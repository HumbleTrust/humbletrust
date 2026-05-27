const { getClient } = require("../../../_lib/db");
const { isValidWallet, setCors } = require("../../../_lib/validate");

const getRiskLevel = (r) =>
  r >= 75 ? "LOW" : r >= 50 ? "MEDIUM" : r >= 25 ? "HIGH" : "CRITICAL";

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Service unavailable" });

  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: "invalid wallet address" });

  const db = getClient();

  try {
    // Launches created by this wallet
    const { data: launches } = await db
      .from("tokens")
      .select("mint, name, symbol, trust_score, launch_score, status, created_at, raydium_pool, lock_percent, verified_issuer")
      .eq("creator", wallet)
      .order("created_at", { ascending: false });

    // Trades executed by this wallet
    const { data: trades } = await db
      .from("trades")
      .select("mint, side, sol_amount, price_sol, block_time")
      .eq("trader", wallet)
      .order("block_time", { ascending: false })
      .limit(100);

    const totalLaunches  = launches?.length || 0;
    const graduated      = launches?.filter(l => l.status === "migrated" || l.raydium_pool).length || 0;
    const highScore      = launches?.filter(l => (l.trust_score || 0) >= 70).length || 0;
    const lowScore       = launches?.filter(l => (l.trust_score || 0) < 40).length || 0;
    const avgScore       = totalLaunches > 0
      ? Math.round(launches.reduce((s, l) => s + (l.trust_score || 0), 0) / totalLaunches)
      : null;
    const isVerified     = launches?.some(l => l.verified_issuer) || false;

    // Trade analysis (last 100 trades)
    const totalTrades = trades?.length || 0;
    const buys  = trades?.filter(t => t.side === "buy").length  || 0;
    const sells = trades?.filter(t => t.side === "sell").length || 0;
    const totalSolTraded = trades?.reduce((s, t) => s + Number(t.sol_amount || 0), 0) || 0;

    // Reputation score (0–100)
    let reputation = 50;

    if (totalLaunches === 0) {
      reputation = 50; // unknown — neutral
    } else {
      reputation = avgScore || 50;
      if (totalLaunches >= 3 && highScore / totalLaunches >= 0.8) reputation += 10;
      reputation -= lowScore * 10;
      reputation += graduated * 8;
    }
    if (isVerified) reputation = Math.max(reputation, 70);
    reputation = Math.max(0, Math.min(100, Math.round(reputation)));

    // Flags
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
        total: totalLaunches,
        avg_trust_score: avgScore,
        graduated,
        high_score: highScore,
        low_score: lowScore,
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
      computed_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error("[api/wallets/risk]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
