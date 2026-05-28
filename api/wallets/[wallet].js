const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");

const getTrustLevel = s =>
  s >= 85 ? "ELITE" : s >= 70 ? "STRONG" : s >= 40 ? "OK" : s >= 20 ? "WEAK" : "DANGER";

const getRiskLevel = r =>
  r >= 75 ? "LOW" : r >= 50 ? "MEDIUM" : r >= 25 ? "HIGH" : "CRITICAL";

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Service unavailable" });

  const { wallet, view } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: "invalid wallet address" });

  const db = getClient();

  if (view === "intelligence") {
    return handleIntelligence(req, res, wallet, db).catch(e => {
      console.error("[api/wallets intelligence]", e.message);
      return res.status(500).json({ error: "Internal server error" });
    });
  }

  try {
    const { data: launches } = await db
      .from("tokens")
      .select("mint, name, symbol, trust_score, launch_score, status, created_at, raydium_pool, lock_percent, verified_issuer")
      .eq("creator", wallet)
      .order("created_at", { ascending: false });

    const { data: trades } = await db
      .from("trades")
      .select("mint, side, sol_amount, price_sol, block_time")
      .eq("trader", wallet)
      .order("block_time", { ascending: false })
      .limit(100);

    const totalLaunches = launches?.length || 0;
    const graduated     = launches?.filter(l => l.status === "migrated" || l.raydium_pool).length || 0;
    const highScore     = launches?.filter(l => (l.trust_score || 0) >= 70).length || 0;
    const lowScore      = launches?.filter(l => (l.trust_score || 0) < 40).length || 0;
    const avgScore      = totalLaunches > 0
      ? Math.round(launches.reduce((s, l) => s + (l.trust_score || 0), 0) / totalLaunches)
      : null;
    const isVerified    = launches?.some(l => l.verified_issuer) || false;

    const totalTrades    = trades?.length || 0;
    const buys           = trades?.filter(t => t.side === "buy").length  || 0;
    const sells          = trades?.filter(t => t.side === "sell").length || 0;
    const totalSolTraded = trades?.reduce((s, t) => s + Number(t.sol_amount || 0), 0) || 0;

    let reputation = 50;
    if (totalLaunches > 0) {
      reputation = avgScore || 50;
      if (totalLaunches >= 3 && highScore / totalLaunches >= 0.8) reputation += 10;
      reputation -= lowScore * 10;
      reputation += graduated * 8;
    }
    if (isVerified) reputation = Math.max(reputation, 70);
    reputation = Math.max(0, Math.min(100, Math.round(reputation)));

    const flags = [];
    if (lowScore > 0)
      flags.push({ type: "low_trust_launches", severity: "warning", message: `${lowScore} launch(es) with TrustScore < 40` });
    if (totalLaunches === 0)
      flags.push({ type: "no_history", severity: "info", message: "No launches found in HumbleTrust registry" });
    if (totalLaunches > 0 && avgScore !== null && avgScore < 40)
      flags.push({ type: "low_avg_score", severity: "warning", message: `Average TrustScore is ${avgScore} — below recommended 70` });
    if (sells > buys * 2 && totalTrades > 10)
      flags.push({ type: "high_sell_ratio", severity: "warning", message: "High sell-to-buy ratio in recent trades" });
    if (isVerified)
      flags.push({ type: "verified_issuer", severity: "info", message: "This wallet is a Verified Issuer on HumbleTrust" });

    return res.json({
      wallet,
      reputation_score: reputation,
      risk_level: getRiskLevel(reputation),
      verified_issuer: isVerified,
      launches: {
        total:           totalLaunches,
        avg_trust_score: avgScore,
        graduated,
        high_score:      highScore,
        low_score:       lowScore,
        recent: (launches || []).slice(0, 5).map(l => ({
          mint:        l.mint,
          name:        l.name,
          symbol:      l.symbol,
          trust_score: l.trust_score,
          status:      l.status,
          created_at:  l.created_at,
        })),
      },
      trading: {
        total_trades:     totalTrades,
        buys,
        sells,
        total_sol_traded: Math.round(totalSolTraded * 1000) / 1000,
      },
      flags,
      intelligence_url: `/api/wallets/${wallet}?view=intelligence`,
      computed_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error("[api/wallets]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// Feature: Creator Intelligence  (?view=intelligence)
//
// Classifies a creator as: serial_rugger / high_risk / neutral / trusted / new_creator
// Uses token_score_cache for enriched scores — zero extra RPC calls needed.
// ════════════════════════════════════════════════════════════════════════════

async function handleIntelligence(req, res, wallet, db) {
  // 1. All tokens launched by this wallet
  const { data: launches } = await db
    .from("tokens")
    .select("mint, name, symbol, trust_score, status, created_at, verified_issuer")
    .eq("creator", wallet)
    .order("created_at", { ascending: false });

  const mintList = (launches || []).map(l => l.mint);

  // 2. Enrich with cached on-chain scores (no extra RPC — read from cache only)
  let cacheScores = {};
  if (mintList.length > 0) {
    const { data: cached } = await db
      .from("token_score_cache")
      .select("mint, score, trust_level")
      .in("mint", mintList.slice(0, 50));
    (cached || []).forEach(c => { cacheScores[c.mint] = { score: c.score, trust_level: c.trust_level }; });
  }

  // 3. Build enriched token list
  const tokens = (launches || []).map(l => {
    const enriched = cacheScores[l.mint];
    const score    = enriched?.score ?? l.trust_score ?? null;
    return {
      mint:         l.mint,
      name:         l.name,
      symbol:       l.symbol,
      trust_score:  score,
      trust_level:  enriched?.trust_level ?? (score !== null ? getTrustLevel(score) : null),
      status:       l.status,
      created_at:   l.created_at,
      score_source: enriched ? "cache" : (l.trust_score !== null ? "registry" : "unknown"),
    };
  });

  // 4. Aggregate statistics
  const total        = tokens.length;
  const scored       = tokens.filter(t => t.trust_score !== null);
  const avgScore     = scored.length > 0
    ? Math.round(scored.reduce((s, t) => s + t.trust_score, 0) / scored.length)
    : null;
  const dangerCount  = scored.filter(t => t.trust_score < 20).length;
  const rugCount     = scored.filter(t => t.trust_score < 30).length;
  const lowCount     = scored.filter(t => t.trust_score < 40).length;
  const successCount = tokens.filter(t => t.status === "migrated" || (t.trust_score || 0) >= 70).length;
  const isVerified   = (launches || []).some(l => l.verified_issuer);

  // 5. Classification
  let classification = "new_creator";
  let classificationReason = "No launch history";
  let riskScore = 50;

  if (total === 0) {
    classification = "new_creator";
    classificationReason = "No tokens launched yet — insufficient data";
    riskScore = 50;
  } else if (scored.length >= 2 && dangerCount >= 2 && dangerCount / scored.length >= 0.6) {
    classification = "serial_rugger";
    classificationReason = `${dangerCount}/${scored.length} tokens at DANGER level (score < 20) — serial rug pattern`;
    riskScore = Math.min(100, 75 + dangerCount * 5);
  } else if (scored.length >= 2 && rugCount / scored.length >= 0.6) {
    classification = "serial_rugger";
    classificationReason = `${rugCount}/${scored.length} tokens scored below 30 — repeated low-quality launches`;
    riskScore = Math.min(98, 65 + rugCount * 5);
  } else if (scored.length >= 2 && lowCount / scored.length >= 0.5) {
    classification = "high_risk";
    classificationReason = `${lowCount}/${scored.length} launches scored below 40`;
    riskScore = Math.min(90, 50 + lowCount * 8);
  } else if (isVerified || (total >= 2 && avgScore !== null && avgScore >= 70 && successCount >= 1)) {
    classification = "trusted";
    classificationReason = isVerified
      ? "Verified Issuer on HumbleTrust"
      : `Strong track record: avg score ${avgScore}, ${successCount} graduated/high-score token(s)`;
    riskScore = Math.max(5, 30 - successCount * 5);
  } else {
    classification = "neutral";
    classificationReason = `${total} launch(es), avg score ${avgScore ?? "N/A"} — no clear pattern`;
    riskScore = avgScore !== null ? Math.max(0, Math.min(100, 100 - avgScore)) : 50;
  }

  // 6. Flags
  const flags = [];
  if (dangerCount >= 2)
    flags.push({ type: "serial_rugger", severity: "critical", msg: `${dangerCount} tokens with TrustScore < 20 (DANGER)` });
  else if (rugCount >= 2)
    flags.push({ type: "repeated_low_scores", severity: "high", msg: `${rugCount} tokens with TrustScore < 30` });
  if (lowCount > 0 && rugCount < 2)
    flags.push({ type: "low_trust_launches", severity: "medium", msg: `${lowCount} launch(es) with TrustScore < 40` });
  if (successCount > 0)
    flags.push({ type: "has_successes", severity: "info", msg: `${successCount} token(s) graduated or scored ≥70` });
  if (isVerified)
    flags.push({ type: "verified_issuer", severity: "info", msg: "Verified Issuer on HumbleTrust" });
  if (total > 0 && scored.length === 0)
    flags.push({ type: "unscored", severity: "info", msg: "No on-chain scores available yet" });

  return res.json({
    wallet,
    classification,
    classification_reason: classificationReason,
    risk_score:   riskScore,
    risk_level:   getRiskLevel(100 - riskScore),
    verified_issuer: isVerified,
    summary: {
      total_launched:  total,
      scored_count:    scored.length,
      avg_trust_score: avgScore,
      rug_indicators:  rugCount,
      danger_count:    dangerCount,
      success_count:   successCount,
      low_score_count: lowCount,
    },
    tokens: tokens.slice(0, 25),
    flags,
    note: "Uses HumbleTrust registry + cached on-chain scores. Call /api/score/:mint?nocache=1 to refresh a specific token.",
    computed_at: new Date().toISOString(),
  });
}
