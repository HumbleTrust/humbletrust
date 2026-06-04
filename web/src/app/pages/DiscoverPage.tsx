import { useCallback, useEffect, useMemo, useState } from "react";
import { HexAvatar } from "../components/HexAvatar";
import { ArrowLeft, Award, Check, Copy, ExternalLink, HardDrive, Lock, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ApiToken, ApiTrade, getToken, getTokens, getTokenTrades, syncTokenTrades } from "../../lib/solana/api";
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

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

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
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTrades = useCallback(async () => {
    const result = await getTokenTrades(mint, 500).catch(() => ({ trades: [] as ApiTrade[] }));
    return result.trades ?? [];
  }, [mint]);

  const runSync = useCallback(async (silent = false) => {
    if (!silent) setSyncMsg(null);
    setSyncing(true);
    try {
      const result = await syncTokenTrades(mint, 300);
      const freshTrades = await loadTrades();
      setTrades(freshTrades);
      if (!silent) {
        setSyncMsg(result.synced ? `Synced ${result.synced} trade${result.synced !== 1 ? "s" : ""} from chain` : (result.message || "No new on-chain trades found"));
        setTimeout(() => setSyncMsg(null), 5000);
      }
    } catch (e: any) {
      if (!silent) setSyncMsg(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, [mint, loadTrades]);

  useEffect(() => {
    let mounted = true;
    setError(null);
    setLoading(true);

    // Fetch token info and trades independently — a 404 on the token must not block trade loading
    const tokenPromise = getToken(mint).catch(() => null);
    const tradesPromise = loadTrades();

    Promise.all([tokenPromise, tradesPromise]).then(async ([tokenResult, fetchedTrades]) => {
      if (!mounted) return;
      if (tokenResult) setToken(tokenResult.token);
      setTrades(fetchedTrades);
      setLoading(false);
      // Auto-sync from blockchain when no trades are stored yet
      if (fetchedTrades.length === 0) {
        setSyncing(true);
        try {
          const result = await syncTokenTrades(mint, 300);
          if (!mounted) return;
          if (result.synced && result.synced > 0) {
            const fresh = await loadTrades();
            if (mounted) setTrades(fresh);
          }
        } catch { /* silent */ } finally {
          if (mounted) setSyncing(false);
        }
      }
    }).catch((e) => {
      if (!mounted) return;
      setError(e.message || String(e));
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [mint, loadTrades]);

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
        <div className="flex items-center gap-2">
          <p className="text-white/40 text-xs font-mono break-all">{mint}</p>
          <button
            type="button"
            title={copied ? "Copied" : "Copy mint address"}
            aria-label={copied ? "Mint address copied" : "Copy mint address"}
            className="shrink-0 inline-flex w-7 h-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/45 hover:text-[#00FF41] hover:border-[#00FF41]/30 hover:bg-[#00FF41]/10 transition-colors"
            onClick={async () => {
              await copyText(mint);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </GlassPanel>

      {error && !error.includes("NOT_FOUND") && !error.includes("not found") && (
        <div className="text-red-400 text-sm px-1">{error}</div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Chart area */}
        <GlassPanel className="overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
            <span className="text-xs text-[#00FF41] font-mono px-2 py-0.5 rounded bg-[#00FF41]/10">1m</span>
            <span className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-xs text-white/40 flex-1">Real OHLCV</span>
            {syncMsg && (
              <span className="text-xs text-white/50 font-mono">{syncMsg}</span>
            )}
            <button
              type="button"
              title="Sync trades from blockchain"
              disabled={syncing || loading}
              onClick={() => runSync()}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-[#00FF41] disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
          </div>
          {(loading || syncing) && trades.length === 0 ? (
            <div className="flex items-center justify-center h-[288px] text-white/30 text-sm">
              {syncing ? "Syncing transactions from blockchain…" : "Loading…"}
            </div>
          ) : (
            <LightweightTradeChart
              trades={trades}
              periodSec={60}
              height={288}
              showVolume={true}
              mode="candles"
            />
          )}
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
        {trades.length === 0 && !loading && !syncing && (
          <div className="px-4 py-6 text-center text-white/30 text-sm">No trades found on-chain.</div>
        )}
        {(loading || syncing) && trades.length === 0 && (
          <div className="px-4 py-6 text-center text-white/30 text-sm">
            {syncing ? "Fetching transactions from blockchain…" : "Loading…"}
          </div>
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
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

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

  const copyMint = async (mint: string) => {
    await copyText(mint);
    setCopiedMint(mint);
    window.setTimeout(() => {
      setCopiedMint((current) => current === mint ? null : current);
    }, 1200);
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
          <h2 className="text-2xl font-bold text-white mb-1 font-[Orbitron]">
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
          {busy && tokens.length === 0 && Array.from({length: 8}).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1A2332] bg-[#0F1923] p-4 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-white/10 mb-3" />
              <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
              <div className="h-3 bg-white/10 rounded w-full mb-1" />
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          ))}
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
                    <HexAvatar
                      src={t.logo_uri}
                      label={t.symbol || t.name || "?"}
                      size={48}
                      gradient={score >= 85}
                    />
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
                            : "border-[#1A2332] text-white/40 bg-white/5"
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
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-white/30 text-[10px] font-mono">
                      {t.mint.slice(0, 8)}...{t.mint.slice(-6)}
                    </span>
                    <button
                      type="button"
                      title={copiedMint === t.mint ? "Copied" : "Copy mint address"}
                      aria-label={copiedMint === t.mint ? "Mint address copied" : "Copy mint address"}
                      className="shrink-0 inline-flex w-6 h-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/35 hover:text-[#00FF41] hover:border-[#00FF41]/30 hover:bg-[#00FF41]/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyMint(t.mint);
                      }}
                    >
                      {copiedMint === t.mint ? <Check size={12} /> : <Copy size={12} />}
                    </button>
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
