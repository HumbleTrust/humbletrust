import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../../_lib/db";

const TF_INTERVALS: Record<string, string> = {
  "1s": "1 second", "5s": "5 seconds", "30s": "30 seconds",
  "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes",
  "1h": "1 hour", "4h": "4 hours", "1d": "1 day",
};

const TF_LOOKBACK: Record<string, string> = {
  "1s": "2 hours", "5s": "6 hours", "30s": "12 hours",
  "1m": "24 hours", "5m": "3 days", "15m": "7 days",
  "1h": "30 days", "4h": "90 days", "1d": "365 days",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const { mint } = req.query as { mint: string };
  const tf = String(req.query.tf || "1m");
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const interval = TF_INTERVALS[tf] ?? "1 minute";
  const lookback = TF_LOOKBACK[tf] ?? "24 hours";

  try {
    // Try pre-computed ohlcv table first (populated by indexer if running)
    const { rows: stored } = await query(
      `SELECT extract(epoch from bucket)::integer as time, open, high, low, close, volume_token as volume, volume_sol
       FROM ohlcv WHERE mint = $1 AND timeframe = $2
       ORDER BY bucket DESC LIMIT $3`,
      [mint, tf, limit]
    );
    if (stored.length > 0) {
      return res.json({ candles: stored.reverse(), timeframe: tf });
    }

    // Fall back: compute from raw trades
    const { rows } = await query(
      `WITH buckets AS (
        SELECT
          date_trunc($3, block_time) as bucket,
          price_sol,
          token_amount,
          sol_amount,
          row_number() OVER (PARTITION BY date_trunc($3, block_time) ORDER BY block_time) as rn_asc,
          row_number() OVER (PARTITION BY date_trunc($3, block_time) ORDER BY block_time DESC) as rn_desc
        FROM trades
        WHERE mint = $1 AND block_time > now() - $4::interval
      )
      SELECT
        extract(epoch from bucket)::integer as time,
        max(CASE WHEN rn_asc = 1 THEN price_sol END) as open,
        max(price_sol) as high,
        min(price_sol) as low,
        max(CASE WHEN rn_desc = 1 THEN price_sol END) as close,
        sum(token_amount) as volume,
        sum(sol_amount) as volume_sol
      FROM buckets
      GROUP BY bucket
      ORDER BY bucket
      LIMIT $5`,
      [mint, tf, interval, lookback, limit]
    );

    const candles = rows.map(r => ({
      time: Number(r.time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
      volumeSol: Number(r.volume_sol),
    }));

    return res.json({ candles, timeframe: tf });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
