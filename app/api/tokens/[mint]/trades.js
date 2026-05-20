const { query } = require("../../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const { mint } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  try {
    const { rows } = await query(
      "SELECT * FROM trades WHERE mint = $1 ORDER BY block_time DESC LIMIT $2",
      [mint, limit]
    );
    return res.json({ trades: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
