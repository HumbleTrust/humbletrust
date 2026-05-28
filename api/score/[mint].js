"use strict";

/**
 * HumbleTrust TrustScore API  –  /api/score/:mint
 *
 * Works for any Solana token (mainnet / devnet / pump.fun / Raydium / etc).
 * Returns a structured 0-100 score with category breakdowns, per-signal
 * explanations, actionable flags, and raw on-chain data.
 *
 * Categories (total 100 pts):
 *   supply_control  40  –  mint/freeze authority
 *   liquidity       25  –  LP burned, pool exists
 *   distribution    20  –  creator holdings, top-holder concentration
 *   legitimacy      15  –  metadata, update authority, creator DB record
 *
 * Query params:
 *   ?format=badge    – returns SVG badge image (cached 5 min)
 *   ?view=history    – returns score trend over time
 *   ?nocache=1       – bypass all caches, force recompute
 */

const { createHash } = require("crypto");
const { getClient }       = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");
const { getTrustLevel } = require("../_lib/trust");

// ── RPC endpoints ─────────────────────────────────────────────────────────────
const MAINNET = process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com";
const DEVNET  = process.env.SOLANA_RPC          || "https://api.devnet.solana.com";

// ── Well-known addresses ──────────────────────────────────────────────────────
const PUMP_FUN_PROGRAM   = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMP_FUN_MIGRATION = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";
const TOKEN_PROGRAM      = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022         = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const METAPLEX           = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const RAYDIUM_CPMM       = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const RAYDIUM_AMM        = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA_WHIRLPOOL     = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const METEORA_DLMM       = "LBUZKhRxPF3XUpBCjp4YzTKgLLjgGSFTKZqCoNaKXd";
const BURN_ADDRESS       = "1nc1nerator11111111111111111111111111111111";
const NULL_ADDR          = "11111111111111111111111111111111";

const KNOWN_PROGRAMS = new Set([
  PUMP_FUN_PROGRAM, PUMP_FUN_MIGRATION,
  TOKEN_PROGRAM, TOKEN_2022,
  RAYDIUM_CPMM, RAYDIUM_AMM, ORCA_WHIRLPOOL, METEORA_DLMM,
  METAPLEX, BURN_ADDRESS, NULL_ADDR,
]);

const DEX_PROGRAMS = {
  [RAYDIUM_CPMM]:     "raydium_cpmm",
  [RAYDIUM_AMM]:      "raydium_amm",
  [ORCA_WHIRLPOOL]:   "orca_whirlpool",
  [METEORA_DLMM]:     "meteora_dlmm",
  [PUMP_FUN_PROGRAM]: "pump_fun",
  [PUMP_FUN_MIGRATION]: "pump_fun",
};

// ════════════════════════════════════════════════════════════════════════════
// L1 in-process memory cache  (0 ms, per warm container)
// ════════════════════════════════════════════════════════════════════════════

const L1 = new Map(); // mint → { data, exp }
const L1_TTL = 30_000; // 30 s

function l1get(key) {
  const e = L1.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { L1.delete(key); return null; }
  return e.data;
}

function l1set(key, data, ttl = L1_TTL) {
  if (L1.size > 500) {
    const sorted = [...L1.entries()].sort((a, b) => a[1].exp - b[1].exp);
    sorted.slice(0, 100).forEach(([k]) => L1.delete(k));
  }
  L1.set(key, { data, exp: Date.now() + ttl });
}

// ════════════════════════════════════════════════════════════════════════════
// Base58 encode / decode
// ════════════════════════════════════════════════════════════════════════════

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58Decode(str) {
  if (!str) return null;
  const bytes = [0];
  for (const c of str) {
    const d = B58.indexOf(c);
    if (d < 0) return null;
    let carry = d;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 255;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 255); carry >>= 8; }
  }
  const leading = (str.match(/^1+/) || [""])[0].length;
  const out = new Uint8Array(leading + bytes.length);
  bytes.reverse().forEach((b, i) => { out[leading + i] = b; });
  return Buffer.from(out);
}

function b58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  const leading = Array.from(bytes).findIndex(b => b !== 0);
  return "1".repeat(leading < 0 ? bytes.length : leading) + s;
}

// ════════════════════════════════════════════════════════════════════════════
// Ed25519 off-curve check  (needed for PDA derivation)
// ════════════════════════════════════════════════════════════════════════════

function isOnEd25519Curve(bytes) {
  try {
    const P = (1n << 255n) - 19n;
    const D = -4513249062541557337682894930092624173785641285191125241628941591882900924598840740n;
    const mod = a => ((a % P) + P) % P;
    const pow = (a, e) => {
      let r = 1n; a = mod(a);
      for (; e > 0n; e >>= 1n) { if (e & 1n) r = mod(r * a); a = mod(a * a); }
      return r;
    };

    const buf  = Buffer.from(bytes);
    const sign = (buf[31] >> 7) & 1;
    buf[31]   &= 0x7f;
    let y = 0n;
    for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(buf[i]);
    if (y >= P) return false;

    const y2 = mod(y * y);
    const u  = mod(y2 - 1n);
    const v  = mod(D * y2 + 1n);
    const v3 = mod(v * v * v);
    const v7 = mod(v3 * v3 * v);
    let x    = mod(u * v3 * pow(mod(u * v7), (P - 5n) / 8n));
    const vx2 = mod(v * x * x);

    if (vx2 === mod(-u))       x = mod(x * pow(2n, (P - 1n) / 4n));
    else if (vx2 !== u)        return false;
    if ((sign === 1) !== ((x & 1n) === 1n)) x = mod(-x);
    if (x === 0n && sign === 1) return false;
    return true;
  } catch {
    return false;
  }
}

// Returns true if address is a real Ed25519 wallet (on-curve).
// Returns false for PDAs (off-curve by design) — bonding curves, AMM vaults, etc.
function isWalletAddress(addr) {
  if (!addr || typeof addr !== "string") return false;
  const bytes = b58Decode(addr);
  return bytes ? isOnEd25519Curve(bytes) : false;
}

// ════════════════════════════════════════════════════════════════════════════
// PDA derivation
// ════════════════════════════════════════════════════════════════════════════

function derivePda(seeds, programId) {
  const prog = b58Decode(programId);
  if (!prog) return null;
  for (let nonce = 255; nonce >= 0; nonce--) {
    const data = Buffer.concat([
      ...seeds.map(s => (typeof s === "string" ? Buffer.from(s, "utf8") : s)),
      Buffer.from([nonce]),
      prog,
      Buffer.from("ProgramDerivedAddress"),
    ]);
    const hash = createHash("sha256").update(data).digest();
    if (!isOnEd25519Curve(hash)) return b58Encode(hash);
  }
  return null;
}

function metadataPda(mint) {
  const prog = b58Decode(METAPLEX);
  const mintBytes = b58Decode(mint);
  if (!prog || !mintBytes) return null;
  return derivePda([Buffer.from("metadata"), prog, mintBytes], METAPLEX);
}

// ════════════════════════════════════════════════════════════════════════════
// Solana JSON-RPC helpers
// ════════════════════════════════════════════════════════════════════════════

let _id = 0;
async function rpcCall(endpoint, method, params = [], timeout = 4000) {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++_id, method, params }),
      signal: AbortSignal.timeout(timeout),
    });
    const d = await r.json();
    return d?.result ?? null;
  } catch {
    return null;
  }
}

async function fetchMintInfo(mint, ep) {
  const r = await rpcCall(ep, "getAccountInfo", [mint, { encoding: "jsonParsed" }]);
  return r?.value?.data?.parsed?.info || null;
}

async function fetchRawAccount(addr, ep) {
  const r = await rpcCall(ep, "getAccountInfo", [addr, { encoding: "base64" }]);
  const d = r?.value?.data;
  if (!d || !d[0]) return null;
  return Buffer.from(d[0], "base64");
}

async function fetchLargestAccounts(mint, ep) {
  const r = await rpcCall(ep, "getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  return r?.value || [];
}

async function fetchTokenAccountOwner(tokenAcc, ep) {
  const r = await rpcCall(ep, "getAccountInfo", [tokenAcc, { encoding: "jsonParsed" }]);
  return r?.value?.data?.parsed?.info?.owner || null;
}

async function fetchTokenCreator(mint, ep) {
  try {
    let before;
    let oldest = null;
    for (let page = 0; page < 2; page++) {
      const sigs = await rpcCall(ep, "getSignaturesForAddress",
        [mint, { limit: 1000, ...(before ? { before } : {}) }], 3000);
      if (!sigs?.length) break;
      oldest = sigs[sigs.length - 1];
      if (sigs.length < 1000) break;
      before = sigs[sigs.length - 1].signature;
    }
    if (!oldest?.signature) return null;

    const tx = await rpcCall(ep, "getTransaction", [oldest.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 3000);
    const keys = tx?.transaction?.message?.accountKeys
              || tx?.transaction?.message?.staticAccountKeys || [];
    const signer = keys.find(k => typeof k === "object" && k.signer && k.writable);
    return signer?.pubkey || (typeof keys[0] === "string" ? keys[0] : keys[0]?.pubkey) || null;
  } catch {
    return null;
  }
}

async function fetchCreatorBalance(creator, mint, ep) {
  const r = await rpcCall(ep, "getTokenAccountsByOwner",
    [creator, { mint }, { encoding: "jsonParsed" }], 5000);
  return (r?.value || []).reduce((s, a) => {
    const n = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
    return s + (n ? BigInt(n) : 0n);
  }, 0n);
}

// ════════════════════════════════════════════════════════════════════════════
// Metaplex token metadata parser
// ════════════════════════════════════════════════════════════════════════════

function parseMetaplexMetadata(raw) {
  if (!raw || raw.length < 100) return null;
  try {
    const updateAuthority = b58Encode(raw.slice(1, 33));
    const mintAddress     = b58Encode(raw.slice(33, 65));

    let o = 65;
    const readString = () => {
      if (o + 4 > raw.length) throw new Error("eof");
      const len = raw.readUInt32LE(o); o += 4;
      if (len > 200 || o + len > raw.length) throw new Error("bad_len");
      const s = raw.slice(o, o + len).toString("utf8").replace(/\0/g, "").trim();
      o += len;
      return s;
    };

    const name   = readString();
    const symbol = readString();
    const uri    = readString();

    o += 2; // seller_fee_basis_points (u16)

    if (o + 1 > raw.length) return { updateAuthority, mintAddress, name, symbol, uri, isMutable: null };
    const hasCreators = raw[o++];
    if (hasCreators) {
      if (o + 4 > raw.length) return { updateAuthority, mintAddress, name, symbol, uri, isMutable: null };
      const cnt = raw.readUInt32LE(o); o += 4 + cnt * 34;
    }

    if (o + 2 > raw.length) return { updateAuthority, mintAddress, name, symbol, uri, isMutable: null };
    o += 1;
    const isMutable = raw[o] === 1;

    return { updateAuthority, mintAddress, name, symbol, uri, isMutable };
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Platform detection via recent transactions
// ════════════════════════════════════════════════════════════════════════════

async function detectPlatform(mint, mintAuthority, ep) {
  if (mintAuthority === PUMP_FUN_PROGRAM)   return "pump_fun";
  if (mintAuthority === PUMP_FUN_MIGRATION) return "pump_fun_graduated";

  const sigs = await rpcCall(ep, "getSignaturesForAddress", [mint, { limit: 10 }], 4000);
  if (!sigs?.length) return "unknown";

  const tx = await rpcCall(ep, "getTransaction",
    [sigs[0].signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], 4000);
  const keys = tx?.transaction?.message?.accountKeys
            || tx?.transaction?.message?.staticAccountKeys || [];
  for (const k of keys) {
    const addr = typeof k === "string" ? k : k?.pubkey;
    if (addr && DEX_PROGRAMS[addr]) return DEX_PROGRAMS[addr];
  }

  if (mintAuthority && !KNOWN_PROGRAMS.has(mintAuthority) && mintAuthority.length >= 43) {
    return "pump_fun_likely";
  }
  return "unknown";
}

// ════════════════════════════════════════════════════════════════════════════
// Core scoring engine
// ════════════════════════════════════════════════════════════════════════════

const MAX = {
  supply_control: 40,
  liquidity:      25,
  distribution:   20,
  legitimacy:     15,
};

async function computeScore(mint, mintInfo, ep, db) {
  const totalSupply = BigInt(mintInfo?.supply || 0);
  const signals   = [];
  const flags     = [];
  let onchain     = {};

  const metaPda   = metadataPda(mint);
  const [holders, metaRaw] = await Promise.all([
    fetchLargestAccounts(mint, ep),
    metaPda ? fetchRawAccount(metaPda, ep) : Promise.resolve(null),
  ]);

  const meta = metaRaw ? parseMetaplexMetadata(metaRaw) : null;

  let owners = [];
  if (holders.length > 0) {
    owners = await Promise.all(holders.slice(0, 5).map(h => fetchTokenAccountOwner(h.address, ep)));
  }

  let creator = null;
  if (mintInfo?.mintAuthority
      && !KNOWN_PROGRAMS.has(mintInfo.mintAuthority)
      && isWalletAddress(mintInfo.mintAuthority)) {
    // Mint authority is a real wallet — that wallet is the creator
    creator = mintInfo.mintAuthority;
  } else if (meta?.updateAuthority
             && !KNOWN_PROGRAMS.has(meta.updateAuthority)
             && meta.updateAuthority !== NULL_ADDR
             && meta.updateAuthority !== BURN_ADDRESS) {
    // Metadata update authority (works for graduated tokens & most others)
    creator = meta.updateAuthority;
  } else if (mintInfo?.mintAuthority !== PUMP_FUN_PROGRAM
             && mintInfo?.mintAuthority !== PUMP_FUN_MIGRATION) {
    // PDA mint authority (bonding curve) or null — fall back to tx history
    creator = await fetchTokenCreator(mint, ep);
  }

  let creatorBalance = 0n;
  if (creator && totalSupply > 0n) {
    creatorBalance = await fetchCreatorBalance(creator, mint, ep);
  }

  // ── A: SUPPLY CONTROL (40 pts) ─────────────────────────────────────────────

  if (!mintInfo?.mintAuthority) {
    signals.push({ id: "mint_authority_revoked", category: "supply_control",
      earned: 25, max: 25, ok: true,
      label: "Mint authority revoked",
      detail: "No new tokens can ever be created — supply is fixed forever" });
  } else {
    signals.push({ id: "mint_authority_active", category: "supply_control",
      earned: 0, max: 25, ok: false,
      label: `Mint authority active (${mintInfo.mintAuthority.slice(0,8)}…)`,
      detail: "Token creator can print unlimited new tokens and dilute holders" });
    flags.push({ type: "mint_authority_active", severity: "critical",
      msg: "Mint authority not revoked — creator can inflate supply at any time" });
  }

  if (!mintInfo?.freezeAuthority) {
    signals.push({ id: "freeze_authority_revoked", category: "supply_control",
      earned: 15, max: 15, ok: true,
      label: "Freeze authority revoked",
      detail: "No wallet holding this token can be frozen" });
  } else {
    signals.push({ id: "freeze_authority_active", category: "supply_control",
      earned: 0, max: 15, ok: false,
      label: `Freeze authority active (${mintInfo.freezeAuthority.slice(0,8)}…)`,
      detail: "Creator can freeze any wallet that holds this token" });
    flags.push({ type: "freeze_authority_active", severity: "high",
      msg: "Freeze authority not revoked — wallet freezes possible" });
  }

  onchain.mint_authority   = mintInfo?.mintAuthority   || null;
  onchain.freeze_authority = mintInfo?.freezeAuthority || null;

  // ── B: LIQUIDITY (25 pts) ──────────────────────────────────────────────────

  let lpBurned = false;
  let hasPool  = false;
  const holderData = holders.slice(0, 5).map((h, i) => ({
    token_account: h.address,
    owner: owners[i] || null,
    amount: h.amount,
    pct: totalSupply > 0n
      ? (Number(BigInt(h.amount)) / Number(totalSupply)) * 100
      : 0,
  }));

  for (const h of holderData) {
    if (!h.owner) continue;
    if (h.owner === BURN_ADDRESS || h.owner === NULL_ADDR) lpBurned = true;
    if (KNOWN_PROGRAMS.has(h.owner) && h.owner !== TOKEN_PROGRAM && h.owner !== TOKEN_2022) hasPool = true;
    // PDA owner with >10% = bonding curve / AMM vault → treat as a liquidity pool
    if (!KNOWN_PROGRAMS.has(h.owner) && h.pct > 10 && !isWalletAddress(h.owner)) hasPool = true;
  }

  if (lpBurned) {
    signals.push({ id: "lp_burned", category: "liquidity",
      earned: 20, max: 20, ok: true,
      label: "LP tokens burned",
      detail: "Liquidity pool tokens sent to burn address — liquidity is permanent" });
  } else if (!hasPool && holderData.length === 0) {
    signals.push({ id: "lp_unknown", category: "liquidity",
      earned: 0, max: 20, ok: null,
      label: "No liquidity data",
      detail: "No holder or pool information available" });
  } else {
    signals.push({ id: "lp_not_burned", category: "liquidity",
      earned: 0, max: 20, ok: false,
      label: "LP tokens not burned",
      detail: "Liquidity can be removed — rug pull possible" });
    if (holderData.length > 0) {
      flags.push({ type: "lp_not_burned", severity: "high",
        msg: "LP tokens are not burned — liquidity can be removed by the creator" });
    }
  }

  if (hasPool || lpBurned) {
    signals.push({ id: "has_liquidity_pool", category: "liquidity",
      earned: 5, max: 5, ok: true,
      label: "Liquidity pool found",
      detail: "Token has an active DEX liquidity pool" });
  } else {
    signals.push({ id: "no_liquidity_pool", category: "liquidity",
      earned: 0, max: 5, ok: null,
      label: "No liquidity pool detected",
      detail: "Token may not yet be tradeable on a DEX" });
  }

  onchain.top_holders = holderData;

  // ── C: DISTRIBUTION (20 pts) ───────────────────────────────────────────────

  let creatorPct = null;
  if (creator && totalSupply > 0n) {
    creatorPct = (Number(creatorBalance) / Number(totalSupply)) * 100;
    let earned = 0;
    let detail = "";
    if (creatorPct < 2) {
      earned = 10; detail = `Creator holds only ${creatorPct.toFixed(2)}% — sold/distributed, low dump risk`;
    } else if (creatorPct < 10) {
      earned = 7; detail = `Creator holds ${creatorPct.toFixed(2)}% — moderate position`;
    } else if (creatorPct < 25) {
      earned = 3; detail = `Creator holds ${creatorPct.toFixed(2)}% — notable position, some dump risk`;
      flags.push({ type: "creator_large_holdings", severity: "medium",
        msg: `Creator holds ${creatorPct.toFixed(1)}% of supply` });
    } else {
      earned = 0; detail = `Creator holds ${creatorPct.toFixed(2)}% — very high dump risk`;
      flags.push({ type: "creator_whale", severity: "critical",
        msg: `Creator holds ${creatorPct.toFixed(1)}% of supply — extreme dump risk` });
    }
    const penalty = creatorPct >= 50 ? -5 : (creatorPct >= 30 ? -3 : 0);
    signals.push({ id: "creator_holdings", category: "distribution",
      earned: Math.max(0, earned + penalty), max: 10, ok: earned >= 7,
      label: `Creator holds ${creatorPct.toFixed(2)}%`,
      detail,
      creator_wallet:  creator,
      creator_balance: creatorBalance.toString(),
    });
  } else {
    signals.push({ id: "creator_holdings", category: "distribution",
      earned: 0, max: 10, ok: null,
      label: creator ? "Creator balance unavailable" : "Creator not identified",
      detail: creator ? "Could not fetch creator token balance" : "Creation transaction not found",
      creator_wallet: creator || null,
    });
  }

  const nonSpecial = holderData.filter(h =>
    h.owner !== BURN_ADDRESS && h.owner !== NULL_ADDR
    && !KNOWN_PROGRAMS.has(h.owner)
    && isWalletAddress(h.owner) // Exclude PDA vaults (bonding curves, AMM pools) from distribution
  );
  if (nonSpecial.length > 0) {
    const topPct = nonSpecial[0].pct;
    let earned = 0;
    let label  = "";
    if (topPct < 5) {
      earned = 10; label = `Well distributed — top holder ${topPct.toFixed(1)}%`;
    } else if (topPct < 15) {
      earned = 7;  label = `Top holder ${topPct.toFixed(1)}%`;
    } else if (topPct < 30) {
      earned = 4;  label = `Top holder ${topPct.toFixed(1)}% — moderate concentration`;
    } else if (topPct < 50) {
      earned = 1;  label = `Top holder ${topPct.toFixed(1)}% — high concentration`;
      flags.push({ type: "high_concentration", severity: "medium",
        msg: `Single wallet holds ${topPct.toFixed(1)}% of circulating supply` });
    } else {
      earned = 0;  label = `Top holder ${topPct.toFixed(1)}% — dangerous concentration`;
      flags.push({ type: "extreme_concentration", severity: "high",
        msg: `Single wallet controls ${topPct.toFixed(1)}% of supply — dump risk` });
    }
    signals.push({ id: "holder_concentration", category: "distribution",
      earned, max: 10, ok: earned >= 7, label,
      detail: `Top ${Math.min(5, nonSpecial.length)} non-LP holders analyzed`,
      top_holder_pct: topPct,
    });
  } else if (holderData.length > 0) {
    // All top holders are recognized as protocol vaults (DEX pools, bonding curves) — that's good
    signals.push({ id: "holder_concentration", category: "distribution",
      earned: 10, max: 10, ok: true,
      label: "Tokens distributed in DEX pools",
      detail: "No single-wallet whale detected — liquidity spread across DEX vaults",
    });
  } else {
    signals.push({ id: "holder_concentration", category: "distribution",
      earned: 0, max: 10, ok: null,
      label: "No holder data available",
      detail: "Could not fetch top holders from chain",
    });
  }

  onchain.creator         = creator;
  onchain.creator_balance = creatorBalance.toString();
  onchain.creator_pct     = creatorPct !== null ? Number(creatorPct.toFixed(4)) : null;

  // ── D: LEGITIMACY (15 pts) ─────────────────────────────────────────────────

  if (meta) {
    signals.push({ id: "has_metadata", category: "legitimacy",
      earned: 5, max: 5, ok: true,
      label: `Metadata: ${meta.name || "?"} (${meta.symbol || "?"})`,
      detail: meta.uri ? `URI: ${meta.uri.slice(0, 60)}` : "No off-chain URI" });
    onchain.metadata = {
      pda:              metaPda,
      name:             meta.name,
      symbol:           meta.symbol,
      uri:              meta.uri,
      update_authority: meta.updateAuthority,
      is_mutable:       meta.isMutable,
    };
  } else {
    signals.push({ id: "no_metadata", category: "legitimacy",
      earned: 0, max: 5, ok: false,
      label: "No on-chain Metaplex metadata",
      detail: "Token has no Metaplex metadata — common in low-effort launches" });
    flags.push({ type: "no_metadata", severity: "low",
      msg: "No Metaplex metadata found — token name/symbol not verifiable on-chain" });
    onchain.metadata = null;
  }

  if (meta) {
    const updateAuth = meta.updateAuthority;
    const isRevoked  = !updateAuth || updateAuth === NULL_ADDR || meta.isMutable === false;
    if (isRevoked) {
      signals.push({ id: "metadata_immutable", category: "legitimacy",
        earned: 5, max: 5, ok: true,
        label: "Metadata immutable",
        detail: "Token name, symbol, and image cannot be changed" });
    } else {
      signals.push({ id: "metadata_mutable", category: "legitimacy",
        earned: 0, max: 5, ok: false,
        label: `Metadata mutable (update auth: ${updateAuth?.slice(0,8)}…)`,
        detail: "Token creator can change name, symbol, and logo at any time" });
      flags.push({ type: "metadata_mutable", severity: "medium",
        msg: "Metadata is mutable — creator can rename the token or swap the logo" });
    }
  } else {
    signals.push({ id: "metadata_immutable", category: "legitimacy",
      earned: 0, max: 5, ok: null,
      label: "Metadata state unknown (no metadata account)",
      detail: "Cannot verify immutability without metadata" });
  }

  if (creator) {
    try {
      const { data: launches } = await db
        .from("tokens")
        .select("mint, trust_score, status, verified_issuer")
        .eq("creator", creator);

      if (launches?.length) {
        const isVerified = launches.some(t => t.verified_issuer);
        const avgScore   = Math.round(launches.reduce((s, t) => s + (t.trust_score || 0), 0) / launches.length);
        const graduated  = launches.filter(t => t.status === "migrated").length;
        const earned     = isVerified || avgScore >= 70 ? 5 : avgScore >= 40 ? 2 : 0;
        signals.push({ id: "creator_track_record", category: "legitimacy",
          earned, max: 5, ok: earned > 0,
          label: `${launches.length} HumbleTrust launch(es), avg score ${avgScore}${isVerified ? " — Verified Issuer ✓" : ""}`,
          detail: `${graduated} graduated to Raydium`,
          creator_launches:  launches.length,
          creator_avg_score: avgScore,
          creator_verified:  isVerified,
        });
        if (avgScore < 40 && launches.length > 0) {
          flags.push({ type: "creator_low_record", severity: "low",
            msg: `Creator's previous HumbleTrust launches averaged ${avgScore}/100` });
        }
      } else {
        signals.push({ id: "creator_track_record", category: "legitimacy",
          earned: 0, max: 5, ok: null,
          label: "No HumbleTrust history for this creator",
          detail: "Creator has not launched tokens on HumbleTrust" });
      }
    } catch {
      signals.push({ id: "creator_track_record", category: "legitimacy",
        earned: 0, max: 5, ok: null, label: "DB lookup failed", detail: "" });
    }
  } else {
    signals.push({ id: "creator_track_record", category: "legitimacy",
      earned: 0, max: 5, ok: null,
      label: "Creator unknown — track record unavailable",
      detail: "Could not identify creator wallet" });
  }

  // ── Assemble result ────────────────────────────────────────────────────────

  const byCategory = (cat) => signals.filter(s => s.category === cat);
  const earnedCat  = (cat) => Math.max(0, byCategory(cat).reduce((s, sig) => s + sig.earned, 0));

  const categories = {
    supply_control: { earned: earnedCat("supply_control"), max: MAX.supply_control },
    liquidity:      { earned: earnedCat("liquidity"),      max: MAX.liquidity      },
    distribution:   { earned: earnedCat("distribution"),   max: MAX.distribution   },
    legitimacy:     { earned: earnedCat("legitimacy"),     max: MAX.legitimacy     },
  };

  const rawScore = Object.values(categories).reduce((s, c) => s + c.earned, 0);
  const score    = Math.max(0, Math.min(100, Math.round(rawScore)));

  return { score, categories, signals, flags, onchain, creator };
}

// ════════════════════════════════════════════════════════════════════════════
// Trust level helpers
// ════════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS      = 2 * 60 * 60 * 1000; // 2 h Supabase cache
const HISTORY_MIN_DELTA = 3;                   // min score delta to write new history row

// ════════════════════════════════════════════════════════════════════════════
// Feature: SVG Score Badge  (?format=badge)
// ════════════════════════════════════════════════════════════════════════════

const BADGE_COLORS = {
  ELITE:  { bg: "#00d4aa", text: "#003d30" },
  STRONG: { bg: "#00b894", text: "#003d30" },
  OK:     { bg: "#fdcb6e", text: "#5c4500" },
  WEAK:   { bg: "#e17055", text: "#fff"    },
  DANGER: { bg: "#d63031", text: "#fff"    },
};

function buildBadge(score, trust_level, tokenName) {
  const c     = BADGE_COLORS[trust_level] || { bg: "#888", text: "#fff" };
  const label = "HumbleTrust";
  const value = `${trust_level}  ${score}`;
  const title = `HumbleTrust TrustScore: ${trust_level} ${score}/100${tokenName ? ` — ${tokenName}` : ""}`;

  // ~6.5 px per char at font-size 11, + 20 px horizontal padding
  const lw = Math.ceil(label.length * 6.5 + 20);
  const vw = Math.ceil(value.length * 6.5 + 20);
  const W  = lw + vw;
  const H  = 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="${label}: ${score}">
<title>${title}</title>
<defs>
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0"  stop-color="#eee" stop-opacity=".2"/>
    <stop offset="1"  stop-opacity=".1"/>
  </linearGradient>
  <mask id="m"><rect width="${W}" height="${H}" rx="4" fill="#fff"/></mask>
</defs>
<g mask="url(#m)">
  <rect width="${lw}" height="${H}" fill="#444"/>
  <rect x="${lw}" width="${vw}" height="${H}" fill="${c.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</g>
<g font-family="DejaVu Sans,Verdana,Geneva,Lucida,sans-serif" font-size="11" text-anchor="middle">
  <text x="${lw / 2}" y="14" fill="#010101" fill-opacity=".35">${label}</text>
  <text x="${lw / 2}" y="13" fill="#fff">${label}</text>
  <text x="${lw + vw / 2}" y="14" fill="#010101" fill-opacity=".35" font-weight="bold">${value}</text>
  <text x="${lw + vw / 2}" y="13" fill="${c.text}" font-weight="bold">${value}</text>
</g>
</svg>`;
}

// ════════════════════════════════════════════════════════════════════════════
// Feature: Rug Risk Assessment
// ════════════════════════════════════════════════════════════════════════════

function computeRugRisk(flags = []) {
  const WEIGHTS = {
    mint_authority_active:   40,
    creator_whale:           30,
    freeze_authority_active: 25,
    lp_not_burned:           20,
    extreme_concentration:   20,
    creator_large_holdings:  10,
    high_concentration:       8,
    metadata_mutable:         5,
    no_metadata:              5,
    creator_low_record:       3,
  };
  let riskScore = 0;
  for (const f of flags) riskScore += WEIGHTS[f.type] || 0;
  riskScore = Math.min(100, riskScore);
  const rug_risk =
    riskScore >= 75 ? "CRITICAL" :
    riskScore >= 50 ? "HIGH"     :
    riskScore >= 25 ? "MEDIUM"   : "LOW";
  return { rug_risk, rug_risk_score: riskScore, rug_indicators: flags };
}

// ════════════════════════════════════════════════════════════════════════════
// Feature: Score History  (?view=history)
// ════════════════════════════════════════════════════════════════════════════

async function handleHistory(req, res, mint, db) {
  const limit = Math.min(parseInt(req.query.limit) || 30, 90);

  const { data: rows } = await db
    .from("score_history")
    .select("score, trust_level, computed_at")
    .eq("mint", mint)
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (!rows?.length) {
    const { data: cached } = await db
      .from("token_score_cache")
      .select("score, trust_level, computed_at")
      .eq("mint", mint)
      .single();
    return res.json({
      mint,
      history: cached
        ? [{ score: cached.score, trust_level: cached.trust_level, computed_at: cached.computed_at }]
        : [],
      trend:         "stable",
      delta_7d:      null,
      current_score: cached?.score || null,
      periods:       cached ? 1 : 0,
      note: "Score history tracking started. Trend data will accumulate over time.",
    });
  }

  const latest       = rows[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const row7d        = rows.find(r => r.computed_at <= sevenDaysAgo);
  const delta7d      = row7d ? latest.score - row7d.score : null;
  const trend        = delta7d === null ? "stable" : delta7d > 5 ? "up" : delta7d < -5 ? "down" : "stable";

  return res.json({
    mint,
    history: rows.map(r => ({ score: r.score, trust_level: r.trust_level, computed_at: r.computed_at })),
    trend,
    delta_7d:            delta7d,
    current_score:       latest.score,
    current_trust_level: latest.trust_level,
    periods:             rows.length,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// HTTP handler
// ════════════════════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  // Hard 9-second guard: if computation stalls, return a 503 before Vercel kills the fn
  const _guard = setTimeout(() => {
    if (!res.headersSent) {
      const { mint } = req.query || {};
      console.error("[api/score] guard timeout", mint);
      res.status(503).json({
        error: "Score computation timed out",
        hint: "Token has extensive on-chain history. Retry in a few seconds — result will be cached.",
        mint: mint || null,
      });
    }
  }, 9000);

  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") { clearTimeout(_guard); return res.status(204).end(); }
  if (req.method !== "GET")     { clearTimeout(_guard); return res.status(405).json({ error: "Method not allowed" }); }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    clearTimeout(_guard);
    return res.status(503).json({ error: "Service unavailable" });
  }

  const { mint, nocache, format, view } = req.query;
  if (!mint)                { clearTimeout(_guard); return res.status(400).json({ error: "mint required" }); }
  if (!isValidWallet(mint)) { clearTimeout(_guard); return res.status(400).json({ error: "invalid mint address" }); }

  const db = getClient();

  // ── Route: score history ───────────────────────────────────────────────────
  if (view === "history") {
    return handleHistory(req, res, mint, db)
      .then(r => { clearTimeout(_guard); return r; })
      .catch(e => {
        clearTimeout(_guard);
        console.error("[api/score history]", e.message);
        return res.status(500).json({ error: "Internal server error" });
      });
  }

  const isBadge = format === "badge";

  try {
    // ── L1 memory cache (warm container, 30 s) ────────────────────────────────
    let scoreData = nocache ? null : l1get(mint);

    // ── Native HumbleTrust token ──────────────────────────────────────────────
    if (!scoreData) {
      const { data: token } = await db.from("tokens").select("*").eq("mint", mint).single();

      if (token) {
        const score       = token.trust_score || token.launch_score || 0;
        const mintInfo    = await fetchMintInfo(mint, DEVNET);
        const trust_level = getTrustLevel(score);
        scoreData = {
          score, trust_level,
          source:   "humbletrust",
          network:  "devnet",
          platform: "humbletrust",
          token: {
            name:                  token.name,
            symbol:                token.symbol,
            creator:               token.creator,
            status:                token.status,
            logo_uri:              token.logo_uri,
            description:           token.description,
            website:               token.website,
            twitter:               token.twitter,
            telegram:              token.telegram,
            created_at:            token.created_at,
            raydium_pool:          token.raydium_pool,
            certificate_mint:      token.certificate_mint,
            verified_issuer:       token.verified_issuer || false,
            verified_issuer_level: token.verified_issuer_level || 0,
          },
          categories: null, signals: null, flags: [],
          onchain: mintInfo ? {
            mint_authority:   mintInfo.mintAuthority   || null,
            freeze_authority: mintInfo.freezeAuthority || null,
            supply:           mintInfo.supply,
            decimals:         mintInfo.decimals,
          } : null,
          _nativeToken: true,
        };
        l1set(mint, scoreData);
      }
    }

    // ── L2 Supabase cache (external tokens, 2 h TTL) ──────────────────────────
    if (!scoreData && !nocache) {
      const { data: cached } = await db
        .from("token_score_cache")
        .select("*")
        .eq("mint", mint)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        const d = cached.score_components || {};
        scoreData = {
          score:       cached.score,
          trust_level: cached.trust_level,
          source:      "external_cached",
          network:     d.network   || "unknown",
          platform:    d.platform  || "unknown",
          token:       d.token     || null,
          categories:  d.categories || null,
          signals:     d.signals   || [],
          flags:       d.flags     || [],
          onchain:     d.onchain   || null,
          _cachedAt:   cached.computed_at,
          _expiresAt:  cached.expires_at,
        };
        l1set(mint, scoreData);
      }
    }

    // ── Badge fast-path: score from cache → return SVG without full compute ───
    if (isBadge && scoreData) {
      const tokenName = scoreData.token?.name || scoreData.token?.symbol || null;
      clearTimeout(_guard);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      return res.send(buildBadge(scoreData.score, scoreData.trust_level, tokenName));
    }

    // ── L3 Full on-chain computation ──────────────────────────────────────────
    if (!scoreData) {
      let mintInfo = await fetchMintInfo(mint, MAINNET);
      let ep       = MAINNET;
      let network  = "mainnet-beta";

      if (!mintInfo) {
        mintInfo = await fetchMintInfo(mint, DEVNET);
        ep       = DEVNET;
        network  = mintInfo ? "devnet" : "unknown";
      }
      if (!mintInfo) {
        clearTimeout(_guard);
        return res.status(404).json({ error: "Mint account not found on mainnet or devnet", mint });
      }

      const [platform, computed] = await Promise.all([
        detectPlatform(mint, mintInfo.mintAuthority, ep),
        computeScore(mint, mintInfo, ep, db),
      ]);

      const { score, categories, signals, flags, onchain, creator } = computed;
      const metaParsed  = onchain.metadata;
      const supply      = Number(BigInt(mintInfo.supply || 0));
      const trust_level = getTrustLevel(score);
      const now         = new Date();

      const tokenInfo = {
        name:     metaParsed?.name   || null,
        symbol:   metaParsed?.symbol || null,
        uri:      metaParsed?.uri    || null,
        creator,
        decimals: mintInfo.decimals,
        supply:   mintInfo.supply,
        supply_human: mintInfo.decimals != null && supply > 0
          ? (supply / Math.pow(10, mintInfo.decimals)).toLocaleString("en-US", { maximumFractionDigits: 0 })
          : null,
        network, platform,
      };

      onchain.supply   = mintInfo.supply;
      onchain.decimals = mintInfo.decimals;
      onchain.platform = platform;

      scoreData = {
        score, trust_level,
        source:   "external",
        network,  platform,
        token:    tokenInfo,
        categories, signals, flags, onchain,
        _computedAt: now.toISOString(),
        _expiresAt:  new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
      };

      // L1 + L2 cache (fire-and-forget on DB write)
      l1set(mint, scoreData);
      db.from("token_score_cache").upsert({
        mint, score, trust_level, source: "external",
        score_components: { categories, signals, flags, onchain, token: tokenInfo, network, platform },
        computed_at: now.toISOString(),
        expires_at:  scoreData._expiresAt,
      }, { onConflict: "mint" })
        .then(({ error }) => { if (error) console.error("[api/score] cache upsert:", error.message, error.code, mint.slice(0,8)); })
        .catch(e => console.error("[api/score] cache upsert throw:", e.message, mint.slice(0,8)));

      // History: write only if score moved by >= HISTORY_MIN_DELTA points
      db.from("score_history")
        .select("score")
        .eq("mint", mint)
        .order("computed_at", { ascending: false })
        .limit(1)
        .single()
        .then(({ data: last }) => {
          if (!last || Math.abs(last.score - score) >= HISTORY_MIN_DELTA) {
            return db.from("score_history").insert({
              mint, score, trust_level, categories, flags,
              computed_at: now.toISOString(),
            });
          }
        })
        .catch(e => console.error("[api/score] history insert:", e.message, mint.slice(0,8)));
    }

    // ── Badge response (post L3 compute) ──────────────────────────────────────
    if (isBadge) {
      const tokenName = scoreData.token?.name || scoreData.token?.symbol || null;
      clearTimeout(_guard);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      return res.send(buildBadge(scoreData.score, scoreData.trust_level, tokenName));
    }

    // ── JSON response ──────────────────────────────────────────────────────────
    const isNative = scoreData._nativeToken;
    const isCached = scoreData.source === "external_cached";
    const rugRisk  = computeRugRisk(scoreData.flags || []);

    clearTimeout(_guard);
    return res.json({
      mint,
      score:          scoreData.score,
      trust_level:    scoreData.trust_level,
      rug_risk:       rugRisk.rug_risk,
      rug_risk_score: rugRisk.rug_risk_score,
      rug_indicators: rugRisk.rug_indicators,
      source:         scoreData.source,
      network:        scoreData.network,
      platform:       scoreData.platform,
      token:          scoreData.token,
      categories:     scoreData.categories,
      signals:        scoreData.signals,
      flags:          scoreData.flags,
      onchain:        scoreData.onchain,
      ...(isNative ? {} : {
        warning: isCached
          ? "Score from cache — use ?nocache=1 to force recompute"
          : "External token — not in HumbleTrust registry. Score based on on-chain data only.",
        cta: "Launch on HumbleTrust for a full TrustScore with LP lock verification, Certificate NFT, and verified issuer badge.",
      }),
      computed_at:   scoreData._cachedAt  || scoreData._computedAt || new Date().toISOString(),
      cache_expires: scoreData._expiresAt || null,
      badge_url:     `/api/score/${mint}?format=badge`,
      history_url:   `/api/score/${mint}?view=history`,
    });

  } catch (e) {
    clearTimeout(_guard);
    console.error("[api/score]", mint, e.message, e.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
