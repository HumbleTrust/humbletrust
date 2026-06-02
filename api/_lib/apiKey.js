const crypto = require("crypto");
const { getClient } = require("./db");

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateKey() {
  const rand = crypto.randomBytes(20).toString("hex");
  return `ht_live_${rand}`;
}

const PLAN_LIMITS = {
  free:       50,
  pro:        10000,
  enterprise: 999999,
  nft:        10000,
};

async function validateApiKey(req) {
  const authHeader = req.headers["authorization"] || "";
  const key =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() :
    (req.query?.api_key || "").trim();

  if (!key) return { valid: false, plan: "free", dailyLimit: PLAN_LIMITS.free, keyId: null };

  const hash = hashKey(key);
  const db = getClient();

  const { data, error } = await db
    .from("api_keys")
    .select("id, plan, daily_limit, revoked, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !data)    return { valid: false, error: "invalid_key" };
  if (data.revoked)      return { valid: false, error: "revoked_key" };
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { valid: false, error: "expired_key" };

  return {
    valid: true,
    keyId: data.id,
    plan: data.plan,
    dailyLimit: data.daily_limit ?? PLAN_LIMITS[data.plan] ?? PLAN_LIMITS.free,
  };
}

async function checkRateLimit(keyId, ip, dailyLimit) {
  const db = getClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = db.from("api_usage").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (keyId) query = query.eq("key_id", keyId);
  else       query = query.is("key_id", null).eq("ip", ip);

  const { count } = await query;
  const used = count || 0;

  return { used, limit: dailyLimit, exceeded: used >= dailyLimit };
}

async function trackUsage({ keyId, ip, mint, format, cached }) {
  const db = getClient();
  await db.from("api_usage").insert({ key_id: keyId || null, ip, mint, format, cached });
}

async function handleApiAuth(req, res) {
  const keyData = await validateApiKey(req).catch(() => ({ valid: false, plan: "free", dailyLimit: PLAN_LIMITS.free, keyId: null }));

  if (keyData.error) {
    res.setHeader("WWW-Authenticate", "Bearer realm=\"HumbleTrust API\"");
    res.status(401).json({ error: keyData.error, docs: "https://humbletrust.vercel.app/api" });
    return null;
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const rl = await checkRateLimit(keyData.keyId, ip, keyData.dailyLimit).catch(() => ({ used: 0, limit: keyData.dailyLimit, exceeded: true }));

  if (rl.exceeded) {
    res.setHeader("X-RateLimit-Limit",     String(rl.limit));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset",     String(Math.floor(Date.now() / 1000) + 3600));
    res.status(429).json({
      error: "rate_limit_exceeded",
      plan: keyData.plan,
      used: rl.used,
      limit: rl.limit,
      reset_in: "24h",
      upgrade: "https://humbletrust.vercel.app/api#plans",
    });
    return null;
  }

  res.setHeader("X-RateLimit-Limit",     String(rl.limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, rl.limit - rl.used - 1)));
  res.setHeader("X-Plan",                keyData.plan);

  return { ...keyData, ip, usage: rl };
}

module.exports = { generateKey, hashKey, validateApiKey, checkRateLimit, trackUsage, handleApiAuth, PLAN_LIMITS };
