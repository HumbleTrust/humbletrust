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
const { handleApiAuth, trackUsage } = require("../_lib/apiKey");
const { detectChain }      = require('../_lib/chains/detect');
const { fingerprintToken } = require('../_lib/tokenFingerprint');
const { scoreProtocol }    = require('../_lib/scorers/protocol');
const { scoreEcosystem }   = require('../_lib/scorers/ecosystem');
const { scoreEvm }         = require('../_lib/scorers/evm');
const { scoreBitcoin }     = require('../_lib/scorers/bitcoin');
const { scoreTon }         = require('../_lib/scorers/ton');
const { fetchJupiterPrice, fetchMarketContext } = require('../_lib/enrichers/jupiterPrice');
const { fetchGoPlusToken }  = require('../_lib/enrichers/goplus');
const { fetchRugCheck }     = require('../_lib/enrichers/rugcheck');
const { fetchDexScreener }  = require('../_lib/enrichers/dexscreener');
const { fetchJupiterToken } = require('../_lib/enrichers/jupiterToken');
const knownTokens          = require('../_lib/knownTokens.json');

// ── Category system ──────────────────────────────────────────────────────────
// Categories: l1 | stablecoin | lsd | dao | defi | oracle | ai | gaming |
//             meme | nft | infrastructure | bridge | rwa | unknown

// Meme/gaming tokens have inherently higher risk — cap their max achievable score
const CATEGORY_CAPS = { meme: 78, gaming: 82, nft: 80 };

function applyCategoryCap(score, category) {
  const cap = CATEGORY_CAPS[category];
  return cap !== undefined ? Math.min(score, cap) : score;
}

// Derive category label for unknown Solana tokens from platform detection
function categoryFromPlatform(platform) {
  if (!platform) return 'unknown';
  if (platform.startsWith('pump_fun') || platform === 'pump_fun_likely') return 'meme';
  if (platform === 'raydium_cpmm' || platform === 'raydium_amm') return 'defi';
  if (platform === 'orca_whirlpool') return 'defi';
  if (platform === 'meteora_dlmm')   return 'defi';
  return 'unknown';
}

// Category-specific signals added to response
function categorySignal(category, tokenName) {
  const labels = {
    l1:             { label: 'Layer-1 native asset', detail: 'Core blockchain asset — highest trust tier' },
    stablecoin:     { label: 'Stablecoin', detail: 'Designed to maintain peg to fiat currency' },
    lsd:            { label: 'Liquid staking derivative', detail: 'Staked asset wrapper — backed by validator rewards' },
    dao:            { label: 'DAO / Governance token', detail: 'Grants voting rights in a decentralised protocol' },
    defi:           { label: 'DeFi protocol token', detail: 'Powers a decentralised finance application' },
    oracle:         { label: 'Oracle network token', detail: 'Provides verified real-world data on-chain' },
    ai:             { label: 'AI / Data economy token', detail: 'Powers an AI or data marketplace protocol' },
    gaming:         { label: 'GameFi / Gaming token', detail: 'In-game economy or play-to-earn token' },
    meme:           { label: 'Meme token', detail: 'Community-driven token — high volatility, higher inherent risk' },
    nft:            { label: 'NFT ecosystem token', detail: 'Powers an NFT platform or metaverse' },
    infrastructure: { label: 'Physical infrastructure token', detail: 'Incentivises real-world network deployment' },
    bridge:         { label: 'Bridged / Wrapped asset', detail: 'Canonical cross-chain representation of another asset' },
    rwa:            { label: 'Real World Asset token', detail: 'Tokenised exposure to off-chain financial assets' },
  };
  const c = labels[category];
  if (!c) return null;
  return { id: `category_${category}`, category: 'legitimacy', earned: 0, max: 0, ok: null,
    label: c.label, detail: c.detail };
}

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
             && meta.updateAuthority !== BURN_ADDRESS
             && isWalletAddress(meta.updateAuthority)) {
    // Metadata update authority — only use if it's a real wallet (not a PDA).
    // Bonding curve programs (HumbleTrust, etc.) set a PDA as update authority,
    // which would otherwise cause the entire vault balance to count as "creator".
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
      earned: -8, max: 20, ok: null,
      label: "No liquidity data",
      detail: "Cannot verify pool safety or LP lock — unverifiable = risk" });
    flags.push({ type: "no_liquidity_data", severity: "medium",
      msg: "Liquidity status unverifiable — cannot confirm pool safety or LP lock" });
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
      earned: -5, max: 10, ok: null,
      label: "No holder data available",
      detail: "Whale concentration unverifiable — hidden risk cannot be ruled out",
    });
    flags.push({ type: "no_holder_data", severity: "low",
      msg: "Holder concentration unverifiable — whale risk cannot be assessed" });
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
      earned: -10, max: 5, ok: false,
      label: "No on-chain Metaplex metadata",
      detail: "Token identity is unverifiable — no legitimate project skips metadata" });
    flags.push({ type: "no_metadata", severity: "high",
      msg: "No Metaplex metadata — token name, symbol and image cannot be verified on-chain" });
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
  // Allow negative sums so penalties propagate — floor per category is -max (can't go below -100%)
  const earnedCat  = (cat) => {
    const raw = byCategory(cat).reduce((s, sig) => s + sig.earned, 0);
    const max  = MAX[cat] || 100;
    return Math.max(-max, raw);
  };

  const categories = {
    supply_control: { earned: earnedCat("supply_control"), max: MAX.supply_control },
    liquidity:      { earned: earnedCat("liquidity"),      max: MAX.liquidity      },
    distribution:   { earned: earnedCat("distribution"),   max: MAX.distribution   },
    legitimacy:     { earned: earnedCat("legitimacy"),     max: MAX.legitimacy     },
  };

  const rawScore = Object.values(categories).reduce((s, c) => s + c.earned, 0);

  // ── Data confidence: penalise scores built on missing data ────────────────
  // Points where ok===null are "unknown" — we couldn't fetch the data.
  // A token that scores 50 purely because we couldn't measure 60% of it is NOT "OK".
  const nullPts  = signals.filter(s => s.ok === null).reduce((a, s) => a + s.max, 0);
  const totalPts = signals.reduce((a, s) => a + s.max, 0);
  const knownRatio = totalPts > 0 ? 1 - nullPts / totalPts : 1;
  // FULL ≥75% data resolved, PARTIAL ≥55%, INSUFFICIENT <55%
  const data_quality =
    knownRatio >= 0.75 ? "FULL"         :
    knownRatio >= 0.55 ? "PARTIAL"      : "INSUFFICIENT";

  // Cap ensures supply-control-only scores can't masquerade as trust.
  // Active penalties above already lower the raw score; cap is a safety net.
  const cap = data_quality === "INSUFFICIENT" ? 40 : data_quality === "PARTIAL" ? 58 : 100;
  const score = Math.max(0, Math.min(cap, Math.round(rawScore)));

  return { score, data_quality, categories, signals, flags, onchain, creator };
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
  ELITE:  { bg: "#00c896", border: "#00a878", text: "#001f16", numBg: "#00a878" },
  STRONG: { bg: "#00b07a", border: "#009060", text: "#001f16", numBg: "#009060" },
  OK:     { bg: "#e8a020", border: "#c88010", text: "#1a0e00", numBg: "#c88010" },
  WEAK:   { bg: "#d4562a", border: "#b03a18", text: "#fff",    numBg: "#b03a18" },
  DANGER: { bg: "#c02020", border: "#9a0a0a", text: "#fff",    numBg: "#9a0a0a" },
};

function buildBadge(score, trust_level, tokenName) {
  const c = BADGE_COLORS[trust_level] || { bg: "#555", border: "#333", text: "#fff", numBg: "#333" };

  const H = 22;
  const FONT = "DejaVu Sans,Verdana,Geneva,Lucida,sans-serif";

  // Left section: "HumbleTrust"
  const label = "HumbleTrust";
  const lw    = Math.ceil(label.length * 6.6 + 22);

  // Right section: "TRUST_LEVEL" + score pill
  const lvLen  = trust_level.length;
  const scLen  = String(score).length;
  const lvW    = Math.ceil(lvLen * 6.6 + 14);
  const numW   = Math.ceil(scLen * 7.8 + 14);   // wider chars for the number pill
  const vw     = lvW + numW + 4;

  const W     = lw + vw;
  const title = `HumbleTrust TrustScore: ${trust_level} ${score}/100${tokenName ? ` — ${tokenName}` : ""}`;

  // Vertical centres
  const yTxt  = Math.round(H / 2) + 4;   // baseline ≈ visual centre for 11px font
  const yShad = yTxt + 1;

  // Right half x centres
  const xLv   = lw + Math.round(lvW / 2);
  const xNum  = lw + lvW + 4 + Math.round(numW / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="TrustScore ${trust_level} ${score}/100">
<title>${title}</title>
<defs>
  <linearGradient id="sheen" x2="0" y2="100%">
    <stop offset="0"  stop-color="#fff" stop-opacity=".14"/>
    <stop offset="1"  stop-color="#000" stop-opacity=".10"/>
  </linearGradient>
  <!-- HumbleTrust brand gradient: green → purple -->
  <linearGradient id="htg" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0%"   stop-color="#00FF41"/>
    <stop offset="100%" stop-color="#B026FF"/>
  </linearGradient>
  <mask id="m"><rect width="${W}" height="${H}" rx="4" fill="#fff"/></mask>
</defs>
<g mask="url(#m)">
  <!-- left panel — near-black -->
  <rect width="${lw}" height="${H}" fill="#0d1117"/>
  <!-- right panel — trust level colour -->
  <rect x="${lw}" width="${vw}" height="${H}" fill="${c.bg}"/>
  <!-- score number pill — darker shade -->
  <rect x="${lw + lvW + 4}" width="${numW}" height="${H}" fill="${c.numBg}"/>
  <!-- shared gloss overlay -->
  <rect width="${W}" height="${H}" fill="url(#sheen)"/>
  <!-- separator line -->
  <line x1="${lw}" y1="0" x2="${lw}" y2="${H}" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>
  <line x1="${lw + lvW + 4}" y1="3" x2="${lw + lvW + 4}" y2="${H - 3}" stroke="${c.text}" stroke-opacity=".25" stroke-width="1"/>
</g>
<!-- "HumbleTrust" — brand gradient text -->
<text x="${lw / 2}" y="${yShad}" text-anchor="middle" fill="#000" fill-opacity=".4"
  font-family="${FONT}" font-size="11" font-weight="700">${label}</text>
<text x="${lw / 2}" y="${yTxt}" text-anchor="middle" fill="url(#htg)"
  font-family="${FONT}" font-size="11" font-weight="700">${label}</text>
<!-- Trust level label -->
<text x="${xLv}" y="${yShad}" text-anchor="middle" fill="#000" fill-opacity=".3"
  font-family="${FONT}" font-size="10" font-weight="700">${trust_level}</text>
<text x="${xLv}" y="${yTxt}" text-anchor="middle" fill="${c.text}"
  font-family="${FONT}" font-size="10" font-weight="700">${trust_level}</text>
<!-- Score number — bold, slightly larger -->
<text x="${xNum}" y="${yShad}" text-anchor="middle" fill="#000" fill-opacity=".3"
  font-family="${FONT}" font-size="12" font-weight="900">${score}</text>
<text x="${xNum}" y="${yTxt}" text-anchor="middle" fill="${c.text}"
  font-family="${FONT}" font-size="12" font-weight="900">${score}</text>
</svg>`
}



function computeRugRisk(flags = []) {
  const WEIGHTS = {
    mint_authority_active:   40,
    creator_whale:           30,
    freeze_authority_active: 25,
    lp_not_burned:           20,
    extreme_concentration:   20,
    no_metadata:             18, // unverifiable identity = major red flag
    price_crash:             25, // price dropped ≥70% in 24h
    creator_large_holdings:  10,
    high_concentration:       8,
    no_liquidity_data:        8, // can't verify pool safety
    metadata_mutable:         8,
    low_liquidity:            8, // < $10K pool liquidity
    no_holder_data:           5, // can't verify concentration
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
  const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 90));

  const { data: rows } = await db
    .from("score_history")
    .select("score, trust_level, recorded_at")
    .eq("mint", mint)
    .order("recorded_at", { ascending: false })
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
  const row7d        = rows.find(r => r.recorded_at <= sevenDaysAgo);
  const delta7d      = row7d ? latest.score - row7d.score : null;
  const trend        = delta7d === null ? "stable" : delta7d > 5 ? "up" : delta7d < -5 ? "down" : "stable";

  return res.json({
    mint,
    history: rows.map(r => ({ score: r.score, trust_level: r.trust_level, recorded_at: r.recorded_at })),
    trend,
    delta_7d:            delta7d,
    current_score:       latest.score,
    current_trust_level: latest.trust_level,
    periods:             rows.length,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Badge helper — applies category cap then sends SVG
// ════════════════════════════════════════════════════════════════════════════

function sendBadgeResponse(res, scoreData) {
  const category   = scoreData.category || categoryFromPlatform(scoreData.platform || '');
  const capped     = scoreData._nativeToken ? scoreData.score : applyCategoryCap(scoreData.score, category);
  const trustLevel = getTrustLevel(capped);
  const tokenName  = scoreData.token?.name || scoreData.token?.symbol || null;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  return res.send(buildBadge(capped, trustLevel, tokenName));
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

  const authCtx = await handleApiAuth(req, res);
  if (!authCtx) { clearTimeout(_guard); return; }
  const doTrack = (fmt, cached = false) => {
    const _m = (req.query || {}).mint;
    trackUsage({ keyId: authCtx.keyId, ip: authCtx.ip, mint: _m, format: fmt, cached }).catch(() => {});
  };

  const { mint, nocache, format, view } = req.query;
  if (!mint)                              { clearTimeout(_guard); return res.status(400).json({ error: "mint required" }); }
  if (typeof mint !== 'string' || mint.length > 100) { clearTimeout(_guard); return res.status(400).json({ error: "invalid mint address" }); }

  // Multi-chain address validation: allow EVM, BTC, TON addresses in addition to Solana.
  // A string that passes isValidWallet() (32-byte Ed25519 base58) is always Solana —
  // this prevents BTC_RE false-positives for short Solana addresses starting with 1/3.
  const _isActualSolana = isValidWallet(mint);
  const _chainDetect    = detectChain(mint);
  const _isNonSolana    = !_isActualSolana && _chainDetect.chain !== 'solana' && _chainDetect.chain !== 'unknown' && _chainDetect.confidence > 0;
  if (!_isNonSolana && !_isActualSolana) { clearTimeout(_guard); return res.status(400).json({ error: "invalid mint address" }); }

  const db = getClient();

  // ── Route: score history ───────────────────────────────────────────────────
  if (view === "history") {
    return handleHistory(req, res, mint, db)
      .then(r => { doTrack("json", false); clearTimeout(_guard); return r; })
      .catch(e => {
        clearTimeout(_guard);
        console.error("[api/score history]", e.message);
        return res.status(500).json({ error: "Internal server error" });
      });
  }

  const isBadge = format === "badge";

  try {
    // ── Multi-chain fast path ────────────────────────────────────────────────────
    const chainInfo = _chainDetect;   // reuse result from validation step above
    const chain = chainInfo.chain;

    // Fast path: non-Solana chains
    if (chain !== 'solana' && chain !== 'unknown') {
      const chainRegistry = knownTokens[chain] || {};
      const mintNorm = mint.toLowerCase();
      const NATIVE_ALIASES = new Set(['native','btc','bitcoin','eth','ether','ethereum','bnb','bsc','ton','toncoin','sol','solana','matic','polygon','pol','op','optimism','avax','avalanche','arb','arbitrum','base','ftm','fantom','near','sui','apt','aptos','algo','algorand','atom','cosmos','ada','cardano','dot','polkadot','xrp','ripple','trx','tron']);
      const isNativeAlias = NATIVE_ALIASES.has(mintNorm);
      const knownEntry = chainRegistry[mint] || chainRegistry[mintNorm] || (isNativeAlias ? chainRegistry['native'] : null);
      const isBitcoin = chain === 'bitcoin';
      let result;
      if (chain === 'ton') {
        result = await scoreTon(mint, knownEntry);
      } else if (isBitcoin) {
        result = scoreBitcoin(chain, mint);
      } else {
        result = scoreEvm(chain, mint, knownEntry);
      }

      const category = knownEntry?.category || (isBitcoin ? 'l1' : 'unknown');
      const catCappedScore = applyCategoryCap(result.score, category);
      const catSignal = categorySignal(category, knownEntry?.name);
      const resultSignals = catSignal ? [...(result.signals || []), catSignal] : (result.signals || []);

      const rugRisk = computeRugRisk(result.flags || []);
      const tokenInfo = result.onchain?.name
        ? { name: result.onchain.name, symbol: result.onchain.symbol || null, status: null, logo_uri: result.onchain.image || null, creator: null, verified_issuer: false }
        : knownEntry ? { name: knownEntry.name, symbol: knownEntry.symbol, status: null, logo_uri: knownEntry.logo_uri || null, description: knownEntry.description || null, creator: null, verified_issuer: false }
        : null;
      doTrack(isBadge ? "badge" : "json", false);
      clearTimeout(_guard);
      return res.json({
        mint,
        chain,
        archetype:  knownEntry?.archetype || (chain === 'ton' ? 'unknown' : isBitcoin ? 'protocol' : 'unknown'),
        category,
        known_token: !!knownEntry,
        score:          catCappedScore,
        trust_level:    getTrustLevel(catCappedScore),
        data_quality:   result.data_quality || null,
        rug_risk:       rugRisk.rug_risk,
        rug_risk_score: rugRisk.rug_risk_score,
        rug_indicators: rugRisk.rug_indicators,
        source:         result.source || 'registry',
        network:        chain,
        platform:       chain === 'ton' ? 'ton' : (knownEntry?.name ?? null),
        token:          tokenInfo,
        categories:     result.categories,
        signals:        resultSignals,
        flags:          result.flags,
        onchain:        null,
        ...(knownEntry ? {} : {
          warning: `${chain.toUpperCase()} token not in HumbleTrust registry. Score based on registry lookup only.`,
          cta: 'HumbleTrust on-chain analysis is currently available for Solana tokens only.',
        }),
        computed_at:   new Date().toISOString(),
        cache_expires: null,
        badge_url:   `/api/score/${mint}?format=badge`,
        history_url: `/api/score/${mint}?view=history`,
      });
    }

    // ── Solana known-token fast path ─────────────────────────────────────────────
    const solanaRegistry = knownTokens['solana'] || {};
    const knownSolanaToken = solanaRegistry[mint];
    if (knownSolanaToken && !nocache) {
      // For ecosystem/protocol tokens, still do basic on-chain checks (mint auth, freeze auth)
      // but skip the heavy LP/holder analysis
      const archetype = knownSolanaToken.archetype;

      // Quick mint info fetch (just mintInfo, no holder/LP analysis)
      let onchainBasic = {};
      try {
        const mintInfoRes = await Promise.race([
          fetch(`${MAINNET}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [mint, { encoding: 'jsonParsed' }] }),
          }).then(r => r.json()),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
        ]);
        const info = mintInfoRes?.result?.value?.data?.parsed?.info;
        if (info) {
          onchainBasic.mintAuthRevoked   = info.mintAuthority   === null;
          onchainBasic.freezeAuthRevoked = info.freezeAuthority === null;
        }
      } catch { /* skip */ }

      const result = archetype === 'protocol'
        ? scoreProtocol(knownSolanaToken, onchainBasic)
        : scoreEcosystem(knownSolanaToken, onchainBasic);

      const knownCategory = knownSolanaToken.category || null;

      // Try Jupiter price enrichment (non-blocking)
      let priceData = null;
      try { priceData = await fetchJupiterPrice(mint); } catch { /* skip */ }
      if (priceData?.has_price) {
        result.signals.push({ id: 'jup_price', category: 'liquidity', earned: 10, max: 10, ok: true,
          label: `Active trading: $${priceData.price_usd?.toFixed(6) ?? '?'}`, detail: 'Token has active price on Jupiter' });
        if (result.categories) result.categories.liquidity = { earned: 20, max: 25 };
        result.score = Math.min(99, result.score + (archetype === 'protocol' ? 0 : 5));

        // Stablecoin peg check — only meaningful if we have a live price
        if (knownCategory === 'stablecoin') {
          const price    = priceData.price_usd != null ? priceData.price_usd : null;
          if (price !== null) {
            const priceDev = Math.abs(price - 1.0) * 100; // % deviation from $1
            if (priceDev > 5) {
              result.flags.push({ type: 'stablecoin_depeg', severity: 'critical',
                msg: `Stablecoin trading at $${price.toFixed(4)} — ${priceDev.toFixed(1)}% off peg` });
              result.score = Math.max(0, result.score - 20);
              result.signals.push({ id: 'peg_deviation', category: 'legitimacy', earned: -10, max: 0, ok: false,
                label: `DEPEG: $${price.toFixed(4)} (${priceDev.toFixed(1)}% off $1)`,
                detail: 'Severe peg deviation — stablecoin may be failing' });
            } else if (priceDev > 2) {
              result.flags.push({ type: 'stablecoin_depeg', severity: 'high',
                msg: `Stablecoin trading at $${price.toFixed(4)} — slight depeg` });
              result.score = Math.max(0, result.score - 8);
              result.signals.push({ id: 'peg_deviation', category: 'legitimacy', earned: -3, max: 0, ok: false,
                label: `Slight depeg: $${price.toFixed(4)}`, detail: 'Minor peg deviation' });
            } else {
              result.signals.push({ id: 'peg_maintained', category: 'legitimacy', earned: 5, max: 5, ok: true,
                label: `Peg maintained: $${price.toFixed(4)}`,
                detail: 'Trading within 2% of $1.00 — peg is healthy' });
            }
          }
        }
      }

      // Append category signal and apply cap
      const catSig = categorySignal(knownCategory, knownSolanaToken.name);
      if (catSig) result.signals.push(catSig);
      const cappedScore = applyCategoryCap(result.score, knownCategory);

      const rugRisk = computeRugRisk(result.flags || []);
      doTrack(isBadge ? "badge" : "json", false);
      clearTimeout(_guard);
      if (!isBadge) res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      return res.json({
        mint,
        chain: 'solana',
        archetype,
        category:       knownCategory,
        known_token: true,
        score:          cappedScore,
        trust_level:    getTrustLevel(cappedScore),
        rug_risk:       rugRisk.rug_risk,
        rug_risk_score: rugRisk.rug_risk_score,
        rug_indicators: rugRisk.rug_indicators,
        source:         result.source || 'registry+onchain',
        network:        'solana',
        platform:       knownSolanaToken.name,
        token: { name: knownSolanaToken.name, symbol: knownSolanaToken.symbol, status: null, logo_uri: knownSolanaToken.logo_uri || null, description: knownSolanaToken.description || null, creator: null, verified_issuer: false },
        categories:     result.categories,
        signals:        result.signals,
        flags:          result.flags,
        onchain:        onchainBasic,
        computed_at:   new Date().toISOString(),
        cache_expires: null,
        badge_url:   `/api/score/${mint}?format=badge`,
        history_url: `/api/score/${mint}?view=history`,
      });
    }

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

        // Background: compute live on-chain score and sync tokens.trust_score
        if (!nocache && mintInfo) {
          Promise.resolve().then(async () => {
            try {
              const { score: liveScore } = await computeScore(mint, mintInfo, DEVNET, db);
              const clamped = Math.max(0, Math.min(100, Math.round(liveScore)));
              if (Math.abs(clamped - score) >= 2) {
                const lvl = getTrustLevel(clamped);
                await db.from("tokens").update({
                  trust_score: clamped,
                  trust_level: lvl,
                  updated_at: new Date().toISOString(),
                }).eq("mint", mint);
                // Invalidate L1 so next request gets fresh score
                L1.delete(mint);
              }
            } catch { /* non-fatal */ }
          });
        }
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
        const d = cached.components || {};
        scoreData = {
          score:        cached.score,
          trust_level:  cached.trust_level,
          data_quality: d.data_quality || null,
          source:       "external_cached",
          network:      d.network   || "unknown",
          platform:     d.platform  || "unknown",
          token:        d.token     || null,
          categories:   d.categories || null,
          signals:      d.signals   || [],
          flags:        d.flags     || [],
          onchain:      d.onchain   || null,
          _cachedAt:    cached.computed_at,
          _expiresAt:   cached.expires_at,
        };
        l1set(mint, scoreData);
      }
    }

    // ── Badge fast-path: score from cache → return SVG without full compute ───
    if (isBadge && scoreData) {
      doTrack("badge", true);
      clearTimeout(_guard);
      return sendBadgeResponse(res, scoreData);
    }

    // ── L3 Full on-chain computation ──────────────────────────────────────────
    if (!scoreData) {
      const [mainnetInfo, devnetInfo] = await Promise.all([
        fetchMintInfo(mint, MAINNET).catch(() => null),
        fetchMintInfo(mint, DEVNET).catch(() => null),
      ]);
      const mintInfo = mainnetInfo || devnetInfo;
      const ep       = mainnetInfo ? MAINNET : DEVNET;
      const network  = mainnetInfo ? "mainnet-beta" : devnetInfo ? "devnet" : "unknown";

      if (!mintInfo) {
        clearTimeout(_guard);
        return res.status(404).json({ error: "Mint account not found on mainnet or devnet", mint });
      }

      const isMainnet = ep === MAINNET;
      const [platform, computed, mktRaw, dexRaw, goplusRaw, rugcheckRaw, jupTokenRaw] = await Promise.all([
        detectPlatform(mint, mintInfo.mintAuthority, ep),
        computeScore(mint, mintInfo, ep, db),
        fetchMarketContext(mint).catch(() => null),
        isMainnet ? fetchDexScreener(mint).catch(() => null)  : null,
        isMainnet ? fetchGoPlusToken(mint).catch(() => null)  : null,
        isMainnet ? fetchRugCheck(mint).catch(() => null)     : null,
        isMainnet ? fetchJupiterToken(mint).catch(() => null) : null,
      ]);

      const { score, data_quality, categories, signals, flags, onchain, creator } = computed;
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

      // ── Market context enrichment (already fetched in parallel above) ────────
      let mktScore = score;
      let mktFlags = flags;
      let mktSignals = signals;
      try {
        const mkt = mktRaw;
        if (mkt) {
          onchain.market = mkt;
          // Price crash: ≤ -70% in 24h
          if (mkt.price_change_24h !== null && mkt.price_change_24h <= -70) {
            mktFlags = [...mktFlags, { type: "price_crash", severity: "critical",
              msg: `Price dropped ${mkt.price_change_24h.toFixed(1)}% in 24h — possible rug pull` }];
            mktSignals = [...mktSignals, { id: "price_crash", category: "liquidity",
              earned: -15, max: 0, ok: false,
              label: `Price crashed ${mkt.price_change_24h.toFixed(1)}% in 24h`,
              detail: "Extreme price drop — likely rug pull or mass exit" }];
            mktScore = Math.max(0, mktScore - 20);
          } else if (mkt.price_change_24h !== null && mkt.price_change_24h <= -40) {
            mktFlags = [...mktFlags, { type: "price_crash", severity: "high",
              msg: `Price dropped ${mkt.price_change_24h.toFixed(1)}% in 24h — high sell pressure` }];
            mktScore = Math.max(0, mktScore - 8);
          }
          // Low liquidity: < $10K USD
          if (mkt.liquidity_usd !== null && mkt.liquidity_usd < 10_000) {
            mktFlags = [...mktFlags, { type: "low_liquidity", severity: "high",
              msg: `Pool liquidity only $${mkt.liquidity_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })} — easy to manipulate` }];
            mktScore = Math.max(0, mktScore - 5);
          }
        }
      } catch { /* non-fatal */ }

      // ── Helper: check if flag type already exists ───────────────────────────
      const hasFlag = (type) => mktFlags.some(f => f.type === type);

      // ── Jupiter Token metadata enrichment ───────────────────────────────────
      if (jupTokenRaw) {
        onchain.jupiter_token = jupTokenRaw;
        // Enrich tokenInfo with Jupiter data (logo, social links)
        if (!tokenInfo.logo_uri && jupTokenRaw.logo_uri) tokenInfo.logo_uri = jupTokenRaw.logo_uri;
        if (!tokenInfo.name    && jupTokenRaw.name)     tokenInfo.name     = jupTokenRaw.name;
        if (!tokenInfo.symbol  && jupTokenRaw.symbol)   tokenInfo.symbol   = jupTokenRaw.symbol;
        if (jupTokenRaw.website) tokenInfo.website = jupTokenRaw.website;
        if (jupTokenRaw.twitter) tokenInfo.twitter = jupTokenRaw.twitter;

        if (jupTokenRaw.strict) {
          mktSignals = [...mktSignals, { id: 'jup_verified', category: 'legitimacy',
            earned: 8, max: 8, ok: true,
            label: 'Jupiter Verified Token',
            detail: 'Listed on Jupiter strict verified token list — community-approved' }];
          mktScore = Math.min(mktScore + 5, 99);
        } else if (jupTokenRaw.verified) {
          mktSignals = [...mktSignals, { id: 'jup_verified', category: 'legitimacy',
            earned: 4, max: 8, ok: true,
            label: 'Jupiter Community Token',
            detail: 'Listed on Jupiter community token list' }];
          mktScore = Math.min(mktScore + 2, 99);
        }
      }

      // ── DexScreener enrichment ───────────────────────────────────────────────
      if (dexRaw) {
        onchain.dexscreener = dexRaw;

        // Pool age signal
        if (dexRaw.pair_created_at) {
          const ageMs   = Date.now() - dexRaw.pair_created_at;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays < 1) {
            mktFlags = [...mktFlags, { type: 'new_pool', severity: 'high',
              msg: 'Pool created less than 24 hours ago — very early stage, high risk' }];
            mktSignals = [...mktSignals, { id: 'pool_age', category: 'liquidity',
              earned: -5, max: 0, ok: false,
              label: 'Pool < 24h old (DexScreener)',
              detail: 'Newly created trading pool — insufficient trading history' }];
            mktScore = Math.max(0, mktScore - 5);
          } else if (ageDays > 30) {
            mktSignals = [...mktSignals, { id: 'pool_age', category: 'liquidity',
              earned: 3, max: 3, ok: true,
              label: `Pool ${Math.round(ageDays)}d old (DexScreener)`,
              detail: 'Established pool with trading history' }];
          }
        }

        // FDV sanity check
        if (dexRaw.fdv && dexRaw.liquidity_usd && dexRaw.fdv > 0) {
          const liqToFdvRatio = dexRaw.liquidity_usd / dexRaw.fdv;
          if (liqToFdvRatio < 0.005 && dexRaw.fdv > 100_000) {
            mktFlags = [...mktFlags, { type: 'low_liq_fdv_ratio', severity: 'medium',
              msg: `Liquidity/FDV ratio ${(liqToFdvRatio * 100).toFixed(2)}% — very thin liquidity vs market cap` }];
          }
        }

        // Price crash (supplement Birdeye if not already flagged)
        if (!hasFlag('price_crash') && dexRaw.price_change_24h !== null) {
          if (dexRaw.price_change_24h <= -70) {
            mktFlags   = [...mktFlags, { type: 'price_crash', severity: 'critical',
              msg: `DexScreener: Price dropped ${dexRaw.price_change_24h.toFixed(1)}% in 24h` }];
            mktSignals = [...mktSignals, { id: 'dex_price_crash', category: 'liquidity',
              earned: -15, max: 0, ok: false,
              label: `Price crashed ${dexRaw.price_change_24h.toFixed(1)}% in 24h (DexScreener)`,
              detail: 'Extreme price drop detected on DexScreener' }];
            mktScore = Math.max(0, mktScore - 20);
          } else if (dexRaw.price_change_24h <= -40) {
            mktFlags = [...mktFlags, { type: 'price_crash', severity: 'high',
              msg: `DexScreener: Price dropped ${dexRaw.price_change_24h.toFixed(1)}% in 24h` }];
            mktScore = Math.max(0, mktScore - 8);
          }
        }

        // Low liquidity (supplement Birdeye)
        if (!hasFlag('low_liquidity') && dexRaw.liquidity_usd !== null && dexRaw.liquidity_usd < 10_000) {
          mktFlags = [...mktFlags, { type: 'low_liquidity', severity: 'high',
            msg: `DexScreener: Pool liquidity $${dexRaw.liquidity_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }];
          mktScore = Math.max(0, mktScore - 5);
        }
      }

      // ── GoPlus Security enrichment ───────────────────────────────────────────
      if (goplusRaw) {
        onchain.goplus = goplusRaw;

        if (goplusRaw.is_honeypot) {
          mktFlags   = [...mktFlags, { type: 'honeypot', severity: 'critical',
            msg: 'GoPlus: Token flagged as honeypot — sell transactions blocked' }];
          mktSignals = [...mktSignals, { id: 'goplus_honeypot', category: 'supply_control',
            earned: -30, max: 0, ok: false,
            label: 'HONEYPOT detected (GoPlus)',
            detail: 'Buy transactions succeed but selling is blocked — total trap' }];
          mktScore = Math.max(0, mktScore - 35);
        }
        if (goplusRaw.transfer_pausable) {
          mktFlags   = [...mktFlags, { type: 'transfer_pausable', severity: 'high',
            msg: 'GoPlus: Token transfers can be paused by owner' }];
          mktSignals = [...mktSignals, { id: 'goplus_pausable', category: 'supply_control',
            earned: -10, max: 0, ok: false,
            label: 'Transfers pausable (GoPlus)',
            detail: 'Owner can freeze all token transfers at any time' }];
          mktScore = Math.max(0, mktScore - 10);
        }
        if (goplusRaw.can_take_back_ownership) {
          mktFlags   = [...mktFlags, { type: 'ownership_reclaimable', severity: 'high',
            msg: 'GoPlus: Ownership can be reclaimed by creator' }];
          mktSignals = [...mktSignals, { id: 'goplus_ownership', category: 'supply_control',
            earned: -8, max: 0, ok: false,
            label: 'Ownership reclaimable (GoPlus)',
            detail: 'Creator can reclaim contract ownership — re-enable privileges' }];
          mktScore = Math.max(0, mktScore - 8);
        }
        if (!goplusRaw.is_honeypot && !goplusRaw.transfer_pausable && !goplusRaw.can_take_back_ownership) {
          mktSignals = [...mktSignals, { id: 'goplus_clean', category: 'legitimacy',
            earned: 5, max: 5, ok: true,
            label: 'GoPlus: No security threats detected',
            detail: 'Passed honeypot, transfer restriction, and ownership checks' }];
        }
      }

      // ── RugCheck enrichment ──────────────────────────────────────────────────
      if (rugcheckRaw) {
        onchain.rugcheck = { score: rugcheckRaw.score, risks: rugcheckRaw.risks };
        const rcScore    = rugcheckRaw.score;
        const critRisks  = rugcheckRaw.risks.filter(r => r.level === 'danger' || r.level === 'critical');
        const warnRisks  = rugcheckRaw.risks.filter(r => r.level === 'warn');

        if (rcScore !== null) {
          if (rcScore >= 500) {
            mktFlags   = [...mktFlags, { type: 'rugcheck_danger', severity: 'critical',
              msg: `RugCheck: Risk score ${rcScore} — DANGER` }];
            mktSignals = [...mktSignals, { id: 'rugcheck_score', category: 'legitimacy',
              earned: -15, max: 0, ok: false,
              label: `RugCheck DANGER (score: ${rcScore})`,
              detail: 'RugCheck detected critical rug risk indicators' }];
            mktScore = Math.max(0, mktScore - 20);
          } else if (rcScore >= 200) {
            mktFlags   = [...mktFlags, { type: 'rugcheck_warn', severity: 'high',
              msg: `RugCheck: Risk score ${rcScore} — HIGH RISK` }];
            mktSignals = [...mktSignals, { id: 'rugcheck_score', category: 'legitimacy',
              earned: -8, max: 0, ok: false,
              label: `RugCheck HIGH RISK (score: ${rcScore})`,
              detail: 'RugCheck flagged multiple risk indicators' }];
            mktScore = Math.max(0, mktScore - 10);
          } else if (rcScore < 100) {
            mktSignals = [...mktSignals, { id: 'rugcheck_score', category: 'legitimacy',
              earned: 5, max: 5, ok: true,
              label: `RugCheck: GOOD (score: ${rcScore})`,
              detail: 'RugCheck found no significant rug risk indicators' }];
          }
        }
        for (const risk of critRisks.slice(0, 3)) {
          if (!hasFlag('rugcheck_risk_' + risk.name)) {
            mktFlags = [...mktFlags, { type: 'rugcheck_risk', severity: 'high',
              msg: `RugCheck: ${risk.name}` }];
          }
        }
        if (warnRisks.length > 0) {
          for (const risk of warnRisks.slice(0, 2)) {
            mktFlags = [...mktFlags, { type: 'rugcheck_warn_detail', severity: 'medium',
              msg: `RugCheck warning: ${risk.name}` }];
          }
        }
      }

      const finalScore      = Math.min(mktScore, score <= 40 ? score : mktScore); // never inflate
      const finalTrustLevel = getTrustLevel(finalScore);

      scoreData = {
        score: finalScore, trust_level: finalTrustLevel, data_quality,
        source:   "external",
        network,  platform,
        category: categoryFromPlatform(platform) || null,
        token:    tokenInfo,
        categories, signals: mktSignals, flags: mktFlags, onchain,
        _computedAt: now.toISOString(),
        _expiresAt:  new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
      };

      // L1 + L2 cache (fire-and-forget on DB write)
      l1set(mint, scoreData);
      db.from("token_score_cache").upsert({
        mint, score: finalScore, trust_level: finalTrustLevel,
        components: { categories, signals: mktSignals, flags: mktFlags, onchain, token: tokenInfo, network, platform, data_quality,
          enrichments: {
            goplus:      goplusRaw    ? { is_honeypot: goplusRaw.is_honeypot, transfer_pausable: goplusRaw.transfer_pausable } : null,
            rugcheck:    rugcheckRaw  ? { score: rugcheckRaw.score, risks_count: rugcheckRaw.risks.length } : null,
            dexscreener: dexRaw       ? { liquidity_usd: dexRaw.liquidity_usd, fdv: dexRaw.fdv, total_pairs: dexRaw.total_pairs } : null,
            jupiter:     jupTokenRaw  ? { verified: jupTokenRaw.verified, strict: jupTokenRaw.strict } : null,
          },
        },
        computed_at: now.toISOString(),
        expires_at:  scoreData._expiresAt,
      }, { onConflict: "mint" })
        .then(({ error }) => { if (error) console.error("[api/score] cache upsert:", error.message, error.code, mint.slice(0,8)); })
        .catch(e => console.error("[api/score] cache upsert throw:", e.message, mint.slice(0,8)));

      // History: write only if score moved by >= HISTORY_MIN_DELTA points
      db.from("score_history")
        .select("score")
        .eq("mint", mint)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single()
        .then(({ data: last }) => {
          if (!last || Math.abs(last.score - score) >= HISTORY_MIN_DELTA) {
            return db.from("score_history").insert({
              mint, score: finalScore, trust_level: finalTrustLevel,
              recorded_at: now.toISOString(),
            });
          }
        })
        .catch(e => console.error("[api/score] history insert:", e.message, mint.slice(0,8)));
    }

    // ── Badge response (post L3 compute) ──────────────────────────────────────
    if (isBadge) {
      doTrack("badge", false);
      clearTimeout(_guard);
      return sendBadgeResponse(res, scoreData);
    }

    // ── JSON response ──────────────────────────────────────────────────────────
    const isNative = scoreData._nativeToken;
    const isCached = scoreData.source === "external_cached";
    const rugRisk  = computeRugRisk(scoreData.flags || []);

    // Determine archetype + category for unknown Solana tokens
    let tokenArchetype = 'unknown';
    if (isNative) {
      tokenArchetype = 'humbletrust';
    } else if (scoreData.platform === 'pump.fun' || scoreData.platform === 'pump_fun') {
      tokenArchetype = scoreData.onchain?.graduated ? 'meme_graduated' : 'meme_active';
    } else if (scoreData.platform === 'pump_fun_graduated') {
      tokenArchetype = 'meme_graduated';
    } else if (scoreData.platform === 'pump_fun_likely') {
      tokenArchetype = 'meme_active';
    }

    // category from cache (already computed) or derive from platform
    const tokenCategory = scoreData.category || (isNative ? 'unknown' : categoryFromPlatform(scoreData.platform));
    const finalCapped   = isNative ? scoreData.score : applyCategoryCap(scoreData.score, tokenCategory);
    const finalTrust    = getTrustLevel(finalCapped);

    // Append category signal if not already present
    let finalSignals = scoreData.signals || [];
    if (!isNative && !finalSignals.find(s => s.id?.startsWith('category_'))) {
      const catSig = categorySignal(tokenCategory, scoreData.token?.name);
      if (catSig) finalSignals = [...finalSignals, catSig];
    }

    doTrack("json", isCached);
    clearTimeout(_guard);
    return res.json({
      mint,
      chain:          'solana',
      archetype:      tokenArchetype,
      category:       tokenCategory,
      known_token:    false,
      score:          finalCapped,
      trust_level:    finalTrust,
      data_quality:   scoreData.data_quality || null,
      rug_risk:       rugRisk.rug_risk,
      rug_risk_score: rugRisk.rug_risk_score,
      rug_indicators: rugRisk.rug_indicators,
      source:         scoreData.source,
      network:        scoreData.network,
      platform:       scoreData.platform,
      token:          scoreData.token,
      categories:     scoreData.categories,
      signals:        finalSignals,
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
