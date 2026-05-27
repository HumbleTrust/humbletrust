import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
}

// crypto.com Exchange API instruments
const COINS = [
  { instrument: "SOL_USDT",  symbol: "SOL"  },
  { instrument: "BTC_USDT",  symbol: "BTC"  },
  { instrument: "ETH_USDT",  symbol: "ETH"  },
  { instrument: "JUP_USDT",  symbol: "JUP"  },
  { instrument: "BONK_USDT", symbol: "BONK" },
  { instrument: "WIF_USDT",  symbol: "WIF"  },
  { instrument: "JTO_USDT",  symbol: "JTO"  },
];

const FALLBACK: TickerItem[] = [
  { symbol: "SOL",  price: 178.42,     change24h:  2.41 },
  { symbol: "BTC",  price: 103200,     change24h:  1.18 },
  { symbol: "ETH",  price: 3940,       change24h:  0.82 },
  { symbol: "JUP",  price: 0.892,      change24h: -1.32 },
  { symbol: "BONK", price: 0.0000312,  change24h:  5.24 },
  { symbol: "WIF",  price: 2.84,       change24h: -0.71 },
  { symbol: "JTO",  price: 3.21,       change24h:  3.12 },
];

function fmt(price: number, sym: string): string {
  if (sym === "BONK" || price < 0.0001) return price.toFixed(8);
  if (price < 0.01)  return price.toFixed(6);
  if (price < 1)     return price.toFixed(4);
  if (price < 100)   return price.toFixed(3);
  if (price < 10000) return price.toFixed(2);
  return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      try {
        // Fetch all tickers from crypto.com Exchange API v2 in a single call
        const r = await fetch(
          "https://api.crypto.com/v2/public/get-ticker",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok || !mounted.current) return;
        const data = await r.json();
        const allTickers: any[] = data?.result?.data ?? [];
        const map = new Map<string, any>(allTickers.map((t: any) => [t.i, t]));

        const next: TickerItem[] = COINS.map(({ instrument, symbol }) => {
          const t = map.get(instrument);
          if (!t) return FALLBACK.find((f) => f.symbol === symbol)!;
          const price = Number(t.a) || 0;
          // 'c' is 24h absolute price change; convert to percentage
          const absChange = Number(t.c) || 0;
          const prevPrice = price - absChange;
          const change24h = prevPrice > 0 ? (absChange / prevPrice) * 100 : 0;
          return { symbol, price, change24h };
        });

        if (mounted.current) setItems(next);
      } catch {
        // keep current data / fallback
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => { mounted.current = false; clearInterval(id); };
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-white/[0.06] bg-black/60 backdrop-blur-sm h-8 flex items-center select-none">
      <div
        className="flex gap-10 items-center px-4 whitespace-nowrap"
        style={{ animation: "ticker-scroll 40s linear infinite" }}
      >
        {doubled.map(({ symbol, price, change24h }, i) => {
          const up = change24h >= 0;
          return (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-white/40 font-bold tracking-widest">{symbol}</span>
              <span className="text-white/80">${fmt(price, symbol)}</span>
              <span
                className="flex items-center gap-0.5"
                style={{ color: up ? "#00FF41" : "#f87171" }}
              >
                {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {Math.abs(change24h).toFixed(2)}%
              </span>
              <span className="text-white/10">·</span>
            </span>
          );
        })}
        {/* Source attribution */}
        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-white/20 shrink-0">
          via crypto.com
          <span className="text-white/10">·</span>
        </span>
      </div>
    </div>
  );
}
