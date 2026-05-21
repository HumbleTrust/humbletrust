const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

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
    console.error("[api/tokens/[mint]/trades]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
