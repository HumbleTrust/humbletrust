/**
 * GET /api/tokens/:mint                  — token info
 * GET /api/tokens/:mint?check=health     — health metrics
 * GET /api/tokens/:mint/metadata.json    — Metaplex-compatible metadata (if subpath)
 */

const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

async function handleTokenInfo(mint, res) {
  const { data, error } = await getClient().from("tokens").select("*").eq("mint", mint).single();
  if (error) return res.status(404).json({ error: "not found" });
  return res.json({ token: data });
}

async function handleHealth(mint, req, res) {
  const db = getClient();
  const now = new Date();
  const h24ago = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const h1ago  = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: token } = await db.from("tokens")
    .select("name, symbol, trust_score, status, created_at, raydium_pool, last_trade_at, volume_sol, trades_count")
    .eq("mint", mint).single();
  if (!token) return res.status(404).json({ error: "Token not found" });

  const [{ data: trades24h }, { data: trades1h }, { data: lastTrade }] = await Promise.all([
    db.from("trades").select("side, sol_amount, price_sol, block_time, trader").eq("mint", mint).gte("block_time", h24ago).order("block_time", { ascending: false }),
    db.from("trades").select("side, sol_amount, price_sol, block_time").eq("mint", mint).gte("block_time", h1ago).order("block_time", { ascending: false }),
    db.from("trades").select("price_sol, block_time, side").eq("mint", mint).order("block_time", { ascending: false }).limit(1).single(),
  ]);

  const t24 = trades24h || [];
  const t1  = trades1h  || [];
  const buys24  = t24.filter(t => t.side === "buy");
  const sells24 = t24.filter(t => t.side === "sell");
  const vol24Sol  = t24.reduce((s, t) => s + Number(t.sol_amount || 0), 0);
  const vol1hSol  = t1.reduce((s,  t) => s + Number(t.sol_amount || 0), 0);
  const prices24  = t24.map(t => Number(t.price_sol)).filter(Boolean);
  const firstPrice = prices24[prices24.length - 1] || 0;
  const lastPrice  = Number(lastTrade?.price_sol || 0);
  const priceChange24h = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const uniqueTraders  = new Set(t24.map(t => t.trader)).size;
  const ratio = buys24.length / Math.max(1, t24.length);

  let health = 50;
  const signals = [];
  if (t24.length >= 20)      { health += 15; signals.push({ type: "active_trading",    delta: +15, msg: "High trade activity (20+ trades/24h)" }); }
  else if (t24.length >= 5)  { health += 5;  signals.push({ type: "moderate_trading",  delta:  +5, msg: "Moderate trade activity (5+ trades/24h)" }); }
  else if (t24.length === 0) { health -= 20; signals.push({ type: "no_recent_trades",  delta: -20, msg: "No trades in last 24h" }); }
  if (ratio >= 0.6)          { health += 10; signals.push({ type: "buy_pressure",      delta: +10, msg: "Strong buy pressure (60%+ buys)" }); }
  else if (ratio < 0.3)      { health -= 15; signals.push({ type: "sell_pressure",     delta: -15, msg: "Heavy sell pressure (<30% buys)" }); }
  if (vol24Sol > 10)         { health += 10; signals.push({ type: "high_volume",        delta: +10, msg: "High volume (>10 SOL/24h)" }); }
  if (uniqueTraders >= 10)   { health += 5;  signals.push({ type: "diverse_traders",   delta:  +5, msg: "10+ unique traders in 24h" }); }
  if (priceChange24h < -30)  { health -= 20; signals.push({ type: "price_crash",        delta: -20, msg: "Price dropped >30% in 24h" }); }
  else if (priceChange24h > 50) { health -= 10; signals.push({ type: "pump_warning",   delta: -10, msg: "Price up >50% — possible pump" }); }

  health = Math.max(0, Math.min(100, health));
  const healthLevel = health >= 70 ? "HEALTHY" : health >= 40 ? "NORMAL" : health >= 20 ? "WARNING" : "CRITICAL";

  return res.json({
    mint, name: token.name, symbol: token.symbol,
    health_score: health, health_level: healthLevel,
    metrics: {
      trades_24h: t24.length, buys_24h: buys24.length, sells_24h: sells24.length,
      volume_sol_24h: Math.round(vol24Sol * 1e4) / 1e4,
      volume_sol_1h:  Math.round(vol1hSol * 1e4) / 1e4,
      price_change_24h: Math.round(priceChange24h * 100) / 100,
      current_price: lastPrice, unique_traders: uniqueTraders,
      buy_sell_ratio: t24.length > 0 ? Math.round(ratio * 100) / 100 : null,
    },
    signals, trust_score: token.trust_score, status: token.status,
    computed_at: now.toISOString(),
  });
}

async function handleMetadataJson(mint, res) {
  const { data, error } = await getClient()
    .from("tokens")
    .select("name, symbol, logo_uri, description, website, twitter, telegram")
    .eq("mint", mint)
    .single();
  if (error || !data) return res.status(404).json({ error: "not found" });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://humbletrust.vercel.app";

  const image = data.logo_uri || `${baseUrl}/HTlogo512.png`;
  const metadata = {
    name: data.name || "Unknown Token",
    symbol: data.symbol || "???",
    description: data.description || `${data.name || "Token"} launched on HumbleTrust — the trust-layer for Solana tokens.`,
    image,
    external_url: `${baseUrl}/token/${mint}`,
    attributes: [
      { trait_type: "Platform", value: "HumbleTrust" },
      { trait_type: "Chain", value: "Solana" },
    ],
    properties: {
      files: image ? [{ uri: image, type: "image/png" }] : [],
      category: "token",
    },
  };
  if (data.twitter) metadata.attributes.push({ trait_type: "Twitter", value: data.twitter });
  if (data.website) metadata.attributes.push({ trait_type: "Website", value: data.website });

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json(metadata);
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Supabase not configured" });

  const mint = req.query.mint;
  if (!mint || !isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    // Support /api/tokens/:mint/metadata.json via query param fallback
    if (req.query.subpath === "metadata.json") return await handleMetadataJson(mint, res);
    if (req.query.check === "health") return await handleHealth(mint, req, res);
    return await handleTokenInfo(mint, res);
  } catch (e) {
    console.error("[api/tokens/[mint]]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
