import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Award, Lock, RefreshCw, HardDrive } from "lucide-react";
import { HexLogo } from "../components/HexLogo";
import { ApiToken, getTokens } from "../lib/api";
import { listTokens, SavedToken } from "../lib/image";

const scoreColor = (score: number) =>
  score >= 85 ? "var(--green-neon)" : score >= 70 ? "var(--solana-blue)" : score >= 40 ? "var(--yellow)" : "var(--orange)";

const scoreLabel = (score: number) =>
  score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

const compact = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });

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
});

export const Discover = ({ openToken }: { openToken: (mint: string) => void }) => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [busy, setBusy] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null); // null = not tried yet
  const [sort, setSort] = useState<"trust" | "volume" | "new">("new");

  // Load localStorage tokens immediately (synchronous)
  const localTokens = useMemo(() => listTokens().map(savedToApi), []);

  const load = async () => {
    setBusy(true);
    try {
      const result = await getTokens(150);
      // Merge: API data wins for existing mints, local fills in the rest
      const apiMints = new Set(result.tokens.map(t => t.mint));
      const localOnly = localTokens.filter(t => !apiMints.has(t.mint));
      setTokens([...result.tokens, ...localOnly]);
      setApiOk(true);
    } catch {
      // Backend not available — use local data only
      setTokens(localTokens);
      setApiOk(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Show local tokens instantly while we attempt API fetch
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

  return (
    <section>
      <div className="sec-eyebrow">Discover</div>
      <h2 className="sec-h2">Trust Layer <span className="hl-green">registry</span></h2>
      <p className="sec-sub">
        {isLocalOnly
          ? "Showing your locally launched tokens. Indexer backend not connected — token data is from this browser."
          : "Tokens indexed from the HumbleTrust backend on devnet."}
      </p>

      <div className="discover-toolbar">
        <div className="trade-tabs small-tabs">
          <button className={sort === "new" ? "active" : ""} onClick={() => setSort("new")} type="button">New</button>
          <button className={sort === "trust" ? "active" : ""} onClick={() => setSort("trust")} type="button">TrustScore</button>
          <button className={sort === "volume" ? "active" : ""} onClick={() => setSort("volume")} type="button">Volume</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          {isLocalOnly && (
            <span className="mini-chip" style={{ background: "rgba(255,122,47,.1)", color: "var(--orange)", border: "1px solid rgba(255,122,47,.2)" }}>
              <HardDrive size={10} /> Local only
            </span>
          )}
          {apiOk && (
            <span className="mini-chip green">
              Indexed
            </span>
          )}
          <button className="reserve-refresh" onClick={load} disabled={busy} type="button">
            <RefreshCw size={13} className={busy ? "spin" : undefined} /> Refresh
          </button>
        </div>
      </div>

      {sorted.length === 0 && !busy && (
        <div className="coming-soon">
          <h3>No launches yet</h3>
          <p>Launch a token on devnet — it will appear here immediately.</p>
          <button
            className="btn-p"
            style={{ marginTop: "1.2rem" }}
            onClick={() => window.dispatchEvent(new CustomEvent("ht:navigate", { detail: "launch" }))}
          >
            Launch your first token →
          </button>
        </div>
      )}
      {sorted.length === 0 && busy && (
        <div className="coming-soon">
          <h3>Loading...</h3>
        </div>
      )}

      <div className="tok-grid-real">
        {sorted.map((t) => {
          const color = scoreColor(Number(t.trust_score));
          const isLocal = !apiOk && localTokens.some(l => l.mint === t.mint);
          const url = "https://solscan.io/token/" + t.mint + "?cluster=devnet";
          return (
            <div key={t.mint} className="tok-card-real token-card-click" onClick={() => openToken(t.mint)}>
              <div className="tok-card-top">
                <HexLogo label={t.symbol || t.mint.slice(0, 3)} size={56} variant={Number(t.trust_score) >= 85 ? "gradient" : "green"} />
                <div className="tok-card-meta">
                  <div className="tok-card-name">
                    {t.name || "Token"}
                    <span className={"tok-card-tier " + (t.status === "migrated" ? "premium" : "standard")}>{t.status}</span>
                    {isLocal && (
                      <span style={{ fontSize: ".6rem", color: "var(--muted)", fontFamily: "var(--font-mono)", marginLeft: 4 }}>local</span>
                    )}
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
