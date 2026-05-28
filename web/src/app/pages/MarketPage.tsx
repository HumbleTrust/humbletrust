import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, RefreshCw, BarChart2, TrendingUp, TrendingDown, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";

// ── types ─────────────────────────────────────────────────────────────────────

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

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` :
  n >= 1e9  ? `$${(n / 1e9).toFixed(2)}B`  :
  n >= 1e6  ? `$${(n / 1e6).toFixed(2)}M`  :
  n >= 1e3  ? `$${(n / 1e3).toFixed(1)}K`  :
  `$${n.toFixed(2)}`;

const fmtPrice = (n: number) => {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(3)}`;
};

// Map CoinGecko symbol → TradingView symbol (EXCHANGE:PAIR)
const TV_SYMBOL_MAP: Record<string, string> = {
  btc:  "BINANCE:BTCUSDT",
  eth:  "BINANCE:ETHUSDT",
  sol:  "BINANCE:SOLUSDT",
  bnb:  "BINANCE:BNBUSDT",
  xrp:  "BINANCE:XRPUSDT",
  usdc: "BINANCE:USDCUSDT",
  usdt: "KRAKEN:USDTUSD",
  ada:  "BINANCE:ADAUSDT",
  avax: "BINANCE:AVAXUSDT",
  doge: "BINANCE:DOGEUSDT",
  dot:  "BINANCE:DOTUSDT",
  link: "BINANCE:LINKUSDT",
  ltc:  "BINANCE:LTCUSDT",
  matic:"BINANCE:MATICUSDT",
  shib: "BINANCE:SHIBUSDT",
  uni:  "BINANCE:UNIUSDT",
  atom: "BINANCE:ATOMUSDT",
  near: "BINANCE:NEARUSDT",
  apt:  "BINANCE:APTUSDT",
  sui:  "BINANCE:SUIUSDT",
  trx:  "BINANCE:TRXUSDT",
  ton:  "BINANCE:TONUSDT",
};

const getTvSymbol = (coin: CoinGeckoCoin) =>
  TV_SYMBOL_MAP[coin.symbol.toLowerCase()] ??
  `BINANCE:${coin.symbol.toUpperCase()}USDT`;

// ── CoinGecko config (Demo plan) ─────────────────────────────────────────────

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

// ── MarketPage ────────────────────────────────────────────────────────────────

export const MarketPage = () => {
  const [coins, setCoins] = useState<CoinGeckoCoin[]>([]);
  const [filtered, setFiltered] = useState<CoinGeckoCoin[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoinGeckoCoin | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCoins = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const data: CoinGeckoCoin[] = await cgFetch(
        "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h&sparkline=false",
        ctrl.signal,
      );
      setCoins(data);
      setFiltered(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load market data. Try again later.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoins();
    return () => abortRef.current?.abort();
  }, [fetchCoins]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setFiltered(coins); return; }
    setFiltered(coins.filter(c =>
      c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    ));
  }, [query, coins]);

  return (
    <div className="space-y-6">
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
            Top 20 coins by market cap · CoinGecko data · Click any coin to open TradingView chart
          </p>
        </GlassPanel>
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-[#00FF41]/50 focus:outline-none"
              placeholder="Filter by name or symbol..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button
            disabled={busy}
            onClick={() => void fetchCoins()}
            className="flex items-center gap-1.5 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : undefined} />
          </button>
        </div>
      </motion.div>

      {error && <div className="text-red-400 text-sm px-1">{error}</div>}

      {/* TradingView chart modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                {/* Modal header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <img src={selected.image} alt="" className="w-7 h-7 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
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

                {/* TradingView iframe */}
                <iframe
                  key={selected.id}
                  src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(getTvSymbol(selected))}&interval=D&theme=dark&locale=en&style=1&toolbar_bg=%230d0d0d&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&studies=%5B%5D&show_popup_button=1&popup_width=1000&popup_height=650`}
                  className="flex-1 w-full border-0 rounded-b-lg"
                  title={`${selected.name} chart`}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {coins.length === 0 && busy && (
        <GlassPanel className="py-16 text-center">
          <div className="text-white/30 text-sm">Loading market data from CoinGecko...</div>
        </GlassPanel>
      )}

      {/* Coin grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((coin, i) => {
          const change = coin.price_change_percentage_24h ?? 0;
          const isUp = change > 0;
          const isDown = change < 0;

          return (
            <motion.div
              key={coin.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <GlassPanel
                hover
                glow={isUp ? "green" : "none"}
                className="p-4 cursor-pointer"
                onClick={() => setSelected(coin)}
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                    <img
                      src={coin.image}
                      alt={coin.symbol}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{coin.symbol.toUpperCase()}</div>
                    <div className="text-white/40 text-xs truncate">{coin.name}</div>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-mono font-semibold shrink-0",
                    isUp  ? "bg-[#00FF41]/10 text-[#00FF41]" :
                    isDown ? "bg-red-500/10 text-red-400" :
                    "bg-white/5 text-white/40"
                  )}>
                    {isUp ? <TrendingUp size={10} className="inline mr-0.5" /> : isDown ? <TrendingDown size={10} className="inline mr-0.5" /> : null}
                    {Math.abs(change).toFixed(2)}%
                  </div>
                </div>

                {/* Price */}
                <div className="text-white font-mono font-bold text-lg mb-3">
                  {fmtPrice(coin.current_price)}
                </div>

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

                {/* Rank + CTA */}
                <div className="flex items-center justify-between">
                  <span className="text-white/20 text-[10px] font-mono">#{coin.market_cap_rank}</span>
                  <div className="flex items-center gap-1 text-[#00FF41]/60 text-xs font-medium">
                    <BarChart2 size={11} /> TradingView chart
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
