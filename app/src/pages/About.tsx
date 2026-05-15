import { Shield, TrendingUp, Lock, Flame, Vote, Award, Zap, DollarSign, FileText } from "lucide-react";

export const About = () => (
  <>
    <section>
      <div className="sec-eyebrow">About Humble.Trust</div>
      <h2 className="sec-h2">A trust layer for <span className="hl-solana">all of Solana</span></h2>
      <p className="sec-sub" style={{ maxWidth: 720 }}>
        Every week thousands of tokens launch on Solana. Most are rugs. Humble.Trust enforces
        protection at the protocol level — locking creator tokens, scoring trust in real time,
        and freezing bad actors automatically. No promises, no UI tricks. Pure on-chain rules.
      </p>
    </section>

    <section className="feat-bg">
      <div className="sec-eyebrow">The Problem</div>
      <h2 className="sec-h2">Why most launchpads <span className="hl-solana">fail investors</span></h2>
      <div className="how-grid">
        {[
          { n: "01", icon: <Zap size={20} />, t: "No enforcement", d: "Pump.fun and clones let anyone launch with zero accountability. Rugs happen within minutes of listing." },
          { n: "02", icon: <FileText size={20} />, t: "Promises, not code", d: 'Creators write "we won\'t rug" in Telegram. There is no on-chain mechanism enforcing any of it.' },
          { n: "03", icon: <TrendingUp size={20} />, t: "No reputation system", d: "A serial rugger relaunches tomorrow with a fresh wallet. History is invisible." },
          { n: "04", icon: <DollarSign size={20} />, t: "Liquidity removed instantly", d: "LP tokens are not locked. Creators pull liquidity the moment price pumps." },
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
      <div className="sec-eyebrow">TrustScore System</div>
      <h2 className="sec-h2">How we score <span className="hl-green">0–100</span></h2>
      <p className="sec-sub">Every token gets a dynamic real-time score based on verifiable on-chain data.</p>
      <div className="feat-grid">
        {[
          { icon: <Lock size={18} />, t: "Lock duration", pts: "+25", d: "Up to +25 pts. Longer lock = higher trust. 360 days earns max." },
          { icon: <Shield size={18} />, t: "Lock percentage", pts: "+18", d: "Up to +18 pts. More supply locked means less creator can dump." },
          { icon: <Flame size={18} />, t: "Burn on unlock", pts: "+12", d: "50% burn = +12 pts. Permanently removes tokens from supply." },
          { icon: <Vote size={18} />, t: "Airdrop config", pts: "+10", d: "Up to +10 pts. Sharing with community signals good intent." },
          { icon: <TrendingUp size={18} />, t: "Verified volume", pts: "+10", d: "Up to +10 pts. Oracle-verified real trading activity." },
          { icon: <Award size={18} />, t: "Vesting milestones", pts: "+15", d: "Up to +15 pts. Completing day 30/60/90 tranches without cash-out." },
          { icon: <Shield size={18} />, t: "Creator verified", pts: "+8", d: "+8 pts when metrics authority confirms creator identity." },
          { icon: <TrendingUp size={18} />, t: "Token age", pts: "+8", d: "Up to +8 pts. Tokens that survive 30+ days earn credibility." },
          { icon: <Vote size={18} />, t: "Community votes", pts: "±18", d: "+5 or -18 pts. Token holders vote to signal trust or fraud." },
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
          { range: "81–100", label: "PROTECTED", color: "var(--green-neon)", desc: "Full vesting, long lock, community-verified." },
          { range: "66–80", label: "TRUSTED", color: "var(--solana-blue)", desc: "Strong fundamentals. Minor gaps in engagement." },
          { range: "51–65", label: "BASIC", color: "var(--yellow)", desc: "Minimum standards met. Proceed with caution." },
          { range: "0–50", label: "WEAK", color: "var(--orange)", desc: "Short lock, minimal burn, or complaints received." },
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
      <div className="sec-eyebrow">Fee Model</div>
      <h2 className="sec-h2">Simple, <span className="hl-green">transparent</span> economics</h2>
      <div className="how-grid">
        {[
          { n: "$5", icon: <Shield size={20} />, t: "Standard Launch", d: "Full on-chain protection. Lock, vesting, burn, anti-bot, voting. TrustScore from day one." },
          { n: "$25", icon: <Award size={20} />, t: "Premium Launch", d: "Featured listing, 60% LP fee share (vs 40% Standard), score boost eligible, priority airdrop queue." },
          { n: "40/60", icon: <DollarSign size={20} />, t: "LP Fee Split", d: "Standard: 40% creator · 35% treasury · 25% rewards. Premium: 60% creator · 30% treasury · 10% rewards." },
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
      <div className="sec-eyebrow">Roadmap</div>
      <h2 className="sec-h2">Where we are. <span className="hl-solana">Where we're going.</span></h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
        {[
          { phase: "Phase 1–2", title: "Core Protocol", status: "done", items: ["Anchor program on Solana devnet", "10 instructions, 5 PDAs", "TrustScore engine (0–100)", "Vesting + locking + burn + anti-bot"] },
          { phase: "Phase 3", title: "Frontend", status: "done", items: ["React + Vite + TypeScript", "Phantom & Solflare wallet adapter", "Live TrustScore ring preview", "Discover hex-grid with Solscan links"] },
          { phase: "Phase 4", title: "Liquidity Layer", status: "active", items: ["LP token lock vault (PDA)", "Raydium CPI integration (devnet)", "Fee distribution 50/30/20 on-chain", "Jupiter/DexScreener auto-indexing"] },
          { phase: "Phase 4.5–4.6", title: "Reputation + NFT", status: "active", items: ["CreatorReputation PDA per wallet", "+5 clean-launch score bonus", "Soulbound Certificate NFT", "Token-2022 NonTransferable mint"] },
          { phase: "Phase 5", title: "Mainnet Readiness", status: "upcoming", items: ["Pyth oracle dynamic pricing", "Squads multisig upgrade authority", "CertiK / OtterSec security audit", "Emergency pause (GlobalState)"] },
          { phase: "Phase 6", title: "Ecosystem", status: "upcoming", items: ["Mobile PWA", "Vault analytics dashboard", "Public API for integrations", "Governance token launch"] },
        ].map((p) => {
          const borderColor = p.status === "done" ? "rgba(0,255,148,.2)" : p.status === "active" ? "rgba(20,102,255,.2)" : "rgba(255,255,255,.06)";
          const badgeBg = p.status === "done" ? "rgba(0,255,148,.1)" : p.status === "active" ? "rgba(20,102,255,.1)" : "rgba(255,255,255,.04)";
          const badgeColor = p.status === "done" ? "var(--green-neon)" : p.status === "active" ? "var(--solana-blue)" : "var(--muted)";
          const bulletColor = p.status === "done" ? "var(--green-neon)" : p.status === "active" ? "var(--solana-blue)" : "var(--muted)";
          return (
            <div key={p.phase} style={{ background: "var(--bg3)", borderRadius: 12, padding: "1.25rem", border: `1px solid ${borderColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".6rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: "var(--muted)" }}>{p.phase}</div>
                <div style={{ fontSize: ".68rem", padding: "2px 8px", borderRadius: 4, background: badgeBg, color: badgeColor }}>
                  {p.status === "done" ? "COMPLETE" : p.status === "active" ? "IN PROGRESS" : "UPCOMING"}
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

    <section className="feat-bg">
      <div className="sec-eyebrow">Competitive Analysis</div>
      <h2 className="sec-h2">What the <span className="hl-green">competition</span> doesn't do</h2>
      <div style={{ overflowX: "auto", marginTop: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem", maxWidth: 920, margin: "0 auto" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              {["Feature", "Pump.fun", "Believe", "Moonshot", "HumbleTrust"].map((h) => (
                <th key={h} style={{ padding: ".75rem .5rem", textAlign: h === "Feature" ? "left" : "center", color: h === "HumbleTrust" ? "var(--green-neon)" : "var(--muted)", fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: ".72rem" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Anti-rug enforced on-chain", "❌", "❌", "⚠️ manual", "✅"],
              ["TrustScore 0–100", "❌", "❌", "❌", "✅"],
              ["LP lock enforced", "Burn only", "Burn only", "Manual", "✅ PDA"],
              ["Creator vesting schedule", "❌", "❌", "Optional", "✅ 30/60/90"],
              ["Anti-bot trading delay", "❌", "❌", "❌", "✅ 0–600s"],
              ["Community vote + auto-freeze", "❌", "❌", "❌", "✅"],
              ["Creator earns LP fees", "❌", "Trading fee", "❌", "✅ 40–60%"],
              ["Reputation across launches", "❌", "❌", "❌", "✅ Phase 4.5"],
              ["Soulbound launch certificate", "❌", "❌", "❌", "✅ Phase 4.6"],
            ].map((row) => (
              <tr key={String(row[0])} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                {row.map((cell, i) => (
                  <td key={i} style={{ padding: ".65rem .5rem", textAlign: i === 0 ? "left" : "center", color: i === 4 ? "var(--green-neon)" : i === 0 ? "var(--text)" : "var(--muted2)" }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </>
);
