/**
 * GET  /api/tokens/:mint/trades           — list trades
 * GET  /api/tokens/:mint/trades?format=ohlcv — OHLCV candles
 * POST /api/tokens/:mint/trades?action=sync  — backfill from RPC
 * POST /api/tokens/:mint/trades              — record a single trade (auth required)
 */

const crypto = require("crypto");
const { Connection, PublicKey } = require("@solana/web3.js");
const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");
const { parseCurveTradeEvents } = require("../../_lib/curve-events");

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

function deriveCurvePdas(mint) {
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

async function handleGetTrades(mint, req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { data, error } = await getClient().from("trades").select("*")
    .eq("mint", mint).in("side", ["buy", "sell"])
    .gt("price_sol", 0).gt("token_amount", 0).gt("sol_amount", 0)
    .order("block_time", { ascending: false }).limit(limit);
  if (error) {
    console.warn("[trades] %s error: %s", mint.slice(0, 8), error.message);
    return res.status(500).json({ error: "database_error" });
  }
  return res.json({ trades: data || [] });
}

async function handleGetOhlcv(mint, req, res) {
  const tf        = TF_SECONDS[req.query.tf] ? req.query.tf : "1m";
  const periodSec = TF_SECONDS[tf];
  const tradeFetch = Math.min(Math.max(1, Number(req.query.limit) || 500), 1000);
  const { data, error } = await getClient().from("trades")
    .select("price_sol, sol_amount, token_amount, side, block_time").eq("mint", mint)
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
    if (!b) {
      buckets.set(bucket, {
        time: bucket, open: price, high: price, low: price, close: price, volume: vol,
        buy_volume: row.side === "buy" ? vol : 0, sell_volume: row.side === "sell" ? vol : 0,
      });
    } else {
      b.high = Math.max(b.high, price); b.low = Math.min(b.low, price); b.close = price; b.volume += vol;
      if (row.side === "buy") b.buy_volume += vol; else b.sell_volume += vol;
    }
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
        rowsBySignature.set(sig.signature, {
          signature: sig.signature, ...event,
          block_time: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : event.block_time,
        });
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

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Supabase not configured" });

  const mint = req.query.mint;
  if (!mint || !isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    if (req.method === "GET") {
      if (req.query.format === "ohlcv") return await handleGetOhlcv(mint, req, res);
      return await handleGetTrades(mint, req, res);
    }

    if (req.method === "POST") {
      // Sync reads public on-chain data — no auth needed
      if (req.query.action === "sync") return await handleSyncTrades(mint, req, res);

      // Direct record requires auth
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
      return await handleRecordTrade(mint, req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[trades] %s %s: %s", req.method, mint?.slice(0, 8), e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
