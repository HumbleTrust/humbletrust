const { query } = require("../_lib/db");
const { initSchema } = require("../_lib/schema");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  try {
    if (req.method === "GET") {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const { rows } = await query(
        "SELECT * FROM tokens ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
      return res.json({ tokens: rows });
    }

    if (req.method === "POST") {
      await initSchema();
      const { mint, creator, name, symbol, signature, launchScore, lockPercent, burnOption, certificateMint } = req.body || {};
      if (!mint || !creator) {
        return res.status(400).json({ error: "mint and creator required" });
      }

      const score = Math.min(100, Math.max(0, Number(launchScore) || 0));
      const trustLevel = score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

      await query(
        `INSERT INTO tokens (mint, creator, name, symbol, launch_tx, launch_score, trust_score, trust_level, lock_percent, burn_option, certificate_mint)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10)
         ON CONFLICT (mint) DO UPDATE SET
           name = COALESCE(excluded.name, tokens.name),
           symbol = COALESCE(excluded.symbol, tokens.symbol),
           certificate_mint = COALESCE(excluded.certificate_mint, tokens.certificate_mint),
           updated_at = now()`,
        [mint, creator, name || null, symbol || null, signature || null, score, trustLevel, lockPercent || null, burnOption || null, certificateMint || null]
      );
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/tokens]", msg);
    return res.status(500).json({ error: msg });
  }
};
