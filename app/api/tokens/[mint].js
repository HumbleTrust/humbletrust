const { getClient } = require("../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });

  try {
    const { data, error } = await getClient()
      .from("tokens")
      .select("*")
      .eq("mint", mint)
      .single();
    if (error) return res.status(404).json({ error: "not found" });
    return res.json({ token: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
