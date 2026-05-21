import { useEffect, useRef, useState } from "react";

const TOKENS = [
  { sym: "SOL",  id: "So11111111111111111111111111111111111111112" },
  { sym: "BTC",  id: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9" },
  { sym: "ETH",  id: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs" },
  { sym: "JUP",  id: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { sym: "BONK", id: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { sym: "WIF",  id: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { sym: "JTO",  id: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwt2nCfxKdGS" },
];

interface TickItem { sym: string; px: string; chg: string; up: boolean }

const fmtPx = (p: number) =>
  p >= 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` :
  p >= 1    ? `$${p.toFixed(2)}` :
  p >= 0.0001 ? `$${p.toFixed(4)}` : `$${p.toExponential(2)}`;

const REFRESH_MS = 60_000;

export const Ticker = () => {
  const [items, setItems] = useState<TickItem[]>(
    TOKENS.map(t => ({ sym: t.sym, px: "…", chg: "", up: true }))
  );
  const abortRef = useRef<AbortController | null>(null);

  const fetchPrices = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const ids = TOKENS.map(t => t.id).join(",");
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${ids}`,
        { signal: ctrl.signal }
      );
      const data = await res.json();
      const pairs: any[] = data.pairs ?? [];

      // Pick the highest-volume SOL pair for each token
      const best = new Map<string, any>();
      for (const pair of pairs) {
        if (pair.chainId !== "solana") continue;
        const prev = best.get(pair.baseToken.address);
        if (!prev || (pair.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0)) {
          best.set(pair.baseToken.address, pair);
        }
      }

      setItems(TOKENS.map(t => {
        const pair = best.get(t.id);
        if (!pair?.priceUsd) return { sym: t.sym, px: "—", chg: "", up: true };
        const chg = pair.priceChange?.h24 ?? 0;
        return {
          sym: t.sym,
          px: fmtPx(Number(pair.priceUsd)),
          chg: chg === 0 ? "" : `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%`,
          up: chg >= 0,
        };
      }));
    } catch (e: any) {
      if (e.name !== "AbortError") {/* silently keep previous prices */}
    }
  };

  useEffect(() => {
    void fetchPrices();
    const timer = setInterval(() => void fetchPrices(), REFRESH_MS);
    return () => { clearInterval(timer); abortRef.current?.abort(); };
  }, []);

  const display = [...items, ...items];

  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        {display.map((it, i) => (
          <div key={i} className="t-item">
            <span className="t-sym">{it.sym}</span>
            <span className="t-px">{it.px}</span>
            {it.chg && <span className={it.up ? "t-up" : "t-dn"}>{it.chg}</span>}
            <span className="t-sep">·</span>
          </div>
        ))}
      </div>
    </div>
  );
};
