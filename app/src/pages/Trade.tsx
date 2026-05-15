import { useState } from "react";
import { ExternalLink, AlertTriangle, TrendingUp, Zap, Clock } from "lucide-react";

export const Trade = ({ goDiscover }: { goDiscover: () => void }) => {
  const [mintInput, setMintInput] = useState("");

  const jupiterUrl = mintInput.trim().length > 30
    ? `https://jup.ag/swap/SOL-${mintInput.trim()}`
    : "https://jup.ag";

  const solscanUrl = mintInput.trim().length > 30
    ? `https://solscan.io/token/${mintInput.trim()}?cluster=devnet`
    : null;

  return (
    <section>
      <div className="sec-eyebrow">Trade</div>
      <h2 className="sec-h2">Trade <span className="hl-green">protected</span> tokens</h2>
      <p className="sec-sub">
        HumbleTrust tokens appear on Jupiter, Raydium, and DexScreener after initial liquidity is
        added. Always check the TrustScore before buying.
      </p>

      {/* Anti-bot notice */}
      <div style={{ background: "rgba(255,122,47,.07)", border: "1px solid rgba(255,122,47,.2)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "2rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: "var(--orange)", fontSize: ".85rem", marginBottom: ".3rem" }}>Anti-bot delay active on new tokens</div>
          <div style={{ fontSize: ".78rem", color: "var(--muted2)", lineHeight: 1.6 }}>
            Each token has a 0–600 second trading delay after launch to block sniper bots.
            If a transaction fails immediately after launch, wait for the delay to expire.
            You can check <code>trading_unlock_time</code> in the token metadata on-chain.
          </div>
        </div>
      </div>

      {/* Jupiter swap */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".5rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color="var(--green-neon)" /> Trade via Jupiter
        </div>
        <p style={{ fontSize: ".82rem", color: "var(--muted2)", marginBottom: "1rem", lineHeight: 1.6 }}>
          Jupiter aggregates all Solana DEX liquidity. Enter the token mint address from your
          Discover page, then open the swap interface.
        </p>

        <label style={{ fontSize: ".8rem", color: "var(--muted)", display: "block", marginBottom: ".4rem" }}>
          Token Mint Address
        </label>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 260 }}
            placeholder="e.g. Gcz7NMtCqKdv..."
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
          />
          <a
            href={jupiterUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--green-neon)", color: "#05070F", padding: ".6rem 1.1rem", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Open Jupiter <ExternalLink size={13} />
          </a>
        </div>

        {solscanUrl && (
          <a href={solscanUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: ".75rem", fontSize: ".75rem", color: "var(--solana-blue)", textDecoration: "none" }}>
            View token on Solscan (devnet) <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* How to check TrustScore before trading */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={16} color="var(--solana-blue)" /> Check TrustScore before buying
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[
            { score: "81–100", label: "PROTECTED", color: "var(--green-neon)", rec: "Strong buy signal — maximum on-chain protections active." },
            { score: "66–80", label: "TRUSTED", color: "var(--solana-blue)", rec: "Good fundamentals. Check vesting status and vote count." },
            { score: "51–65", label: "BASIC", color: "var(--yellow)", rec: "Minimum standards only. Research creator history." },
            { score: "0–50", label: "WEAK", color: "var(--orange)", rec: "High risk. Short lock or complaints detected." },
          ].map((t) => (
            <div key={t.label} style={{ background: "var(--bg4)", borderRadius: 8, padding: ".85rem", border: `1px solid ${t.color}22` }}>
              <div style={{ color: t.color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: ".9rem" }}>{t.score}</div>
              <div style={{ fontWeight: 700, fontSize: ".82rem", marginBottom: ".3rem" }}>{t.label}</div>
              <div style={{ fontSize: ".75rem", color: "var(--muted2)", lineHeight: 1.5 }}>{t.rec}</div>
            </div>
          ))}
        </div>
        <button
          onClick={goDiscover}
          style={{ marginTop: "1rem", background: "rgba(20,102,255,.1)", border: "1px solid rgba(20,102,255,.25)", color: "var(--solana-blue)", borderRadius: 8, padding: ".5rem 1rem", fontSize: ".8rem", cursor: "pointer" }}
        >
          Browse all tokens in Discover →
        </button>
      </div>

      {/* Trading checklist */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} color="var(--muted)" /> Pre-trade checklist
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".6rem" }}>
          {[
            ["TrustScore", "Check score in Discover — aim for 66+ before buying"],
            ["Lock status", "Confirm is_locked = true and unlock_time is in the future"],
            ["Anti-bot", "Verify trading_unlock_time has passed (no-tx immediately post-launch)"],
            ["Votes", "Check positive_votes vs negative_votes ratio — avoid tokens with complaints"],
            ["Liquidity", "Verify LP lock exists via lp_lock PDA before swapping on Raydium"],
            ["Creator", "Check creator_reputation PDA for launch history (Phase 4.5)"],
          ].map(([key, val]) => (
            <li key={key} style={{ display: "flex", gap: ".75rem", fontSize: ".8rem", padding: ".5rem .75rem", background: "var(--bg4)", borderRadius: 6 }}>
              <span style={{ color: "var(--green-neon)", fontFamily: "var(--font-mono)", minWidth: 100, flexShrink: 0 }}>{key}</span>
              <span style={{ color: "var(--muted2)" }}>{val}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
