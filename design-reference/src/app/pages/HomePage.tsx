import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Rocket, ArrowLeftRight, Compass, Lock,
  Zap, BarChart2, Users, TrendingUp, ChevronRight, ExternalLink,
} from "lucide-react";
import { GlassPanel } from "../components/GlassPanel";

interface HomePageProps {
  onTabChange: (tab: string) => void;
}

const INFO_TABS = [
  { id: "how", label: "How it Works" },
  { id: "security", label: "Security" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "roadmap", label: "Roadmap" },
] as const;

type InfoTabId = (typeof INFO_TABS)[number]["id"];

const TAB_CONTENT: Record<
  InfoTabId,
  { title: string; items: { icon: React.ElementType; title: string; desc: string }[] }
> = {
  how: {
    title: "Launch protected tokens in 3 steps",
    items: [
      {
        icon: Rocket,
        title: "1. Configure & Launch",
        desc: "Set token name, supply, and trust parameters. HumbleTrust deploys a bonding-curve smart contract on Solana devnet — no coding required.",
      },
      {
        icon: ArrowLeftRight,
        title: "2. Trade on the Curve",
        desc: "Anyone can buy or sell on the automated V2 bonding curve. Price moves algorithmically based on supply and demand.",
      },
      {
        icon: BarChart2,
        title: "3. Track on Charts",
        desc: "TradingView-powered charts show every trade with buy/sell markers. Watch your token price grow as demand increases.",
      },
    ],
  },
  security: {
    title: "Security-first architecture",
    items: [
      {
        icon: Lock,
        title: "On-chain Bonding Curve",
        desc: "All reserves are held in a Solana program account. The math is transparent and verifiable by anyone on Solscan.",
      },
      {
        icon: Shield,
        title: "Trust Score System",
        desc: "Every token gets a trust score based on creator history, liquidity depth, and trade activity. Rug-pull patterns are flagged.",
      },
      {
        icon: Users,
        title: "Transparent Trading",
        desc: "All transactions are on-chain and indexed. Every buy and sell is publicly visible — visible to all users, not just the creator.",
      },
    ],
  },
  tokenomics: {
    title: "Bonding curve mechanics",
    items: [
      {
        icon: TrendingUp,
        title: "Automated Price Discovery",
        desc: "Price follows the constant-product formula: P = SOL_reserve / TOKEN_reserve. As more tokens are bought, price rises automatically.",
      },
      {
        icon: Zap,
        title: "1% Protocol Fee",
        desc: "A 1% fee on every trade funds protocol development and the trust-score oracle. No hidden fees, no team allocation.",
      },
      {
        icon: BarChart2,
        title: "Slippage Protection",
        desc: "Built-in slippage guard rejects trades that exceed your tolerance (0.5%–3%). No front-running or sandwich attacks.",
      },
    ],
  },
  roadmap: {
    title: "What's next",
    items: [
      {
        icon: Rocket,
        title: "Q3 2026 — Mainnet Launch",
        desc: "Deploy V2 bonding curve to Solana mainnet with fully audited smart contracts. Trust scores go live for all Solana tokens.",
      },
      {
        icon: BarChart2,
        title: "Q4 2026 — Advanced Charts",
        desc: "Raydium CPMM migration for graduated tokens. Full OHLCV history with volume bars and indicator overlays.",
      },
      {
        icon: Users,
        title: "2027 — NFT Certificates",
        desc: "Creators get an NFT certificate for every successful launch. Collectors can trade proof-of-launch badges on secondary markets.",
      },
    ],
  },
};

export function HomePage({ onTabChange }: HomePageProps) {
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTabId>("how");

  const actions = [
    { label: "Launch Token", tab: "launch", icon: Rocket, color: "#B026FF", desc: "Deploy on the bonding curve" },
    { label: "Trade",        tab: "trade",  icon: ArrowLeftRight, color: "#00FF41", desc: "Buy & sell on V2 curve" },
    { label: "Discover",     tab: "discover", icon: Compass, color: "#00D4FF", desc: "Browse all tokens" },
    { label: "Live Charts",  tab: "charts", icon: BarChart2, color: "#FFD700", desc: "Real-time price charts" },
  ];

  const stats = [
    { label: "Protocol",  value: "V2 Curve",  sub: "Solana Devnet" },
    { label: "Fee",       value: "1%",         sub: "Per trade" },
    { label: "Slippage",  value: "0.5–3%",     sub: "Configurable" },
    { label: "Status",    value: "Live",        sub: "Active", green: true },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <GlassPanel className="p-8 relative overflow-hidden" glow="green">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#00FF41]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#B026FF]/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00FF41] to-[#B026FF] flex items-center justify-center shrink-0"
              style={{ boxShadow: "0 0 32px rgba(0,255,65,0.3), 0 0 64px rgba(176,38,255,0.2)" }}
            >
              <Shield className="w-9 h-9 text-black" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-2">
                Decentralized · Transparent · Protected
              </div>
              <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
                HumbleTrust <span className="text-[#00FF41]">Protocol</span>
              </h1>
              <p className="text-white/60 text-base max-w-2xl leading-relaxed">
                The trust layer for Solana token launches. Deploy bonding-curve tokens with built-in
                price discovery, slippage protection, and real-time charts visible to everyone —
                no rugs, no hidden fees, no surprises.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(0,255,65,0.4)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onTabChange("launch")}
                className="px-6 py-3 rounded-lg bg-[#00FF41] text-black font-bold text-sm flex items-center gap-2"
              >
                <Rocket size={15} /> Launch Token
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onTabChange("discover")}
                className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/80 font-medium text-sm flex items-center gap-2 hover:bg-white/10 transition-colors"
              >
                <Compass size={15} /> Browse Tokens
              </motion.button>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, sub, green }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <GlassPanel className="p-4 text-center">
              <p className={`text-2xl font-bold font-mono mb-1 ${green ? "text-[#00FF41]" : "text-white"}`}>
                {value}
                {green && (
                  <span className="inline-block w-2 h-2 rounded-full bg-[#00FF41] ml-2 animate-pulse align-middle" />
                )}
              </p>
              <p className="text-xs text-white/40">{label}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassPanel className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {actions.map(({ label, tab, icon: Icon, color, desc }, i) => (
              <motion.button
                key={tab}
                onClick={() => onTabChange(tab)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                </div>
                <ChevronRight size={12} className="text-white/20 group-hover:text-white/50 transition-colors self-end mt-auto" />
              </motion.button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Info Tabs */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6">
          <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/5 border border-white/10 w-fit flex-wrap">
            {INFO_TABS.map(({ id, label }) => (
              <motion.button
                key={id}
                onClick={() => setActiveInfoTab(id)}
                whileTap={{ scale: 0.97 }}
                className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeInfoTab === id ? "text-black" : "text-white/50 hover:text-white/80"
                }`}
              >
                {activeInfoTab === id && (
                  <motion.div
                    layoutId="info-tab-bg"
                    className="absolute inset-0 rounded-md bg-[#00FF41]"
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
              <h3 className="text-base font-semibold text-white mb-4">
                {TAB_CONTENT[activeInfoTab].title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TAB_CONTENT[activeInfoTab].items.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">{title}</p>
                      <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </GlassPanel>
      </motion.div>

      {/* Footer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/25">
          <a
            href="https://solscan.io/?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white/50 transition-colors"
          >
            Solscan Devnet <ExternalLink size={10} />
          </a>
          <span>·</span>
          <span className="font-mono">V2 Bonding Curve</span>
          <span>·</span>
          <span>HumbleTrust Protocol © 2026</span>
        </div>
      </motion.div>
    </div>
  );
}
