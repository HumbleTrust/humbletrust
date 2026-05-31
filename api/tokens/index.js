const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");
const { getTrustLevel } = require("../_lib/trust");

module.exports = async (req, res) => {
  setCors(req, res);
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
      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (internalSecret) {
        const authHeader = req.headers["authorization"] || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (token !== internalSecret) {
          return res.status(401).json({ error: "unauthorized" });
        }
      }

      const {
        mint, creator, name, symbol, signature, launchScore, lockPercent,
        burnOption, certificateMint, tier, logoUri, logo_uri, raydium_pool,
        description, website, twitter, telegram,
      } = req.body || {};

      if (!mint || !creator) return res.status(400).json({ error: "mint and creator required" });
      if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });
      if (!isValidWallet(creator)) return res.status(400).json({ error: "invalid creator address" });
      if (name && typeof name === 'string' && name.length > 64) return res.status(400).json({ error: "name too long (max 64)" });
      if (symbol && typeof symbol === 'string' && symbol.length > 10) return res.status(400).json({ error: "symbol too long (max 10)" });

      const score = Math.min(100, Math.max(0, Number(launchScore) || 0));
      const trustLevel = getTrustLevel(score);
      const tierValue = tier === 1 ? 'premium' : 'standard';

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
        logo_uri: logoUri || logo_uri || null,
        tier: tierValue,
        description: (description && typeof description === 'string') ? description.slice(0, 200) : null,
        website: (website && typeof website === 'string') ? website.slice(0, 255) : null,
        twitter: (twitter && typeof twitter === 'string') ? twitter.slice(0, 100) : null,
        telegram: (telegram && typeof telegram === 'string') ? telegram.slice(0, 255) : null,
        ...(raydium_pool ? { raydium_pool, status: "migrated" } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: "mint", ignoreDuplicates: false });

      if (error) throw error;
      console.info('[api/tokens] upsert mint=%s creator=%s tier=%s score=%d', mint.slice(0,8), creator.slice(0,8), tierValue, score);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[api/tokens]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
