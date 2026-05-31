const { generateKey, hashKey, validateApiKey, checkRateLimit, PLAN_LIMITS } = require("../_lib/apiKey");
const { getClient } = require("../_lib/db");

// GET  /api/keys   — key info + usage (requires Bearer token)
// POST /api/keys   — generate a free API key
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const keyData = await validateApiKey(req).catch(() => null);
    if (!keyData || !keyData.valid) return res.status(401).json({ error: "invalid_key" });

    const db = getClient();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [keyRow, usageLast30d, rl] = await Promise.all([
      db.from("api_keys").select("key_prefix, plan, daily_limit, label, created_at, owner_email").eq("id", keyData.keyId).single(),
      db.from("api_usage").select("ts, cached, format").eq("key_id", keyData.keyId).gte("ts", since30d).order("ts", { ascending: false }).limit(1000),
      checkRateLimit(keyData.keyId, null, keyData.dailyLimit),
    ]);

    const rows = usageLast30d.data || [];
    const byDay = {};
    for (const r of rows) { const d = r.ts.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }

    return res.status(200).json({
      key_prefix:  keyRow.data?.key_prefix,
      plan:        keyRow.data?.plan,
      label:       keyRow.data?.label,
      created_at:  keyRow.data?.created_at,
      limits: {
        daily:           keyData.dailyLimit,
        used_today:      rl.used,
        remaining_today: Math.max(0, rl.limit - rl.used),
      },
      usage_30d: {
        total:  rows.length,
        cached: rows.filter(r => r.cached).length,
        by_day: byDay,
      },
      upgrade: keyData.plan === "free" ? "https://humbletrust.vercel.app/api#plans" : null,
    });
  }

  if (req.method === "POST") {
    const { email, wallet, label } = req.body || {};
    if (!email && !wallet) return res.status(400).json({ error: "email or wallet required" });
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRe.test(email)) return res.status(400).json({ error: "invalid email" });

    const db = getClient();
    if (email) {
      const { count } = await db.from("api_keys").select("id", { count: "exact", head: true }).eq("owner_email", email).eq("revoked", false);
      if ((count || 0) >= 3) return res.status(429).json({ error: "max_keys_reached", message: "Maximum 3 active keys per email on free plan." });
    }

    const key    = generateKey();
    const hash   = hashKey(key);
    const prefix = key.slice(0, 12);

    const { error } = await db.from("api_keys").insert({
      key_hash: hash, key_prefix: prefix,
      owner_email: email || null, owner_wallet: wallet || null,
      plan: "free", daily_limit: PLAN_LIMITS.free, label: label || null,
    });
    if (error) { console.error("Key insert error", error); return res.status(500).json({ error: "internal_error" }); }

    return res.status(201).json({
      key, prefix, plan: "free", daily_limit: PLAN_LIMITS.free,
      message: "Store this key securely — it will not be shown again.",
      docs: "https://humbletrust.vercel.app/api",
    });
  }

  return res.status(405).json({ error: "method_not_allowed" });
};
