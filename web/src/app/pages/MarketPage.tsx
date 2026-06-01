import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { HexAvatar } from "../components/HexAvatar";
import {
  Search, X, RefreshCw, BarChart2, TrendingUp, TrendingDown, Globe,
  Star, ChevronDown, Zap, Layers, Award,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";
import { CHAINS, Chain, ChainIcon, TrustScoreBadge } from "../data/chains.tsx";

// ── types ─────────────────────────────────────────────────────────────────────

type MarketCategory = "all" | "blockchains" | "new" | "gainers_losers" | "watchlist";

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number | null;
  total_volume: number;
  circulating_supply: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
}

interface TrendingItem {
  item: {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
    market_cap_rank: number | null;
    data?: {
      price?: number | string;
      price_change_percentage_24h?: { usd?: number };
      market_cap?: string;
      total_volume?: string;
    };
  };
}

interface NewPairItem {
  address:       string;
  name:          string;
  symbol:        string;
  image:         string;
  price_usd?:    number;
  change_24h?:   number | null;
  market_cap?:   number;
  volume_24h?:   number;
  liquidity_usd?: number;
  created_at?:   number;
  complete?:     boolean;
  dex_url?:      string;
  description?:  string;
  links?:        Array<{ type: string; label: string; url: string }>;
  source:        "pump" | "pumpswap" | "dex" | "raydium" | "meteora" | "orca";
}

type NewPairsSource = "cg" | "pump" | "pumpswap" | "dex" | "raydium" | "meteora" | "orca";

// Chain type and CHAINS array imported from ../data/chains

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` :
  n >= 1e9  ? `$${(n / 1e9).toFixed(2)}B`  :
  n >= 1e6  ? `$${(n / 1e6).toFixed(2)}M`  :
  n >= 1e3  ? `$${(n / 1e3).toFixed(1)}K`  :
  `$${n.toFixed(2)}`;

const fmtPrice = (n: number | string) => {
  const v = Number(n);
  if (isNaN(v) || v === 0) return "—";
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v >= 1)    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  if (v >= 0.0001) return `$${v.toFixed(6)}`;
  return `$${v.toExponential(3)}`;
};

const TV_SYMBOL_MAP: Record<string, string> = {
  btc: "BINANCE:BTCUSDT", eth: "BINANCE:ETHUSDT", sol: "BINANCE:SOLUSDT",
  bnb: "BINANCE:BNBUSDT", xrp: "BINANCE:XRPUSDT", usdc: "BINANCE:USDCUSDT",
  usdt: "KRAKEN:USDTUSD", ada: "BINANCE:ADAUSDT",  avax: "BINANCE:AVAXUSDT",
  doge: "BINANCE:DOGEUSDT", dot: "BINANCE:DOTUSDT", link: "BINANCE:LINKUSDT",
  ltc: "BINANCE:LTCUSDT", matic: "BINANCE:MATICUSDT", shib: "BINANCE:SHIBUSDT",
  uni: "BINANCE:UNIUSDT", atom: "BINANCE:ATOMUSDT", near: "BINANCE:NEARUSDT",
  apt: "BINANCE:APTUSDT", sui: "BINANCE:SUIUSDT", trx: "BINANCE:TRXUSDT",
  ton: "BINANCE:TONUSDT",
};

const getTvSymbol = (coin: { symbol: string }) =>
  TV_SYMBOL_MAP[coin.symbol.toLowerCase()] ?? `BINANCE:${coin.symbol.toUpperCase()}USDT`;

// ── TradingView widget ─────────────────────────────────────────────────────────

const TradingViewChart = memo(({ symbol }: { symbol: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const uid = `tv_${Date.now()}`;
    el.innerHTML = `<div id="${uid}" style="height:100%;width:100%"></div>`;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      const TV = (window as any).TradingView;
      if (!TV) return;
      new TV.widget({
        autosize: true, symbol, interval: "D", timezone: "Etc/UTC",
        theme: "dark", style: "1", locale: "en", toolbar_bg: "#0d0d0d",
        enable_publishing: false, hide_side_toolbar: false,
        allow_symbol_change: true, container_id: uid,
      });
    };
    el.appendChild(script);
    return () => { el.innerHTML = ""; };
  }, [symbol]);
  return <div ref={containerRef} className="flex-1 w-full min-h-0" />;
});

// ── CoinGecko config ──────────────────────────────────────────────────────────

const CG_BASE = "https://api.coingecko.com/api/v3";
const CG_KEY  = (import.meta.env.VITE_COINGECKO_API_KEY as string) || "CG-mGH1d5uGSUubaj8sKxxBbwZT";

async function cgFetch(path: string, signal?: AbortSignal) {
  const res = await fetch(`${CG_BASE}${path}`, {
    signal,
    headers: CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : undefined,
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return res.json();
}

// ── CoinCard ──────────────────────────────────────────────────────────────────

const CoinCard = memo(({
  coin, index, onSelect, onToggleStar, isStarred,
}: {
  coin: CoinGeckoCoin;
  index: number;
  onSelect: (c: CoinGeckoCoin) => void;
  onToggleStar: (id: string) => void;
  isStarred: boolean;
}) => {
  const change = coin.price_change_percentage_24h ?? 0;
  const isUp   = change > 0;
  const isDown = change < 0;
  return (
    <motion.div
      key={coin.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <GlassPanel hover glow={isUp ? "green" : "none"} className="p-4 cursor-pointer relative group">
        {/* Star button */}
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(coin.id); }}
          className={cn(
            "absolute top-3 right-3 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100",
            isStarred ? "opacity-100 text-yellow-400" : "text-white/20 hover:text-yellow-400"
          )}
        >
          <Star size={12} fill={isStarred ? "currentColor" : "none"} />
        </button>

        <div onClick={() => onSelect(coin)}>
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3 pr-5">
            <HexAvatar src={coin.image} label={coin.symbol} size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">{coin.symbol.toUpperCase()}</div>
              <div className="text-white/40 text-xs truncate">{coin.name}</div>
            </div>
            <div className={cn(
              "px-2 py-1 rounded-lg text-xs font-mono font-semibold shrink-0",
              isUp   ? "bg-[#00FF41]/10 text-[#00FF41]" :
              isDown ? "bg-red-500/10 text-red-400" :
                       "bg-white/5 text-white/40"
            )}>
              {isUp ? <TrendingUp size={10} className="inline mr-0.5" /> : isDown ? <TrendingDown size={10} className="inline mr-0.5" /> : null}
              {Math.abs(change).toFixed(2)}%
            </div>
          </div>
          {/* Price */}
          <div className="text-white font-mono font-bold text-lg mb-3">{fmtPrice(coin.current_price)}</div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Market Cap", value: fmtUsd(coin.market_cap) },
              { label: "Vol 24h",    value: fmtUsd(coin.total_volume) },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <div className="text-white/30 text-[10px]">{label}</div>
                <div className="text-white/80 text-xs font-mono font-semibold">{value}</div>
              </div>
            ))}
          </div>
          {/* Rank */}
          <div className="flex items-center justify-between">
            <span className="text-white/20 text-[10px] font-mono">#{coin.market_cap_rank}</span>
            <div className="flex items-center gap-1 text-[#00FF41]/60 text-xs font-medium">
              <BarChart2 size={11} /> TradingView chart
            </div>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
});

// ── MarketPage ────────────────────────────────────────────────────────────────

export const MarketPage = () => {
  const [category, setCategory]   = useState<MarketCategory>("all");
  const [coins, setCoins]         = useState<CoinGeckoCoin[]>([]);
  const [filtered, setFiltered]   = useState<CoinGeckoCoin[]>([]);
  const [query, setQuery]         = useState("");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<CoinGeckoCoin | null>(null);

  // Blockchains
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [chainOpen, setChainOpen]         = useState(false);
  const [chainSearch, setChainSearch]     = useState("");
  const [chainCoins, setChainCoins]       = useState<CoinGeckoCoin[]>([]);
  const [chainBusy, setChainBusy]         = useState(false);

  // Trending / New Pairs
  const [trending,       setTrending]       = useState<TrendingItem[]>([]);
  const [newSource,      setNewSource]      = useState<NewPairsSource>("cg");
  const [newPairsData,   setNewPairsData]   = useState<Record<string, NewPairItem[]>>({});
  const [newPairsBusy,   setNewPairsBusy]   = useState(false);

  // Gainers/Losers
  const [glCoins, setGlCoins] = useState<CoinGeckoCoin[]>([]);

  // WatchList
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ht_market_watchlist") || "[]")); }
    catch { return new Set(); }
  });

  const abortRef = useRef<AbortController | null>(null);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem("ht_market_watchlist", JSON.stringify([...watchlist]));
  }, [watchlist]);

  const toggleStar = useCallback((id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Fetches ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(null);
    try {
      const data: CoinGeckoCoin[] = await cgFetch(
        "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h&sparkline=false",
        ctrl.signal,
      );
      setCoins(data); setFiltered(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load market data. Try again later.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const fetchChainCoins = useCallback(async (chain: Chain) => {
    if (!chain.category) { setChainCoins([]); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChainBusy(true); setError(null);
    try {
      const data: CoinGeckoCoin[] = await cgFetch(
        `/coins/markets?vs_currency=usd&category=${chain.category}&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h&sparkline=false`,
        ctrl.signal,
      );
      setChainCoins(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load chain data.");
    } finally {
      if (!ctrl.signal.aborted) setChainBusy(false);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(null);
    try {
      const data = await cgFetch("/trending", ctrl.signal);
      setTrending(data.coins || []);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load trending data.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const fetchNewPairs = useCallback(async (src: Exclude<NewPairsSource, "cg">) => {
    setNewPairsBusy(true);
    try {
      const r = await fetch(`/api/new-pairs?source=${src}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setNewPairsData(prev => ({ ...prev, [src]: data.items ?? [] }));
    } catch (e: any) {
      console.warn("[fetchNewPairs]", src, e.message);
    } finally {
      setNewPairsBusy(false);
    }
  }, []);

  const fetchGainersLosers = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(null);
    try {
      const data: CoinGeckoCoin[] = await cgFetch(
        "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h&sparkline=false",
        ctrl.signal,
      );
      setGlCoins(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load market data.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  // ── Category switch ───────────────────────────────────────────────────────────

  useEffect(() => {
    setError(null); setQuery("");
    if (category === "all")           void fetchAll();
    else if (category === "new") {
      if (newSource === "cg")          void fetchTrending();
      else                             void fetchNewPairs(newSource);
    }
    else if (category === "gainers_losers") void fetchGainersLosers();
    else if (category === "blockchains" && selectedChain) void fetchChainCoins(selectedChain);
    return () => abortRef.current?.abort();
  }, [category, selectedChain, newSource]);

  useEffect(() => {
    void fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  // ── Search filter (all/blockchains) ──────────────────────────────────────────

  useEffect(() => {
    const src = category === "blockchains" ? chainCoins : coins;
    const q = query.trim().toLowerCase();
    if (!q) { setFiltered(src); return; }
    setFiltered(src.filter(c =>
      c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    ));
  }, [query, coins, chainCoins, category]);

  // ── Gainers/Losers split ──────────────────────────────────────────────────────

  const { gainers, losers } = useMemo(() => {
    const valid = glCoins.filter(c => c.price_change_percentage_24h !== null);
    const sorted = [...valid].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));
    return { gainers: sorted.slice(0, 10), losers: sorted.slice(-10).reverse() };
  }, [glCoins]);

  // ── Watchlist coins ───────────────────────────────────────────────────────────

  const watchlistCoins = useMemo(() => {
    const all = [...coins, ...chainCoins, ...glCoins];
    const seen = new Set<string>();
    const unique = all.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
    return unique.filter(c => watchlist.has(c.id));
  }, [coins, chainCoins, glCoins, watchlist]);

  // ── Chain selection ───────────────────────────────────────────────────────────

  const filteredChains = useMemo(() => {
    const q = chainSearch.toLowerCase();
    return q ? CHAINS.filter(c => c.name.toLowerCase().includes(q)) : CHAINS;
  }, [chainSearch]);

  const handleSelectChain = (chain: Chain) => {
    setSelectedChain(chain);
    setChainOpen(false);
    setChainSearch("");
    setCategory("blockchains");
    void fetchChainCoins(chain);
  };

  // ── Refresh ───────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    if (category === "all")                   void fetchAll();
    else if (category === "new")              void fetchTrending();
    else if (category === "gainers_losers")   void fetchGainersLosers();
    else if (category === "blockchains" && selectedChain) void fetchChainCoins(selectedChain);
  };

  const isBusy = busy || chainBusy;

  // ── Render helpers ────────────────────────────────────────────────────────────

  const CoinGrid = ({ list }: { list: CoinGeckoCoin[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {list.map((coin, i) => (
        <CoinCard
          key={coin.id}
          coin={coin}
          index={i}
          onSelect={setSelected}
          onToggleStar={toggleStar}
          isStarred={watchlist.has(coin.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassPanel className="p-6" glow="green">
          <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-1 flex items-center gap-2">
            <Globe size={12} /> Market Watch · Global
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Global <span className="text-[#00FF41]">crypto markets</span>
          </h2>
          <p className="text-white/50 text-sm">
            Top coins by market cap · CoinGecko data · Click any coin to open TradingView chart
          </p>
        </GlassPanel>
      </motion.div>

      {/* ── Category tabs ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-center gap-2 flex-wrap">

          {/* All */}
          <button
            onClick={() => { setCategory("all"); setSelectedChain(null); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
              category === "all"
                ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <Globe size={13} /> All
          </button>

          {/* Blockchains */}
          <div className="relative">
            <button
              onClick={() => { setCategory("blockchains"); setChainOpen(o => !o); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
                category === "blockchains"
                  ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
              )}
            >
              {selectedChain ? <ChainIcon chain={selectedChain} size={14} /> : <Layers size={13} />}
              {selectedChain ? selectedChain.name : "Blockchains"}
              <ChevronDown size={12} className={cn("transition-transform", chainOpen && "rotate-180")} />
            </button>
          </div>

          {/* New Pairs */}
          <button
            onClick={() => setCategory("new")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
              category === "new"
                ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <Zap size={13} /> New Pairs
          </button>

          {/* Gainers & Losers */}
          <button
            onClick={() => setCategory("gainers_losers")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
              category === "gainers_losers"
                ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <TrendingUp size={13} /> Gainers &amp; Losers
          </button>

          {/* WatchList */}
          <button
            onClick={() => setCategory("watchlist")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
              category === "watchlist"
                ? "bg-yellow-400/15 border-yellow-400/50 text-yellow-400"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <Star size={13} fill={category === "watchlist" ? "currentColor" : "none"} />
            WatchList
            {watchlist.size > 0 && (
              <span className={cn(
                "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                category === "watchlist" ? "bg-yellow-400/20 text-yellow-400" : "bg-white/10 text-white/40"
              )}>
                {watchlist.size}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            disabled={isBusy}
            onClick={handleRefresh}
            className="ml-auto flex items-center gap-1.5 p-2.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <RefreshCw size={13} className={isBusy ? "animate-spin" : undefined} />
          </button>
        </div>
      </motion.div>

      {/* ── Blockchain dropdown panel ── */}
      <AnimatePresence>
        {chainOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassPanel className="p-4" glow="none">
              {/* Chain search */}
              <div className="relative mb-3">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-[#00FF41]/50 focus:outline-none"
                  placeholder="Search blockchain..."
                  value={chainSearch}
                  onChange={e => setChainSearch(e.target.value)}
                  autoFocus
                />
                {chainSearch && (
                  <button onClick={() => setChainSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                    <X size={11} />
                  </button>
                )}
              </div>
              {/* Chain grid */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {filteredChains.map(chain => (
                  <button
                    key={chain.name}
                    onClick={() => handleSelectChain(chain)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      selectedChain?.name === chain.name
                        ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                        : chain.category
                          ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                          : "bg-white/3 border-white/6 text-white/30 hover:bg-white/8 hover:text-white/50"
                    )}
                  >
                    <ChainIcon chain={chain} size={14} />
                    {chain.name}
                    {!chain.category && <span className="ml-1 text-[9px] text-white/20">·</span>}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-white/20">
                Chains with dimmed text have no CoinGecko category data yet
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search bar (for all / blockchains) ── */}
      <AnimatePresence>
        {(category === "all" || category === "blockchains") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-[#00FF41]/50 focus:outline-none"
                placeholder="Filter by name or symbol..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="text-red-400 text-sm px-1">{error}</div>}

      {/* ── TradingView modal ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-5xl h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <GlassPanel className="flex flex-col h-full" glow="green">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <HexAvatar src={selected.image} label={selected.symbol} size={28} />
                    <div>
                      <span className="text-white font-semibold">{selected.name}</span>
                      <span className="text-white/40 font-normal ml-1.5 text-sm">{selected.symbol.toUpperCase()}</span>
                    </div>
                    <span className="text-xs font-mono text-white/30">#{selected.market_cap_rank}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-white font-mono font-bold">{fmtPrice(selected.current_price)}</div>
                      <div className={cn("text-xs font-mono", (selected.price_change_percentage_24h ?? 0) >= 0 ? "text-[#00FF41]" : "text-red-400")}>
                        {(selected.price_change_percentage_24h ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(selected.price_change_percentage_24h ?? 0).toFixed(2)}% 24h
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <TradingViewChart symbol={getTvSymbol(selected)} />
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading ── */}
      {isBusy && (
        <GlassPanel className="py-10 text-center">
          <div className="text-white/30 text-sm">Loading market data...</div>
        </GlassPanel>
      )}

      {/* ── ALL ── */}
      {!isBusy && category === "all" && (
        filtered.length === 0
          ? <div className="text-white/30 text-sm text-center py-8">No coins match your search.</div>
          : <CoinGrid list={filtered} />
      )}

      {/* ── BLOCKCHAINS ── */}
      {!isBusy && category === "blockchains" && !selectedChain && (
        <GlassPanel className="py-12 text-center">
          <Layers size={28} className="mx-auto text-white/20 mb-3" />
          <div className="text-white/50 text-sm mb-1">Select a blockchain above</div>
          <div className="text-white/25 text-xs">to explore its top tokens</div>
        </GlassPanel>
      )}

      {!isBusy && category === "blockchains" && selectedChain && !selectedChain.category && (
        <GlassPanel className="py-12 text-center">
          <Layers size={28} className="mx-auto text-white/20 mb-3" />
          <div className="text-white/50 text-sm mb-1">{selectedChain.name} ecosystem data coming soon</div>
          <div className="text-white/25 text-xs">CoinGecko category not yet available for this chain</div>
        </GlassPanel>
      )}

      {!isBusy && category === "blockchains" && selectedChain?.category && (
        filtered.length === 0
          ? <div className="text-white/30 text-sm text-center py-8">No tokens found for {selectedChain.name}.</div>
          : (
            <div>
              <div className="text-xs text-white/30 mb-3 flex items-center gap-2">
                <Layers size={11} className="text-[#00FF41]" />
                Top tokens on <span className="text-[#00FF41] font-medium">{selectedChain.name}</span>
              </div>
              <CoinGrid list={filtered} />
            </div>
          )
      )}

      {/* ── NEW PAIRS ── */}
      {!isBusy && category === "new" && (
        <div>
          {/* Source sub-tabs */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {(["cg", "pump", "pumpswap", "dex", "raydium", "meteora", "orca"] as const).map(src => {
              const labels: Record<NewPairsSource, string> = {
                cg:       "CoinGecko",
                pump:     "Pump.fun",
                pumpswap: "PumpSwap",
                dex:      "DexScreener",
                raydium:  "Raydium",
                meteora:  "Meteora",
                orca:     "Orca",
              };
              return (
                <button
                  key={src}
                  onClick={() => setNewSource(src)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    newSource === src
                      ? "bg-[#00FF41]/15 border-[#00FF41]/50 text-[#00FF41]"
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {labels[src]}
                </button>
              );
            })}
            {newPairsBusy && <RefreshCw size={12} className="text-[#00FF41]/50 animate-spin ml-1" />}
          </div>

          {/* CoinGecko Trending */}
          {newSource === "cg" && (
            trending.length === 0 ? (
              <GlassPanel className="py-12 text-center">
                <div className="text-white/30 text-sm">No trending data available.</div>
              </GlassPanel>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trending.map((t, i) => {
                  const item   = t.item;
                  const price  = item.data?.price ?? 0;
                  const change = item.data?.price_change_percentage_24h?.usd ?? null;
                  const isUp   = change !== null && change > 0;
                  const isDown = change !== null && change < 0;
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}>
                      <GlassPanel hover glow={isUp ? "green" : "none"} className="p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <HexAvatar src={item.thumb} label={item.symbol} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-semibold text-sm">{item.symbol.toUpperCase()}</div>
                            <div className="text-white/40 text-xs truncate">{item.name}</div>
                          </div>
                          {change !== null && (
                            <div className={cn("px-2 py-1 rounded-lg text-xs font-mono font-semibold",
                              isUp ? "bg-[#00FF41]/10 text-[#00FF41]" : isDown ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/40")}>
                              {isUp ? <TrendingUp size={10} className="inline mr-0.5" /> : isDown ? <TrendingDown size={10} className="inline mr-0.5" /> : null}
                              {Math.abs(change).toFixed(2)}%
                            </div>
                          )}
                        </div>
                        <div className="text-white font-mono font-bold text-lg mb-2">{fmtPrice(price)}</div>
                        <div className="flex items-center justify-between">
                          {item.market_cap_rank && <span className="text-white/20 text-[10px] font-mono">#{item.market_cap_rank}</span>}
                          <div className="flex items-center gap-1 text-[#00FF41]/50 text-[10px]"><Zap size={9} /> Trending</div>
                        </div>
                      </GlassPanel>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}

          {/* All non-CG sources — universal card grid */}
          {newSource !== "cg" && (() => {
            const coins = newPairsData[newSource] ?? [];
            const sourceLabels: Record<string, string> = {
              pump: "pump.fun", pumpswap: "PumpSwap", dex: "DexScreener",
              raydium: "Raydium", meteora: "Meteora", orca: "Orca",
            };
            const label = sourceLabels[newSource] ?? newSource;
            if (coins.length === 0) return (
              <GlassPanel className="py-12 text-center">
                <div className="text-white/30 text-sm">{newPairsBusy ? "Loading…" : `No data from ${label}.`}</div>
              </GlassPanel>
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {coins.map((coin, i) => {
                  const isUp   = (coin.change_24h ?? 0) > 0;
                  const isDown = (coin.change_24h ?? 0) < 0;
                  const stat   = coin.liquidity_usd
                    ? `Liq ${fmtUsd(coin.liquidity_usd)}`
                    : coin.market_cap
                      ? `MCap ${fmtUsd(coin.market_cap)}`
                      : coin.volume_24h
                        ? `Vol ${fmtUsd(coin.volume_24h)}`
                        : "";
                  return (
                    <motion.div key={coin.address + i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }}>
                      <GlassPanel hover glow={isUp ? "green" : coin.complete ? "green" : "none"} className="p-4 cursor-pointer"
                        onClick={() => window.dispatchEvent(new CustomEvent("ht:open-trade", { detail: coin.address }))}>
                        <div className="flex items-center gap-2.5 mb-3">
                          <HexAvatar src={coin.image} label={coin.symbol || coin.name} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-semibold text-sm truncate">{coin.symbol || coin.name || coin.address.slice(0,8)+"…"}</div>
                            <div className="text-white/40 text-xs truncate">{coin.name}</div>
                          </div>
                          <TrustScoreBadge mint={coin.address} />
                          {coin.complete && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20">bonded</span>}
                          {!coin.complete && coin.change_24h !== null && coin.change_24h !== undefined && (
                            <div className={cn("px-2 py-1 rounded-lg text-xs font-mono font-semibold",
                              isUp ? "bg-[#00FF41]/10 text-[#00FF41]" : isDown ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/40")}>
                              {isUp ? <TrendingUp size={10} className="inline mr-0.5" /> : isDown ? <TrendingDown size={10} className="inline mr-0.5" /> : null}
                              {Math.abs(coin.change_24h).toFixed(2)}%
                            </div>
                          )}
                        </div>
                        <div className="text-white font-mono font-bold text-lg mb-2">
                          {coin.price_usd ? fmtPrice(coin.price_usd) : "—"}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/20 text-[10px]">{stat}</span>
                          {coin.dex_url && (
                            <a href={coin.dex_url} target="_blank" rel="noreferrer"
                              className="text-[#00FF41]/50 text-[10px] hover:text-[#00FF41] transition-colors"
                              onClick={e => e.stopPropagation()}>
                              {label} ↗
                            </a>
                          )}
                        </div>
                      </GlassPanel>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── GAINERS & LOSERS ── */}
      {!isBusy && category === "gainers_losers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gainers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-[#00FF41]" />
                <span className="text-sm font-semibold text-white">Top Gainers</span>
                <span className="text-xs text-white/30">24h</span>
              </div>
              <div className="space-y-2">
                {gainers.map((coin, i) => {
                  const change = coin.price_change_percentage_24h ?? 0;
                  return (
                    <motion.div
                      key={coin.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <GlassPanel hover glow="green" className="px-4 py-3 cursor-pointer" onClick={() => setSelected(coin)}>
                        <div className="flex items-center gap-3">
                          <span className="text-white/20 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                          <HexAvatar src={coin.image} label={coin.symbol} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-semibold">{coin.symbol.toUpperCase()}</div>
                            <div className="text-white/40 text-xs truncate">{coin.name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-white font-mono text-sm">{fmtPrice(coin.current_price)}</div>
                            <div className="text-[#00FF41] text-xs font-mono font-bold">
                              <TrendingUp size={9} className="inline mr-0.5" />+{change.toFixed(2)}%
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); toggleStar(coin.id); }}
                            className={cn("p-1 ml-1 shrink-0 transition-all", watchlist.has(coin.id) ? "text-yellow-400" : "text-white/15 hover:text-yellow-400")}
                          >
                            <Star size={12} fill={watchlist.has(coin.id) ? "currentColor" : "none"} />
                          </button>
                        </div>
                      </GlassPanel>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Losers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} className="text-red-400" />
                <span className="text-sm font-semibold text-white">Top Losers</span>
                <span className="text-xs text-white/30">24h</span>
              </div>
              <div className="space-y-2">
                {losers.map((coin, i) => {
                  const change = coin.price_change_percentage_24h ?? 0;
                  return (
                    <motion.div
                      key={coin.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <GlassPanel hover className="px-4 py-3 cursor-pointer" onClick={() => setSelected(coin)}>
                        <div className="flex items-center gap-3">
                          <span className="text-white/20 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                          <HexAvatar src={coin.image} label={coin.symbol} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-semibold">{coin.symbol.toUpperCase()}</div>
                            <div className="text-white/40 text-xs truncate">{coin.name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-white font-mono text-sm">{fmtPrice(coin.current_price)}</div>
                            <div className="text-red-400 text-xs font-mono font-bold">
                              <TrendingDown size={9} className="inline mr-0.5" />{change.toFixed(2)}%
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); toggleStar(coin.id); }}
                            className={cn("p-1 ml-1 shrink-0 transition-all", watchlist.has(coin.id) ? "text-yellow-400" : "text-white/15 hover:text-yellow-400")}
                          >
                            <Star size={12} fill={watchlist.has(coin.id) ? "currentColor" : "none"} />
                          </button>
                        </div>
                      </GlassPanel>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WATCHLIST ── */}
      {!isBusy && category === "watchlist" && (
        watchlist.size === 0 ? (
          <GlassPanel className="py-16 text-center">
            <Star size={32} className="mx-auto text-white/10 mb-3" />
            <div className="text-white/50 text-sm mb-1">Your watchlist is empty</div>
            <div className="text-white/25 text-xs">Click the ★ on any coin to add it here</div>
          </GlassPanel>
        ) : watchlistCoins.length === 0 ? (
          <GlassPanel className="py-16 text-center">
            <div className="text-white/30 text-sm">Watchlisted coins not in current data.</div>
            <div className="text-white/20 text-xs mt-1">Switch to All, Blockchains, or Gainers/Losers to load them first.</div>
          </GlassPanel>
        ) : (
          <div>
            <div className="text-xs text-white/30 mb-3 flex items-center gap-2">
              <Star size={11} className="text-yellow-400" fill="currentColor" />
              <span>{watchlistCoins.length} coin{watchlistCoins.length !== 1 ? "s" : ""} in your watchlist</span>
            </div>
            <CoinGrid list={watchlistCoins} />
          </div>
        )
      )}
    </div>
  );
};
