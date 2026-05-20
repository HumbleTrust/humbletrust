import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const { mint } = req.query as { mint: string };
  try {
    const { rows } = await query(`SELECT * FROM tokens WHERE mint = $1`, [mint]);
    if (!rows.length) return res.status(404).json({ error: "Token not found" });
    return res.json({ token: rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
