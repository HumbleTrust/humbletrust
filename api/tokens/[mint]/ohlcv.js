const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

const TF_SECONDS = {
  "1s": 1, "5s": 5, "15s": 15,
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  const tf = req.query.tf || "1m";
  const periodSec = TF_SECONDS[tf] || 60;
  const limit = Math.min(Number(req.query.limit) || 500, 1000);

  try {
    const { data, error } = await getClient()
      .from("trades")
      .select("price_sol, sol_amount, token_amount, block_time, side")
      .eq("mint", mint)
      .gt("price_sol", 0)
      .order("block_time", { ascending: true })
      .limit(limit);

    if (error) throw error;
    if (!data || data.length === 0) return res.json({ candles: [], timeframe: tf });

    // Aggregate into OHLCV buckets
    const buckets = new Map();
    for (const row of data) {
      const ts = Math.floor(new Date(row.block_time).getTime() / 1000);
      const bucket = Math.floor(ts / periodSec) * periodSec;
      const price = Number(row.price_sol);
      const vol = Number(row.sol_amount);
      const b = buckets.get(bucket);
      if (!b) {
        buckets.set(bucket, { time: bucket, open: price, high: price, low: price, close: price, volume: vol, volumeSol: vol });
      } else {
        b.high = Math.max(b.high, price);
        b.low = Math.min(b.low, price);
        b.close = price;
        b.volume += vol;
        b.volumeSol += vol;
      }
    }

    const candles = [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, c]) => c);

    return res.json({ candles, timeframe: tf });
  } catch (e) {
    console.error("[api/tokens/[mint]/ohlcv]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
