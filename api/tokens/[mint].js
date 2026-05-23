const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  try {
    const { data, error } = await getClient()
      .from("tokens")
      .select("*")
      .eq("mint", mint)
      .single();
    if (error) return res.status(404).json({ error: "not found" });
    return res.json({ token: data });
  } catch (e) {
    console.error("[api/tokens/[mint]]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
