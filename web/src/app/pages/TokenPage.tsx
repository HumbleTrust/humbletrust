/**
 * TokenPage — full-page token view for direct URL access (/token/:mint)
 * Bloomberg Terminal × TradingView aesthetics
 */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Award,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  RefreshCw,
  Send,
  Twitter,
} from "lucide-react";
import { motion } from "motion/react";
import {
  ApiToken,
  ApiTrade,
  getToken,
  getTokenTrades,
  getTrustScore,
  syncTokenTrades,
  TrustScore,
} from "../../lib/solana/api";
import { GlassPanel } from "../components/GlassPanel";
import { HexAvatar, HexScore } from "../components/HexAvatar";
import { LightweightTradeChart, type ChartMode } from "../components/LightweightTradeChart";
import { cn } from "../components/ui/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Timeframe = "1s" | "5s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1s": 1, "5s": 5, "1m": 60, "5m": 300,
  "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSolanaAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

const scoreColor = (score: number) =>
  score >= 85 ? "#00FF41" :
  score >= 70 ? "#60a5fa" :
  score >= 40 ? "#facc15" :
  "#fb923c";

const scoreLabel = (score: number) =>
  score >= 85 ? "ELITE" :
  score >= 70 ? "STRONG" :
  score >= 40 ? "OK" : "WEAK";

const rugRiskColor = (risk: string) => {
  switch (risk) {
    case "LOW":      return "text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10";
    case "MEDIUM":   return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    case "HIGH":     return "text-orange-400 border-orange-400/30 bg-orange-400/10";
    case "CRITICAL": return "text-red-400 border-red-400/30 bg-red-400/10";
    default:         return "text-white/50 border-white/20 bg-white/5";
  }
};

const statusColor = (status: string) =>
  status === "migrated"
    ? "border-[#B026FF]/40 text-[#B026FF] bg-[#B026FF]/10"
    : status === "instant_pool"
    ? "border-blue-400/40 text-blue-400 bg-blue-400/10"
    : "border-[#1A2332] text-white/40 bg-white/5";

const compact = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });

const truncate = (s: string, head = 6, tail = 4) =>
  s.length > head + tail + 3 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-white/10", className)} />
  );
}

// ── TokenPage ─────────────────────────────────────────────────────────────────

interface TokenPageProps {
  mint: string;
  /** Present when accessed via SPA navigation (not direct URL) */
  onBack?: () => void;
}

export function TokenPage({ mint, onBack }: TokenPageProps) {
  const [token, setToken]       = useState<ApiToken | null>(null);
  const [trades, setTrades]     = useState<ApiTrade[]>([]);
  const [score, setScore]       = useState<TrustScore | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [showVolume, setShowVolume] = useState(true);

  // ── data loading ────────────────────────────────────────────────────────────

  const loadTrades = useCallback(async () => {
    const r = await getTokenTrades(mint, 500).catch(() => ({ trades: [] as ApiTrade[] }));
    return r.trades ?? [];
  }, [mint]);

  const runSync = useCallback(async (silent = false) => {
    if (!silent) setSyncMsg(null);
    setSyncing(true);
    try {
      const result = await syncTokenTrades(mint, 300);
      const fresh  = await loadTrades();
      setTrades(fresh);
      if (!silent) {
        setSyncMsg(
          result.synced
            ? `Synced ${result.synced} trade${result.synced !== 1 ? "s" : ""} from chain`
            : result.message || "No new on-chain trades found"
        );
        setTimeout(() => setSyncMsg(null), 5000);
      }
    } catch (e: unknown) {
      if (!silent) setSyncMsg(`Sync error: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }, [mint, loadTrades]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const tokenP  = getToken(mint).catch(() => null);
    const tradesP = loadTrades();
    const scoreP  = getTrustScore(mint).catch(() => null);

    Promise.all([tokenP, tradesP, scoreP]).then(async ([tokenRes, fetchedTrades, trustScore]) => {
      if (!alive) return;
      if (tokenRes) setToken(tokenRes.token);
      setTrades(fetchedTrades);
      if (trustScore) setScore(trustScore);
      setLoading(false);
      // auto-sync if no trades cached
      if (fetchedTrades.length === 0) {
        setSyncing(true);
        try {
          const r = await syncTokenTrades(mint, 300);
          if (!alive) return;
          if (r.synced && r.synced > 0) {
            const fresh = await loadTrades();
            if (alive) setTrades(fresh);
          }
        } catch { /* silent */ } finally {
          if (alive) setSyncing(false);
        }
      }
    }).catch((e: unknown) => {
      if (!alive) return;
      setError((e as Error).message || String(e));
      setLoading(false);
    });

    return () => { alive = false; };
  }, [mint, loadTrades]);

  // ── derived stats ───────────────────────────────────────────────────────────

  const trustScore  = Number(token?.trust_score ?? 0);
  const color       = scoreColor(trustScore);
  const buys        = trades.filter((t) => t.side === "buy").length;
  const sells       = trades.filter((t) => t.side === "sell").length;
  const volSol      = trades.reduce((s, t) => s + Number(t.sol_amount), 0);
  const buyPct      = buys + sells > 0 ? Math.round((buys / (buys + sells)) * 100) : 50;
  const lastPrice   = trades.length > 0 ? Number(trades[0].price_sol) : 0;
  const priceStr    = lastPrice > 0
    ? (lastPrice < 0.000001 ? lastPrice.toExponential(3) : lastPrice.toFixed(9))
    : "--";

  // ── error / invalid mint ─────────────────────────────────────────────────────

  if (!isSolanaAddress(mint)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="text-6xl font-mono text-red-400/40">404</div>
        <div className="text-white/60 font-mono text-sm">Invalid token address</div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("ht:navigate", { detail: "discover" }))}
          className="px-4 py-2 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-sm font-mono hover:bg-[#00FF41]/20 transition-colors"
        >
          Browse Tokens
        </button>
      </div>
    );
  }

  if (!loading && error && !token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="text-6xl font-mono text-red-400/40">404</div>
        <div className="text-white/60 font-mono text-sm">Token not found</div>
        <div className="text-white/30 font-mono text-xs max-w-sm">{mint}</div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("ht:navigate", { detail: "discover" }))}
          className="px-4 py-2 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-sm font-mono hover:bg-[#00FF41]/20 transition-colors"
        >
          Browse Tokens
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── Back nav ──────────────────────────────────────────────────────── */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-mono"
        >
          <ArrowLeft size={13} /> Back to Discover
        </button>
      )}

      {/* ── Token header ──────────────────────────────────────────────────── */}
      <GlassPanel className="p-5" glow="green">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Logo */}
            <HexAvatar
              src={token?.logo_uri}
              label={token?.symbol || token?.name || mint.slice(0, 3)}
              size={64}
              gradient={trustScore >= 85}
            />
            {/* Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white font-[Orbitron] leading-none">
                  {token?.name || "Unknown Token"}
                </h1>
                <span className="text-[#00FF41] text-lg font-mono font-semibold">
                  ${token?.symbol || mint.slice(0, 6)}
                </span>
                {/* Status badge */}
                {token?.status && (
                  <span className={cn(
                    "text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider",
                    statusColor(token.status)
                  )}>
                    {token.status === "instant_pool" ? "Raydium Pool" : token.status}
                  </span>
                )}
                {/* Trust badge */}
                <span
                  className="text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold"
                  style={{
                    color,
                    borderColor: `${color}50`,
                    backgroundColor: `${color}15`,
                  }}
                >
                  {scoreLabel(trustScore)}
                </span>
              </div>

              {/* Mint address row */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-white/30 font-mono text-xs break-all sm:break-normal">
                  {mint}
                </span>
                <button
                  type="button"
                  title={copied ? "Copied" : "Copy mint address"}
                  aria-label={copied ? "Mint address copied" : "Copy mint address"}
                  className="shrink-0 inline-flex w-6 h-6 items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-[#00FF41] hover:border-[#00FF41]/30 hover:bg-[#00FF41]/10 transition-colors"
                  onClick={async () => {
                    await copyText(mint);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
                <a
                  href={`https://solscan.io/token/${mint}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-[#00FF41] transition-colors font-mono"
                >
                  Solscan <ExternalLink size={9} />
                </a>
              </div>

              {/* Social links */}
              {(token?.website || token?.twitter || token?.telegram) && (
                <div className="flex flex-wrap items-center gap-2">
                  {token.website && (
                    <a
                      href={token.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-[#00FF41] transition-colors font-mono"
                    >
                      <Globe size={10} /> Website
                    </a>
                  )}
                  {token.twitter && (
                    <a
                      href={`https://twitter.com/${token.twitter.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-[#00FF41] transition-colors font-mono"
                    >
                      <Twitter size={10} /> Twitter
                    </a>
                  )}
                  {token.telegram && (
                    <a
                      href={`https://t.me/${token.telegram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-[#00FF41] transition-colors font-mono"
                    >
                      <Send size={10} /> Telegram
                    </a>
                  )}
                </div>
              )}

              {/* Description */}
              {token?.description && (
                <p className="mt-2 text-white/40 text-xs leading-relaxed max-w-xl">
                  {token.description}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("ht:navigate", {
                      detail: "discover",
                    })
                  )
                }
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#00FF41] to-[#00FF41]/70 text-black font-bold text-sm hover:shadow-[0_0_20px_rgba(0,255,65,0.35)] transition-all whitespace-nowrap"
              >
                Trade Now →
              </button>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Last Price",
            value: loading ? null : priceStr,
            unit: "SOL",
            color: "#00FF41",
          },
          {
            label: "Volume (all)",
            value: loading ? null : `${compact(volSol)}`,
            unit: "SOL",
            color: "#60a5fa",
          },
          {
            label: "Trades",
            value: loading ? null : String(token?.trades_count ?? trades.length),
            unit: "",
            color: "#facc15",
          },
          {
            label: "Lock %",
            value: loading ? null : `${token?.lock_percent ?? 0}`,
            unit: "%",
            color: "#B026FF",
          },
        ].map(({ label, value, unit, color: c }) => (
          <GlassPanel key={label} className="p-4">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-wider mb-1">
              {label}
            </div>
            {value === null ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <div className="font-mono font-bold text-xl" style={{ color: c }}>
                {value}
                {unit && (
                  <span className="text-xs text-white/30 ml-1">{unit}</span>
                )}
              </div>
            )}
          </GlassPanel>
        ))}
      </div>

      {/* ── Main grid: chart + trust score ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Chart */}
        <GlassPanel className="overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.07] bg-black/20">
            {trades.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                <span className="text-[#00FF41]">{buys}B</span>
                <span className="text-white/15">/</span>
                <span className="text-[#FF3C6B]">{sells}S</span>
                <div className="w-10 h-1 rounded-full bg-[#FF3C6B]/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00FF41]/60 transition-all"
                    style={{ width: `${buyPct}%` }}
                  />
                </div>
                <span className="text-white/30">{volSol.toFixed(2)}◎</span>
              </div>
            )}
            <span className="flex-1" />
            <label className="flex items-center gap-1 text-[10px] text-white/30 font-mono cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
                className="accent-[#00FF41] w-3 h-3"
              />
              Vol
            </label>
            {syncMsg && (
              <span className="text-[10px] text-white/40 font-mono">{syncMsg}</span>
            )}
            <button
              type="button"
              title="Sync trades from blockchain"
              disabled={syncing || loading}
              onClick={() => runSync()}
              className="flex items-center gap-1 text-[10px] text-white/35 hover:text-[#00FF41] disabled:opacity-40 transition-colors font-mono"
            >
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
          </div>

          {(loading || syncing) && trades.length === 0 ? (
            <div className="flex items-center justify-center h-[320px] text-white/30 text-sm font-mono">
              {syncing ? "Syncing from blockchain…" : "Loading…"}
            </div>
          ) : (
            <div className="p-3">
              <LightweightTradeChart
                trades={trades}
                periodSec={TIMEFRAME_SECONDS[timeframe]}
                height={300}
                showVolume={showVolume}
                mode={chartMode}
                timeframe={timeframe}
                onTimeframeChange={(tf) => setTimeframe(tf as Timeframe)}
                onModeChange={setChartMode}
              />
            </div>
          )}
        </GlassPanel>

        {/* Trust Score Card */}
        <GlassPanel className="p-5" glow="green">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="w-24 h-24 mx-auto rounded-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Score ring */}
              <div className="flex justify-center mb-4">
                <HexScore score={trustScore} color={color} size={120} />
              </div>
              <div className="text-center text-[10px] text-white/40 font-mono uppercase tracking-widest mb-4">
                TrustScore 2.0
              </div>

              {/* Sub-scores */}
              <div className="space-y-2.5">
                {(
                  [
                    ["Launch Score",       token?.launch_score],
                    ["Creator Rep",        token?.creator_reputation],
                    ["Market Health",      token?.market_health],
                    ["Community Risk",     token?.community_risk],
                  ] as [string, number | null | undefined][]
                ).map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-xs border-b border-white/5 pb-2"
                  >
                    <span className="text-white/45">{label}</span>
                    <span className="font-mono font-semibold text-white">
                      {val != null ? val : "--"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rug risk */}
              {score?.rug_risk && (
                <div className="mt-4">
                  <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider mb-1">
                    Rug Risk
                  </div>
                  <span
                    className={cn(
                      "inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-full border uppercase",
                      rugRiskColor(score.rug_risk)
                    )}
                  >
                    {score.rug_risk}
                  </span>
                </div>
              )}

              {/* Trust categories from TrustScore API */}
              {score?.categories && (
                <div className="mt-4 space-y-1.5">
                  {(Object.entries(score.categories) as [string, { earned: number; max: number }][]).map(
                    ([cat, { earned, max }]) => (
                      <div key={cat} className="text-[10px] font-mono">
                        <div className="flex justify-between text-white/40 mb-0.5 capitalize">
                          <span>{cat.replace(/_/g, " ")}</span>
                          <span>
                            {earned}/{max}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#00FF41]/60 transition-all"
                            style={{ width: `${max > 0 ? (earned / max) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Flags / warnings */}
              {score?.rug_indicators && score.rug_indicators.length > 0 && (
                <div className="mt-4 space-y-1">
                  <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider mb-1">
                    Risk Flags
                  </div>
                  {score.rug_indicators.slice(0, 4).map((flag, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-[10px] font-mono px-2 py-1 rounded border",
                        flag.severity === "critical" ? "border-red-500/30 text-red-400 bg-red-500/10" :
                        flag.severity === "high"     ? "border-orange-500/30 text-orange-400 bg-orange-500/10" :
                        flag.severity === "medium"   ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" :
                                                       "border-white/10 text-white/40 bg-white/5"
                      )}
                    >
                      {flag.msg}
                    </div>
                  ))}
                </div>
              )}

              {/* Links */}
              <div className="mt-4 space-y-1.5">
                <a
                  href={`https://solscan.io/token/${mint}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#00FF41]/60 hover:text-[#00FF41] transition-colors font-mono"
                >
                  Solscan (devnet) <ExternalLink size={9} />
                </a>
                {token?.certificate_mint && (
                  <a
                    href={`https://solscan.io/token/${token.certificate_mint}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#B026FF]/60 hover:text-[#B026FF] transition-colors font-mono"
                  >
                    Launch certificate <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </>
          )}
        </GlassPanel>
      </div>

      {/* ── Token metadata card ────────────────────────────────────────────── */}
      <GlassPanel className="p-5">
        <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">
          Token Metadata
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs font-mono">
          {/* Creator */}
          <div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">Creator</div>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : token?.creator ? (
              <a
                href={`https://solscan.io/account/${token.creator}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 hover:text-[#00FF41] transition-colors flex items-center gap-1"
              >
                {truncate(token.creator)}
                <ExternalLink size={9} />
              </a>
            ) : (
              <span className="text-white/25">--</span>
            )}
          </div>

          {/* Lock % */}
          <div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">Creator Lock</div>
            {loading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="text-[#B026FF] font-bold">
                <Lock size={10} className="inline mr-1 mb-0.5" />
                {token?.lock_percent ?? 0}%
              </span>
            )}
          </div>

          {/* Burn Option */}
          <div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">Burn Option</div>
            {loading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="text-white/60">
                {token?.burn_option === 1 ? "Enabled" : token?.burn_option === 2 ? "Auto" : "None"}
              </span>
            )}
          </div>

          {/* Creator Supply % */}
          {token?.creator_percent != null && (
            <div>
              <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">
                Creator Supply
              </div>
              <span className="text-white/60">{token.creator_percent}%</span>
            </div>
          )}

          {/* Circulation % */}
          {token?.circulation_percent != null && (
            <div>
              <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">
                Circulation
              </div>
              <span className="text-white/60">{token.circulation_percent}%</span>
            </div>
          )}

          {/* Curve Liquidity */}
          {token?.curve_liquidity_percent != null && (
            <div>
              <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">
                Curve Liquidity
              </div>
              <span className="text-white/60">{token.curve_liquidity_percent}%</span>
            </div>
          )}

          {/* Certificate */}
          {token?.certificate_mint && (
            <div>
              <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">
                Certificate
              </div>
              <a
                href={`https://solscan.io/token/${token.certificate_mint}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-400/70 hover:text-blue-400 transition-colors"
              >
                <Award size={9} /> {truncate(token.certificate_mint, 6, 4)}
                <ExternalLink size={8} />
              </a>
            </div>
          )}

          {/* Raydium Pool */}
          {token?.raydium_pool && (
            <div>
              <div className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">
                Raydium Pool
              </div>
              <a
                href={`https://solscan.io/account/${token.raydium_pool}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#B026FF]/70 hover:text-[#B026FF] transition-colors"
              >
                {truncate(token.raydium_pool)}
                <ExternalLink size={8} />
              </a>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* ── Recent Trades ──────────────────────────────────────────────────── */}
      <GlassPanel className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
          <span className="font-semibold text-sm text-white">Recent Trades</span>
          {trades.length > 0 && (
            <span className="text-xs text-white/30 font-mono">{trades.length} records</span>
          )}
        </div>

        {/* Column headers */}
        {trades.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-mono text-white/25 border-b border-white/[0.04] bg-white/[0.01]">
            <span className="w-8">SIDE</span>
            <span className="w-20">PRICE</span>
            <span className="w-16">SOL</span>
            <span className="flex-1">TOKENS</span>
            <span className="hidden sm:block w-20 text-right">TIME</span>
            <span className="w-14 text-right">TX</span>
          </div>
        )}

        {/* Empty / loading states */}
        {trades.length === 0 && !loading && !syncing && (
          <div className="px-4 py-8 text-center">
            <div className="text-white/25 text-sm font-mono mb-2">No trades found on-chain.</div>
            <button
              type="button"
              onClick={() => runSync()}
              className="text-xs text-[#00FF41]/60 hover:text-[#00FF41] font-mono border border-[#00FF41]/20 hover:border-[#00FF41]/40 px-3 py-1 rounded transition-colors"
            >
              Sync from blockchain
            </button>
          </div>
        )}
        {(loading || syncing) && trades.length === 0 && (
          <div className="px-4 py-6 text-center text-white/30 text-sm font-mono">
            {syncing ? "Fetching transactions from blockchain…" : "Loading…"}
          </div>
        )}

        <div className="divide-y divide-white/[0.04] max-h-[400px] overflow-y-auto">
          {trades.slice(0, 20).map((trade) => {
            const price    = Number(trade.price_sol);
            const sol      = Number(trade.sol_amount);
            const tokens   = Number(trade.token_amount);
            const priceS   = price < 0.000001 ? price.toExponential(2) : price.toFixed(9);
            const solS     = sol >= 1 ? sol.toFixed(3) : sol.toFixed(5);
            const tokensS  = tokens >= 1_000_000
              ? `${(tokens / 1_000_000).toFixed(2)}M`
              : tokens >= 1_000
              ? `${(tokens / 1_000).toFixed(1)}K`
              : tokens.toFixed(0);
            const t        = new Date(trade.block_time);
            const timeS    = t.toLocaleTimeString([], {
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            });
            const isBuy    = trade.side === "buy";

            return (
              <div
                key={`${trade.signature}-${trade.block_time}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 text-xs font-mono transition-colors",
                  isBuy
                    ? "hover:bg-[#00FF41]/[0.02]"
                    : "hover:bg-[#FF3C6B]/[0.02]"
                )}
              >
                <span
                  className={cn(
                    "w-8 font-bold uppercase text-[11px]",
                    isBuy ? "text-[#00FF41]" : "text-[#FF3C6B]"
                  )}
                >
                  {trade.side}
                </span>
                <span className="w-20 text-white/60">{priceS}</span>
                <span
                  className={cn(
                    "w-16",
                    isBuy ? "text-[#00FF41]/80" : "text-[#FF3C6B]/80"
                  )}
                >
                  {isBuy ? "+" : "-"}
                  {solS}◎
                </span>
                <span className="flex-1 text-white/40">{tokensS}</span>
                <span className="hidden sm:block w-20 text-right text-white/25">{timeS}</span>
                <a
                  href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-14 text-right text-white/30 hover:text-[#00FF41] transition-colors"
                >
                  {trade.signature.slice(0, 6)}…
                </a>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
