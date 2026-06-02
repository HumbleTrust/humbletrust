import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Rocket, Lock, ExternalLink, Github, Twitter,
  TrendingUp, Users, CheckCircle2, ArrowLeftRight,
  BarChart2, Award, Globe, Mail, FileText, Zap,
  Code2, Database, Activity, Download, Presentation, X, Copy, Check,
} from "lucide-react";
import { GlassPanel } from "../components/GlassPanel";

interface AboutPageProps {
  onTabChange?: (tab: string) => void;
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const TIMELINE = [
  {
    date: "Early 2026",
    label: "The Problem",
    status: "done",
    desc: "Born from first-hand frustration with Solana launches. Every week: another rug pull, another team dumping LP, another community left holding worthless tokens. The tools existed — what was missing was a protocol that enforced rules on-chain, not just on paper.",
  },
  {
    date: "February 2026",
    label: "V1 Program — First Devnet Deploy",
    status: "done",
    desc: "First Anchor smart contract deployed to Solana devnet. Basic token lock mechanism: creator deposits % of supply into a PDA vault with a time lock. Burn-on-unlock option. TrustScore v1 calculated from lock %, lock duration, burn choice, and airdrop allocation.",
  },
  {
    date: "March 2026",
    label: "V2 Architecture Design",
    status: "done",
    desc: "Complete redesign around a five-vault model: Locked, Creator, Curve Liquidity, Circulation, Airdrop. Bonding curve AMM (CPMM and Quadratic). LP Policy: Lock/Burn on graduation. TrustScore v2 incorporating all five supply buckets. Certificate NFT (Token-2022 NonTransferable).",
  },
  {
    date: "April 2026",
    label: "V2 Program — Devnet Launch",
    status: "done",
    desc: "V2 Anchor program deployed: FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr. Full bonding-curve trading (buy/sell). Raydium CPMM graduation tested on devnet — tokens auto-migrate at 50 SOL threshold via CPI, LP locked in PDA or burned on-chain. Creator reputation account. Launch Certificate NFT minting. Anti-bot delay.",
  },
  {
    date: "May 2026",
    label: "Frontend & Protocol Surface",
    status: "done",
    desc: "Full React + Vite + TypeScript frontend live at humbletrust.vercel.app. Launch, Trade, Discover, Charts, Market, NFT, Dashboard pages. Live TradingView charts connected to Supabase trade index. Social fields for tokens. Real-time price ticker. Announcement banner. LP policy selectors. Protected CPMM + Quadratic curve types.",
  },
  {
    date: "May 2026",
    label: "Chrome Extension — Live",
    status: "done",
    desc: "HumbleTrust Chrome Extension (Manifest V3) submitted to the Chrome Web Store. Detects token contract addresses on 9 trading platforms (DEXScreener, Birdeye, Jupiter, Raydium, Phantom, Solflare, Bullx, Trojan, Axiom) and shows TrustScore inline — without ever leaving the page.",
  },
  {
    date: "Q3 2026",
    label: "Mainnet Launch",
    status: "upcoming",
    desc: "Audited V2 program deployed to Solana mainnet. TrustScore goes live for all Solana token launches. Squads multisig authority. Production RPC with failover. Full test suite.",
  },
  {
    date: "Q4 2026",
    label: "Raydium CPMM — Mainnet",
    status: "upcoming",
    desc: "Raydium CPMM graduation is already live on devnet. Mainnet activation requires a security audit and production RPC. LP lock/burn enforcement on-chain, OHLCV indexing, volume bars and indicator overlays in the chart.",
  },
  {
    date: "2027",
    label: "Trust Layer Expansion",
    status: "future",
    desc: "HumbleTrust TrustScore expands beyond launches to score any Solana token. NFT launch certificates tradeable on secondary markets. Creator reputation graph. Multi-chain expansion.",
  },
];

// ── Principles ────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  { icon: Lock,       title: "On-chain enforcement",   desc: "Rules are code, not promises. Every allocation, lock, and LP policy is enforced by the Solana program — not by the frontend." },
  { icon: Shield,     title: "No creator control of LP", desc: "After token graduation, LP tokens go to a locked PDA vault or are burned. The creator cannot withdraw liquidity." },
  { icon: TrendingUp, title: "Algorithmic price discovery", desc: "The bonding curve price is deterministic math — no admin can manually change price or manipulate reserves." },
  { icon: Users,      title: "Transparent by default",  desc: "Every trade, every lock, every fee is on-chain. Anyone can verify on Solscan. No hidden wallets, no secret allocations." },
  { icon: Award,      title: "Provable trust",          desc: "TrustScore is calculated from on-chain data only. Creators earn a soulbound NFT certificate for each successful launch." },
  { icon: Zap,        title: "Protocol fee: 1%",        desc: "A flat 1% fee on every trade (0.5% platform + 0.5% creator). Disclosed upfront. No other fees exist." },
];

// ── Technical stack ───────────────────────────────────────────────────────────
const TECH = [
  { icon: Code2,    label: "Smart Contract",   value: "Anchor v0.32.1 · Rust · Solana devnet" },
  { icon: Database, label: "Backend / Index",  value: "Vercel serverless · Supabase (PostgreSQL)" },
  { icon: Globe,    label: "Frontend",         value: "React 19 · Vite · TypeScript · TailwindCSS" },
  { icon: BarChart2, label: "Charts",          value: "TradingView Lightweight Charts · OHLCV API" },
  { icon: Activity,  label: "Price Ticker",    value: "CoinGecko public API · 30s refresh" },
  { icon: Shield,    label: "Wallet",          value: "Solana Wallet Adapter · Phantom · Backpack" },
  { icon: Globe,     label: "Browser Extension", value: "Chrome MV3 · 9 trading platforms · TrustScore inline" },
];

// ── Links ─────────────────────────────────────────────────────────────────────
const LINKS = [
  { icon: Twitter, label: "X (Twitter)",    href: "https://x.com/HumbleTrust2026",                               color: "#1DA1F2" },
  { icon: Github,  label: "GitHub",         href: "https://github.com/HumbleTrust/humbletrust",                  color: "#e2e8f0" },
  { icon: Globe,   label: "Frontend",       href: "https://humbletrust.vercel.app",                              color: "#00FF41" },
  { icon: FileText,label: "V2 Program",     href: "https://solscan.io/account/FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr?cluster=devnet", color: "#B026FF" },
  { icon: Mail,    label: "Contact / Security", href: "mailto:humble.trust@outlook.com",                         color: "#FFD700" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
const PITCH_URL = "/pitch.html";
const PITCH_SHARE_URL = "https://humbletrust.vercel.app/pitch.html";

export function AboutPage({ onTabChange }: AboutPageProps) {
  const [pitchOpen, setPitchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pitchBlobUrl, setPitchBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pitchOpen || blobRef.current) return;
    fetch(PITCH_URL)
      .then(r => r.text())
      .then(html => {
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        blobRef.current = url;
        setPitchBlobUrl(url);
      })
      .catch(() => setPitchBlobUrl(PITCH_URL));
  }, [pitchOpen]);

  useEffect(() => {
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(PITCH_SHARE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <GlassPanel className="relative overflow-hidden p-0" glow="green">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#00FF41]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#B026FF]/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 p-8 md:p-12">
            <div className="flex items-center gap-5 mb-6">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden shrink-0"
                style={{ boxShadow: "0 0 32px rgba(0,255,65,0.3), 0 0 64px rgba(176,38,255,0.2)" }}
              >
                <img src="/HT.PNG" alt="HumbleTrust" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-xs font-mono tracking-[0.2em] uppercase text-[#00FF41]/60 mb-1">
                  About the project
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                  HumbleTrust{" "}
                  <span
                    className="text-transparent bg-clip-text"
                    style={{ backgroundImage: "linear-gradient(90deg, #00FF41, #B026FF)" }}
                  >
                    Protocol
                  </span>
                </h1>
              </div>
            </div>
            <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-2xl">
              HumbleTrust is the <strong className="text-white">First Trust Layer for Solana</strong> —
              infrastructure that makes token launches verifiably honest. Not just a launchpad.
              A protocol that enforces security rules in code, scores every token transparently,
              and protects communities from manipulation.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {LINKS.map(({ icon: Icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 hover:border-white/20 transition-all"
                  style={{ borderColor: `${color}20` }}
                >
                  <Icon size={14} style={{ color }} />
                  {label}
                  <ExternalLink size={10} className="text-white/20" />
                </a>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Mission ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-3">Mission</div>
          <blockquote className="text-xl md:text-2xl font-semibold text-white leading-relaxed border-l-2 border-[#00FF41]/40 pl-5">
            "Make every Solana token launch provably honest — before the first trade happens."
          </blockquote>
          <p className="mt-5 text-white/50 text-sm leading-relaxed">
            The Solana ecosystem has incredible velocity but a trust deficit. Rug pulls, hidden team allocations,
            and creator-controlled LP have eroded confidence. HumbleTrust solves this at the protocol level:
            rules are enforced by on-chain smart contracts, not by promises in a whitepaper.
            Anyone can verify the math, the allocations, and the lock status in real time on Solscan.
          </p>
        </GlassPanel>
      </motion.div>

      {/* ── Investor Pitch ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <GlassPanel className="p-6 md:p-8 relative overflow-hidden" glow="purple">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#B026FF]/6 blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-xs font-mono tracking-widest uppercase text-[#B026FF]/70">Investor Pitch</div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41]">Seed Round · June 2026</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">View or download the pitch deck</h2>
            <p className="text-white/45 text-sm mb-5 max-w-xl">
              12-slide investor presentation — real data on Solana rug pulls, creator economics from the smart contract, charts, business model and funding ask.
            </p>
            <div className="flex flex-wrap gap-3 mb-5">
              <button
                onClick={() => setPitchOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-black transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(90deg,#00FF41,#14F195)" }}
              >
                <Presentation size={15} /> View Pitch
              </button>
              <a
                href={PITCH_URL}
                download="HumbleTrust-Pitch-2026.html"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white border border-[#B026FF]/40 bg-[#B026FF]/8 hover:bg-[#B026FF]/18 transition-all"
              >
                <Download size={15} /> Download
              </a>
              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-all"
              >
                {copied ? <Check size={15} className="text-[#00FF41]" /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-white/30 shrink-0">SHARE:</span>
              <span className="text-[11px] font-mono text-[#B026FF]/80 truncate">{PITCH_SHARE_URL}</span>
              <ExternalLink size={11} className="text-white/20 shrink-0" />
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Pitch Modal ── */}
      <AnimatePresence>
        {pitchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "rgba(4,4,12,0.97)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-2">
                <img src="/HT.PNG" alt="" className="w-7 h-7 rounded-lg object-cover" />
                <span className="text-sm font-semibold text-white">HumbleTrust — Investor Pitch 2026</span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41] hidden sm:inline">Seed Round</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={PITCH_URL}
                  download="HumbleTrust-Pitch-2026.html"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#B026FF]/30 bg-[#B026FF]/8 text-white/60 hover:bg-[#B026FF]/15 transition-all"
                >
                  <Download size={12} /> Download
                </a>
                <button
                  onClick={() => setPitchOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/12 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {pitchBlobUrl ? (
              <iframe
                src={pitchBlobUrl}
                title="HumbleTrust Investor Pitch"
                className="flex-1 w-full border-0"
                allow="fullscreen"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-white/30 text-sm animate-pulse">Loading pitch…</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Story / Timeline ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-2">Story</div>
          <h2 className="text-xl font-bold text-white mb-6">From frustration to first layer</h2>

          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-[#00FF41]/50 via-[#B026FF]/30 to-white/5" />

            {TIMELINE.map(({ date, label, status, desc }, i) => {
              const dotColor =
                status === "done"     ? "#00FF41" :
                status === "upcoming" ? "#B026FF"  : "rgba(255,255,255,0.2)";
              const badge =
                status === "done"     ? { text: "LIVE",     bg: "rgba(0,255,65,0.12)",    color: "#00FF41"  } :
                status === "upcoming" ? { text: "PLANNED",  bg: "rgba(176,38,255,0.12)",  color: "#B026FF"  } :
                                        { text: "FUTURE",   bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" };

              return (
                <div key={i} className="relative mb-7 last:mb-0">
                  <div
                    className="absolute -left-4 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: dotColor, background: `${dotColor}15` }}
                  >
                    {status === "done" && <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />}
                  </div>
                  <div className="pl-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-white/30">{date}</span>
                      <span
                        className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}25` }}
                      >
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1.5">{label}</p>
                    <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Core Principles ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-2">Principles</div>
          <h2 className="text-xl font-bold text-white mb-6">What we stand for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
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
        </GlassPanel>
      </motion.div>

      {/* ── Technical Stack ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-2">Architecture</div>
          <h2 className="text-xl font-bold text-white mb-2">Technical stack</h2>
          <p className="text-white/40 text-sm mb-6">
            Open source. Auditable. Every component chosen for transparency and security.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TECH.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-lg bg-[#B026FF]/10 border border-[#B026FF]/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#B026FF]" />
                </div>
                <div>
                  <p className="text-xs text-white/35 mb-0.5">{label}</p>
                  <p className="text-xs font-mono text-white/70">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-xs text-white/30 font-mono leading-relaxed">
              <span className="text-[#00FF41]/60">V2 Program ID:</span>{" "}
              <span className="text-white/50">FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr</span>
              {" · "}
              <span className="text-[#00FF41]/60">Network:</span>{" "}
              <span className="text-white/50">Solana Devnet</span>
              {" · "}
              <span className="text-[#00FF41]/60">Framework:</span>{" "}
              <span className="text-white/50">Anchor 0.32.1</span>
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Security ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-2">Security</div>
          <h2 className="text-xl font-bold text-white mb-2">Commitment to security</h2>
          <p className="text-white/40 text-sm mb-6">
            HumbleTrust is currently in devnet alpha. No real assets are at risk. The following controls are live:
          </p>
          <div className="space-y-2.5">
            {[
              "PDA-based custody — all SOL and token vaults are program-derived accounts",
              "Mint authority revoked after launch — no one can mint additional supply",
              "LP tokens go to lock PDA or are burned — creator cannot withdraw liquidity",
              "Supply validation: all five vaults must sum to 100%",
              "Creator allocation capped at 5% on-chain",
              "Anti-bot delay: 0–600 seconds before curve trading opens",
              "Overflow-safe curve math using u128 intermediates",
              "TrustScore calculated from on-chain data only — no oracle manipulation",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm">
                <CheckCircle2 size={14} className="text-[#00FF41] mt-0.5 shrink-0" />
                <span className="text-white/60">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
            <p className="text-yellow-400/80 text-xs leading-relaxed">
              <strong className="text-yellow-400">Devnet alpha.</strong> No formal third-party audit has been completed yet.
              Mainnet launch requires a full security audit by a qualified Solana auditor, multisig authority migration,
              and a signed mainnet readiness checklist. Do not use real assets on this network.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="mailto:humble.trust@outlook.com"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-all"
            >
              <Mail size={12} className="text-[#FFD700]" /> Report a vulnerability
            </a>
            <a
              href="https://github.com/HumbleTrust/humbletrust/security/advisories/new"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-all"
            >
              <Github size={12} /> GitHub Security Advisory <ExternalLink size={9} className="text-white/20" />
            </a>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Get Involved ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <GlassPanel className="p-6 md:p-8">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-2">Community</div>
          <h2 className="text-xl font-bold text-white mb-4">Follow the build</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            HumbleTrust is being built in public. Follow development updates on X, explore the
            code on GitHub, or test the protocol on Solana devnet. No tokens sold. No VC funding.
            Just building the trust layer Solana needs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://x.com/HumbleTrust2026"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#1DA1F2]/8 border border-[#1DA1F2]/20 hover:bg-[#1DA1F2]/15 transition-all group"
            >
              <Twitter size={20} style={{ color: "#1DA1F2" }} />
              <div>
                <p className="font-semibold text-white text-sm">@HumbleTrust2026</p>
                <p className="text-xs text-white/40">Updates, milestones, devnet tips</p>
              </div>
              <ExternalLink size={12} className="text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
            </a>
            <a
              href="https://github.com/HumbleTrust/humbletrust"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all group"
            >
              <Github size={20} className="text-white/70" />
              <div>
                <p className="font-semibold text-white text-sm">HumbleTrust/humbletrust</p>
                <p className="text-xs text-white/40">Open source · Anchor + React</p>
              </div>
              <ExternalLink size={12} className="text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
            </a>
            <a
              href="https://solscan.io/account/FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#B026FF]/8 border border-[#B026FF]/20 hover:bg-[#B026FF]/15 transition-all group"
            >
              <FileText size={20} style={{ color: "#B026FF" }} />
              <div>
                <p className="font-semibold text-white text-sm">V2 Program on Solscan</p>
                <p className="text-xs text-white/40">Verify on-chain · Devnet</p>
              </div>
              <ExternalLink size={12} className="text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
            </a>
            <a
              href="https://humbletrust.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#00FF41]/8 border border-[#00FF41]/20 hover:bg-[#00FF41]/15 transition-all group"
            >
              <Rocket size={20} style={{ color: "#00FF41" }} />
              <div>
                <p className="font-semibold text-white text-sm">Try on Devnet</p>
                <p className="text-xs text-white/40">humbletrust.vercel.app</p>
              </div>
              <ExternalLink size={12} className="text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
            </a>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div className="text-center text-xs text-white/20 py-4 space-y-1.5">
          <p className="font-mono">HumbleTrust Protocol · Solana Devnet Alpha · © 2026</p>
          <p>
            Built in public ·{" "}
            <a href="https://x.com/HumbleTrust2026" target="_blank" rel="noreferrer" className="hover:text-white/50 transition-colors underline underline-offset-2">
              @HumbleTrust2026
            </a>
            {" · "}
            <a href="mailto:humble.trust@outlook.com" className="hover:text-white/50 transition-colors underline underline-offset-2">
              humble.trust@outlook.com
            </a>
          </p>
          <p className="text-white/10">
            This is alpha software on a test network. No real assets. No financial advice.
          </p>
        </div>
      </motion.div>

    </div>
  );
}
