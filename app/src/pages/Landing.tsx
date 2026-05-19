import { Shield, Settings, DollarSign, Rocket, TrendingUp, Lock, Flame, Eye, Clock, Award, Users, BarChart3, Database, FileCheck } from "lucide-react";

export const Landing = ({ goLaunch, goDiscover }: { goLaunch: () => void; goDiscover: () => void }) => (
  <>
    <section className="hero">
      <div className="hero-badge">
        <span className="badge-pulse" />
        Live on Devnet · Solana · Anchor 0.32
      </div>
      <h1 className="hero-h1">
        HumbleTrust<br />
        <span className="hl-solana">Trust & Safety layer + protected launchpad for Solana</span>
      </h1>
      <p className="hero-p">
        HumbleTrust starts as a protected launchpad and grows into a trust layer: on-chain launch records,
        PDA custody, TrustScore primitives, certificates, bonding-curve trading, and Raydium CPMM migration readiness.
      </p>
      <div className="hero-btns">
        <button className="btn-p" onClick={goLaunch}>
          <Rocket size={16} /> Launch Protected Token
        </button>
        <button className="btn-s" onClick={goDiscover}>
          <Eye size={16} /> Explore Tokens
        </button>
      </div>
      <div className="hero-stats">
        <div className="hstat"><span className="hstat-n">v2</span><div className="hstat-l">Devnet Program</div></div>
        <div className="hstat"><span className="hstat-n">1B</span><div className="hstat-l">Fixed Supply</div></div>
        <div className="hstat"><span className="hstat-n">0-100</span><div className="hstat-l">TrustScore</div></div>
        <div className="hstat"><span className="hstat-n">NFT</span><div className="hstat-l">Launch Certificate</div></div>
      </div>
    </section>

    <section>
      <div className="sec-eyebrow">Layer + Launchpad</div>
      <h2 className="sec-h2">Launchpad is the first use case. Trust layer is the product.</h2>
      <p className="sec-sub">The current production frontend is wired to the v2 devnet program and exposes the first enforced trust primitives.</p>
      <div className="how-grid">
        <div className="how-card">
          <span className="how-n">01</span>
          <div className="how-icon-wrap"><Settings size={20} /></div>
          <div className="how-t">Set Protected Parameters</div>
          <div className="how-d">Choose lock 30-80%, creator 0-5%, curve liquidity 25-50%, airdrop 0-5%, burn 25/50%, initial SOL, and anti-bot delay.</div>
        </div>
        <div className="how-card">
          <span className="how-n">02</span>
          <div className="how-icon-wrap"><DollarSign size={20} /></div>
          <div className="how-t">Fund The Curve</div>
          <div className="how-d">Initial SOL goes to the curve treasury PDA. It is not sent to the creator, not used as Raydium LP, and does not give control.</div>
        </div>
        <div className="how-card">
          <span className="how-n">03</span>
          <div className="how-icon-wrap"><TrendingUp size={20} /></div>
          <div className="how-t">Trade Instantly</div>
          <div className="how-d">Buy and sell are live on the HumbleTrust bonding curve with 1% total fee, anti-bot gating, and wallet balance-aware swap UX.</div>
        </div>
        <div className="how-card">
          <span className="how-n">04</span>
          <div className="how-icon-wrap"><Award size={20} /></div>
          <div className="how-t">Record The Trust Signal</div>
          <div className="how-d">Creators can receive a Token-2022 NonTransferable Launch Certificate NFT linked to the on-chain launch record.</div>
        </div>
      </div>
    </section>

    <section className="feat-bg">
      <div className="sec-eyebrow">Current Status</div>
      <h2 className="sec-h2">DEVNET is active. MAINNET is preparation, not marketing.</h2>
      <p className="sec-sub">HumbleTrust is devnet alpha. The app is usable, but mainnet is blocked until audits, indexing, and Raydium CPMM migration are complete.</p>
      <div className="feat-grid">
        {[
          { icon: <Lock size={18} />, t: "PDA Vault Distribution", d: "Locked, creator, curve, circulation, and airdrop vaults are split and validated on-chain.", s: "active", l: "LIVE" },
          { icon: <TrendingUp size={18} />, t: "Bonding Curve Swap", d: "Devnet buy and sell are live with wallet token picker, MAX sell, and Solscan links.", s: "active", l: "LIVE" },
          { icon: <Shield size={18} />, t: "TrustScore v2", d: "Formula uses lock, creator %, curve %, circulation %, airdrop %, and burn bonus, normalized to 100.", s: "active", l: "LIVE" },
          { icon: <FileCheck size={18} />, t: "Token Metadata", d: "New v2 launches create Metaplex metadata during the launch transaction.", s: "active", l: "LIVE" },
          { icon: <Award size={18} />, t: "Launch Certificate NFT", d: "Token-2022 NonTransferable certificate can be minted after v2 launch and linked to the certificate PDA.", s: "active", l: "LIVE" },
          { icon: <Flame size={18} />, t: "Locked Vault Burn", d: "25% or 50% burn option applies to the locked allocation without breaking curve liquidity.", s: "active", l: "LIVE" },
          { icon: <Clock size={18} />, t: "Raydium CPMM Migration", d: "Threshold state and trigger reward exist. Real CPMM CPI pool creation is the active migration milestone.", s: "soon", l: "IN PROGRESS" },
          { icon: <Database size={18} />, t: "Chain Discover Index", d: "Discover currently uses browser cache. Program-account/event indexing is the next sync layer.", s: "soon", l: "NEXT" },
          { icon: <BarChart3 size={18} />, t: "Real Market Chart", d: "Current chart previews the curve. Real candles, trades, holders, and top traders are next.", s: "soon", l: "NEXT" },
          { icon: <Users size={18} />, t: "Creator Reputation", d: "PDA groundwork exists. Profile history and score effects still need frontend integration.", s: "soon", l: "NEXT" },
        ].map((f) => (
          <div key={f.t} className="feat-card">
            <div className="feat-icon">{f.icon}</div>
            <div className="feat-t">{f.t}</div>
            <div className="feat-d">{f.d}</div>
            <div className={"feat-status " + (f.s === "active" ? "fs-active" : "fs-soon")}>{f.l}</div>
          </div>
        ))}
      </div>
    </section>
  </>
);
