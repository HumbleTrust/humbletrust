import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ExternalLink, X, RefreshCw, BarChart2, TrendingUp, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";

// ── constants ─────────────────────────────────────────────────────────────────

const POPULAR_ADDRESSES = [
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwt2nCfxKdGS",  // JTO
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",  // ORCA
  "So11111111111111111111111111111111111111112",    // SOL (wrapped)
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // mSOL
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",  // ETH (Wormhole)
].join(",");

// ── types ─────────────────────────────────────────────────────────────────────

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

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` :
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` :
  n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` :
  `$${n.toFixed(2)}`;

const fmtPrice = (p?: string) => {
  if (!p) return "—";
  const n = Number(p);
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const FETCH_TIMEOUT_MS = 9000;

function fetchWithTimeout(url: string, signal: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── MarketPage ────────────────────────────────────────────────────────────────

export const MarketPage = () => {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<DexPair | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        `https://api.dexscreener.com/latest/dex/tokens/${POPULAR_ADDRESSES}`,
        ctrl.signal,
      );
      const data = await res.json();
      const sol = (data.pairs ?? []).filter((p: DexPair) => p.chainId === "solana");
      setPairs(dedupe(sol).slice(0, 24));
    } catch (e: any) {
      if (e.name !== "AbortError") setError("DexScreener unavailable. Try again later.");
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
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
      setPairs(dedupe(sol).slice(0, 24));
      if (sol.length === 0) setError(`No results for "${q}" on Solana`);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Search error. Try again later.");
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => void fetchSearch(val), 500);
    }
  };

  useEffect(() => {
    void fetchPopular();
    return cancelPending;
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassPanel className="p-6" glow="green">
          <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-1">
            Market Watch · Mainnet
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Solana <span className="text-[#00FF41]">live market</span>
          </h2>
          <p className="text-white/50 text-sm">
            Real tokens · DexScreener data · Live charts. Monitor only — your tokens are on devnet.
          </p>
        </GlassPanel>
      </motion.div>

      {/* ── Search bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
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
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 disabled:opacity-40"
          >
            <Search size={12} /> Search
          </button>
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

      {/* ── Error ── */}
      {error && (
        <div className="text-red-400 text-sm px-1">{error}</div>
      )}

      {/* ── Chart modal ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <GlassPanel className="flex flex-col h-[80vh]" glow="green">
                {/* Modal head */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BarChart2 size={15} className="text-[#00FF41]" />
                    <span className="text-white font-semibold text-sm">
                      {selected.baseToken.name}
                      <span className="text-white/40 font-normal"> / {selected.quoteToken.symbol}</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 uppercase">
                      {selected.dexId}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20">
                      <Zap size={8} /> LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-[#00FF41] border border-[#00FF41]/20 bg-[#00FF41]/10 hover:bg-[#00FF41]/20 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      DexScreener <ExternalLink size={10} />
                    </a>
                    <button
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all"
                      onClick={() => setSelected(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Price row */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/10 bg-white/[0.02] shrink-0 flex-wrap">
                  <span className="text-2xl font-bold font-mono text-white">
                    {fmtPrice(selected.priceUsd)}
                  </span>
                  {(() => {
                    const c = selected.priceChange?.h24 ?? 0;
                    return (
                      <span className={cn(
                        "font-mono font-bold text-sm",
                        c > 0 ? "text-[#00FF41]" : c < 0 ? "text-red-400" : "text-white/40"
                      )}>
                        {c > 0 ? "▲" : c < 0 ? "▼" : "–"} {Math.abs(c).toFixed(2)}%
                      </span>
                    );
                  })()}
                  <span className="text-white/40 text-xs">Vol 24h: {fmtUsd(selected.volume?.h24 ?? 0)}</span>
                  <span className="text-white/40 text-xs">Liq: {fmtUsd(selected.liquidity?.usd ?? 0)}</span>
                  {selected.fdv && <span className="text-white/40 text-xs">FDV: {fmtUsd(selected.fdv)}</span>}
                </div>

                {/* iframe */}
                <iframe
                  src={`${selected.url}?embed=1&theme=dark&info=0&trades=1`}
                  className="flex-1 w-full border-0"
                  title={`${selected.baseToken.symbol} chart`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  referrerPolicy="no-referrer"
                />
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading / empty states ── */}
      {pairs.length === 0 && busy && (
        <GlassPanel className="py-16 text-center">
          <div className="text-white/30 text-sm">Loading market data...</div>
        </GlassPanel>
      )}
      {pairs.length === 0 && !busy && !error && (
        <GlassPanel className="py-16 text-center">
          <div className="text-white font-semibold mb-2">No results</div>
          <p className="text-white/40 text-sm">Try a different query.</p>
        </GlassPanel>
      )}

      {/* ── Token grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pairs.map((pair, i) => {
          const change = pair.priceChange?.h24 ?? 0;
          const isUp = change > 0;
          const isDown = change < 0;
          const initials = pair.baseToken.symbol.slice(0, 2).toUpperCase();

          return (
            <motion.div
              key={pair.pairAddress}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.2 }}
            >
              <GlassPanel
                hover
                glow={isUp ? "green" : "none"}
                className="p-4 cursor-pointer"
                onClick={() => setSelected(pair)}
              >
                {/* Card header */}
                <div className="flex items-center gap-2.5 mb-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs text-white/70 shrink-0 overflow-hidden relative">
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
                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{pair.baseToken.symbol}</div>
                    <div className="text-white/40 text-xs truncate">{pair.baseToken.name} · {pair.dexId}</div>
                  </div>
                  {/* Change badge */}
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-mono font-semibold shrink-0",
                    isUp ? "bg-[#00FF41]/10 text-[#00FF41]" :
                    isDown ? "bg-red-500/10 text-red-400" :
                    "bg-white/5 text-white/40"
                  )}>
                    {isUp ? "▲" : isDown ? "▼" : "–"} {Math.abs(change).toFixed(2)}%
                  </div>
                </div>

                {/* Price */}
                <div className="text-white font-mono font-bold text-lg mb-3">
                  {fmtPrice(pair.priceUsd)}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Vol 24h", value: fmtUsd(pair.volume?.h24 ?? 0) },
                    { label: "Liquidity", value: fmtUsd(pair.liquidity?.usd ?? 0) },
                    { label: "FDV", value: pair.fdv ? fmtUsd(pair.fdv) : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="text-white/30 text-[10px]">{label}</div>
                      <div className="text-white/80 text-xs font-mono font-semibold">{value}</div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-1.5 text-[#00FF41]/60 text-xs font-medium">
                  <BarChart2 size={11} /> Live chart
                </div>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
