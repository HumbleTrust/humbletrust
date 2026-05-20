import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const { mint } = req.query as { mint: string };
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  try {
    const { rows } = await query(
      `SELECT signature, trader, side, source, token_amount, sol_amount, price_sol, block_time
       FROM trades WHERE mint = $1 ORDER BY block_time DESC LIMIT $2`,
      [mint, limit]
    );
    return res.json({ trades: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
