/**
 * Unified trades endpoint for a mint.
 *
 * GET  /api/tokens/:mint/trades               → list trades
 * GET  /api/tokens/:mint/trades?format=ohlcv  → OHLCV candles
 * POST /api/tokens/:mint/trades               → record a single trade
 * POST /api/tokens/:mint/trades?action=sync   → backfill from Solana RPC
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

const PROGRAM_ID_V2    = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RPC_ENDPOINT     = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

const TF_SECONDS = {
  "1s": 1, "5s": 5, "15s": 15,
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

function derivePdas(mint) {
  const mintPk    = new PublicKey(mint);
  const programPk = new PublicKey(PROGRAM_ID_V2);
  const enc = s => Buffer.from(s);
  const pda = seeds => PublicKey.findProgramAddressSync(seeds, programPk)[0];
  return {
    curveTreasurySol: pda([enc("curve_treasury_sol_v2"), mintPk.toBuffer()]),
    curvePoolVault:   pda([enc("curve_pool_vault_v2"),    mintPk.toBuffer()]),
  };
}

async function handleGetTrades(mint, req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { data, error } = await getClient()
    .from("trades").select("*").eq("mint", mint)
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
    .eq("mint", mint).gt("price_sol", 0)
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

async function handleSyncTrades(mint, req, res) {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const conn  = new Connection(RPC_ENDPOINT, "confirmed");
  const { curveTreasurySol, curvePoolVault } = derivePdas(mint);

  const sigs = await conn.getSignaturesForAddress(curveTreasurySol, { limit });
  if (!sigs || sigs.length === 0)
    return res.json({ synced: 0, message: "No transactions found for this mint" });

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

      const accounts = (tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys || [])
        .map(k => k.toBase58());
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

  if (rows.length === 0)
    return res.json({ synced: 0, message: "Transactions found but none parsed as curve trades" });

  const { error } = await getClient().from("trades")
    .upsert(rows, { onConflict: "signature", ignoreDuplicates: true });
  if (error) throw error;
  return res.json({ synced: rows.length, total_sigs: sigs.length });
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
      if (req.query.action === "sync") return await handleSyncTrades(mint, req, res);
      return await handleRecordTrade(mint, req, res);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[trades]", e.message);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
};
