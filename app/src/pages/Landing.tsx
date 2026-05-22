import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Clock,
  Database,
  Eye,
  FileCheck,
  Flame,
  Github,
  Gauge,
  Lock,
  Network,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";
import { API_BASE_URL, NETWORK_STAGE } from "../lib/constants";
import { ZodiacBadgeCard } from "../components/ZodiacBadgeCard";

const GITHUB_URL = "https://github.com/HumbleTrust/humbletrust";

const statusCards = [
  {
    title: "DEVNET ACTIVE",
    body: "Launch flow, PDA vaults, bonding curve trading, TrustScore and launch certificates are active on devnet.",
    tone: "green",
  },
  {
    title: "MAINNET PREP",
    body: "Mainnet requires audit, production backend, production RPC, E2E Raydium verification and security hardening.",
    tone: "cyan",
  },
  {
    title: "NO MAINNET VALUE",
    body: "Devnet test tokens only. The public interface must not be treated as real-value mainnet infrastructure yet.",
    tone: "amber",
  },
];

const vaults = [
  { name: "Curve", value: 35, color: "var(--green-neon)" },
  { name: "Locked", value: 30, color: "var(--solana-blue)" },
  { name: "Creator", value: 4, color: "var(--solana-purple)" },
  { name: "Circulation", value: 27, color: "var(--solana-blue)" },
  { name: "Airdrop", value: 4, color: "var(--yellow)" },
];

const productModules = [
  ["Protected Launchpad", "Enforced supply distribution, PDA vaults, creator caps, vesting, burn options and anti-rug parameters.", Rocket],
  ["TrustScore", "Explainable 0-100 score from LaunchScore, CreatorReputation, MarketHealth and CommunityRisk.", Gauge],
  ["Wallet Reputation", "Creator behavior across launches, complaints, migration history and indexed market outcomes.", Wallet],
  ["Market Intelligence", "Trades, OHLCV, liquidity, price impact, migration state and risk-aware token detail pages.", BarChart3],
  ["Zodiac Badge NFT", "Premium on-chain badge unique to each wallet. Zodiac sign and element determined by token creation date. Tradeable with 30-day resell cooldown.", Award],
  ["Raydium CPMM Readiness", "Bonding curve reserves are designed to migrate with LP custody locked in a PDA after threshold.", Network],
] as const;

const trustRows = [
  ["LaunchScore", 86, "Lock %, curve liquidity, burn option, creator cap, airdrop limits", "green"],
  ["CreatorReputation", 72, "Previous launches, clean history, complaints, failed migrations", "cyan"],
  ["MarketHealth", 74, "Volume, liquidity, price impact, dump behavior, trade quality", "purple"],
  ["CommunityRisk", 81, "Reports, votes, abuse signals and future moderation inputs", "amber"],
] as const;


const BadgeNFTSection = () => (
  <section id="badge-nft" className="landing-section soft-band">
    <div className="sec-eyebrow">Zodiac Badge NFT</div>
    <div className="badge-nft-split">
      <div className="badge-nft-copy">
        <h2 className="sec-h2">Your on-chain identity, written in the stars</h2>
        <p className="sec-sub">
          Every HumbleTrust wallet earns a unique Zodiac Badge — a tradeable NFT with
          attributes derived entirely from the blockchain. Zodiac sign flows from the
          token creation date. Aura color is hashed from your wallet address. No two
          badges are ever the same, even for the same zodiac sign.
        </p>
        <ul className="badge-trait-list">
          {([
            ["#00FF94", "12 Zodiac signs", "Aries through Pisces, determined by mint date."],
            ["#9945FF", "4 Elements",      "Fire · Water · Earth · Air — linked to each sign."],
            ["#00D4FF", "32 Unique auras", "Aura color derived deterministically from your wallet."],
            ["#FFD600", "Tradeable",       "Sell freely — re-mint requires a 30-day cooldown."],
          ] as const).map(([color, title, body]) => (
            <li key={title} style={{ "--tc": color } as React.CSSProperties}>
              <span />
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="badge-price-row">
          <div><strong>0.2 SOL</strong><span>Standard mint</span></div>
          <div><strong>0.5 SOL</strong><span>Genesis (first 100/sign)</span></div>
          <div><strong>30 days</strong><span>Resell cooldown</span></div>
        </div>
      </div>
      <div className="badge-nft-grid">
        <ZodiacBadgeCard zodiac="Leo"      element="Fire"  aura="#FF3C6B" edition={7}  />
        <ZodiacBadgeCard zodiac="Aquarius" element="Air"   aura="#00D4FF" edition={14} />
        <ZodiacBadgeCard zodiac="Taurus"   element="Earth" aura="#9945FF" edition={3}  />
        <ZodiacBadgeCard zodiac="Scorpio"  element="Water" aura="#39FF14" edition={21} />
      </div>
    </div>
  </section>
);

const roadmap = [
  ["Phase 1", "Devnet MVP polish", "Launch, Discover and Trade surfaces refined around the trust layer."],
  ["Phase 2", "Indexer + real market data", "Backend writes tokens, trades, OHLCV and wallet reputation to Postgres."],
  ["Phase 3", "Raydium E2E verification", "Real devnet CPMM create/deposit/migration transaction path."],
  ["Phase 4", "Security audit", "External review, dependency cleanup, CI hardening and operational monitoring."],
  ["Phase 5", "Mainnet beta", "Controlled launch with production RPC, multisig and public disclosure policy."],
] as const;

const toneClass = (tone: string) => `landing-badge landing-badge-${tone}`;

const LandingBadge = ({ children, tone = "green" }: { children: ReactNode; tone?: string }) => (
  <span className={toneClass(tone)}>
    <span className="landing-badge-dot" />
    {children}
  </span>
);

const LandingNav = ({
  goLaunch,
  goDiscover,
  goTrade,
}: {
  goLaunch: () => void;
  goDiscover: () => void;
  goTrade: () => void;
}) => (
  <header className="landing-nav">
    <a className="landing-brand" href="#top" aria-label="HumbleTrust home">
      <span className="landing-logo"><ShieldCheck size={16} /></span>
      <span>Humble<span>Trust</span></span>
      <em><span /> DEVNET</em>
    </a>
    <nav className="landing-nav-links" aria-label="Landing navigation">
      <a href="#product">Product</a>
      <button type="button" onClick={goLaunch}>Launch</button>
      <button type="button" onClick={goDiscover}>Discover</button>
      <button type="button" onClick={goTrade}>Trade</button>
      <a href="#trustscore">TrustScore</a>
      <a href="#badge-nft">Badge NFT</a>
      <a href="#architecture">Architecture</a>
      <a href="#devnet">Devnet Status</a>
      <a href="#roadmap">Roadmap</a>
      <a href="#docs">Docs</a>
    </nav>
    <div className="landing-nav-actions">
      <a className="landing-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
        <Github size={15} /> GitHub
      </a>
      <button className="landing-demo-btn" type="button" onClick={goLaunch}>
        View Devnet Demo <ArrowRight size={15} />
      </button>
    </div>
  </header>
);

const MiniCandles = ({ compact = false }: { compact?: boolean }) => {
  const candles = [24, 32, 28, 38, 45, 40, 52, 58, 53, 66, 74, 69, 78, 84, 80, 88];
  return (
    <div className={compact ? "mini-candles compact" : "mini-candles"} aria-hidden="true">
      {candles.map((height, index) => (
        <span
          key={index}
          className={index % 5 === 2 ? "down" : "up"}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
};

const VaultDistribution = () => (
  <div className="vault-panel">
    <div className="mock-row">
      <span>Vault distribution</span>
      <strong>1B supply</strong>
    </div>
    <div className="vault-stack">
      {vaults.map((vault) => (
        <span key={vault.name} title={`${vault.name}: ${vault.value}%`} style={{ width: `${vault.value}%`, background: vault.color }} />
      ))}
    </div>
    <div className="vault-legend">
      {vaults.map((vault) => (
        <div key={vault.name}>
          <span style={{ background: vault.color }} />
          {vault.name} {vault.value}%
        </div>
      ))}
    </div>
  </div>
);

const HeroDashboard = () => (
  <div className="hero-dashboard">
    <div className="terminal-bar">
      <span />
      <span />
      <span />
      <strong>humbletrust / launch / $TRUST_demo</strong>
      <em>devnet preview</em>
    </div>
    <div className="dashboard-grid">
      <div className="score-widget">
        <div className="mock-row">
          <span>TrustScore</span>
          <strong>+2 since launch</strong>
        </div>
        <div className="score-ring-lg">
          <svg viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="58" />
            <circle cx="70" cy="70" r="58" className="progress" />
          </svg>
          <div>
            <strong>78</strong>
            <span>/ 100</span>
          </div>
        </div>
        <div className="score-mini-grid">
          <span>Launch <b>86</b></span>
          <span>Creator <b>72</b></span>
          <span>Market <b>74</b></span>
          <span>Risk <b>81</b></span>
        </div>
      </div>
      <div className="dashboard-side">
        <VaultDistribution />
        <div className="chip-row">
          <span>Curve Active</span>
          <span>PDA Custody</span>
          <span>Zodiac Badge NFT</span>
          <span>Mainnet Prep</span>
        </div>
        <div className="chart-widget">
          <div className="mock-row">
            <span>Bonding curve - 1h</span>
            <strong>+18.4%</strong>
          </div>
          <MiniCandles />
        </div>
      </div>
    </div>
    <div className="creator-float">
      <span />
      <div>Creator wallet<br /><b>7Hx...f93Q</b></div>
      <div>Reputation<br /><b>72 / 100</b></div>
    </div>
  </div>
);

const LaunchSurface = ({ goLaunch }: { goLaunch: () => void }) => (
  <section id="launch" className="landing-section">
    <div className="sec-eyebrow">A - Launch</div>
    <div className="landing-split">
      <div>
        <h2 className="sec-h2">Launch protected tokens with enforced trust parameters</h2>
        <p className="sec-sub">
          Creators configure the launch once. HumbleTrust enforces supply distribution, PDA custody,
          vesting, curve liquidity and TrustScore inputs on-chain.
        </p>
        <button className="btn-p landing-cta" onClick={goLaunch}>
          Launch on Devnet <ArrowRight size={16} />
        </button>
      </div>
      <div className="surface-card launch-mock">
        <div className="surface-head">
          <span>Protected Launch</span>
          <LandingBadge>DEVNET</LandingBadge>
        </div>
        {[
          ["Token name", "Humble Signal"],
          ["Symbol", "HSG"],
          ["Initial Liquidity", "1.25 SOL"],
          ["Locked / Creator", "42% / 3%"],
          ["Curve / Circulation", "35% / 17%"],
          ["Airdrop / Burn", "3% / 25%"],
          ["Anti-bot delay", "60 sec"],
        ].map(([label, value]) => (
          <div className="form-row-mini" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <div className="launch-score-preview">
          <span>Expected LaunchScore</span>
          <strong>86</strong>
        </div>
      </div>
    </div>
  </section>
);

const DiscoverSurface = ({ goDiscover }: { goDiscover: () => void }) => {
  const tokens = [
    ["Vault Net", "VLT", 91, "Migrated - CPMM", "1,204 SOL", "92.1 SOL"],
    ["Solgrid", "SOLG", 81, "Devnet", "302 SOL", "22.7 SOL"],
    ["Risk Layer", "RSK", 58, "On curve", "94 SOL", "8.6 SOL"],
    ["Orbital", "ORB", 67, "On curve", "151 SOL", "11.9 SOL"],
  ];
  return (
    <section id="discover" className="landing-section soft-band">
      <div className="sec-eyebrow">B - Discover</div>
      <h2 className="sec-h2">Discover launches through a Trust Layer registry</h2>
      <p className="sec-sub">
        Discover is designed as an indexed trust registry powered by launch events, wallet history,
        market health and community risk.
      </p>
      <div className="discover-mock">
        <div className="discover-toolbar-mock">
          <div>
            <button type="button" className="active" onClick={goDiscover}>New</button>
            <button type="button" onClick={goDiscover}>TrustScore</button>
            <button type="button" onClick={goDiscover}>Volume</button>
          </div>
          <div>
            <span>Strong</span>
            <span>Elite</span>
            <span>Low Risk</span>
          </div>
        </div>
        <div className="discover-token-grid">
          {tokens.map(([name, symbol, score, status, volume, liquidity]) => (
            <div className="discover-token-card" key={String(symbol)} onClick={goDiscover} style={{cursor:"pointer"}}>
              <div className="token-avatar">{String(symbol).slice(0, 2)}</div>
              <div className="token-main">
                <strong>{name}</strong>
                <span>${symbol}</span>
              </div>
              <BadgeCheck size={16} className="token-cert" />
              <div className="token-score">
                <span>TrustScore</span>
                <strong>{score}</strong>
              </div>
              <div className="mini-progress"><span style={{ width: `${score}%` }} /></div>
              <div className="token-metrics">
                <span>Vol <b>{volume}</b></span>
                <span>Liq <b>{liquidity}</b></span>
              </div>
              <div className="token-status">{status}</div>
            </div>
          ))}
        </div>
      </div>
      <button className="btn-p landing-cta" onClick={goDiscover}>
        Explore Tokens <ArrowRight size={16} />
      </button>
    </section>
  );
};

const TradeSurface = ({ goTrade }: { goTrade: () => void }) => (
  <section id="trade" className="landing-section">
    <div className="sec-eyebrow">C - Trade Swap</div>
    <div className="landing-split reverse">
      <div>
        <h2 className="sec-h2">Trade with visible risk, slippage and market context</h2>
        <p className="sec-sub">
          Users can buy and sell through the HumbleTrust bonding curve while seeing TrustScore,
          slippage, price impact and market health before trading.
        </p>
        <button className="btn-p landing-cta" onClick={goTrade}>
          Open Trade <ArrowRight size={16} />
        </button>
      </div>
      <div className="trade-mock-grid">
        <div className="surface-card swap-mock">
          <div className="surface-head">
            <span>Mini Swap</span>
            <LandingBadge>DEVNET</LandingBadge>
          </div>
          <div className="input-mini">
            <span>Token mint</span>
            <strong>7Hx2k...Q9pL - $HUMBLE</strong>
          </div>
          <div className="trade-tabs-mini">
            <button type="button" className="active" onClick={goTrade}>Buy</button>
            <button type="button" onClick={goTrade}>Sell</button>
          </div>
          <div className="swap-box">
            <span>From</span>
            <strong>0.5 SOL</strong>
          </div>
          <div className="swap-box">
            <span>To est.</span>
            <strong>201.4K TOKEN</strong>
          </div>
          <div className="swap-meta-mini">
            <span>Fee <b>1%</b></span>
            <span>Slippage <b>1%</b></span>
            <span>Impact <b>1.42%</b></span>
          </div>
          <button className="swap-preview-btn" type="button" onClick={goTrade}>Preview buy on Devnet</button>
          <div className="devnet-warning-mini">
            <AlertTriangle size={14} /> Devnet preview only. No real-value assets.
          </div>
        </div>
        <div className="surface-card market-mock">
          <div className="mock-row">
            <span>$HUMBLE / SOL</span>
            <strong>+18.4%</strong>
          </div>
          <MiniCandles />
          <div className="trust-side">
            <Sparkles size={16} />
            <div>
              <span>TrustScore</span>
              <strong>78/100</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const TrustScoreSection = () => (
  <section id="trustscore" className="landing-section soft-band">
    <div className="sec-eyebrow">TrustScore</div>
    <h2 className="sec-h2">TrustScore is explainable, not magic</h2>
    <p className="sec-sub">
      The score is split into launch, creator, market and community components so users can see why a token is strong or risky.
    </p>
    <div className="trustscore-grid">
      {trustRows.map(([label, value, body, tone]) => (
        <div className="trustscore-card" key={label}>
          <div className="mock-row">
            <span>{label}</span>
            <strong>{value}/100</strong>
          </div>
          <div className="mini-progress"><span className={`tone-${tone}`} style={{ width: `${value}%` }} /></div>
          <p>{body}</p>
        </div>
      ))}
    </div>
  </section>
);

const ArchitectureSection = () => (
  <section id="architecture" className="landing-section">
    <div className="sec-eyebrow">Architecture</div>
    <h2 className="sec-h2">The launchpad is the first interface. The trust layer is the network.</h2>
    <p className="sec-sub">
      Launch, Discover and Trade share the same trust graph: creator behavior, PDA custody,
      launch parameters, market health, certificates and future wallet reputation.
    </p>
    <div className="architecture-flow">
      {["Frontend", "Anchor v2", "PDA Vaults", "Bonding Curve", "Indexer API", "Postgres", "Charts", "Raydium CPMM"].map((item, index) => (
        <div key={item} className="arch-node">
          <span>{String(index + 1).padStart(2, "0")}</span>
          {item}
        </div>
      ))}
    </div>
  </section>
);

export const Landing = ({
  goLaunch,
  goDiscover,
  goTrade,
}: {
  goLaunch: () => void;
  goDiscover: () => void;
  goTrade: () => void;
}) => (
  <>
    <LandingNav goLaunch={goLaunch} goDiscover={goDiscover} goTrade={goTrade} />
    <section id="top" className="landing-hero">
      <div className="landing-hero-copy">
        <div className="landing-badge-row">
          <LandingBadge>DEVNET ACTIVE</LandingBadge>
          <LandingBadge tone="cyan">MAINNET PREP</LandingBadge>
          <LandingBadge tone="purple">Anchor v2 - Solana</LandingBadge>
        </div>
        <h1 className="landing-h1">
          The <span>Trust & Safety</span> Layer for Solana launches.
        </h1>
        <p>
          Protected token launches, PDA custody, TrustScore, wallet reputation, market health
          and Zodiac Badge NFTs — starting with a devnet launchpad MVP.
        </p>
        <div className="hero-btns left">
          <button className="btn-p" onClick={goLaunch}>
            Launch on Devnet <ArrowRight size={16} />
          </button>
          <a className="btn-s" href="#product">
            Explore Trust Layer
          </a>
        </div>
        <div className="landing-metrics">
          <div><strong>1B</strong><span>fixed supply</span></div>
          <div><strong>6</strong><span>PDA vaults</span></div>
          <div><strong>0-100</strong><span>TrustScore</span></div>
        </div>
      </div>
      <HeroDashboard />
    </section>

    <section id="devnet" className="landing-status-strip">
      {statusCards.map((card) => (
        <div className={`status-card ${card.tone}`} key={card.title}>
          <strong>{card.title}</strong>
          <span>{card.body}</span>
        </div>
      ))}
    </section>

    <section id="product" className="landing-section">
      <div className="sec-eyebrow">Product</div>
      <h2 className="sec-h2">HumbleTrust turns launch behavior into trust infrastructure</h2>
      <p className="sec-sub">
        Every launch creates structured trust data: supply allocation, vault custody, liquidity,
        creator wallet history, market health, complaints, votes and certificates.
      </p>
      <div className="module-grid">
        {productModules.map(([title, body, Icon]) => (
          <div className="module-card" key={title}>
            <Icon size={19} />
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>

    <LaunchSurface goLaunch={goLaunch} />
    <DiscoverSurface goDiscover={goDiscover} />
    <TradeSurface goTrade={goTrade} />
    <TrustScoreSection />
    <BadgeNFTSection />
    <ArchitectureSection />

    <section id="roadmap" className="landing-section soft-band">
      <div className="sec-eyebrow">Roadmap</div>
      <h2 className="sec-h2">Devnet first. Mainnet only after proof.</h2>
      <div className="roadmap-grid">
        {roadmap.map(([phase, title, body]) => (
          <div className="roadmap-card" key={phase}>
            <span>{phase}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>

    <section id="docs" className="landing-section docs-security">
      <div>
        <div className="sec-eyebrow">Docs</div>
        <h2 className="sec-h2">Built for grants, auditors and serious creators</h2>
        <p className="sec-sub">
          Technical docs and a formal security page are planned. Current code and readiness status are visible in GitHub.
        </p>
        <div className="docs-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"><FileCheck size={15} /> Open GitHub</a>
          <a href="#architecture"><Database size={15} /> Architecture</a>
          <a href="#devnet"><ShieldCheck size={15} /> Devnet/Mainnet status</a>
        </div>
      </div>
      <div id="security" className="security-card">
        <div className="mock-row">
          <span>Backend / Indexer</span>
          <strong>{API_BASE_URL ? "configured" : "env required"}</strong>
        </div>
        <p>
          Frontend reads backend data through <code>VITE_API_BASE_URL</code>. Current stage: {NETWORK_STAGE}.
          Set the Vercel env var after backend deployment to enable live registry and chart data.
        </p>
        <div className="security-warning">
          <AlertTriangle size={16} />
          No mainnet claims until audit, production backend and Raydium E2E migration are verified.
        </div>
      </div>
    </section>
  </>
);
