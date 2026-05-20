const { query } = require("../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });

  try {
    const { rows } = await query("SELECT * FROM tokens WHERE mint = $1", [mint]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    return res.json({ token: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
