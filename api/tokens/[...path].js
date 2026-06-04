/**
 * Unified tokens endpoint:
 *   GET  /api/tokens/:mint            — token info
 *   GET  /api/tokens/:mint?check=health — health metrics
 *   GET  /api/tokens/:mint/trades     — list trades
 *   GET  /api/tokens/:mint/trades?format=ohlcv — OHLCV candles
 *   POST /api/tokens/:mint/trades     — record a trade
 *   POST /api/tokens/:mint/trades?action=sync  — backfill from RPC
 */

const crypto = require("crypto");
const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");
const { parseCurveTradeEvents } = require("../_lib/curve-events");
const { getTrustLevel } = require("../_lib/trust");

const PROGRAM_ID_V2       = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RAYDIUM_CPMM_DEVNET = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb";
const WSOL_MINT           = "So11111111111111111111111111111111111111112";
const RPC_ENDPOINT        = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL    = 1_000_000_000;

const TF_SECONDS = {
  "1s": 1, "5s": 5, "15s": 15,
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let web3;
function getWeb3() {
  if (!web3) web3 = require("@solana/web3.js");
  return web3;
}

function deriveCurvePdas(mint) {
  const { PublicKey } = getWeb3();
  const mintPk    = new PublicKey(mint);
  const programPk = new PublicKey(PROGRAM_ID_V2);
  const raydiumPk = new PublicKey(RAYDIUM_CPMM_DEVNET);
  const wsolPk    = new PublicKey(WSOL_MINT);
  const enc = s => Buffer.from(s);
  const pda = seeds => PublicKey.findProgramAddressSync(seeds, programPk)[0];
  const rayPda = seeds => PublicKey.findProgramAddressSync(seeds, raydiumPk)[0];
  const [token0, token1] = wsolPk.toBuffer().compare(mintPk.toBuffer()) < 0
    ? [wsolPk, mintPk] : [mintPk, wsolPk];
  const ammConfigIndex = Buffer.alloc(2);
  ammConfigIndex.writeUInt16LE(0, 0);
  const raydiumAmmConfig = rayPda([enc("amm_config"), ammConfigIndex]);
  const raydiumPoolState = rayPda([enc("pool"), raydiumAmmConfig.toBuffer(), token0.toBuffer(), token1.toBuffer()]);
  return {
    curveTreasurySol: pda([enc("curve_treasury_sol_v2"), mintPk.toBuffer()]),
    curvePoolVault:   pda([enc("curve_pool_vault_v2"),   mintPk.toBuffer()]),
    raydiumPoolState,
    raydiumToken0Mint: token0,
    raydiumToken1Mint: token1,
    raydiumToken0Vault: rayPda([enc("pool_vault"), raydiumPoolState.toBuffer(), token0.toBuffer()]),
    raydiumToken1Vault: rayPda([enc("pool_vault"), raydiumPoolState.toBuffer(), token1.toBuffer()]),
  };
}

function keyToString(key) {
  if (typeof key === "string") return key;
  if (key?.pubkey) return keyToString(key.pubkey);
  return key?.toBase58 ? key.toBase58() : String(key || "");
}

function getTransactionAccounts(tx) {
  const msg = tx?.transaction?.message || {};
  const staticKeys = msg.staticAccountKeys || msg.accountKeys || [];
  const loaded = tx?.meta?.loadedAddresses || {};
  return [...staticKeys, ...(loaded.writable || []), ...(loaded.readonly || [])].map(keyToString);
}

function tokenUiAmount(balance) {
  const amount = balance?.uiTokenAmount;
  if (!amount) return 0;
  return Number(amount.uiAmountString ?? amount.uiAmount ?? 0);
}

function tokenAccountDelta(tx, accounts, mint, tokenAccount) {
  const account = keyToString(tokenAccount);
  const pre  = (tx.meta?.preTokenBalances  || []).find(b => b.mint === mint && accounts[b.accountIndex] === account);
  const post = (tx.meta?.postTokenBalances || []).find(b => b.mint === mint && accounts[b.accountIndex] === account);
  return tokenUiAmount(post) - tokenUiAmount(pre);
}

function isRaydiumSwap(tx) {
  const logs = tx.meta?.logMessages || [];
  return logs.some(l => l.includes("Instruction: SwapBaseInput") || l.includes("Instruction: SwapBaseOutput") || l.includes("Instruction: Swap"));
}

function parseRaydiumSwap(tx, sigInfo, mint, pdas) {
  if (!isRaydiumSwap(tx)) return null;
  const accounts = getTransactionAccounts(tx);
  const tokenIs0  = pdas.raydiumToken0Mint.toBase58() === mint;
  const targetVault = tokenIs0 ? pdas.raydiumToken0Vault : pdas.raydiumToken1Vault;
  const wsolVault   = tokenIs0 ? pdas.raydiumToken1Vault : pdas.raydiumToken0Vault;
  const tokenDelta = tokenAccountDelta(tx, accounts, mint, targetVault);
  const wsolDelta  = tokenAccountDelta(tx, accounts, WSOL_MINT, wsolVault);
  if (!Number.isFinite(tokenDelta) || !Number.isFinite(wsolDelta)) return null;
  if (Math.abs(tokenDelta) <= 0 || Math.abs(wsolDelta) <= 0) return null;
  let side;
  if (wsolDelta > 0 && tokenDelta < 0) side = "buy";
  if (wsolDelta < 0 && tokenDelta > 0) side = "sell";
  if (!side) return null;
  const tokenAmount = Math.abs(tokenDelta);
  const solAmount   = Math.abs(wsolDelta);
  if (tokenAmount <= 0 || solAmount <= 0) return null;
  const trader = accounts[0] || "";
  if (!isValidWallet(trader)) return null;
  return {
    signature: sigInfo.signature, mint, trader, side,
    source: "raydium", token_amount: tokenAmount, sol_amount: solAmount,
    price_sol: solAmount / tokenAmount,
    block_time: sigInfo.blockTime ? new Date(sigInfo.blockTime * 1000).toISOString() : new Date().toISOString(),
  };
}

async function fetchTransactionsBatch(conn, batch) {
  const config = { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 };
  if (typeof fetch !== "function") {
    return Promise.all(batch.map(s => conn.getTransaction(s.signature, config).catch(() => null)));
  }
  try {
    const response = await fetch(RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch.map((s, id) => ({ jsonrpc: "2.0", id, method: "getTransaction", params: [s.signature, config] }))),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("RPC batch response is not an array");
    const byId = new Map(payload.map(item => [item.id, item.result || null]));
    return batch.map((_, id) => byId.get(id) || null);
  } catch {
    return Promise.all(batch.map(s => conn.getTransaction(s.signature, config).catch(() => null)));
  }
}

// ── Token info handlers ───────────────────────────────────────────────────────

async function handleTokenInfo(mint, res) {
  const { data, error } = await getClient().from("tokens").select("*").eq("mint", mint).single();
  if (error) return res.status(404).json({ error: "not found" });
  return res.json({ token: data });
}

async function handleHealth(mint, req, res) {
  const db = getClient();
  const now = new Date();
  const h24ago = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const h1ago  = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: token } = await db.from("tokens")
    .select("name, symbol, trust_score, status, created_at, raydium_pool, last_trade_at, volume_sol, trades_count")
    .eq("mint", mint).single();
  if (!token) return res.status(404).json({ error: "Token not found" });

  const [{ data: trades24h }, { data: trades1h }, { data: lastTrade }] = await Promise.all([
    db.from("trades").select("side, sol_amount, price_sol, block_time, trader").eq("mint", mint).gte("block_time", h24ago).order("block_time", { ascending: false }),
    db.from("trades").select("side, sol_amount, price_sol, block_time").eq("mint", mint).gte("block_time", h1ago).order("block_time", { ascending: false }),
    db.from("trades").select("price_sol, block_time, side").eq("mint", mint).order("block_time", { ascending: false }).limit(1).single(),
  ]);

  const t24 = trades24h || [];
  const t1  = trades1h  || [];
  const buys24  = t24.filter(t => t.side === "buy");
  const sells24 = t24.filter(t => t.side === "sell");
  const vol24Sol  = t24.reduce((s, t) => s + Number(t.sol_amount || 0), 0);
  const vol1hSol  = t1.reduce((s,  t) => s + Number(t.sol_amount || 0), 0);
  const prices24  = t24.map(t => Number(t.price_sol)).filter(Boolean);
  const firstPrice = prices24[prices24.length - 1] || 0;
  const lastPrice  = Number(lastTrade?.price_sol || 0);
  const priceChange24h = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const uniqueTraders  = new Set(t24.map(t => t.trader)).size;

  let health = 50;
  const signals = [];
  if (t24.length >= 20)      { health += 15; signals.push({ type: "active_trading",    delta: +15, msg: "High trade activity (20+ trades/24h)" }); }
  else if (t24.length >= 5)  { health += 8;  signals.push({ type: "moderate_trading", delta: +8,  msg: "Moderate activity (5-20 trades/24h)" }); }
  else if (t24.length === 0) { health -= 15; signals.push({ type: "no_activity",      delta: -15, msg: "No trades in last 24h" }); }
  const ratio = t24.length > 0 ? buys24.length / t24.length : 0.5;
  if (ratio >= 0.45 && ratio <= 0.65)    { health += 10; signals.push({ type: "balanced_flow",  delta: +10, msg: "Balanced buy/sell ratio" }); }
  else if (ratio < 0.2 && t24.length > 5)  { health -= 15; signals.push({ type: "heavy_selling", delta: -15, msg: "Heavy sell pressure (>80% sells)" }); }
  else if (ratio > 0.85 && t24.length > 5) { health += 5;  signals.push({ type: "strong_buying", delta: +5,  msg: "Strong buy pressure" }); }
  if (priceChange24h >= 5)        { health += 10; signals.push({ type: "price_up",    delta: +10, msg: `Price +${priceChange24h.toFixed(1)}% in 24h` }); }
  else if (priceChange24h <= -20) { health -= 15; signals.push({ type: "price_crash", delta: -15, msg: `Price ${priceChange24h.toFixed(1)}% in 24h` }); }
  else if (priceChange24h <= -10) { health -= 8;  signals.push({ type: "price_down",  delta: -8,  msg: `Price ${priceChange24h.toFixed(1)}% in 24h` }); }
  if (uniqueTraders >= 10)                        { health += 10; signals.push({ type: "diverse_traders", delta: +10, msg: `${uniqueTraders} unique traders in 24h` }); }
  else if (uniqueTraders <= 2 && t24.length > 5)  { health -= 10; signals.push({ type: "concentrated",   delta: -10, msg: "Very few unique traders (possible wash trading)" }); }
  if (token.status === "migrated") { health += 5; signals.push({ type: "graduated", delta: +5, msg: "Token graduated to Raydium CPMM" }); }
  const maxSell = Math.max(...sells24.map(t => Number(t.sol_amount || 0)), 0);
  if (vol24Sol > 0 && maxSell / vol24Sol > 0.3 && t24.length > 3) {
    health -= 12;
    signals.push({ type: "large_dump", delta: -12, msg: `Large single sell detected (${((maxSell / vol24Sol) * 100).toFixed(0)}% of 24h volume)` });
  }
  health = Math.max(0, Math.min(100, Math.round(health)));
  const healthLevel = health >= 75 ? "HEALTHY" : health >= 50 ? "NORMAL" : health >= 25 ? "WARNING" : "CRITICAL";

  const criticalSignals = signals.filter(s => s.delta <= -12);
  if (criticalSignals.length > 0) {
    await db.from("token_health_events").insert(criticalSignals.map(s => ({
      mint, event_type: s.type,
      severity: s.delta <= -15 ? "critical" : "warning",
      details: { msg: s.msg, delta: s.delta, health_score: health },
    }))).catch(() => {});
  }
  await db.from("tokens").update({
    volume_sol: Math.round(vol24Sol * 1e6) / 1e6,
    trades_count: t24.length,
    last_trade_at: lastTrade?.block_time || null,
    updated_at: now.toISOString(),
  }).eq("mint", mint).catch(() => {});

  return res.json({
    mint, name: token.name, symbol: token.symbol,
    health_score: health, health_level: healthLevel,
    metrics: {
      trades_24h: t24.length, buys_24h: buys24.length, sells_24h: sells24.length,
      volume_sol_24h: Math.round(vol24Sol * 1e4) / 1e4,
      volume_sol_1h:  Math.round(vol1hSol * 1e4) / 1e4,
      price_change_24h: Math.round(priceChange24h * 100) / 100,
      current_price: lastPrice, unique_traders: uniqueTraders,
      buy_sell_ratio: t24.length > 0 ? Math.round(ratio * 100) / 100 : null,
    },
    signals, trust_score: token.trust_score, status: token.status,
    computed_at: now.toISOString(),
  });
}

// ── Trades handlers ───────────────────────────────────────────────────────────

async function handleGetTrades(mint, req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { data, error } = await getClient().from("trades").select("*")
    .eq("mint", mint).in("side", ["buy", "sell"])
    .gt("price_sol", 0).gt("token_amount", 0).gt("sol_amount", 0)
    .order("block_time", { ascending: false }).limit(limit);
  if (error) {
    console.warn("[handleGetTrades] %s error: %s", mint.slice(0, 8), error.message);
    return res.status(500).json({ error: "database_error" });
  }
  return res.json({ trades: data || [] });
}

async function handleGetOhlcv(mint, req, res) {
  const tf        = TF_SECONDS[req.query.tf] ? req.query.tf : "1m";
  const periodSec = TF_SECONDS[tf];
  const tradeFetch = Math.min(Math.max(1, Number(req.query.limit) || 500), 1000);
  const { data, error } = await getClient().from("trades")
    .select("price_sol, sol_amount, block_time").eq("mint", mint)
    .in("side", ["buy", "sell"]).gt("price_sol", 0).gt("token_amount", 0).gt("sol_amount", 0)
    .order("block_time", { ascending: true }).limit(tradeFetch);
  if (error) throw error;
  if (!data || data.length === 0) {
    res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    return res.json({ candles: [], timeframe: tf });
  }
  const buckets = new Map();
  for (const row of data) {
    const ts     = Math.floor(new Date(row.block_time).getTime() / 1000);
    const bucket = Math.floor(ts / periodSec) * periodSec;
    const price  = Number(row.price_sol);
    const vol    = Number(row.sol_amount);
    const b = buckets.get(bucket);
    if (!b) buckets.set(bucket, { time: bucket, open: price, high: price, low: price, close: price, volume: vol });
    else { b.high = Math.max(b.high, price); b.low = Math.min(b.low, price); b.close = price; b.volume += vol; }
  }
  const candles = [...buckets.entries()].sort(([a], [b]) => a - b).slice(-500).map(([, c]) => c);
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  return res.json({ candles, timeframe: tf });
}

async function handleRecordTrade(mint, req, res) {
  const { signature, trader, side, source, token_amount, sol_amount, price_sol, block_time } = req.body || {};
  if (!signature || !/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature)) return res.status(400).json({ error: "invalid signature" });
  if (!trader || !isValidWallet(trader))   return res.status(400).json({ error: "invalid trader" });
  if (!["buy", "sell"].includes(side))     return res.status(400).json({ error: "side must be buy or sell" });
  if (Number(token_amount) <= 0 || Number(sol_amount) <= 0 || Number(price_sol) <= 0)
    return res.status(400).json({ error: "invalid trade amounts" });
  const row = {
    signature, mint, trader, side,
    source: source || "curve",
    token_amount: Number(token_amount), sol_amount: Number(sol_amount), price_sol: Number(price_sol),
    block_time: block_time ? new Date(block_time).toISOString() : new Date().toISOString(),
  };
  const { error } = await getClient().from("trades").upsert(row, { onConflict: "signature", ignoreDuplicates: true });
  if (error) throw error;
  return res.status(201).json({ ok: true });
}

async function handleSyncTrades(mint, req, res) {
  const { Connection } = getWeb3();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const conn  = new Connection(RPC_ENDPOINT, "confirmed");
  const pdas  = deriveCurvePdas(mint);
  const { curveTreasurySol, curvePoolVault, raydiumPoolState } = pdas;

  const [curveSigs, raydiumSigs] = await Promise.all([
    conn.getSignaturesForAddress(curveTreasurySol, { limit }).catch(() => []),
    conn.getSignaturesForAddress(raydiumPoolState, { limit }).catch(() => []),
  ]);
  const bySignature = new Map();
  for (const sig of curveSigs) bySignature.set(sig.signature, { ...sig, sources: new Set(["curve"]) });
  for (const sig of raydiumSigs) {
    const ex = bySignature.get(sig.signature);
    if (ex) ex.sources.add("raydium");
    else bySignature.set(sig.signature, { ...sig, sources: new Set(["raydium"]) });
  }
  const sigs = [...bySignature.values()].sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0)).slice(0, limit);
  if (!sigs.length) return res.json({ synced: 0, message: "No transactions found for this mint" });

  const rowsBySignature = new Map();
  const treasuryStr = curveTreasurySol.toBase58();
  const vaultStr    = curvePoolVault.toBase58();

  for (let i = 0; i < sigs.length; i += 20) {
    if (i > 0) await sleep(150);
    const batch = sigs.slice(i, i + 20);
    const txs   = await fetchTransactionsBatch(conn, batch);
    for (let j = 0; j < txs.length; j++) {
      const tx  = txs[j];
      const sig = batch[j];
      if (!tx || tx.meta?.err) continue;

      if (sig.sources?.has("raydium")) {
        const raydiumRow = parseRaydiumSwap(tx, sig, mint, pdas);
        if (raydiumRow) { rowsBySignature.set(raydiumRow.signature, raydiumRow); continue; }
      }

      const event = parseCurveTradeEvents(tx.meta?.logMessages || [], mint)[0];
      if (event) {
        rowsBySignature.set(sig.signature, { signature: sig.signature, ...event, block_time: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : event.block_time });
        continue;
      }

      const accounts = getTransactionAccounts(tx);
      const tIdx = accounts.indexOf(treasuryStr);
      if (tIdx === -1) continue;
      const preSol  = (tx.meta.preBalances[tIdx]  || 0) / LAMPORTS_PER_SOL;
      const postSol = (tx.meta.postBalances[tIdx] || 0) / LAMPORTS_PER_SOL;
      const solDelta = postSol - preSol;
      if (Math.abs(solDelta) < 0.000001) continue;
      const trader = accounts[0] || "";
      if (!isValidWallet(trader)) continue;
      const preT  = (tx.meta.preTokenBalances  || []).find(b => b.mint === mint && accounts[b.accountIndex] === vaultStr);
      const postT = (tx.meta.postTokenBalances || []).find(b => b.mint === mint && accounts[b.accountIndex] === vaultStr);
      const postTokenReserve = postT ? Number(postT.uiTokenAmount?.uiAmountString || postT.uiTokenAmount?.uiAmount || 0) : 0;
      const tokenAmount = (preT && postT) ? Math.abs(Number(preT.uiTokenAmount?.uiAmountString || 0) - Number(postT.uiTokenAmount?.uiAmountString || 0)) : 0;
      if (tokenAmount <= 0) continue;
      rowsBySignature.set(sig.signature, {
        signature: sig.signature, mint, trader,
        side: solDelta > 0 ? "buy" : "sell",
        source: "curve", token_amount: tokenAmount,
        sol_amount: Math.abs(solDelta),
        price_sol: Math.abs(solDelta) / tokenAmount || (postTokenReserve > 0 ? postSol / postTokenReserve : 0),
        block_time: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
      });
    }
  }

  const validRows = [...rowsBySignature.values()].filter(r =>
    ["buy","sell"].includes(r.side) && Number(r.price_sol) > 0 && Number(r.token_amount) > 0 && Number(r.sol_amount) > 0
  );
  if (!validRows.length) return res.json({ synced: 0, total_sigs: sigs.length, message: "Parsed transactions had no valid trade amounts" });

  const { error } = await getClient().from("trades").upsert(validRows, { onConflict: "signature", ignoreDuplicates: true });
  if (error) throw error;
  return res.json({ synced: validRows.length, total_sigs: sigs.length, curve_sigs: curveSigs.length, raydium_sigs: raydiumSigs.length });
}

// ── Metaplex-compatible metadata JSON ────────────────────────────────────────

async function handleMetadataJson(mint, res) {
  const { data, error } = await getClient()
    .from("tokens")
    .select("name, symbol, logo_uri, description, website, twitter, telegram")
    .eq("mint", mint)
    .single();
  if (error || !data) return res.status(404).json({ error: "not found" });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://humbletrust.vercel.app";

  const image = data.logo_uri || `${baseUrl}/HTlogo512.png`;

  const metadata = {
    name: data.name || "Unknown Token",
    symbol: data.symbol || "???",
    description: data.description || `${data.name || "Token"} launched on HumbleTrust — the trust-layer for Solana tokens.`,
    image,
    external_url: `${baseUrl}/token/${mint}`,
    attributes: [
      { trait_type: "Platform", value: "HumbleTrust" },
      { trait_type: "Chain", value: "Solana" },
    ],
    properties: {
      files: image ? [{ uri: image, type: "image/png" }] : [],
      category: "token",
    },
  };
  if (data.twitter) metadata.attributes.push({ trait_type: "Twitter", value: data.twitter });
  if (data.website) metadata.attributes.push({ trait_type: "Website", value: data.website });

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json(metadata);
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Supabase not configured" });

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const mint    = pathParts[0];
  const subpath = pathParts[1];

  // ── Root /api/tokens — list (GET) or upsert (POST) ────────────────────────
  if (!mint) {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "GET") {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const { data, error } = await getClient().from("tokens").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return res.json({ tokens: data });
    }

    if (req.method === "POST") {
      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (!internalSecret) return res.status(503).json({ error: "auth_not_configured" });
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      let authorized = false;
      try {
        const a = Buffer.from(token), b = Buffer.from(internalSecret);
        authorized = a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch { authorized = false; }
      if (!authorized) return res.status(401).json({ error: "unauthorized" });
      const { mint: m, creator, name, symbol, signature, launchScore, lockPercent, burnOption, certificateMint, tier, logoUri, logo_uri, raydium_pool, description, website, twitter, telegram } = req.body || {};
      if (!m || !creator) return res.status(400).json({ error: "mint and creator required" });
      if (!isValidWallet(m)) return res.status(400).json({ error: "invalid mint address" });
      if (!isValidWallet(creator)) return res.status(400).json({ error: "invalid creator address" });
      if (name && typeof name === "string" && name.length > 64) return res.status(400).json({ error: "name too long (max 64)" });
      if (symbol && typeof symbol === "string" && symbol.length > 10) return res.status(400).json({ error: "symbol too long (max 10)" });
      const score = Math.min(100, Math.max(0, Number(launchScore) || 0));
      const { error } = await getClient().from("tokens").upsert({
        mint: m, creator, name: name || null, symbol: symbol || null, launch_tx: signature || null,
        launch_score: score, trust_score: score, trust_level: getTrustLevel(score),
        lock_percent: lockPercent || null, burn_option: burnOption || null, certificate_mint: certificateMint || null,
        logo_uri: logoUri || logo_uri || null, tier: tier === 1 ? "premium" : "standard",
        description: (description && typeof description === "string") ? description.slice(0, 200) : null,
        website: (website && typeof website === "string") ? website.slice(0, 255) : null,
        twitter: (twitter && typeof twitter === "string") ? twitter.slice(0, 100) : null,
        telegram: (telegram && typeof telegram === "string") ? telegram.slice(0, 255) : null,
        ...(raydium_pool ? { raydium_pool, status: "migrated" } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: "mint", ignoreDuplicates: false });
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  try {
    if (subpath === "metadata.json") {
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      return await handleMetadataJson(mint, res);
    }

    if (subpath === "trades") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (req.method === "GET") {
        if (req.query.format === "ohlcv") return await handleGetOhlcv(mint, req, res);
        return await handleGetTrades(mint, req, res);
      }
      if (req.method === "POST") {
        const internalSecret2 = process.env.INTERNAL_API_SECRET;
        if (!internalSecret2) return res.status(503).json({ error: "auth_not_configured" });
        const authHeader2 = req.headers["authorization"] || "";
        const token2 = authHeader2.startsWith("Bearer ") ? authHeader2.slice(7) : "";
        let authorized2 = false;
        try {
          const a2 = Buffer.from(token2), b2 = Buffer.from(internalSecret2);
          authorized2 = a2.length === b2.length && crypto.timingSafeEqual(a2, b2);
        } catch { authorized2 = false; }
        if (!authorized2) return res.status(401).json({ error: "unauthorized" });
        if (req.query.action === "sync") return await handleSyncTrades(mint, req, res);
        return await handleRecordTrade(mint, req, res);
      }
      return res.status(405).json({ error: "Method not allowed" });
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (req.query.check === "health") return await handleHealth(mint, req, res);
    return await handleTokenInfo(mint, res);

  } catch (e) {
    console.error("[api/tokens/[...path]]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
