import { AlertTriangle, BarChart3, CheckCircle2, Database, Lock, Network, Rocket, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { MAINNET_STATUS, NETWORK_STAGE, PROGRAM_ID_V2, RAYDIUM_CPMM_MAINNET_PROGRAM, RPC_DEVNET } from "../lib/constants";

const devnetReady = [
  ["v2 protected launch", "Fixed 1B supply, L/C/Q/R/A vaults, burn, vesting, initial SOL treasury PDA."],
  ["TrustScore primitive", "Allocation-based score is calculated and stored on-chain with transparent breakdown."],
  ["Bonding curve trade", "Buy/sell instructions are live on devnet with fee split, anti-bot guard, and reserve PDAs."],
  ["Launch certificate", "Token-2022 NonTransferable certificate can be linked to the launch PDA."],
  ["Frontend demo", "Vercel app supports launch, trade, token picker, MAX sell, chart preview, and Solscan links."],
];

const mainnetBlockers = [
  ["Indexer/API", "Discover must read program accounts/events globally instead of browser-local cache."],
  ["Real market data", "Charts need event-backed candles, transactions, holders, and top trader analytics."],
  ["DEX migration", "Raydium/OpenBook CPI pool creation, LP custody, and leftover burn must be implemented and audited."],
  ["Security audit", "Full Anchor tests, threat model, dependency cleanup, and third-party review are required."],
  ["Operations", "Upgrade authority should move to multisig with production RPC, monitoring, alerts, and incident response."],
];

const layers = [
  {
    icon: <Rocket size={18} />,
    title: "Protected Launchpad",
    status: "LIVE DEVNET",
    text: "Token creation is not a free-form mint. The v2 program enforces supply split, lock, creator cap, airdrop cap, Q+R rule, burn option, metadata, and fixed supply.",
  },
  {
    icon: <Lock size={18} />,
    title: "Custody Layer",
    status: "LIVE DEVNET",
    text: "Tokens and initial SOL are routed into PDAs: locked vault, creator vault, curve pool vault, circulation vault, airdrop vault, curve treasury, and LP lock vault.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "TrustScore Layer",
    status: "LIVE DEVNET PRIMITIVE",
    text: "TrustScore v2 is real on-chain scoring for launch quality. It is not yet full wallet reputation or anti-scam intelligence.",
  },
  {
    icon: <Database size={18} />,
    title: "Reputation/Data Layer",
    status: "MAINNET PREP",
    text: "The next infrastructure step is an indexer, API, creator profiles, wallet history, reports, score history, and event-backed analytics.",
  },
];

export const Status = () => (
  <>
    <section>
      <div className="sec-eyebrow">Status</div>
      <h2 className="sec-h2">Trust & Safety <span className="hl-solana">layer</span> + protected launchpad</h2>
      <p className="sec-sub" style={{ maxWidth: 780 }}>
        HumbleTrust is positioned as a Solana trust layer with a launchpad as the first enforced use case.
        Today the layer exists on devnet through on-chain launch records, PDA custody, TrustScore primitives,
        bonding-curve trading, and certificates. Mainnet is intentionally blocked until the data layer, audit,
        and DEX migration are complete.
      </p>
    </section>

    <section className="feat-bg status-section-tight">
      <div className="status-split">
        <div className="status-card status-card-good">
          <div className="status-card-head">
            <CheckCircle2 size={18} />
            <div>
              <div className="status-card-kicker">Part 1</div>
              <h3>DEVNET ready target</h3>
            </div>
          </div>
          <p>Public demo must be honest, stable, and test-only. Users should always know they are on devnet.</p>
          <ul>
            {devnetReady.map(([title, body]) => (
              <li key={title}><strong>{title}</strong><span>{body}</span></li>
            ))}
          </ul>
        </div>

        <div className="status-card status-card-warn">
          <div className="status-card-head">
            <AlertTriangle size={18} />
            <div>
              <div className="status-card-kicker">Part 2</div>
              <h3>MAINNET readiness path</h3>
            </div>
          </div>
          <p>Mainnet is a future release, not the current product state. These blockers must be closed first.</p>
          <ul>
            {mainnetBlockers.map(([title, body]) => (
              <li key={title}><strong>{title}</strong><span>{body}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    <section>
      <div className="sec-eyebrow">Layer Architecture</div>
      <h2 className="sec-h2">What is real today, not just wording</h2>
      <div className="layer-grid">
        {layers.map((layer) => (
          <div key={layer.title} className="layer-card">
            <div className="layer-icon">{layer.icon}</div>
            <div className="layer-meta">{layer.status}</div>
            <div className="layer-title">{layer.title}</div>
            <div className="layer-text">{layer.text}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="feat-bg status-section-tight">
      <div className="sec-eyebrow">Network Facts</div>
      <h2 className="sec-h2">Current deployment is devnet-only</h2>
      <div className="network-facts">
        <div><Network size={16} /><span>Stage</span><strong>{NETWORK_STAGE} active · MAINNET {MAINNET_STATUS}</strong></div>
        <div><Network size={16} /><span>RPC</span><strong>{RPC_DEVNET}</strong></div>
        <div><ShieldCheck size={16} /><span>v2 devnet program</span><strong>{PROGRAM_ID_V2}</strong></div>
        <div><TrendingUp size={16} /><span>Raydium CPMM</span><strong>target program {RAYDIUM_CPMM_MAINNET_PROGRAM}; devnet CPI integration in progress</strong></div>
        <div><BarChart3 size={16} /><span>Chart data</span><strong>devnet curve preview, not production market feed</strong></div>
        <div><Users size={16} /><span>Wallet reputation</span><strong>planned indexer/API layer</strong></div>
      </div>
    </section>
  </>
);
