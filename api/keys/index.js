const { generateKey, hashKey, PLAN_LIMITS } = require("../_lib/apiKey");
const { getClient } = require("../_lib/db");

// POST /api/keys — generate a free API key
// GET  /api/keys/me — handled by me.js
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "POST") {
    const { email, wallet, label } = req.body || {};

    if (!email && !wallet) {
      return res.status(400).json({ error: "email or wallet required" });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRe.test(email)) {
      return res.status(400).json({ error: "invalid email" });
    }

    const db = getClient();

    // max 3 active free keys per email
    if (email) {
      const { count } = await db
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("owner_email", email)
        .eq("revoked", false);

      if ((count || 0) >= 3) {
        return res.status(429).json({ error: "max_keys_reached", message: "Maximum 3 active keys per email on free plan." });
      }
    }

    const key = generateKey();
    const hash = hashKey(key);
    const prefix = key.slice(0, 12);

    const { error } = await db.from("api_keys").insert({
      key_hash: hash,
      key_prefix: prefix,
      owner_email: email || null,
      owner_wallet: wallet || null,
      plan: "free",
      daily_limit: PLAN_LIMITS.free,
      label: label || null,
    });

    if (error) {
      console.error("Key insert error", error);
      return res.status(500).json({ error: "internal_error" });
    }

    return res.status(201).json({
      key,
      prefix,
      plan: "free",
      daily_limit: PLAN_LIMITS.free,
      message: "Store this key securely — it will not be shown again.",
      docs: "https://humbletrust.xyz/api",
    });
  }

  return res.status(405).json({ error: "method_not_allowed" });
};
