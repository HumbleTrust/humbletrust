const { getClient } = require("../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const db = getClient();

  try {
    if (req.method === "GET") {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const { data, error } = await db
        .from("tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return res.json({ tokens: data });
    }

    if (req.method === "POST") {
      const { mint, creator, name, symbol, signature, launchScore, lockPercent, burnOption, certificateMint, tier } = req.body || {};
      if (!mint || !creator) {
        return res.status(400).json({ error: "mint and creator required" });
      }

      const score = Math.min(100, Math.max(0, Number(launchScore) || 0));
      const trustLevel = score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

      const { error } = await db.from("tokens").upsert({
        mint,
        creator,
        name: name || null,
        symbol: symbol || null,
        launch_tx: signature || null,
        launch_score: score,
        trust_score: score,
        trust_level: trustLevel,
        lock_percent: lockPercent || null,
        burn_option: burnOption || null,
        certificate_mint: certificateMint || null,
        tier: tier === 1 ? 'premium' : 'standard',
        updated_at: new Date().toISOString(),
      }, { onConflict: "mint", ignoreDuplicates: false });

      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[api/tokens]", e.message);
    return res.status(500).json({ error: e.message });
  }
};
