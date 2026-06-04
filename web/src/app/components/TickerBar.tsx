import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
}

const CG_KEY = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;

const COINS = [
  // Market leaders
  { id: "bitcoin",                      symbol: "BTC"    },
  { id: "ethereum",                     symbol: "ETH"    },
  { id: "solana",                       symbol: "SOL"    },
  { id: "binancecoin",                  symbol: "BNB"    },
  { id: "ripple",                       symbol: "XRP"    },
  { id: "cardano",                      symbol: "ADA"    },
  { id: "avalanche-2",                  symbol: "AVAX"   },
  { id: "sui",                          symbol: "SUI"    },
  { id: "aptos",                        symbol: "APT"    },
  { id: "the-open-network",            symbol: "TON"    },
  // Solana ecosystem
  { id: "jupiter-exchange-solana",      symbol: "JUP"    },
  { id: "jito-governance-token",        symbol: "JTO"    },
  { id: "raydium",                      symbol: "RAY"    },
  { id: "orca",                         symbol: "ORCA"   },
  { id: "pyth-network",                 symbol: "PYTH"   },
  { id: "wormhole",                     symbol: "W"      },
  { id: "drift-protocol",              symbol: "DRIFT"  },
  { id: "kamino",                       symbol: "KMNO"   },
  { id: "tensor",                       symbol: "TNSR"   },
  // Solana memecoins
  { id: "bonk",                         symbol: "BONK"   },
  { id: "dogwifcoin",                   symbol: "WIF"    },
  { id: "popcat",                       symbol: "POPCAT" },
  { id: "cat-in-a-dogs-world",         symbol: "MEW"    },
  { id: "book-of-meme",                symbol: "BOME"   },
  // DeFi blue chips
  { id: "uniswap",                      symbol: "UNI"    },
  { id: "aave",                         symbol: "AAVE"   },
  { id: "chainlink",                    symbol: "LINK"   },
  { id: "polkadot",                     symbol: "DOT"    },
  { id: "dogecoin",                     symbol: "DOGE"   },
];

const IDS = COINS.map(c => c.id).join(",");

function fmt(price: number, sym: string): string {
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.0001 || sym === "BONK") return price.toFixed(8);
  if (price < 0.001)  return price.toFixed(7);
  if (price < 0.01)   return price.toFixed(6);
  if (price < 1)      return price.toFixed(4);
  if (price < 100)    return price.toFixed(3);
  if (price < 10000)  return price.toFixed(2);
  return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      try {
        const r = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${IDS}&vs_currencies=usd&include_24hr_change=true`,
          {
            signal: AbortSignal.timeout(8000),
            headers: { "x-cg-demo-api-key": CG_KEY },
          }
        );
        if (!r.ok || !mounted.current) return;
        const data = await r.json();

        const next: TickerItem[] = COINS.map(({ id, symbol }) => {
          const d = data[id];
          if (!d) return null;
          return { symbol, price: d.usd ?? 0, change24h: d.usd_24h_change ?? 0 };
        }).filter(Boolean) as TickerItem[];

        if (mounted.current && next.length > 0) setItems(next);
      } catch {
        // keep current data
      }
    };

    load();
    const id = setInterval(load, 60_000); // CoinGecko Demo: 30 req/min, refresh every 60s
    return () => { mounted.current = false; clearInterval(id); };
  }, []);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-[#1A2332] bg-black/60 backdrop-blur-sm h-8 flex items-center select-none">
      <div
        className="flex gap-10 items-center px-4 whitespace-nowrap"
        style={{ animation: "ticker-scroll 120s linear infinite" }}
      >
        {doubled.map(({ symbol, price, change24h }, i) => {
          const up = change24h >= 0;
          return (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-white/40 font-bold tracking-widest">{symbol}</span>
              <span className="text-white/80">${fmt(price, symbol)}</span>
              <span className="flex items-center gap-0.5" style={{ color: up ? "#00FF41" : "#FF4444" }}>
                {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {Math.abs(change24h).toFixed(2)}%
              </span>
              <span className="text-white/10">·</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-white/20 shrink-0">
          via CoinGecko <span className="text-white/10">·</span>
        </span>
      </div>
    </div>
  );
}
