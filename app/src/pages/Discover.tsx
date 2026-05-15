import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { HexLogo } from "../components/HexLogo";
import { listTokens, SavedToken } from "../lib/image";

export const Discover = () => {
  const [tokens, setTokens] = useState<SavedToken[]>([]);

  useEffect(() => { setTokens(listTokens()); }, []);

  if (tokens.length === 0) {
    return (
      <section>
        <div className="sec-eyebrow">Discover</div>
        <h2 className="sec-h2">All <span className="hl-green">protected</span> tokens</h2>
        <p className="sec-sub">Tokens launched on Humble.Trust devnet, stored locally per browser.</p>
        <div className="coming-soon">
          <h3>No tokens yet</h3>
          <p>Go to <strong>LAUNCH</strong> and create your first protected token.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="sec-eyebrow">Discover</div>
      <h2 className="sec-h2">All <span className="hl-green">protected</span> tokens</h2>
      <p className="sec-sub">Tokens launched on Humble.Trust devnet, stored locally per browser.</p>
      <div style={{ background: "rgba(20,102,255,.07)", border: "1px solid rgba(20,102,255,.18)", color: "var(--muted2)", padding: ".6rem .9rem", borderRadius: 8, fontSize: ".78rem", marginBottom: "1.5rem" }}>
        Trust Scores shown here are snapshots from launch time. Live scores may differ as votes, trades, and time-lock changes accumulate on-chain.
      </div>
      <div className="tok-grid-real">
        {tokens.map((t) => {
          const scoreColor = t.trustScore >= 81 ? "var(--green-neon)" : t.trustScore >= 66 ? "var(--solana-blue)" : t.trustScore >= 51 ? "var(--yellow)" : "var(--orange)";
          const url = "https://solscan.io/token/" + t.mint + "?cluster=devnet";
          return (
            <div
              key={t.mint}
              className="tok-card-real"
              onClick={() => window.open(url, "_blank")}
            >
              <div className="tok-card-top">
                <HexLogo src={t.logo} label={t.symbol} size={56} variant={t.tier === 1 ? "gradient" : "green"} />
                <div className="tok-card-meta">
                  <div className="tok-card-name">
                    {t.name}
                    <span className={"tok-card-tier " + (t.tier === 1 ? "premium" : "standard")}>{t.tier === 1 ? "PREMIUM" : "STANDARD"}</span>
                  </div>
                  <div className="tok-card-symbol">${t.symbol}</div>
                </div>
              </div>
              <div className="tok-card-mint">Mint: {t.mint.slice(0, 8)}...{t.mint.slice(-6)}</div>
              <div className="tok-card-score-row">
                <span className="tok-card-score-k">Trust Score</span>
                <span className="tok-card-score-v" style={{ color: scoreColor }}>
                  {t.trustScore} / 100 <ExternalLink size={12} style={{ display: "inline", marginLeft: 4, opacity: 0.5 }} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
