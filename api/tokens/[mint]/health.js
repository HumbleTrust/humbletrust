const { getClient } = require("../../../_lib/db");
const { isValidWallet, setCors } = require("../../../_lib/validate");

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Service unavailable" });

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  const db = getClient();
  const now = new Date();
  const h24ago = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const h1ago  = new Date(now - 60 * 60 * 1000).toISOString();

  try {
    // Token metadata
    const { data: token } = await db
      .from("tokens")
      .select("name, symbol, trust_score, status, created_at, raydium_pool, last_trade_at, volume_sol, trades_count")
      .eq("mint", mint)
      .single();

    if (!token) return res.status(404).json({ error: "Token not found" });

    // Last 24h trades
    const { data: trades24h } = await db
      .from("trades")
      .select("side, sol_amount, price_sol, block_time, trader")
      .eq("mint", mint)
      .gte("block_time", h24ago)
      .order("block_time", { ascending: false });

    // Last 1h trades
    const { data: trades1h } = await db
      .from("trades")
      .select("side, sol_amount, price_sol, block_time")
      .eq("mint", mint)
      .gte("block_time", h1ago)
      .order("block_time", { ascending: false });

    // All-time last trade
    const { data: lastTrade } = await db
      .from("trades")
      .select("price_sol, block_time, side")
      .eq("mint", mint)
      .order("block_time", { ascending: false })
      .limit(1)
      .single();

    const t24 = trades24h || [];
    const t1  = trades1h  || [];

    const buys24     = t24.filter(t => t.side === "buy");
    const sells24    = t24.filter(t => t.side === "sell");
    const vol24Sol   = t24.reduce((s, t) => s + Number(t.sol_amount || 0), 0);
    const vol1hSol   = t1.reduce((s,  t) => s + Number(t.sol_amount || 0), 0);

    // Price change 24h
    const prices24 = t24.map(t => Number(t.price_sol)).filter(Boolean);
    const firstPrice = prices24[prices24.length - 1] || 0;
    const lastPrice  = Number(lastTrade?.price_sol || 0);
    const priceChange24h = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    // Unique traders
    const uniqueTraders = new Set(t24.map(t => t.trader)).size;

    // Health score (0-100)
    let health = 50;
    const signals = [];

    // Activity signal
    if (t24.length >= 20) { health += 15; signals.push({ type: "active_trading",    delta: +15, msg: "High trade activity (20+ trades/24h)" }); }
    else if (t24.length >= 5) { health += 8;  signals.push({ type: "moderate_trading", delta: +8,  msg: "Moderate activity (5-20 trades/24h)" }); }
    else if (t24.length === 0) { health -= 15; signals.push({ type: "no_activity",     delta: -15, msg: "No trades in last 24h" }); }

    // Buy/sell balance
    const ratio = t24.length > 0 ? buys24.length / t24.length : 0.5;
    if (ratio >= 0.45 && ratio <= 0.65) { health += 10; signals.push({ type: "balanced_flow",    delta: +10, msg: "Balanced buy/sell ratio" }); }
    else if (ratio < 0.2 && t24.length > 5) { health -= 15; signals.push({ type: "heavy_selling",   delta: -15, msg: "Heavy sell pressure (>80% sells)" }); }
    else if (ratio > 0.85 && t24.length > 5) { health += 5;  signals.push({ type: "strong_buying",   delta: +5,  msg: "Strong buy pressure" }); }

    // Price trend
    if (priceChange24h >= 5)       { health += 10; signals.push({ type: "price_up",    delta: +10, msg: `Price +${priceChange24h.toFixed(1)}% in 24h` }); }
    else if (priceChange24h <= -20) { health -= 15; signals.push({ type: "price_crash", delta: -15, msg: `Price ${priceChange24h.toFixed(1)}% in 24h` }); }
    else if (priceChange24h <= -10) { health -= 8;  signals.push({ type: "price_down",  delta: -8,  msg: `Price ${priceChange24h.toFixed(1)}% in 24h` }); }

    // Diversity of traders
    if (uniqueTraders >= 10) { health += 10; signals.push({ type: "diverse_traders",  delta: +10, msg: `${uniqueTraders} unique traders in 24h` }); }
    else if (uniqueTraders <= 2 && t24.length > 5) { health -= 10; signals.push({ type: "concentrated", delta: -10, msg: "Very few unique traders (possible wash trading)" }); }

    // Token status
    if (token.status === "migrated") { health += 5; signals.push({ type: "graduated", delta: +5, msg: "Token graduated to Raydium CPMM" }); }

    // Large single dump detection (single sell > 30% of 24h volume)
    const maxSell = Math.max(...sells24.map(t => Number(t.sol_amount || 0)), 0);
    if (vol24Sol > 0 && maxSell / vol24Sol > 0.3 && t24.length > 3) {
      health -= 12;
      signals.push({ type: "large_dump", delta: -12, msg: `Large single sell detected (${((maxSell / vol24Sol) * 100).toFixed(0)}% of 24h volume)` });
    }

    health = Math.max(0, Math.min(100, Math.round(health)));
    const healthLevel =
      health >= 75 ? "HEALTHY" :
      health >= 50 ? "NORMAL"  :
      health >= 25 ? "WARNING" : "CRITICAL";

    // Persist health events for critical signals
    const criticalSignals = signals.filter(s => s.delta <= -12);
    if (criticalSignals.length > 0) {
      const events = criticalSignals.map(s => ({
        mint,
        event_type: s.type,
        severity:   s.delta <= -15 ? "critical" : "warning",
        data:       { msg: s.msg, delta: s.delta, health_score: health },
      }));
      await db.from("token_health_events").insert(events).catch(() => {});
    }

    // Update token stats
    await db.from("tokens").update({
      volume_sol:   Math.round(vol24Sol * 1e6) / 1e6,
      trades_count: t24.length,
      last_trade_at: lastTrade?.block_time || null,
      updated_at: now.toISOString(),
    }).eq("mint", mint).catch(() => {});

    return res.json({
      mint,
      name:   token.name,
      symbol: token.symbol,
      health_score: health,
      health_level: healthLevel,
      metrics: {
        trades_24h:       t24.length,
        buys_24h:         buys24.length,
        sells_24h:        sells24.length,
        volume_sol_24h:   Math.round(vol24Sol * 1e4) / 1e4,
        volume_sol_1h:    Math.round(vol1hSol * 1e4) / 1e4,
        price_change_24h: Math.round(priceChange24h * 100) / 100,
        current_price:    lastPrice,
        unique_traders:   uniqueTraders,
        buy_sell_ratio:   t24.length > 0 ? Math.round(ratio * 100) / 100 : null,
      },
      signals,
      trust_score: token.trust_score,
      status:      token.status,
      computed_at: now.toISOString(),
    });

  } catch (e) {
    console.error("[api/tokens/health]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
