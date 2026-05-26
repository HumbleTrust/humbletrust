import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, ExternalLink, HardDrive, Lock, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ApiToken, ApiTrade, getToken, getTokens, getTokenTrades } from "../../lib/solana/api";
import { listTokens, SavedToken } from "../../lib/solana/image";
import { GlassPanel } from "../components/GlassPanel";
import { LightweightTradeChart } from "../components/LightweightTradeChart";
import { cn } from "../components/ui/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (score: number) =>
  score >= 85 ? "text-[#00FF41]" :
  score >= 70 ? "text-blue-400" :
  score >= 40 ? "text-yellow-400" :
  "text-orange-400";

const scoreLabel = (score: number) =>
  score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

const scoreBorderColor = (score: number) =>
  score >= 85 ? "border-[#00FF41]/30" :
  score >= 70 ? "border-blue-400/30" :
  score >= 40 ? "border-yellow-400/30" :
  "border-orange-400/30";

const compact = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });

const savedToApi = (t: SavedToken): ApiToken => ({
  mint: t.mint,
  creator: "",
  name: t.name || null,
  symbol: t.symbol || null,
  status: "curve",
  trust_score: t.trustScore ?? 0,
  launch_score: t.trustScore ?? 0,
  creator_reputation: 0,
  market_health: 0,
  community_risk: 0,
  volume_sol: 0,
  liquidity_sol: 0,
  trades_count: 0,
  created_at: new Date(t.createdAt).toISOString(),
  certificate_mint: t.certificateMint ?? null,
  logo_uri: t.logo ?? null,
});

// ── TokenDetail sub-view ──────────────────────────────────────────────────────

interface TokenDetailViewProps {
  mint: string;
  onBack: () => void;
}

const TokenDetailView = ({ mint, onBack }: TokenDetailViewProps) => {
  const [token, setToken] = useState<ApiToken | null>(null);
  const [trades, setTrades] = useState<ApiTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setError(null);
    setLoading(true);
    Promise.all([getToken(mint), getTokenTrades(mint, 80)])
      .then(([tokenResult, tradeResult]) => {
        if (!mounted) return;
        setToken(tokenResult.token);
        setTrades(tradeResult.trades);
      })
      .catch((e) => mounted && setError(e.message || String(e)))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [mint]);

  const score = Number(token?.trust_score ?? 0);

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <GlassPanel className="p-5" glow="purple">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft size={13} /> Discover
        </button>
        <div className="text-xs font-mono tracking-widest text-[#B026FF] uppercase mb-1">Token Detail</div>
        <h2 className="text-2xl font-bold text-white mb-0.5">
          {token?.name || "Indexed token"}{" "}
          <span className="text-[#00FF41]">${token?.symbol || mint.slice(0, 4)}</span>
        </h2>
        <p className="text-white/40 text-xs font-mono break-all">{mint}</p>
      </GlassPanel>

      {error && (
        <div className="text-red-400 text-sm px-1">{error}</div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Chart area */}
        <GlassPanel className="overflow-hidden">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
            <span className="text-xs text-[#00FF41] font-mono px-2 py-0.5 rounded bg-[#00FF41]/10">1m</span>
            <span className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-xs text-white/40">Real OHLCV</span>
          </div>
          <LightweightTradeChart
            trades={trades}
            periodSec={60}
            height={288}
            showVolume={true}
            mode="candles"
          />
        </GlassPanel>

        {/* Score card */}
        <GlassPanel className={cn("p-5 border", scoreBorderColor(score))} glow="green">
          {loading ? (
            <div className="space-y-3">
              {[80, 60, 60, 60, 60].map((w, i) => (
                <div key={i} className="h-4 rounded bg-white/10 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              <div className={cn("text-5xl font-bold font-mono mb-1", scoreColor(score))}>
                {token?.trust_score ?? "--"}
              </div>
              <div className="text-white/50 text-xs mb-4">TrustScore 2.0</div>
              <div className="space-y-2.5">
                {([
                  ["LaunchScore", token?.launch_score],
                  ["CreatorReputation", token?.creator_reputation],
                  ["MarketHealth", token?.market_health],
                  ["CommunityRisk", token?.community_risk],
                ] as [string, number | undefined | null][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-white/50">{label}</span>
                    <strong className="text-white">{value ?? "--"}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <a
                  href={`https://solscan.io/token/${mint}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#00FF41]/70 hover:text-[#00FF41]"
                >
                  Solscan devnet <ExternalLink size={10} />
                </a>
                {token?.certificate_mint && (
                  <a
                    href={`https://solscan.io/token/${token.certificate_mint}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#B026FF]/70 hover:text-[#B026FF]"
                  >
                    Launch certificate <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </>
          )}
        </GlassPanel>
      </div>

      {/* Trades table */}
      <GlassPanel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 font-semibold text-sm text-white">
          Recent trades
        </div>
        {trades.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-white/30 text-sm">No indexed trades yet.</div>
        )}
        {loading && (
          <div className="px-4 py-6 text-center text-white/30 text-sm">Loading trades...</div>
        )}
        <div className="divide-y divide-white/5">
          {trades.map((trade) => (
            <div
              key={`${trade.signature}-${trade.block_time}`}
              className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/[0.02]"
            >
              <span className={cn(
                "w-8 font-semibold font-mono uppercase",
                trade.side === "sell" ? "text-red-400" : "text-[#00FF41]"
              )}>
                {trade.side}
              </span>
              <span className="text-white/70 font-mono">{Number(trade.sol_amount).toFixed(5)} SOL</span>
              <span className="text-white/50 font-mono flex-1">
                {Number(trade.token_amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} token
              </span>
              <a
                href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-[#00FF41]/60 hover:text-[#00FF41] font-mono"
              >
                {trade.signature.slice(0, 8)}...
              </a>
            </div>
          ))}
        </div>
      </GlassPanel>
    </motion.div>
  );
};

// ── DiscoverPage ──────────────────────────────────────────────────────────────

interface DiscoverPageProps {
  onOpenToken?: (mint: string) => void;
  initialMint?: string | null;
  onBack?: () => void;
}

export const DiscoverPage = ({ onOpenToken, initialMint, onBack }: DiscoverPageProps) => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [busy, setBusy] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [sort, setSort] = useState<"trust" | "volume" | "new">("new");
  const [selectedMint, setSelectedMint] = useState<string | null>(initialMint ?? null);

  const localTokens = useMemo(() => listTokens().map(savedToApi), []);

  const load = async () => {
    setBusy(true);
    try {
      const result = await getTokens(150);
      const apiMints = new Set(result.tokens.map(t => t.mint));
      const localOnly = localTokens.filter(t => !apiMints.has(t.mint));
      setTokens([...result.tokens, ...localOnly]);
      setApiOk(true);
    } catch {
      setTokens(localTokens);
      setApiOk(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setTokens(localTokens);
    void load();
  }, []);

  const sorted = useMemo(() => {
    return [...tokens].sort((a, b) => {
      if (sort === "trust") return Number(b.trust_score) - Number(a.trust_score);
      if (sort === "volume") return Number(b.volume_sol) - Number(a.volume_sol);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tokens, sort]);

  const isLocalOnly = apiOk === false;

  const openToken = (mint: string) => {
    if (onOpenToken) {
      onOpenToken(mint);
    } else {
      setSelectedMint(mint);
    }
  };

  const handleBack = () => {
    setSelectedMint(null);
    onBack?.();
  };

  // If a token is selected, show detail view
  if (selectedMint) {
    return <TokenDetailView mint={selectedMint} onBack={handleBack} />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {/* Page header */}
        <GlassPanel className="p-6" glow="green">
          <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-1">Discover</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Trust Layer <span className="text-[#00FF41]">registry</span>
          </h2>
          <p className="text-white/50 text-sm">
            {isLocalOnly
              ? "Showing your locally launched tokens. Indexer backend not connected — token data is from this browser."
              : "Tokens indexed from the HumbleTrust backend on devnet."}
          </p>
        </GlassPanel>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-white/5">
            {(["new", "trust", "volume"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                  sort === s
                    ? "bg-[#00FF41]/15 text-[#00FF41]"
                    : "text-white/50 hover:text-white/70"
                )}
                onClick={() => setSort(s)}
              >
                {s === "trust" ? "TrustScore" : s === "new" ? "New" : "Volume"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {isLocalOnly && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <HardDrive size={9} /> Local only
              </span>
            )}
            {apiOk && (
              <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20">
                Indexed
              </span>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 disabled:opacity-40"
              onClick={load}
              disabled={busy}
            >
              <RefreshCw size={12} className={busy ? "animate-spin" : undefined} />
              Refresh
            </button>
          </div>
        </div>

        {/* Empty states */}
        {sorted.length === 0 && busy && (
          <GlassPanel className="py-16 text-center">
            <div className="text-white/30 text-sm">Loading tokens...</div>
          </GlassPanel>
        )}
        {sorted.length === 0 && !busy && (
          <GlassPanel className="py-16 text-center">
            <div className="text-white font-semibold text-lg mb-2">No launches yet</div>
            <p className="text-white/40 text-sm mb-5">Launch a token on devnet — it will appear here immediately.</p>
            <button
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#00FF41] to-[#00FF41]/70 text-black font-semibold text-sm hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all"
              onClick={() => window.dispatchEvent(new CustomEvent("ht:navigate", { detail: "launch" }))}
            >
              Launch your first token →
            </button>
          </GlassPanel>
        )}

        {/* Token grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((t, i) => {
            const score = Number(t.trust_score);
            const isLocal = !apiOk && localTokens.some(l => l.mint === t.mint);
            const solscanUrl = "https://solscan.io/token/" + t.mint + "?cluster=devnet";
            const initials = (t.symbol || t.mint.slice(0, 3)).slice(0, 2).toUpperCase();

            return (
              <motion.div
                key={t.mint}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
              >
                <GlassPanel
                  hover
                  glow="green"
                  className="p-4 cursor-pointer"
                  onClick={() => openToken(t.mint)}
                >
                  {/* Card top */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Logo */}
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden",
                      score >= 85
                        ? "bg-gradient-to-br from-[#00FF41]/30 to-[#B026FF]/30 border border-[#00FF41]/40"
                        : "bg-[#00FF41]/10 border border-[#00FF41]/20"
                    )}>
                      {t.logo_uri ? (
                        <img
                          src={t.logo_uri}
                          alt={t.symbol || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className="text-[#00FF41] font-mono">{initials}</span>
                      )}
                    </div>
                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-semibold text-sm truncate">
                          {t.name || "Token"}
                        </span>
                        <span className={cn(
                          "text-[9px] font-mono px-1.5 py-0.5 rounded-full border",
                          t.status === "migrated"
                            ? "border-[#B026FF]/40 text-[#B026FF] bg-[#B026FF]/10"
                            : "border-white/15 text-white/40 bg-white/5"
                        )}>
                          {t.status}
                        </span>
                        {isLocal && (
                          <span className="text-[9px] text-white/30 font-mono">local</span>
                        )}
                      </div>
                      <div className="text-[#00FF41]/70 text-xs font-mono">
                        ${t.symbol || t.mint.slice(0, 4)}
                      </div>
                    </div>
                  </div>

                  {/* Mint */}
                  <div className="text-white/30 text-[10px] font-mono mb-2.5">
                    {t.mint.slice(0, 8)}...{t.mint.slice(-6)}
                  </div>

                  {/* Score */}
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/40">Trust Score</span>
                    <span className={cn("font-mono font-semibold", scoreColor(score))}>
                      {t.trust_score} / 100 · {scoreLabel(score)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-white/40">Volume</span>
                    <span className="text-white/70 font-mono">{compact(t.volume_sol)} SOL</span>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {t.certificate_mint && (
                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
                        <Award size={8} /> Certificate
                      </span>
                    )}
                    {t.raydium_pool && (
                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[#B026FF]/10 text-[#B026FF] border border-[#B026FF]/20">
                        <Lock size={8} /> Raydium/LP
                      </span>
                    )}
                    <a
                      href={solscanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 hover:bg-[#00FF41]/20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Solscan <ExternalLink size={8} />
                    </a>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
