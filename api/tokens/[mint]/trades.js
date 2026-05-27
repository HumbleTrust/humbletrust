/**
 * Unified trades endpoint for a mint.
 *
 * GET  /api/tokens/:mint/trades               → list trades
 * GET  /api/tokens/:mint/trades?format=ohlcv  → OHLCV candles
 * POST /api/tokens/:mint/trades               → record a single trade
 * POST /api/tokens/:mint/trades?action=sync   → backfill from Solana RPC
 */

const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");
const { parseCurveTradeEvents } = require("../../_lib/curve-events");

const PROGRAM_ID_V2    = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RAYDIUM_CPMM     = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb";
const WSOL_MINT        = "So11111111111111111111111111111111111111112";
const RPC_ENDPOINT     = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

const TF_SECONDS = {
  "1s": 1, "5s": 5, "15s": 15,
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

let web3;
function getWeb3() {
  if (!web3) web3 = require("@solana/web3.js");
  return web3;
}

function deriveCurvePdas(mint) {
  const { PublicKey } = getWeb3();
  const mintPk    = new PublicKey(mint);
  const programPk = new PublicKey(PROGRAM_ID_V2);
  const enc = s => Buffer.from(s);
  const pda = seeds => PublicKey.findProgramAddressSync(seeds, programPk)[0];
  return {
    curveTreasurySol: pda([enc("curve_treasury_sol_v2"), mintPk.toBuffer()]),
    curvePoolVault:   pda([enc("curve_pool_vault_v2"),    mintPk.toBuffer()]),
  };
}

function deriveRaydiumVaults(poolState, mint) {
  const { PublicKey } = getWeb3();
  const raydiumPk   = new PublicKey(RAYDIUM_CPMM);
  const poolStatePk = new PublicKey(poolState);
  const mintPk      = new PublicKey(mint);
  const wsolPk      = new PublicKey(WSOL_MINT);
  const pda = seeds => PublicKey.findProgramAddressSync(seeds, raydiumPk)[0];
  return {
    wsolVault: pda([Buffer.from("pool_vault"), poolStatePk.toBuffer(), wsolPk.toBuffer()]),
    mintVault: pda([Buffer.from("pool_vault"), poolStatePk.toBuffer(), mintPk.toBuffer()]),
  };
}

async function handleGetTrades(mint, req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { data, error } = await getClient()
    .from("trades").select("*")
    .eq("mint", mint)
    .in("side", ["buy", "sell"])
    .gt("price_sol", 0)
    .gt("token_amount", 0)
    .gt("sol_amount", 0)
    .order("block_time", { ascending: false }).limit(limit);
  if (error) throw error;
  return res.json({ trades: data || [] });
}

async function handleGetOhlcv(mint, req, res) {
  const tf        = req.query.tf || "1m";
  const periodSec = TF_SECONDS[tf] || 60;
  const limit     = Math.min(Number(req.query.limit) || 500, 1000);
  const { data, error } = await getClient()
    .from("trades")
    .select("price_sol, sol_amount, block_time")
    .eq("mint", mint)
    .in("side", ["buy", "sell"])
    .gt("price_sol", 0)
    .gt("token_amount", 0)
    .gt("sol_amount", 0)
    .order("block_time", { ascending: true }).limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return res.json({ candles: [], timeframe: tf });

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
  const candles = [...buckets.entries()].sort(([a], [b]) => a - b).map(([, c]) => c);
  return res.json({ candles, timeframe: tf });
}

async function handleRecordTrade(mint, req, res) {
  const { signature, trader, side, source, token_amount, sol_amount, price_sol, block_time } = req.body || {};
  if (!signature || signature.length < 10) return res.status(400).json({ error: "invalid signature" });
  if (!trader || !isValidWallet(trader))   return res.status(400).json({ error: "invalid trader" });
  if (!["buy", "sell"].includes(side))     return res.status(400).json({ error: "side must be buy or sell" });
  if (Number(token_amount) <= 0 || Number(sol_amount) <= 0 || Number(price_sol) <= 0) {
    return res.status(400).json({ error: "invalid trade amounts" });
  }

  const row = {
    signature, mint, trader, side,
    source:       source || "curve",
    token_amount: Number(token_amount) || 0,
    sol_amount:   Number(sol_amount)   || 0,
    price_sol:    Number(price_sol)    || 0,
    block_time:   block_time ? new Date(block_time).toISOString() : new Date().toISOString(),
  };
  const { error } = await getClient().from("trades").upsert(row, { onConflict: "signature", ignoreDuplicates: true });
  if (error) {
    console.error("[trades:record] supabase error", error.message, "sig:", signature?.slice(0, 20));
    throw error;
  }
  console.log("[trades:record] ok sig:", signature?.slice(0, 20), "mint:", mint?.slice(0, 8), "price:", row.price_sol);
  return res.status(201).json({ ok: true });
}

async function syncCurveTrades(mint, conn, limit) {
  const { curveTreasurySol, curvePoolVault } = deriveCurvePdas(mint);
  const sigs = await conn.getSignaturesForAddress(curveTreasurySol, { limit });
  if (!sigs || sigs.length === 0) return { rows: [], totalSigs: 0 };

  const rows        = [];
  const treasuryStr = curveTreasurySol.toBase58();
  const vaultStr    = curvePoolVault.toBase58();

  for (let i = 0; i < sigs.length; i += 10) {
    const batch = sigs.slice(i, i + 10);
    const txs   = await Promise.all(
      batch.map(s => conn.getTransaction(s.signature, {
        commitment: "confirmed", maxSupportedTransactionVersion: 0,
      }).catch(() => null))
    );
    for (let j = 0; j < txs.length; j++) {
      const tx  = txs[j];
      const sig = batch[j];
      if (!tx || tx.meta?.err) continue;

      const event = parseCurveTradeEvents(tx.meta?.logMessages || [], mint)[0];
      if (event) {
        rows.push({
          signature: sig.signature,
          ...event,
          block_time: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : event.block_time,
        });
        continue;
      }

      const accounts = (tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys || [])
        .map(k => typeof k === "string" ? k : k.toBase58());
      const tIdx = accounts.indexOf(treasuryStr);
      if (tIdx === -1) continue;

      const preSol   = (tx.meta.preBalances[tIdx]  || 0) / LAMPORTS_PER_SOL;
      const postSol  = (tx.meta.postBalances[tIdx] || 0) / LAMPORTS_PER_SOL;
      const solDelta = postSol - preSol;
      if (Math.abs(solDelta) < 0.000001) continue;

      const trader = accounts[0] || "";
      if (!isValidWallet(trader)) continue;

      const preT  = (tx.meta.preTokenBalances  || []).find(b => b.mint === mint && accounts[b.accountIndex] === vaultStr);
      const postT = (tx.meta.postTokenBalances || []).find(b => b.mint === mint && accounts[b.accountIndex] === vaultStr);

      const postTokenReserve = postT ? Number(postT.uiTokenAmount?.uiAmountString || postT.uiTokenAmount?.uiAmount || 0) : 0;
      const tokenAmount      = (preT && postT)
        ? Math.abs(Number(preT.uiTokenAmount?.uiAmountString || 0) - Number(postT.uiTokenAmount?.uiAmountString || 0))
        : 0;
      if (tokenAmount <= 0) continue;

      rows.push({
        signature:    sig.signature,
        mint, trader,
        side:         solDelta > 0 ? "buy" : "sell",
        source:       "curve",
        token_amount: tokenAmount,
        sol_amount:   Math.abs(solDelta),
        price_sol:    postTokenReserve > 0 ? postSol / postTokenReserve : 0,
        block_time:   sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
      });
    }
  }

  return { rows, totalSigs: sigs.length };
}

async function syncRaydiumTrades(mint, raydiumPool, conn, limit) {
  const { wsolVault, mintVault } = deriveRaydiumVaults(raydiumPool, mint);
  const wsolVaultStr = wsolVault.toBase58();
  const mintVaultStr = mintVault.toBase58();

  const sigs = await conn.getSignaturesForAddress(mintVault, { limit });
  if (!sigs || sigs.length === 0) return { rows: [], totalSigs: 0 };

  const rows = [];

  for (let i = 0; i < sigs.length; i += 10) {
    const batch = sigs.slice(i, i + 10);
    const txs   = await Promise.all(
      batch.map(s => conn.getTransaction(s.signature, {
        commitment: "confirmed", maxSupportedTransactionVersion: 0,
      }).catch(() => null))
    );

    for (let j = 0; j < txs.length; j++) {
      const tx  = txs[j];
      const sig = batch[j];
      if (!tx || tx.meta?.err) continue;

      const accounts = (tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys || [])
        .map(k => typeof k === "string" ? k : k.toBase58());

      const wsolIdx = accounts.indexOf(wsolVaultStr);
      const mintIdx = accounts.indexOf(mintVaultStr);
      if (wsolIdx === -1 || mintIdx === -1) continue;

      const pre  = tx.meta.preTokenBalances  || [];
      const post = tx.meta.postTokenBalances || [];

      const getBal = (bals, idx) => {
        const b = bals.find(b => b.accountIndex === idx);
        return b ? Number(b.uiTokenAmount?.uiAmountString || b.uiTokenAmount?.uiAmount || 0) : 0;
      };

      const preWsol  = getBal(pre,  wsolIdx);
      const postWsol = getBal(post, wsolIdx);
      const preMint  = getBal(pre,  mintIdx);
      const postMint = getBal(post, mintIdx);

      const wsolDelta = postWsol - preWsol;
      const mintDelta = postMint - preMint;

      const DUST = 0.000001;
      if (Math.abs(wsolDelta) < DUST || Math.abs(mintDelta) < DUST) continue;

      // Liquidity add/remove (both vaults move same direction) → skip
      if (wsolDelta > 0 && mintDelta > 0) continue;
      if (wsolDelta < 0 && mintDelta < 0) continue;

      // wsolDelta > 0 → SOL entered pool → user bought tokens
      // wsolDelta < 0 → SOL left pool    → user sold tokens
      const side         = wsolDelta > 0 ? "buy" : "sell";
      const sol_amount   = Math.abs(wsolDelta);
      const token_amount = Math.abs(mintDelta);
      // Post-swap pool price: SOL reserve / token reserve
      const price_sol    = postMint > 0 ? postWsol / postMint : 0;

      const trader = accounts[0] || "";
      if (!isValidWallet(trader)) continue;

      rows.push({
        signature:    sig.signature,
        mint,
        trader,
        side,
        source:       "raydium",
        token_amount,
        sol_amount,
        price_sol,
        block_time:   sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
      });
    }
  }

  return { rows, totalSigs: sigs.length };
}

async function handleSyncTrades(mint, req, res) {
  const { Connection } = getWeb3();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const conn  = new Connection(RPC_ENDPOINT, "confirmed");

  // Fetch raydium_pool for this mint (if migrated)
  const { data: tokenRow } = await getClient()
    .from("tokens").select("raydium_pool").eq("mint", mint).single();
  const raydiumPool = tokenRow?.raydium_pool || null;

  const allRows  = [];
  let totalSigs  = 0;

  // Always attempt curve sync (preserves pre-migration history)
  try {
    const { rows, totalSigs: n } = await syncCurveTrades(mint, conn, limit);
    allRows.push(...rows);
    totalSigs += n;
  } catch (e) {
    console.warn("[trades:sync] curve sync error:", e.message);
  }

  // Raydium sync when pool is known
  if (raydiumPool) {
    try {
      const { rows, totalSigs: n } = await syncRaydiumTrades(mint, raydiumPool, conn, limit);
      allRows.push(...rows);
      totalSigs += n;
    } catch (e) {
      console.warn("[trades:sync] raydium sync error:", e.message);
    }
  }

  if (allRows.length === 0)
    return res.json({ synced: 0, total_sigs: totalSigs, message: "No parseable trades found" });

  const validRows = allRows.filter(row =>
    ["buy", "sell"].includes(row.side) &&
    Number(row.price_sol)    > 0 &&
    Number(row.token_amount) > 0 &&
    Number(row.sol_amount)   > 0
  );

  if (validRows.length === 0)
    return res.json({ synced: 0, total_sigs: totalSigs, message: "Parsed transactions had no valid trade amounts" });

  const { error } = await getClient().from("trades")
    .upsert(validRows, { onConflict: "signature", ignoreDuplicates: true });
  if (error) throw error;

  const curveCount   = validRows.filter(r => r.source === "curve").length;
  const raydiumCount = validRows.filter(r => r.source === "raydium").length;
  console.log("[trades:sync] mint:", mint.slice(0, 8), "synced:", validRows.length, "curve:", curveCount, "raydium:", raydiumCount);
  return res.json({ synced: validRows.length, total_sigs: totalSigs, curve: curveCount, raydium: raydiumCount });
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Supabase not configured" });

  const { mint } = req.query;
  if (!mint || !isValidWallet(mint)) return res.status(400).json({ error: "invalid mint" });

  try {
    if (req.method === "GET") {
      if (req.query.format === "ohlcv") return await handleGetOhlcv(mint, req, res);
      return await handleGetTrades(mint, req, res);
    }
    if (req.method === "POST") {
      console.log("[trades:POST] action=", req.query.action, "mint:", mint?.slice(0, 8), "body-keys:", Object.keys(req.body || {}));
      if (req.query.action === "sync") return await handleSyncTrades(mint, req, res);
      return await handleRecordTrade(mint, req, res);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[trades]", e.message);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
};
