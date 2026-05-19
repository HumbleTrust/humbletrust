import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Award, Lock, RefreshCw } from "lucide-react";
import { HexLogo } from "../components/HexLogo";
import { ApiToken, getTokens } from "../lib/api";

const scoreColor = (score: number) =>
  score >= 85 ? "var(--green-neon)" : score >= 70 ? "var(--solana-blue)" : score >= 40 ? "var(--yellow)" : "var(--orange)";

const scoreLabel = (score: number) =>
  score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

const compact = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });

export const Discover = ({ openToken }: { openToken: (mint: string) => void }) => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"trust" | "volume" | "new">("new");

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await getTokens(150);
      setTokens(result.tokens);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const sorted = useMemo(() => {
    return [...tokens].sort((a, b) => {
      if (sort === "trust") return Number(b.trust_score) - Number(a.trust_score);
      if (sort === "volume") return Number(b.volume_sol) - Number(a.volume_sol);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tokens, sort]);

  return (
    <section>
      <div className="sec-eyebrow">Discover</div>
      <h2 className="sec-h2">Trust Layer <span className="hl-green">registry</span></h2>
      <p className="sec-sub">
        Tokens indexed from the HumbleTrust backend on devnet. This page uses Postgres/indexer data, not browser localStorage.
      </p>

      <div className="discover-toolbar">
        <div className="trade-tabs small-tabs">
          <button className={sort === "new" ? "active" : ""} onClick={() => setSort("new")} type="button">New</button>
          <button className={sort === "trust" ? "active" : ""} onClick={() => setSort("trust")} type="button">TrustScore</button>
          <button className={sort === "volume" ? "active" : ""} onClick={() => setSort("volume")} type="button">Volume</button>
        </div>
        <button className="reserve-refresh" onClick={load} disabled={busy} type="button">
          <RefreshCw size={13} className={busy ? "spin" : undefined} /> Refresh
        </button>
      </div>

      {error && !busy && (
        <div className="coming-soon">
          <h3>Indexer is spinning up</h3>
          <p>The token registry will be available shortly. Be the first to launch on devnet.</p>
        </div>
      )}

      {!error && sorted.length === 0 && (
        <div className="coming-soon">
          <h3>{busy ? "Loading indexed launches..." : "No launches indexed yet"}</h3>
          {!busy && <p>Launch a token on devnet — it will appear here once the indexer picks it up.</p>}
        </div>
      )}

      <div className="tok-grid-real">
        {sorted.map((t) => {
          const color = scoreColor(Number(t.trust_score));
          const url = "https://solscan.io/token/" + t.mint + "?cluster=devnet";
          return (
            <div key={t.mint} className="tok-card-real token-card-click" onClick={() => openToken(t.mint)}>
              <div className="tok-card-top">
                <HexLogo label={t.symbol || t.mint.slice(0, 3)} size={56} variant={Number(t.trust_score) >= 85 ? "gradient" : "green"} />
                <div className="tok-card-meta">
                  <div className="tok-card-name">
                    {t.name || "Indexed token"}
                    <span className={"tok-card-tier " + (t.status === "migrated" ? "premium" : "standard")}>{t.status}</span>
                  </div>
                  <div className="tok-card-symbol">${t.symbol || t.mint.slice(0, 4)}</div>
                </div>
              </div>
              <div className="tok-card-mint">Mint: {t.mint.slice(0, 8)}...{t.mint.slice(-6)}</div>
              <div className="tok-card-score-row">
                <span className="tok-card-score-k">Trust Score</span>
                <span className="tok-card-score-v" style={{ color }}>
                  {t.trust_score} / 100 · {scoreLabel(Number(t.trust_score))}
                </span>
              </div>
              <div className="tok-card-score-row">
                <span className="tok-card-score-k">Volume</span>
                <span className="tok-card-score-v">{compact(t.volume_sol)} SOL</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: ".5rem", flexWrap: "wrap" }}>
                {t.certificate_mint && (
                  <span className="mini-chip blue"><Award size={10} /> Certificate</span>
                )}
                {t.raydium_pool && (
                  <span className="mini-chip purple"><Lock size={10} /> Raydium/LP</span>
                )}
                <a href={url} target="_blank" rel="noreferrer" className="mini-chip green" onClick={(e) => e.stopPropagation()}>
                  Solscan <ExternalLink size={10} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
