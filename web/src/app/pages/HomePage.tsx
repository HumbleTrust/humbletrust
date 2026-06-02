import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Rocket, ArrowLeftRight, Compass, Lock,
  Zap, BarChart2, Users, TrendingUp, ChevronRight,
  ExternalLink, Award, LayoutDashboard, LineChart, Wallet,
  ArrowRight, CheckCircle2, Globe, Activity,
} from "lucide-react";
import { GlassPanel } from "../components/GlassPanel";
import { getTokens } from "../../lib/solana/api";

interface HomePageProps {
  onTabChange: (tab: string) => void;
}

// ── Info Tabs ──────────────────────────────────────────────────────────────────
const INFO_TABS = [
  { id: "how", label: "How it Works" },
  { id: "security", label: "Security" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "roadmap", label: "Roadmap" },
] as const;
type InfoTabId = (typeof INFO_TABS)[number]["id"];

const TAB_CONTENT: Record<InfoTabId, { title: string; items: { icon: React.ElementType; title: string; desc: string }[] }> = {
  how: {
    title: "Launch protected tokens in 3 steps",
    items: [
      { icon: Rocket,          title: "1. Configure & Launch",  desc: "Set token name, supply, and trust parameters. HumbleTrust deploys a bonding-curve smart contract on Solana devnet — no coding required." },
      { icon: ArrowLeftRight,  title: "2. Trade on the Curve",  desc: "Anyone can buy or sell on the V2 bonding curve. Price moves algorithmically based on supply and demand." },
      { icon: BarChart2,       title: "3. Track on Charts",     desc: "TradingView-powered charts show every trade with buy/sell markers. Watch your token price grow as demand increases." },
    ],
  },
  security: {
    title: "Security-first architecture",
    items: [
      { icon: Lock,    title: "On-chain Bonding Curve",   desc: "All reserves held in a Solana program account. The math is transparent and verifiable by anyone on Solscan." },
      { icon: Shield,  title: "Trust Score System",       desc: "Every token gets a trust score based on creator history, liquidity depth, and trade activity. Rug-pull patterns are flagged." },
      { icon: Users,   title: "Transparent Trading",      desc: "All transactions are on-chain and indexed. Every buy and sell is publicly visible — not just to the creator." },
    ],
  },
  tokenomics: {
    title: "Bonding curve mechanics",
    items: [
      { icon: TrendingUp,     title: "Automated Price Discovery",  desc: "Price follows the constant-product formula: P = SOL_reserve / TOKEN_reserve. As more tokens are bought, price rises automatically." },
      { icon: Zap,            title: "1% Protocol Fee",            desc: "A 1% fee on every trade funds protocol development and the trust-score oracle. No hidden fees, no team allocation." },
      { icon: BarChart2,      title: "Slippage Protection",        desc: "Built-in slippage guard rejects trades that exceed your tolerance (0.5%–3%). No front-running or sandwich attacks." },
    ],
  },
  roadmap: {
    title: "Built in 3 months — from zero to devnet alpha",
    items: [
      { icon: Rocket,     title: "Devnet Alpha — Live Now",      desc: "V2 bonding curve, TrustScore engine, 444-piece NFT badges, Chrome Extension, and Stripe monetisation — all running on devnet." },
      { icon: BarChart2,  title: "Q3 2026 — Mainnet Launch",     desc: "Smart-contract audit + mainnet deployment. TrustScore becomes a public API for every Solana token in existence." },
      { icon: Users,      title: "2027 — NFT Certificate Market", desc: "Soulbound launch certificates for creators + open secondary market for the HumbleTrust Zodiac Badge collection." },
    ],
  },
};

// ── Module cards ──────────────────────────────────────────────────────────────
const MODULES = [
  { label: "Launch",      tab: "launch",    icon: Rocket,          color: "#B026FF", desc: "Deploy bonding-curve tokens" },
  { label: "Trade",       tab: "trade",     icon: ArrowLeftRight,  color: "#00FF41", desc: "Buy & sell on the V2 curve" },
  { label: "Discover",    tab: "discover",  icon: Compass,         color: "#00D4FF", desc: "Browse all live tokens" },
  { label: "Charts",      tab: "charts",    icon: LineChart,       color: "#FFD700", desc: "Real-time price charts" },
  { label: "Market",      tab: "market",    icon: BarChart2,       color: "#FF6B9D", desc: "Market overview & rankings" },
  { label: "NFT Badges",  tab: "nft",       icon: Award,           color: "#14F195", desc: "Proof-of-launch certificates" },
] as const;

// ── Architecture steps ────────────────────────────────────────────────────────
const ARCH_STEPS = [
  { icon: Wallet,         label: "Connect Wallet",    desc: "Phantom / Backpack / Solflare on devnet" },
  { icon: Rocket,         label: "Launch Token",       desc: "Choose curve type, lock %, LP policy" },
  { icon: TrendingUp,     label: "Curve Grows",        desc: "Automated price discovery via bonding curve" },
  { icon: CheckCircle2,   label: "Graduate",           desc: "50 SOL raised → Raydium CPMM migration" },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function HomePage({ onTabChange }: HomePageProps) {
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTabId>("how");
  const [tokenCount, setTokenCount] = useState<number | null>(null);

  useEffect(() => {
    getTokens(200)
      .then(({ tokens }) => setTokenCount(tokens.length))
      .catch(() => {});
  }, []);

  const stats = [
    { label: "Protocol",       value: "V2 Curve",  sub: "Solana Devnet",   green: false },
    { label: "Fee",            value: "1%",         sub: "Per trade",       green: false },
    { label: "Active Tokens",  value: tokenCount !== null ? String(tokenCount) : "—", sub: "Indexed on-chain", green: false },
    { label: "Status",         value: "Live",       sub: "Devnet active",   green: true  },
  ];

  return (
    <div className="space-y-8">

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <GlassPanel className="relative overflow-hidden p-0" glow="green">
          {/* Background glows */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#00FF41]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#B026FF]/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Logo */}
              <motion.div
                whileHover={{ scale: 1.06, rotate: 3 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-20 h-20 rounded-2xl overflow-hidden shrink-0"
                style={{ boxShadow: "0 0 40px rgba(0,255,65,0.35), 0 0 80px rgba(176,38,255,0.25)" }}
              >
                <img src="/HTlogo512.png" alt="HumbleTrust" className="w-full h-full object-cover" />
              </motion.div>

              {/* Text */}
              <div className="flex-1">
                <div className="text-xs font-mono tracking-[0.2em] text-[#00FF41]/60 uppercase mb-2">
                  First Layer · Solana · Decentralized
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-3">
                  <span
                    className="text-transparent bg-clip-text"
                    style={{
                      backgroundImage: "linear-gradient(90deg, #00FF41 0%, #14F195 40%, #B026FF 100%)",
                      backgroundSize: "200% 100%",
                      animation: "gradient-x 6s ease infinite",
                    }}
                  >
                    HumbleTrust
                  </span>
                  <span className="text-white"> Protocol</span>
                </h1>
                <p className="text-white/55 text-base md:text-lg max-w-2xl leading-relaxed">
                  The trust &amp; security layer for Solana token launches. Deploy bonding-curve tokens with
                  built-in price discovery, slippage protection, and real-time charts visible to everyone —
                  no rugs, no hidden fees, no surprises.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 shrink-0 w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0 0 28px rgba(0,255,65,0.5)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onTabChange("launch")}
                  className="px-7 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-black"
                  style={{ background: "linear-gradient(90deg, #00FF41, #00cc33)" }}
                >
                  <Rocket size={15} /> Launch Token
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onTabChange("discover")}
                  className="px-7 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/75 font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Compass size={15} /> Browse Tokens
                </motion.button>
              </div>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/5">
              {["Protected Bonding Curve", "TrustScore System", "On-chain LP Lock", "Raydium CPMM Migration", "Soulbound NFT Cert"].map((pill) => (
                <span key={pill} className="text-xs px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/50 font-mono">
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, sub, green }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
          >
            <GlassPanel className="p-4 text-center">
              <p className={`text-2xl font-bold font-mono mb-1 ${green ? "text-[#00FF41]" : "text-white"}`}>
                {value}
                {green && <span className="inline-block w-2 h-2 rounded-full bg-[#00FF41] ml-2 animate-pulse align-middle" />}
              </p>
              <p className="text-xs text-white/40">{label}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      {/* ── Module grid ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">Protocol Modules</h2>
            <span className="text-xs text-white/30 font-mono">{MODULES.length} active</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {MODULES.map(({ label, tab, icon: Icon, color, desc }, i) => (
              <motion.button
                key={tab}
                onClick={() => onTabChange(tab)}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all group text-center"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}15`, border: `1px solid ${color}30`, boxShadow: `0 0 16px ${color}10` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-xs">{label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5 leading-snug hidden sm:block">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Architecture flow ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <GlassPanel className="p-6">
          <h2 className="text-base font-bold text-white mb-2">How It Works</h2>
          <p className="text-xs text-white/40 mb-6">Four steps from wallet connect to graduated Raydium pool.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ARCH_STEPS.map(({ icon: Icon, label, desc }, i) => (
              <div key={label} className="relative flex flex-col items-center text-center gap-3">
                {i < ARCH_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-px bg-gradient-to-r from-[#00FF41]/30 to-transparent" />
                )}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: `rgba(0,255,65,${0.05 + i * 0.04})`,
                    border: `1px solid rgba(0,255,65,${0.15 + i * 0.08})`,
                    boxShadow: `0 0 20px rgba(0,255,65,${0.05 + i * 0.03})`,
                  }}
                >
                  <Icon className="w-5 h-5 text-[#00FF41]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white mb-1">{label}</p>
                  <p className="text-[10px] text-white/40 leading-snug">{desc}</p>
                </div>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,255,65,0.08)", color: "rgba(0,255,65,0.6)", border: "1px solid rgba(0,255,65,0.12)" }}
                >
                  Step {i + 1}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Info Tabs ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6">
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/10 w-fit flex-wrap">
            {INFO_TABS.map(({ id, label }) => (
              <motion.button
                key={id}
                onClick={() => setActiveInfoTab(id)}
                whileTap={{ scale: 0.97 }}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeInfoTab === id ? "text-black" : "text-white/50 hover:text-white/80"
                }`}
              >
                {activeInfoTab === id && (
                  <motion.div
                    layoutId="info-tab-bg"
                    className="absolute inset-0 rounded-lg bg-[#00FF41]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeInfoTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-white mb-4">{TAB_CONTENT[activeInfoTab].title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TAB_CONTENT[activeInfoTab].items.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#00FF41]/8 border border-[#00FF41]/20 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">{title}</p>
                      <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </GlassPanel>
      </motion.div>

      {/* ── Trust score explainer ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <GlassPanel className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="text-xs font-mono tracking-widest text-[#00FF41]/60 uppercase mb-2">TrustScore System</div>
              <h2 className="text-xl font-bold text-white mb-3">
                Every token is scored from{" "}
                <span className="text-[#00FF41]">0 to 100</span>
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                The score is calculated entirely on-chain from verifiable parameters: lock duration,
                locked percentage, creator allocation, curve liquidity, burn rate, and circulation.
                No off-chain oracles, no manual curation.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { range: "85–100", label: "ELITE",  color: "#00FF41" },
                  { range: "70–84",  label: "STRONG", color: "#14F195" },
                  { range: "40–69",  label: "OK",     color: "#FFDB2B" },
                  { range: "0–39",   label: "WEAK",   color: "#FF7A2F" },
                ].map(({ range, label, color }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.07]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                    <div>
                      <span className="text-xs font-bold" style={{ color }}>{label}</span>
                      <span className="text-white/30 text-xs ml-1.5">{range}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-3 w-full md:w-56">
              {[
                { label: "Lock duration",   max: 25 },
                { label: "Lock percent",    max: 20 },
                { label: "Creator alloc",   max: 15 },
                { label: "Curve liquidity", max: 10 },
                { label: "Airdrop",         max: 10 },
                { label: "Burn rate",       max: 12 },
                { label: "Circulation",     max: 8  },
              ].map(({ label, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>{label}</span>
                    <span className="text-[#00FF41]/60 font-mono">max +{max}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(max / 25) * 100}%`, background: "linear-gradient(90deg, #00FF41, #14F195)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Roadmap ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-white">Development History &amp; Roadmap</h2>
            <span className="text-[10px] font-mono text-[#00FF41]/50 px-2 py-0.5 rounded-full bg-[#00FF41]/8 border border-[#00FF41]/15">Built Mar–Jun 2026</span>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-[#00FF41]/40 via-[#B026FF]/40 to-transparent" />
            {([
              { phase: "Mar 2026",  label: "Foundation",                done: true,  current: false, desc: "Solana wallet connect, bonding-curve smart contracts, TradingView charts, live OHLCV trade recording." },
              { phase: "Apr 2026",  label: "V2 Protocol",               done: true,  current: false, desc: "Five-vault model, Protected CPMM & Quadratic curve types, Raydium CPMM graduation at 50 SOL, on-chain LP lock." },
              { phase: "Apr 2026",  label: "Creator Controls",          done: true,  current: false, desc: "Token unlock, vested creator payouts at day 30/60/90, on-chain social fields, burn-on-unlock, DexScreener chart integration." },
              { phase: "May 2026",  label: "TrustScore Engine",         done: true,  current: false, desc: "On-chain 0–100 scoring across 10+ chains. GoPlus, RugCheck, DexScreener & Jupiter integrations. Multi-chain fingerprinting." },
              { phase: "May 2026",  label: "Platform & Monetisation",   done: true,  current: false, desc: "API key system with rate limiting, Stripe subscriptions (Free / Pro / Enterprise), Chrome Extension published to Web Store." },
              { phase: "May 2026",  label: "NFT Zodiac Badges",         done: true,  current: false, desc: "444-piece NFT collection with 4-tier aura system. On-chain reservation, payment binding, badge image API." },
              { phase: "May 2026",  label: "Market Page & Discovery",   done: true,  current: false, desc: "Real-time prices, New Pairs from Raydium/Meteora/Orca/PumpSwap, Gainers & Losers leaderboard, WatchList." },
              { phase: "Jun 2026",  label: "Devnet Alpha — Live",       done: true,  current: true,  desc: "Mobile-first responsive UI, video branding, security hardening. Serverless functions optimised 12→7. Supabase auth wired in." },
              { phase: "Q3 2026",   label: "Mainnet Launch",            done: false, current: false, desc: "Audited contracts on Solana mainnet. TrustScore becomes a public API for every token on the network." },
              { phase: "Q4 2026",   label: "Advanced Analytics",        done: false, current: false, desc: "Public TrustScore API tier, volume bars, indicator overlays, multi-token comparison charts." },
              { phase: "2027",      label: "NFT Certificate Market",    done: false, current: false, desc: "Soulbound launch certificates for every graduation + open secondary market for the Zodiac Badge collection." },
            ] as { phase: string; label: string; done: boolean; current: boolean; desc: string }[]).map(({ phase, label, done, current, desc }, i) => (
              <div key={i} className="relative mb-5 last:mb-0">
                <div
                  className="absolute -left-4 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: current ? "#00FF41" : done ? "rgba(0,255,65,0.5)" : "rgba(255,255,255,0.12)",
                    background: current ? "rgba(0,255,65,0.2)" : done ? "rgba(0,255,65,0.08)" : "rgba(0,0,0,0.6)",
                    boxShadow: current ? "0 0 10px rgba(0,255,65,0.4)" : undefined,
                  }}
                >
                  {(done || current) && <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />}
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-mono text-[#00FF41]/50">{phase}</span>
                    {current && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00FF41]/15 text-[#00FF41] font-mono animate-pulse">LIVE</span>}
                    {done && !current && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-mono">DONE</span>}
                  </div>
                  <p className="text-sm font-semibold text-white mb-0.5">{label}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/20 py-2">
          <a
            href="https://x.com/HumbleTrust2026"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white/50 transition-colors"
          >
            @HumbleTrust2026 <ExternalLink size={9} />
          </a>
          <span>·</span>
          <a
            href="https://solscan.io/?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white/50 transition-colors"
          >
            <Globe size={10} /> Solscan Devnet <ExternalLink size={9} />
          </a>
          <span>·</span>
          <span className="font-mono">V2 Bonding Curve</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Activity size={10} /> HumbleTrust Protocol © 2026
          </span>
        </div>
      </motion.div>

    </div>
  );
}
