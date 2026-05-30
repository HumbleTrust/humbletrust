const { validateApiKey, checkRateLimit } = require("../_lib/apiKey");
const { getClient } = require("../_lib/db");

// GET /api/keys/me — key info + 30-day usage breakdown
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const keyData = await validateApiKey(req).catch(() => null);
  if (!keyData || !keyData.valid) {
    return res.status(401).json({ error: "invalid_key" });
  }

  const db = getClient();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [keyRow, usageLast30d, rl] = await Promise.all([
    db.from("api_keys")
      .select("key_prefix, plan, daily_limit, label, created_at, owner_email")
      .eq("id", keyData.keyId)
      .single(),

    db.from("api_usage")
      .select("ts, cached, format")
      .eq("key_id", keyData.keyId)
      .gte("ts", since30d)
      .order("ts", { ascending: false })
      .limit(1000),

    checkRateLimit(keyData.keyId, null, keyData.dailyLimit),
  ]);

  const rows = usageLast30d.data || [];

  // daily bucketing
  const byDay = {};
  for (const r of rows) {
    const d = r.ts.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }

  return res.status(200).json({
    key_prefix: keyRow.data?.key_prefix,
    plan: keyRow.data?.plan,
    label: keyRow.data?.label,
    created_at: keyRow.data?.created_at,
    limits: {
      daily: keyData.dailyLimit,
      used_today: rl.used,
      remaining_today: Math.max(0, rl.limit - rl.used),
    },
    usage_30d: {
      total: rows.length,
      cached: rows.filter(r => r.cached).length,
      by_day: byDay,
    },
    upgrade: keyData.plan === "free" ? "https://humbletrust.xyz/api#plans" : null,
  });
};
