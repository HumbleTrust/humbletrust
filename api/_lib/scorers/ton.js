"use strict";

const { getTrustLevel } = require('../trust');
const knownTokens = require('../knownTokens.json');

const TONAPI  = "https://tonapi.io/v2";
const DEDUST  = "https://api.dedust.io/v2";
const STON_FI = "https://api.ston.fi/v1";

async function fetchJson(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

// Encode TON address for tonapi.io (EQ/UQ → works as-is)
function encodeAddr(addr) { return encodeURIComponent(addr); }

async function fetchJettonData(address) {
  return fetchJson(`${TONAPI}/jettons/${encodeAddr(address)}`, 6000);
}

async function fetchJettonHolders(address) {
  return fetchJson(`${TONAPI}/jettons/${encodeAddr(address)}/holders?limit=10`, 5000);
}

async function fetchDeDustPool(address) {
  // DeDust /v2/pools returns ALL pools — we need to filter client-side.
  // To keep this fast, use the /v2/jettons/{address} endpoint first,
  // then fall back to checking the first page of pools for the address.
  try {
    // Try DeDust jetton-specific endpoint first
    const jettonInfo = await fetchJson(`${DEDUST}/jettons/${encodeAddr(address)}`, 4000);
    if (jettonInfo && !jettonInfo.error) return { pools: [jettonInfo] };

    // Fallback: fetch pool page and filter (max 200 pools to avoid overload)
    const all = await fetchJson(`${DEDUST}/pools?limit=200`, 4000);
    if (!Array.isArray(all)) return null;
    const addr = address.toLowerCase();
    const matched = all.filter(p =>
      Array.isArray(p.assets) && p.assets.some(a =>
        (a.address || a.jetton_address || "").toLowerCase().includes(addr.split(":").pop() || addr)
      )
    );
    return matched.length > 0 ? { pools: matched } : null;
  } catch { return null; }
}

async function scoreTon(address, knownToken) {
  const signals = [];
  const flags   = [];
  const onchain = {};

  // ── Known token fast path ──────────────────────────────────────────────────
  if (knownToken) {
    const score = Math.min(99, knownToken.baseline_score || 70);
    return {
      score,
      trust_level:  getTrustLevel(score),
      data_quality: "FULL",
      categories:   null,
      signals: [{ id: "known_ton", category: "legitimacy", earned: 5, max: 5, ok: true,
        label: `${knownToken.name} (${knownToken.symbol}) — verified TON token`,
        detail: "Listed in HumbleTrust verified multi-chain registry" }],
      flags:  [],
      onchain: {},
      source: "registry",
    };
  }

  // ── Fetch on-chain data in parallel ───────────────────────────────────────
  const [jetton, holders, dedustPools] = await Promise.all([
    fetchJettonData(address),
    fetchJettonHolders(address),
    fetchDeDustPool(address),
  ]);

  onchain.jetton   = jetton  ? { mintable: jetton.mintable, total_supply: jetton.total_supply, holders_count: jetton.holders_count } : null;
  onchain.metadata = jetton?.metadata || null;

  const MAX = { supply_control: 40, liquidity: 25, distribution: 20, legitimacy: 15 };

  // ── A: SUPPLY CONTROL (40 pts) ─────────────────────────────────────────────
  if (jetton) {
    const mintable = jetton.mintable !== false; // default to true if unknown
    if (!mintable) {
      signals.push({ id: "mint_disabled", category: "supply_control", earned: 25, max: 25, ok: true,
        label: "Minting disabled — supply is fixed forever",
        detail: "Jetton admin cannot create new tokens" });
    } else {
      signals.push({ id: "mint_active", category: "supply_control", earned: 0, max: 25, ok: false,
        label: "Minting still active — admin can create tokens",
        detail: "New tokens can be issued at any time" });
      flags.push({ type: "mint_authority_active", severity: "critical",
        msg: "TON Jetton admin can still mint new tokens — supply is not fixed" });
    }

    // Admin address — null/zero = fully renounced
    const admin = jetton.admin?.address || null;
    const adminZero = !admin || admin === "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
    if (adminZero) {
      signals.push({ id: "admin_revoked", category: "supply_control", earned: 15, max: 15, ok: true,
        label: "Admin address burned — full renouncement",
        detail: "Owner renounced admin rights; contract is immutable" });
    } else {
      signals.push({ id: "admin_active", category: "supply_control", earned: 0, max: 15, ok: false,
        label: `Admin address active (${admin?.slice(0, 10)}…)`,
        detail: "Contract admin can update parameters or transfer ownership" });
      flags.push({ type: "freeze_authority_active", severity: "high",
        msg: `TON Jetton admin is set — contract can be modified (${admin?.slice(0, 12)}…)` });
      onchain.admin_address = admin;
    }
  } else {
    signals.push({ id: "jetton_unavailable", category: "supply_control", earned: -10, max: 40, ok: null,
      label: "Jetton contract data unavailable",
      detail: "Could not fetch mint/admin status — contract may not be a standard Jetton" });
    flags.push({ type: "no_liquidity_data", severity: "high",
      msg: "Could not verify TON Jetton contract — may not be a standard TEP-74 token" });
  }

  // ── B: LIQUIDITY (25 pts) ──────────────────────────────────────────────────
  const pools = Array.isArray(dedustPools) ? dedustPools : (dedustPools?.pools || []);
  if (pools.length > 0) {
    const pool = pools[0];
    const tvl = pool?.total_supply ? Number(pool.total_supply) : null;
    signals.push({ id: "dedust_pool", category: "liquidity", earned: 15, max: 20, ok: true,
      label: `DeDust.io liquidity pool found (${pools.length} pool${pools.length > 1 ? "s" : ""})`,
      detail: tvl ? `Pool TVL data available` : "Pool exists but TVL data unavailable" });
    // Can't easily check LP lock on TON — penalise slightly
    signals.push({ id: "lp_lock_unknown", category: "liquidity", earned: 0, max: 5, ok: null,
      label: "LP lock status unknown (TON)",
      detail: "LP lock verification for TON pools not yet supported" });
  } else {
    signals.push({ id: "ton_lp_unknown", category: "liquidity", earned: -5, max: 25, ok: null,
      label: "No DeDust liquidity pool found",
      detail: "Token may trade on Ston.fi or have no DEX pool yet" });
    flags.push({ type: "no_liquidity_data", severity: "medium",
      msg: "No DeDust.io pool found — liquidity status unverifiable" });
  }

  // ── C: DISTRIBUTION (20 pts) ───────────────────────────────────────────────
  const holderList = holders?.addresses || [];
  const holderCount = jetton?.holders_count || holderList.length || 0;

  if (holderList.length > 0) {
    const topHolder = holderList[0];
    const topPct = topHolder?.balance && jetton?.total_supply
      ? (Number(topHolder.balance) / Number(jetton.total_supply)) * 100
      : null;

    if (holderCount >= 1000) {
      signals.push({ id: "holders_wide", category: "distribution", earned: 10, max: 10, ok: true,
        label: `Well distributed — ${holderCount.toLocaleString()} holders`,
        detail: "Wide holder base indicates organic distribution" });
    } else if (holderCount >= 100) {
      signals.push({ id: "holders_ok", category: "distribution", earned: 6, max: 10, ok: true,
        label: `${holderCount.toLocaleString()} holders`, detail: "Moderate holder distribution" });
    } else {
      signals.push({ id: "holders_low", category: "distribution", earned: 2, max: 10, ok: false,
        label: `Only ${holderCount} holders — low distribution`,
        detail: "Very few holders — high concentration risk" });
      if (holderCount < 20) flags.push({ type: "extreme_concentration", severity: "high",
        msg: `Only ${holderCount} token holders — extreme concentration risk` });
    }

    if (topPct !== null) {
      if (topPct < 5) {
        signals.push({ id: "top_holder_ok", category: "distribution", earned: 10, max: 10, ok: true,
          label: `Top holder ${topPct.toFixed(1)}% — well distributed`, detail: "" });
      } else if (topPct < 20) {
        signals.push({ id: "top_holder_med", category: "distribution", earned: 6, max: 10, ok: true,
          label: `Top holder ${topPct.toFixed(1)}%`, detail: "Moderate top-holder concentration" });
      } else if (topPct < 50) {
        signals.push({ id: "top_holder_high", category: "distribution", earned: 2, max: 10, ok: false,
          label: `Top holder ${topPct.toFixed(1)}% — high concentration`, detail: "" });
        flags.push({ type: "high_concentration", severity: "high",
          msg: `Top holder controls ${topPct.toFixed(1)}% of supply` });
      } else {
        signals.push({ id: "top_holder_whale", category: "distribution", earned: -5, max: 10, ok: false,
          label: `Top holder ${topPct.toFixed(1)}% — whale concentration`, detail: "" });
        flags.push({ type: "extreme_concentration", severity: "critical",
          msg: `Top holder controls ${topPct.toFixed(1)}% — extreme dump risk` });
      }
    }
    onchain.holder_count = holderCount;
  } else {
    signals.push({ id: "ton_holders_unknown", category: "distribution", earned: -3, max: 20, ok: null,
      label: "Holder data unavailable",
      detail: "Could not fetch TON Jetton holder list" });
    flags.push({ type: "no_holder_data", severity: "low",
      msg: "Holder concentration unverifiable for this TON token" });
  }

  // ── D: LEGITIMACY (15 pts) ─────────────────────────────────────────────────
  const meta = jetton?.metadata || null;
  if (meta?.name && meta?.symbol) {
    signals.push({ id: "ton_metadata", category: "legitimacy", earned: 5, max: 5, ok: true,
      label: `Metadata: ${meta.name} (${meta.symbol})`,
      detail: meta.description ? meta.description.slice(0, 80) : "No description" });
    onchain.name   = meta.name;
    onchain.symbol = meta.symbol;
    onchain.image  = meta.image || null;
  } else if (jetton) {
    signals.push({ id: "ton_no_metadata", category: "legitimacy", earned: -8, max: 5, ok: false,
      label: "No Jetton metadata found",
      detail: "Token name/symbol not verifiable — low-effort or anonymous project" });
    flags.push({ type: "no_metadata", severity: "high",
      msg: "TON Jetton has no metadata — token identity unverifiable" });
  } else {
    signals.push({ id: "ton_no_metadata", category: "legitimacy", earned: -10, max: 5, ok: false,
      label: "No metadata — contract unresponsive",
      detail: "Could not verify token identity at all" });
    flags.push({ type: "no_metadata", severity: "critical",
      msg: "No TON Jetton contract or metadata found at this address" });
  }

  // Metadata verification — image is a good signal
  if (meta?.image) {
    signals.push({ id: "has_image", category: "legitimacy", earned: 3, max: 5, ok: true,
      label: "Token image set", detail: meta.image.slice(0, 60) });
  } else {
    signals.push({ id: "no_image", category: "legitimacy", earned: 0, max: 5, ok: null,
      label: "No token image", detail: "No logo URI provided in metadata" });
  }

  // Social / website
  const hasSocial = !!(meta?.social?.twitter || meta?.social?.telegram || meta?.websites?.length);
  signals.push({ id: "ton_social", category: "legitimacy", earned: hasSocial ? 5 : 0, max: 5, ok: hasSocial || null,
    label: hasSocial ? "Social links present" : "No social links in metadata",
    detail: hasSocial ? "Project has public social presence" : "No Twitter/Telegram/website found in metadata" });

  // ── Assemble ───────────────────────────────────────────────────────────────
  const byCategory = (cat) => signals.filter(s => s.category === cat);
  const earnedCat  = (cat) => {
    const raw = byCategory(cat).reduce((s, sig) => s + sig.earned, 0);
    return Math.max(-(MAX[cat] || 100), raw);
  };

  const categories = {
    supply_control: { earned: earnedCat("supply_control"), max: MAX.supply_control },
    liquidity:      { earned: earnedCat("liquidity"),      max: MAX.liquidity      },
    distribution:   { earned: earnedCat("distribution"),   max: MAX.distribution   },
    legitimacy:     { earned: earnedCat("legitimacy"),     max: MAX.legitimacy     },
  };

  const rawScore = Object.values(categories).reduce((s, c) => s + c.earned, 0);

  const nullPts    = signals.filter(s => s.ok === null).reduce((a, s) => a + s.max, 0);
  const totalPts   = signals.reduce((a, s) => a + s.max, 0);
  const knownRatio = totalPts > 0 ? 1 - nullPts / totalPts : 0.5;
  const data_quality =
    knownRatio >= 0.75 ? "FULL"         :
    knownRatio >= 0.55 ? "PARTIAL"      : "INSUFFICIENT";
  const cap = data_quality === "INSUFFICIENT" ? 40 : data_quality === "PARTIAL" ? 58 : 100;
  const score = Math.max(0, Math.min(cap, Math.round(rawScore)));

  return {
    score,
    trust_level: getTrustLevel(score),
    data_quality,
    categories,
    signals,
    flags,
    onchain,
    source: "onchain",
  };
}

module.exports = { scoreTon };
