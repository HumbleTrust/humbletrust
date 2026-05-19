import { Shield, TrendingUp, Lock, Flame, Award, Zap, DollarSign, FileText, Database, BarChart3, Users, FileCheck } from "lucide-react";

export const About = () => (
  <>
    <section>
      <div className="sec-eyebrow">About HumbleTrust</div>
      <h2 className="sec-h2">Trust & Safety layer + protected launchpad <span className="hl-solana">for Solana</span></h2>
      <p className="sec-sub" style={{ maxWidth: 760 }}>
        HumbleTrust is not positioned as only a token launcher. The launchpad is the first enforced workflow for a broader trust layer:
        protected token creation, bonding-curve trading, launch certificates, creator accountability, on-chain risk signals, and Raydium CPMM migration.
      </p>
    </section>

    <section className="feat-bg">
      <div className="sec-eyebrow">The Problem</div>
      <h2 className="sec-h2">Solana needs a trust layer <span className="hl-green">at launch time</span></h2>
      <div className="how-grid">
        {[
          { n: "01", icon: <Zap size={20} />, t: "No enforcement", d: "Fast launch tools let anyone launch with almost no accountability. Risk appears minutes after listing." },
          { n: "02", icon: <FileText size={20} />, t: "Promises, not code", d: "Creators can promise locks or fair launches, but users need verifiable rules and custody." },
          { n: "03", icon: <DollarSign size={20} />, t: "Liquidity control", d: "When creators control liquidity directly, investors are exposed to instant rug mechanics." },
          { n: "04", icon: <Shield size={20} />, t: "Weak reputation", d: "Without creator history and launch records, the same bad wallet pattern can repeat under a new token." },
        ].map((c) => (
          <div key={c.n} className="how-card">
            <span className="how-n">{c.n}</span>
            <div className="how-icon-wrap">{c.icon}</div>
            <div className="how-t">{c.t}</div>
            <div className="how-d">{c.d}</div>
          </div>
        ))}
      </div>
    </section>

    <section>
      <div className="sec-eyebrow">TrustScore v2</div>
      <h2 className="sec-h2">Initial score, normalized <span className="hl-green">0-100</span></h2>
      <p className="sec-sub">The live v2 launch form calculates the same allocation-based score that the program stores on-chain.</p>
      <div className="feat-grid">
        {[
          { icon: <Lock size={18} />, t: "Lock Score", pts: "0/10/20/15", d: "Best range is 40-60%. 61-80% is still protected but leaves less liquid supply." },
          { icon: <Shield size={18} />, t: "Creator Score", pts: "max 20", d: "Creator allocation is capped at 5%. Lower creator % earns a stronger score." },
          { icon: <TrendingUp size={18} />, t: "Curve Liquidity", pts: "max 25", d: "Curve liquidity must be 25-50% and feeds the bonding curve token vault." },
          { icon: <Database size={18} />, t: "Circulation", pts: "max 20", d: "Circulation must be 15-40%. Q + R must be at least 50%." },
          { icon: <Users size={18} />, t: "Airdrop", pts: "max 15", d: "Airdrop is capped at 5%; smaller airdrops score higher in v2." },
          { icon: <Flame size={18} />, t: "Burn Bonus", pts: "+5/+10", d: "25% or 50% burn applies to the Locked Vault and improves the score." },
        ].map((item) => (
          <div key={item.t} className="feat-card">
            <div className="feat-icon">{item.icon}</div>
            <div className="feat-t">
              {item.t}{" "}
              <span style={{ color: "var(--green-neon)", fontFamily: "var(--font-mono)", fontSize: ".78rem" }}>{item.pts}</span>
            </div>
            <div className="feat-d">{item.d}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "2rem" }}>
        {[
          { range: "85-100", label: "ELITE", color: "var(--green-neon)", desc: "Strong allocation, high liquidity, low creator risk." },
          { range: "70-84", label: "STRONG", color: "var(--solana-blue)", desc: "Healthy launch with minor trade-offs." },
          { range: "40-69", label: "OK", color: "var(--yellow)", desc: "Valid, but users should review the breakdown." },
          { range: "0-39", label: "WEAK", color: "var(--orange)", desc: "Low trust configuration or weak liquidity." },
        ].map((tier) => (
          <div key={tier.label} style={{ background: "var(--bg3)", borderRadius: 10, padding: "1rem", border: `1px solid ${tier.color}33` }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700, color: tier.color }}>{tier.range}</div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, marginBottom: ".4rem" }}>{tier.label}</div>
            <div style={{ fontSize: ".78rem", color: "var(--muted2)", lineHeight: 1.5 }}>{tier.desc}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="feat-bg">
      <div className="sec-eyebrow">Current Devnet Status</div>
      <h2 className="sec-h2">What is done. <span className="hl-solana">What comes next.</span></h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
        {[
          { phase: "Live", title: "v2 Protected Launch", status: "done", items: ["Fixed 1B supply", "L/C/Q/R/A vault split", "Initial SOL curve treasury PDA", "Metaplex metadata", "Mint authority revoked"] },
          { phase: "Live", title: "Bonding Curve Trade", status: "done", items: ["Buy and sell on devnet", "1% total fee", "Wallet token picker", "MAX sell amount", "Trading-style chart preview"] },
          { phase: "Live", title: "Launch Certificate NFT", status: "done", items: ["Token-2022 NonTransferable mint", "Certificate PDA record", "Linked token mint", "TrustScore and launch timestamp"] },
          { phase: "In progress", title: "Raydium CPMM Migration", status: "active", items: ["50 SOL threshold state exists", "Trigger reward hook exists", "Real Raydium CPMM CPI pool creation pending", "LP custody verification pending"] },
          { phase: "Next", title: "Global Indexing", status: "active", items: ["Replace browser-cache Discover", "Read program accounts/events", "Real candles and trade feed", "Holders and top traders"] },
          { phase: "Next", title: "Mainnet Readiness", status: "upcoming", items: ["Full v2 tests", "Audit", "Squads multisig", "Production RPC and monitoring"] },
        ].map((p) => {
          const borderColor = p.status === "done" ? "rgba(0,255,148,.2)" : p.status === "active" ? "rgba(20,102,255,.2)" : "rgba(255,255,255,.06)";
          const badgeBg = p.status === "done" ? "rgba(0,255,148,.1)" : p.status === "active" ? "rgba(20,102,255,.1)" : "rgba(255,255,255,.04)";
          const badgeColor = p.status === "done" ? "var(--green-neon)" : p.status === "active" ? "var(--solana-blue)" : "var(--muted)";
          const bulletColor = p.status === "done" ? "var(--green-neon)" : p.status === "active" ? "var(--solana-blue)" : "var(--muted)";
          return (
            <div key={p.title} style={{ background: "var(--bg3)", borderRadius: 12, padding: "1.25rem", border: `1px solid ${borderColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".6rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: "var(--muted)" }}>{p.phase}</div>
                <div style={{ fontSize: ".68rem", padding: "2px 8px", borderRadius: 4, background: badgeBg, color: badgeColor }}>
                  {p.status === "done" ? "LIVE" : p.status === "active" ? "IN PROGRESS" : "UPCOMING"}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem" }}>{p.title}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {p.items.map((item) => (
                  <li key={item} style={{ fontSize: ".78rem", color: "var(--muted2)", padding: ".2rem 0", paddingLeft: ".9rem", position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: bulletColor }}>›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>

    <section>
      <div className="sec-eyebrow">What To Build Next</div>
      <h2 className="sec-h2">The next real upgrades</h2>
      <div className="feat-grid">
        {[
          { icon: <Database size={18} />, t: "Chain-indexed Discover", d: "Show all v2 launches globally, not only tokens saved in local browser storage." },
          { icon: <BarChart3 size={18} />, t: "Real chart candles", d: "Use program events and curve trades for candles, volume, transaction list, holders, and top traders." },
          { icon: <TrendingUp size={18} />, t: "Raydium CPMM CPI migration", d: "Complete pool creation, LP lock, leftover burn, and post-migration curve disable flow." },
          { icon: <Users size={18} />, t: "Creator profiles", d: "Expose launch history, clean-launch record, complaints, and reputation effects." },
          { icon: <FileCheck size={18} />, t: "Audit pack", d: "Add tests, threat model, deployment checklist, and audit-ready documentation." },
        ].map((item) => (
          <div key={item.t} className="feat-card">
            <div className="feat-icon">{item.icon}</div>
            <div className="feat-t">{item.t}</div>
            <div className="feat-d">{item.d}</div>
          </div>
        ))}
      </div>
    </section>
  </>
);
