import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, RefreshCw, TrendingUp, X, BarChart2, Zap, ExternalLink } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { cn } from "../ui/utils";

const POPULAR_SOLANA = [
  "So11111111111111111111111111111111111111112",    // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",  // ORCA
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // mSOL
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
].join(",");

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity?: { usd: number };
  fdv?: number;
  info?: { imageUrl?: string };
}

const fmtUsd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` :
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` :
  n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` :
  `$${n.toFixed(2)}`;

const fmtPrice = (p?: string) => {
  if (!p) return "—";
  const n = Number(p);
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(3)}`;
};

const dedupe = (pairs: DexPair[]) => {
  const best = new Map<string, DexPair>();
  for (const p of pairs) {
    const k = p.baseToken.address;
    if (!best.has(k) || (p.volume?.h24 ?? 0) > (best.get(k)!.volume?.h24 ?? 0)) best.set(k, p);
  }
  return [...best.values()].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
};

const FETCH_TIMEOUT = 9000;
function fetchWithTimeout(url: string, signal: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export function Charts() {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [selected, setSelected] = useState<DexPair | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"popular" | "search">("popular");
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const fetchPopular = useCallback(async () => {
    cancelPending();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(null); setMode("popular");
    try {
      const res = await fetchWithTimeout(
        `https://api.dexscreener.com/latest/dex/tokens/${POPULAR_SOLANA}`,
        ctrl.signal,
      );
      const data = await res.json();
      const sol = (data.pairs ?? []).filter((p: DexPair) => p.chainId === "solana");
      const deduped = dedupe(sol).slice(0, 20);
      setPairs(deduped);
      if (!selected && deduped.length > 0) setSelected(deduped[0]);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("DexScreener unavailable. Try again later.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    cancelPending();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(null); setMode("search");
    try {
      const res = await fetchWithTimeout(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
        ctrl.signal,
      );
      const data = await res.json();
      const sol = (data.pairs ?? []).filter((p: DexPair) => p.chainId === "solana");
      const deduped = dedupe(sol).slice(0, 20);
      setPairs(deduped);
      if (deduped.length > 0) setSelected(deduped[0]);
      if (sol.length === 0) setError(`No results for "${q}" on Solana`);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Search error. Try again.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => void fetchSearch(val), 500);
    } else if (!val.trim()) {
      void fetchPopular();
    }
  };

  useEffect(() => {
    void fetchPopular();
    return cancelPending;
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassPanel className="p-6" glow="green">
          <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-1">Charts · Mainnet</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Solana <span className="text-[#00FF41]">live charts</span>
          </h2>
          <p className="text-white/50 text-sm">Real-time charts via DexScreener · Click a token to load its chart</p>
        </GlassPanel>
      </motion.div>

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={e => { e.preventDefault(); void fetchSearch(searchQuery); }}
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-[#00FF41]/50 focus:outline-none"
              placeholder="Token name, symbol or address..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs transition-all disabled:opacity-40",
              mode === "popular"
                ? "bg-[#00FF41]/10 border-[#00FF41]/30 text-[#00FF41]"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            )}
            onClick={() => { setSearchQuery(""); void fetchPopular(); }}
          >
            <TrendingUp size={12} /> Popular
          </button>
          <button
            type="button"
            disabled={busy}
            className="flex items-center gap-1.5 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 disabled:opacity-40"
            onClick={() => mode === "popular" ? fetchPopular() : fetchSearch(searchQuery)}
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : undefined} />
          </button>
        </form>
      </motion.div>

      {error && <div className="text-red-400 text-sm px-1">{error}</div>}

      {/* Main layout: sidebar + chart — fills remaining viewport height */}
      <div
        className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4"
        style={{ height: "calc(100vh - 320px)", minHeight: 520 }}
      >

        {/* Token list sidebar */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="h-full">
          <GlassPanel className="overflow-hidden flex flex-col h-full">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Pairs</span>
              <span className="text-xs text-white/30">{pairs.length}</span>
            </div>
            <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
              {pairs.length === 0 && busy && (
                <div className="px-4 py-6 text-center text-white/30 text-sm">Loading...</div>
              )}
              {pairs.map((pair) => {
                const change = pair.priceChange?.h24 ?? 0;
                const isActive = selected?.pairAddress === pair.pairAddress;
                const initials = pair.baseToken.symbol.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={pair.pairAddress}
                    type="button"
                    onClick={() => setSelected(pair)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all",
                      isActive ? "bg-[#00FF41]/10 border-l-2 border-[#00FF41]" : "hover:bg-white/5 border-l-2 border-transparent"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70 shrink-0 overflow-hidden relative">
                      <span>{initials}</span>
                      {pair.info?.imageUrl && (
                        <img
                          src={pair.info.imageUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{pair.baseToken.symbol}</div>
                      <div className="text-white/40 text-[10px] truncate">{fmtPrice(pair.priceUsd)}</div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono shrink-0",
                      change > 0 ? "text-[#00FF41]" : change < 0 ? "text-red-400" : "text-white/40"
                    )}>
                      {change > 0 ? "▲" : change < 0 ? "▼" : "–"}{Math.abs(change).toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassPanel>
        </motion.div>

        {/* Chart area */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="h-full flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.pairAddress}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0"
              >
                <GlassPanel className="flex flex-col h-full" glow="green">
                  {/* Chart header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BarChart2 size={15} className="text-[#00FF41]" />
                      <span className="text-white font-semibold text-sm">
                        {selected.baseToken.symbol}
                        <span className="text-white/40 font-normal"> / {selected.quoteToken.symbol}</span>
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 uppercase">
                        {selected.dexId}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20">
                        <Zap size={8} /> LIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-xl font-bold font-mono text-white mr-2">{fmtPrice(selected.priceUsd)}</span>
                        {(() => {
                          const c = selected.priceChange?.h24 ?? 0;
                          return (
                            <span className={cn("font-mono font-bold text-sm", c > 0 ? "text-[#00FF41]" : c < 0 ? "text-red-400" : "text-white/40")}>
                              {c > 0 ? "▲" : c < 0 ? "▼" : "–"} {Math.abs(c).toFixed(2)}%
                            </span>
                          );
                        })()}
                      </div>
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-[#00FF41] border border-[#00FF41]/20 bg-[#00FF41]/10 hover:bg-[#00FF41]/20 px-2 py-1 rounded-lg transition-all"
                      >
                        DexScreener <ExternalLink size={9} />
                      </a>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 px-4 py-2 border-b border-white/10 bg-white/[0.02] shrink-0 flex-wrap">
                    <span className="text-xs text-white/40">
                      Vol 24h: <span className="text-white/70">{fmtUsd(selected.volume?.h24 ?? 0)}</span>
                    </span>
                    <span className="text-xs text-white/40">
                      Liq: <span className="text-white/70">{fmtUsd(selected.liquidity?.usd ?? 0)}</span>
                    </span>
                    {selected.fdv && (
                      <span className="text-xs text-white/40">
                        FDV: <span className="text-white/70">{fmtUsd(selected.fdv)}</span>
                      </span>
                    )}
                  </div>

                  {/* DexScreener iframe — fills remaining height */}
                  <iframe
                    src={`${selected.url}?embed=1&theme=dark&info=0&trades=0`}
                    className="flex-1 w-full border-0 min-h-0"
                    style={{ minHeight: 320 }}
                    title={`${selected.baseToken.symbol} chart`}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    referrerPolicy="no-referrer"
                  />

                  {/* Quick stats pinned to bottom */}
                  <div className="flex items-center gap-6 px-4 py-2.5 border-t border-white/10 bg-white/[0.02] shrink-0 flex-wrap">
                    {[
                      { label: "Price", value: fmtPrice(selected.priceUsd) },
                      { label: "24h", value: `${(selected.priceChange?.h24 ?? 0) > 0 ? "+" : ""}${(selected.priceChange?.h24 ?? 0).toFixed(2)}%`, val: selected.priceChange?.h24 ?? 0 },
                      { label: "Vol 24h", value: fmtUsd(selected.volume?.h24 ?? 0) },
                      { label: "Liquidity", value: fmtUsd(selected.liquidity?.usd ?? 0) },
                    ].map(({ label, value, val }) => (
                      <div key={label} className="flex items-center gap-1.5 text-xs">
                        <span className="text-white/40">{label}:</span>
                        <span className={cn(
                          "font-mono font-semibold",
                          val !== undefined ? (val > 0 ? "text-[#00FF41]" : val < 0 ? "text-red-400" : "text-white") : "text-white"
                        )}>{value}</span>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0">
                <GlassPanel className="flex items-center justify-center h-full">
                  <div className="text-center text-white/30">
                    <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a token from the list to view its chart</p>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
