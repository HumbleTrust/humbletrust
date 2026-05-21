import { useState, useEffect, useCallback } from "react";
import { Search, ExternalLink, X, RefreshCw, BarChart2, TrendingUp, Zap } from "lucide-react";

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

export const Market = () => {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<DexPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"popular" | "search">("popular");

  const fetchPopular = useCallback(async () => {
    setBusy(true); setError(null); setMode("popular");
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${POPULAR_ADDRESSES}`);
      const data = await res.json();
      const sol = (data.pairs ?? []).filter((p: DexPair) => p.chainId === "solana");
      setPairs(dedupe(sol).slice(0, 24));
    } catch {
      setError("DexScreener недоступен. Попробуй позже.");
    } finally { setBusy(false); }
  }, []);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setBusy(true); setError(null); setMode("search");
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const sol = (data.pairs ?? []).filter((p: DexPair) => p.chainId === "solana");
      setPairs(dedupe(sol).slice(0, 24));
      if (sol.length === 0) setError(`Ничего не найдено для "${q}" на Solana`);
    } catch {
      setError("Ошибка поиска. Попробуй позже.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void fetchPopular(); }, []);

  return (
    <section>
      <div className="sec-eyebrow">Market Watch · Mainnet</div>
      <h2 className="sec-h2">Solana <span className="hl-green">live market</span></h2>
      <p className="sec-sub">Реальные токены · Данные DexScreener · Live чарты. Только мониторинг — твои токены на devnet.</p>

      {/* Search bar */}
      <form
        className="market-search-row"
        onSubmit={e => { e.preventDefault(); void fetchSearch(searchQuery); }}
      >
        <div className="market-search-wrap">
          <Search size={14} className="market-search-icon" />
          <input
            className="form-input market-search-input"
            placeholder="Имя токена, символ или адрес..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="reserve-refresh market-search-btn" type="submit" disabled={busy}>
          <Search size={13} /> Найти
        </button>
        <button
          className={`reserve-refresh market-search-btn${mode === "popular" ? " active-btn" : ""}`}
          type="button" disabled={busy}
          onClick={() => { setSearchQuery(""); void fetchPopular(); }}
        >
          <TrendingUp size={13} /> Популярные
        </button>
        <button className="reserve-refresh" type="button" disabled={busy} onClick={() => mode === "popular" ? fetchPopular() : fetchSearch(searchQuery)}>
          <RefreshCw size={13} className={busy ? "spin" : undefined} />
        </button>
      </form>

      {error && <div className="trade-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Chart modal */}
      {selected && (
        <div className="market-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="market-modal" onClick={e => e.stopPropagation()}>
            <div className="market-modal-head">
              <div className="market-modal-title">
                <BarChart2 size={16} color="var(--green-neon)" />
                <span>
                  {selected.baseToken.name}
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}> / {selected.quoteToken.symbol}</span>
                </span>
                <span className="mini-chip" style={{ textTransform: "uppercase", fontSize: ".6rem" }}>{selected.dexId}</span>
                <span className="mini-chip" style={{ background: "rgba(0,255,148,.08)", color: "var(--green-neon)", fontSize: ".6rem" }}>
                  <Zap size={9} /> LIVE
                </span>
              </div>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                <a href={selected.url} target="_blank" rel="noreferrer" className="mini-chip green"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  DexScreener <ExternalLink size={10} />
                </a>
                <button className="market-modal-close" onClick={() => setSelected(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Price row inside modal */}
            <div className="market-modal-price-row">
              <span className="market-modal-price">{fmtPrice(selected.priceUsd)}</span>
              {(() => {
                const c = selected.priceChange?.h24 ?? 0;
                const col = c > 0 ? "var(--green-neon)" : c < 0 ? "#ff3b5c" : "var(--muted)";
                return <span style={{ color: col, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  {c > 0 ? "▲" : c < 0 ? "▼" : "–"} {Math.abs(c).toFixed(2)}%
                </span>;
              })()}
              <span className="market-modal-meta">Vol 24h: {fmtUsd(selected.volume?.h24 ?? 0)}</span>
              <span className="market-modal-meta">Liq: {fmtUsd(selected.liquidity?.usd ?? 0)}</span>
              {selected.fdv && <span className="market-modal-meta">FDV: {fmtUsd(selected.fdv)}</span>}
            </div>

            <iframe
              src={`${selected.url}?embed=1&theme=dark&info=0&trades=1`}
              className="market-modal-iframe"
              title={`${selected.baseToken.symbol} chart`}
            />
          </div>
        </div>
      )}

      {/* States */}
      {pairs.length === 0 && busy && (
        <div className="coming-soon"><h3>Загрузка рыночных данных...</h3></div>
      )}
      {pairs.length === 0 && !busy && !error && (
        <div className="coming-soon"><h3>Нет результатов</h3><p>Попробуй другой запрос.</p></div>
      )}

      {/* Grid */}
      <div className="market-watch-grid">
        {pairs.map(pair => {
          const change = pair.priceChange?.h24 ?? 0;
          const changeCol = change > 0 ? "var(--green-neon)" : change < 0 ? "#ff3b5c" : "var(--muted)";
          const changeBg = change > 0 ? "rgba(0,255,148,.08)" : change < 0 ? "rgba(255,59,92,.08)" : "rgba(255,255,255,.04)";
          const initials = pair.baseToken.symbol.slice(0, 2).toUpperCase();
          return (
            <div key={pair.pairAddress} className="market-watch-card" onClick={() => setSelected(pair)}>
              <div className="mwc-header">
                <div className="mwc-icon">
                  <span>{initials}</span>
                  {pair.info?.imageUrl && (
                    <img
                      src={pair.info.imageUrl}
                      alt=""
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>
                <div className="mwc-identity">
                  <div className="mwc-name">{pair.baseToken.symbol}</div>
                  <div className="mwc-sub">{pair.baseToken.name} · {pair.dexId}</div>
                </div>
                <div className="mwc-badge" style={{ background: changeBg, color: changeCol }}>
                  {change > 0 ? "▲" : change < 0 ? "▼" : "–"} {Math.abs(change).toFixed(2)}%
                </div>
              </div>

              <div className="mwc-price">{fmtPrice(pair.priceUsd)}</div>

              <div className="mwc-stats">
                <div className="mwc-stat">
                  <span>Vol 24h</span>
                  <strong>{fmtUsd(pair.volume?.h24 ?? 0)}</strong>
                </div>
                <div className="mwc-stat">
                  <span>Ликвидность</span>
                  <strong>{fmtUsd(pair.liquidity?.usd ?? 0)}</strong>
                </div>
                <div className="mwc-stat">
                  <span>FDV</span>
                  <strong>{pair.fdv ? fmtUsd(pair.fdv) : "—"}</strong>
                </div>
              </div>

              <div className="mwc-cta">
                <BarChart2 size={11} /> Live chart
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
