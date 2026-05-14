import { Shield, Settings, DollarSign, Rocket, TrendingUp, Lock, Flame, Vote, Snowflake, Eye, Clock, Award, Users } from "lucide-react";

export const Landing = ({ goLaunch, goDiscover }: { goLaunch: () => void; goDiscover: () => void }) => (
  <>
    <section className="hero">
      <div className="hero-badge">
        <span className="badge-pulse" />
        Live on Devnet · Solana · Anchor 0.32
      </div>
      <h1 className="hero-h1">
        The <span className="hl-green">Anti-Rug</span> Token<br />
        <span className="hl-solana">Launchpad for Solana</span>
      </h1>
      <p className="hero-p">
        Every token locked on-chain. Every creator scored for trust.
        Protection from block one — no rug pulls, no excuses.
      </p>
      <div className="hero-btns">
        <button className="btn-p" onClick={goLaunch}>
          <Rocket size={16} /> Launch Your Token
        </button>
        <button className="btn-s" onClick={goDiscover}>
          <Eye size={16} /> Explore Tokens
        </button>
      </div>
      <div className="hero-stats">
        <div className="hstat"><span className="hstat-n">$5</span><div className="hstat-l">Standard Launch</div></div>
        <div className="hstat"><span className="hstat-n">$25</span><div className="hstat-l">Premium Launch</div></div>
        <div className="hstat"><span className="hstat-n">0-100</span><div className="hstat-l">Trust Score</div></div>
        <div className="hstat"><span className="hstat-n">100%</span><div className="hstat-l">On-Chain Rules</div></div>
      </div>
    </section>

    <section>
      <div className="sec-eyebrow">How It Works</div>
      <h2 className="sec-h2">Four steps. Every rule enforced on-chain.</h2>
      <p className="sec-sub">No promises, no UI tricks. Real Solana program does the work.</p>
      <div className="how-grid">
        <div className="how-card">
          <span className="how-n">01</span>
          <div className="how-icon-wrap"><Settings size={20} /></div>
          <div className="how-t">Set Parameters</div>
          <div className="how-d">Choose lock % (30–80%), lock duration (30–360 days), creator allocation (0–10%), burn option (25% or 50%), airdrop config, anti-bot delay.</div>
        </div>
        <div className="how-card">
          <span className="how-n">02</span>
          <div className="how-icon-wrap"><DollarSign size={20} /></div>
          <div className="how-t">Pay ~$5 (or $25 Premium)</div>
          <div className="how-d">Flat fee in SOL goes to the protocol treasury. Premium tier unlocks featured listing and custom vesting.</div>
        </div>
        <div className="how-card">
          <span className="how-n">03</span>
          <div className="how-icon-wrap"><Rocket size={20} /></div>
          <div className="how-t">Launch Protected</div>
          <div className="how-d">Token mints with locked supply on-chain. Anti-bot delay holds back snipers. Your Trust Score is calculated immediately.</div>
        </div>
        <div className="how-card">
          <span className="how-n">04</span>
          <div className="how-icon-wrap"><TrendingUp size={20} /></div>
          <div className="how-t">Build Trust</div>
          <div className="how-d">Score grows as you hit vesting milestones (30/60/90), burn tokens, gain community votes. High scores unlock airdrop rewards.</div>
        </div>
      </div>
    </section>

    <section className="feat-bg">
      <div className="sec-eyebrow">Protection Features</div>
      <h2 className="sec-h2">Every angle covered. <span className="hl-solana">On-chain.</span></h2>
      <p className="sec-sub">Nine layers of protection enforced by smart contracts — not promises.</p>
      <div className="feat-grid">
        {[
          { icon: <Lock size={18} />, t: "Locked Supply", d: "30–80% of supply locked to PDA vault. No creator access.", s: "active", l: "ACTIVE" },
          { icon: <Clock size={18} />, t: "Time-Lock", d: "30–360 day lock duration enforced on-chain via Clock sysvar.", s: "active", l: "ACTIVE" },
          { icon: <Flame size={18} />, t: "Burn on Unlock", d: "25% or 50% of locked supply burned at unlock time.", s: "active", l: "ACTIVE" },
          { icon: <Award size={18} />, t: "Creator Vesting", d: "Day 30 / 60 / 90 unlock tranches. No instant dumps.", s: "active", l: "ACTIVE" },
          { icon: <Shield size={18} />, t: "Anti-Bot Delay", d: "0–600s post-launch trading lock blocks sniper bots.", s: "active", l: "ACTIVE" },
          { icon: <Vote size={18} />, t: "Community Voting", d: "Token holders vote. Complaints can freeze malicious tokens.", s: "active", l: "ACTIVE" },
          { icon: <Snowflake size={18} />, t: "Auto Freeze", d: "20+ complaints + score < 30 → automatic on-chain freeze.", s: "active", l: "ACTIVE" },
          { icon: <Users size={18} />, t: "Airdrop Epochs", d: "Monthly airdrops gated by min Trust Score ≥ 56.", s: "active", l: "ACTIVE" },
          { icon: <Lock size={18} />, t: "LP Lock (Raydium)", d: "Liquidity tokens auto-locked in PDA. Coming Phase 4.", s: "soon", l: "PHASE 4" },
        ].map((f, i) => (
          <div key={i} className="feat-card">
            <div className="feat-icon">{f.icon}</div>
            <div className="feat-t">{f.t}</div>
            <div className="feat-d">{f.d}</div>
            <div className={"feat-status " + (f.s === "active" ? "fs-active" : f.s === "soon" ? "fs-soon" : "fs-plan")}>{f.l}</div>
          </div>
        ))}
      </div>
    </section>
  </>
);
