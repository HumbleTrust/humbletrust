const { getClient } = require("../../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  try {
    const { data, error } = await getClient()
      .from("trades")
      .select("*")
      .eq("mint", mint)
      .order("block_time", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return res.json({ trades: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
