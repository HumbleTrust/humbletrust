import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initSchema } from "./_lib/schema";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL not set" });
  try {
    await initSchema();
    return res.json({ ok: true, message: "Schema initialized" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
