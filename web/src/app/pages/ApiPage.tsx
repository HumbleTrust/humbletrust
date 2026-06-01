import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { HexScore } from "../components/HexAvatar";
import {
  Zap, Shield, Code2, Copy, CheckCircle2, ExternalLink,
  Search, Check, X, Star, Crown, Key, Globe, Activity,
  Chrome, Package, ArrowRight, Lock, LogIn,
} from "lucide-react";
import { cn } from "../components/ui/utils";
import { useAuth } from "../../lib/useAuth";

const BASE = "/api";
const DEMO_MINT = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const NFT_EMAIL = "mailto:humble.trust@outlook.com?subject=OG%20Pass%20Waitlist&body=Please%20add%20me%20to%20the%20OG%20Pass%20waitlist.";

async function startCheckout(plan: "pro" | "enterprise", email?: string) {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, email }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.message || "Checkout failed");
}

// ── helpers ───────────────────────────────────────────────────────────────────

const SCORE_COLORS: Record<string, string> = {
  ELITE: "#00FF41", STRONG: "#14F195", OK: "#FFDB2B", WEAK: "#FF7A2F", DANGER: "#FF4444",
};

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={cn("p-1.5 rounded text-white/30 hover:text-white/70 transition-colors", className)}
    >
      {ok ? <CheckCircle2 size={13} className="text-[#00FF41]" /> : <Copy size={13} />}
    </button>
  );
}

function PlanCTA({ plan, onScroll }: { plan: any; onScroll: () => void }) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (plan.action === "scroll") { onScroll(); return; }
    if (plan.action.startsWith("stripe:")) {
      setBusy(true);
      try {
        await startCheckout(plan.action.replace("stripe:", "") as "pro" | "enterprise");
      } catch { setBusy(false); }
      return;
    }
    window.location.href = plan.action;
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={cn(
        "block w-full py-2.5 rounded-lg text-sm text-center transition-all cursor-pointer disabled:opacity-50",
        plan.ctaStyle
      )}
    >
      {busy ? (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : plan.cta}
    </button>
  );
}

// ── plans ─────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    accent: "#ffffff",
    requests: "50 req / day",
    badge: null,
    desc: "For personal use and testing.",
    features: [
      { ok: true,  text: "50 requests per day" },
      { ok: true,  text: "Full JSON response" },
      { ok: true,  text: "Badge embed (SVG)" },
      { ok: true,  text: "Score API" },
      { ok: false, text: "Bulk scoring" },
      { ok: false, text: "Webhooks" },
      { ok: false, text: "Score history" },
    ],
    cta: "Get Free Key",
    ctaStyle: "border border-white/20 text-white hover:border-white/40",
    action: "scroll",
  },
  {
    id: "pro",
    name: "PRO",
    price: "$29",
    period: "/month",
    accent: "#00FF41",
    requests: "10,000 req / day",
    badge: "POPULAR",
    desc: "For builders, trading bots, and apps.",
    features: [
      { ok: true, text: "10,000 requests per day" },
      { ok: true, text: "Full JSON response" },
      { ok: true, text: "Badge embed (SVG)" },
      { ok: true, text: "Bulk scoring (100 tokens)" },
      { ok: true, text: "Webhooks" },
      { ok: true, text: "90-day score history" },
    ],
    cta: "Subscribe PRO",
    ctaStyle: "bg-[#00FF41] text-black font-bold hover:bg-[#00e63a]",
    action: "stripe:pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$299",
    period: "/month",
    accent: "#B026FF",
    requests: "Unlimited",
    badge: null,
    desc: "For platforms, protocols, data providers.",
    features: [
      { ok: true, text: "Unlimited requests" },
      { ok: true, text: "Full JSON response" },
      { ok: true, text: "White-label badge" },
      { ok: true, text: "Bulk scoring (500 tokens)" },
      { ok: true, text: "Webhooks + alerts" },
      { ok: true, text: "99.9% SLA + dedicated endpoint" },
    ],
    cta: "Subscribe Enterprise",
    ctaStyle: "border border-[#B026FF]/50 text-[#B026FF] hover:bg-[#B026FF]/10",
    action: "stripe:enterprise",
  },
  {
    id: "nft",
    name: "OG Pass",
    price: "4 SOL",
    period: "one-time",
    accent: "#FFD700",
    requests: "10,000 req / day",
    badge: "LIMITED 444",
    desc: "Founding member · Lifetime PRO access.",
    features: [
      { ok: true, text: "Everything in PRO" },
      { ok: true, text: "Lifetime — no subscription" },
      { ok: true, text: "OG badge on platform" },
      { ok: true, text: "Early access to new features" },
      { ok: true, text: "Founding member status" },
      { ok: true, text: "Only 444 ever minted" },
    ],
    cta: "Join Waitlist",
    ctaStyle: "border border-[#FFD700]/50 text-[#FFD700] hover:bg-[#FFD700]/10",
    action: NFT_EMAIL,
  },
] as const;

const FEATURE_MATRIX = [
  { label: "Requests / day",     free: "50",    pro: "10,000",  ent: "Unlimited", nft: "10,000"  },
  { label: "Bulk scoring",       free: false,   pro: "100",     ent: "500",       nft: "100"     },
  { label: "Webhooks",           free: false,   pro: true,      ent: true,        nft: true      },
  { label: "Score history",      free: false,   pro: "90 days", ent: "365 days",  nft: "90 days" },
  { label: "Badge embed",        free: true,    pro: true,      ent: "White-label",nft: true     },
  { label: "CSV export",         free: false,   pro: true,      ent: true,        nft: true      },
  { label: "SLA",                free: "None",  pro: "None",    ent: "99.9%",     nft: "None"    },
  { label: "Support",            free: "Docs",  pro: "Priority",ent: "Dedicated", nft: "Priority"},
];

// ── code examples ──────────────────────────────────────────────────────────────

const CODE_TABS = [
  {
    label: "JavaScript",
    lang: "js",
    code: `const res = await fetch(
  "https://humbletrust.vercel.app/api/score/${DEMO_MINT}",
  { headers: { "Authorization": "Bearer ht_live_YOUR_KEY" } }
);
const { score, trust_level, rug_risk, token } = await res.json();

console.log(\`\${token.symbol}: \${score}/100 · \${trust_level} · \${rug_risk} risk\`);
// → DUST: 81/100 · ELITE · LOW risk`,
  },
  {
    label: "Python",
    lang: "python",
    code: `import httpx

resp = httpx.get(
    f"https://humbletrust.vercel.app/api/score/${DEMO_MINT}",
    headers={"Authorization": "Bearer ht_live_YOUR_KEY"},
)
data = resp.json()
print(f"{data['token']['symbol']}: {data['score']}/100 — {data['trust_level']}")
# → DUST: 81/100 — ELITE`,
  },
  {
    label: "React",
    lang: "tsx",
    code: `import { useEffect, useState } from "react";

function TrustBadge({ mint }: { mint: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(\`/api/score/\${mint}\`, {
      headers: { Authorization: "Bearer ht_live_YOUR_KEY" },
    }).then(r => r.json()).then(setData);
  }, [mint]);

  if (!data) return <span>Loading…</span>;
  const color = data.score >= 80 ? "#00FF41" : data.score >= 60 ? "#FFDB2B" : "#FF4444";
  return (
    <span style={{ color, fontWeight: 700 }}>
      {data.token?.symbol} · {data.score}/100 · {data.trust_level}
    </span>
  );
}`,
  },
  {
    label: "cURL",
    lang: "bash",
    code: `curl "https://humbletrust.vercel.app/api/score/${DEMO_MINT}" \\
  -H "Authorization: Bearer ht_live_YOUR_KEY" | jq .

# Badge (SVG image):
curl "https://humbletrust.vercel.app/api/score/${DEMO_MINT}?format=badge" \\
  -o badge.svg

# Wallet reputation:
curl "https://humbletrust.vercel.app/api/wallets/YOUR_WALLET_ADDRESS" \\
  -H "Authorization: Bearer ht_live_YOUR_KEY"`,
  },
];

const ENDPOINTS_INFO = [
  { method: "GET", path: "/score/{mint}", desc: "TrustScore for any Solana token or supported chain address." },
  { method: "GET", path: "/score/{mint}?format=badge", desc: "Returns an SVG badge — embed directly in README or HTML." },
  { method: "GET", path: "/wallets/{address}", desc: "Reputation + risk profile for a creator wallet." },
  { method: "GET", path: "/tokens", desc: "List all HumbleTrust-verified tokens with scores." },
  { method: "GET", path: "/tokens/{mint}?check=health", desc: "Real-time health: 24h volume, buy/sell ratio, anomalies." },
];

// ── component ─────────────────────────────────────────────────────────────────

export const ApiPage = () => {
  const [demoMint, setDemoMint] = useState(DEMO_MINT);
  const [demoResult, setDemoResult] = useState<any>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const [codeTab, setCodeTab] = useState(0);

  const [email, setEmail] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const keyFormRef = useRef<HTMLDivElement>(null);

  const { email: googleEmail } = useAuth();
  useEffect(() => {
    if (googleEmail && !email) setEmail(googleEmail);
  }, [googleEmail]);

  const runDemo = useCallback(async () => {
    const m = demoMint.trim();
    if (!m) return;
    setDemoBusy(true);
    setDemoError(null);
    setDemoResult(null);
    try {
      const r = await fetch(`${BASE}/score/${encodeURIComponent(m)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDemoResult(await r.json());
    } catch (e: any) {
      setDemoError("Request failed — check the address and try again.");
    } finally {
      setDemoBusy(false);
    }
  }, [demoMint]);

  const generateKey = useCallback(async () => {
    const e = email.trim();
    if (!e) { setKeyError("Email required"); return; }
    setKeyBusy(true);
    setKeyError(null);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, label: keyLabel.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || d.error || "Failed");
      setGeneratedKey(d.key);
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setKeyBusy(false);
    }
  }, [email, keyLabel]);

  const scrollToForm = () => keyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const scoreColor = demoResult ? (SCORE_COLORS[demoResult.trust_level] ?? "#fff") : "#00FF41";

  return (
    <div className="space-y-20 pb-12">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <GlassPanel className="relative overflow-hidden p-6 md:p-10 lg:p-14" glow="green">
          {/* background glow blobs */}
          <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#00FF41]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-[#B026FF]/10 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row items-center gap-10">
            {/* text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41] text-xs font-mono mb-6">
                <Activity size={11} /> LIVE API · v1
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                The{" "}
                <span className="bg-gradient-to-r from-[#00FF41] to-[#B026FF] bg-clip-text text-transparent">
                  TrustScore API
                </span>
              </h1>
              <p className="text-white/60 text-lg max-w-xl mb-8">
                Embed on-chain trust signals into any app, DEX, wallet, or trading bot.
                One endpoint — instant risk analysis for any Solana token.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <button
                  onClick={scrollToForm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00FF41] text-black font-bold text-sm hover:bg-[#00e63a] transition-all"
                >
                  <Key size={14} /> Get Free Key
                </button>
                <button
                  onClick={() => startCheckout("pro")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-white text-sm hover:border-white/40 transition-all"
                >
                  <Zap size={14} /> Subscribe PRO
                </button>
              </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 gap-4 shrink-0">
              {[
                { label: "Chains supported", value: "5+", icon: Globe },
                { label: "Score components", value: "4", icon: Shield },
                { label: "OG NFT supply", value: "444", icon: Star },
                { label: "API latency", value: "<300ms", icon: Zap },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/5 border border-white/10 px-5 py-4 text-center">
                  <Icon size={16} className="text-[#00FF41]/70 mx-auto mb-1" />
                  <div className="text-2xl font-black text-white font-mono">{value}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── LIVE PLAYGROUND ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-1">Live Playground</h2>
          <p className="text-white/40 text-sm">Paste any Solana token address and see the score in real time.</p>
        </div>
        <GlassPanel className="p-6" glow="green">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder-white/20 focus:border-[#00FF41]/50 focus:outline-none"
                placeholder="Token mint address…"
                value={demoMint}
                onChange={e => setDemoMint(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runDemo()}
              />
            </div>
            <button
              onClick={runDemo}
              disabled={demoBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00FF41]/20 border border-[#00FF41]/40 text-[#00FF41] text-sm font-medium hover:bg-[#00FF41]/30 disabled:opacity-40 transition-all"
            >
              {demoBusy ? (
                <span className="inline-block w-3 h-3 border-2 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              Run
            </button>
          </div>

          {demoError && <p className="text-red-400 text-sm mb-4">{demoError}</p>}

          <AnimatePresence>
            {demoResult && (
              <motion.div
                key="demo-result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Score visual */}
                <div className="flex items-center gap-6">
                  <HexScore score={demoResult.score ?? 0} color={scoreColor} size={120} />
                  <div>
                    <p className="text-xs text-white/40 font-mono mb-0.5">TRUST LEVEL</p>
                    <p className="text-2xl font-black" style={{ color: scoreColor }}>{demoResult.trust_level}</p>
                    <p className="text-sm text-white/60 mt-1">
                      Rug risk:{" "}
                      <span style={{ color: { LOW: "#00FF41", MEDIUM: "#FFDB2B", HIGH: "#FF7A2F", CRITICAL: "#FF4444" }[demoResult.rug_risk as string] ?? "#fff" }}>
                        {demoResult.rug_risk}
                      </span>
                    </p>
                    {demoResult.token?.name && (
                      <p className="text-xs text-white/40 font-mono mt-2">{demoResult.token.name} · ${demoResult.token?.symbol}</p>
                    )}
                  </div>
                </div>

                {/* JSON snippet */}
                <div className="relative bg-black/40 rounded-lg border border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                    <span className="text-[10px] text-white/30 font-mono">response.json</span>
                    <CopyBtn text={JSON.stringify(demoResult, null, 2)} />
                  </div>
                  <pre className="text-[11px] text-[#00FF41]/80 font-mono p-3 overflow-auto max-h-36 leading-relaxed">
{JSON.stringify({
  score: demoResult.score,
  trust_level: demoResult.trust_level,
  rug_risk: demoResult.rug_risk,
  category: demoResult.category,
  "token.symbol": demoResult.token?.symbol,
  "token.name": demoResult.token?.name,
  signals: `[${(demoResult.signals?.length ?? 0)} items]`,
  flags: demoResult.flags?.slice(0, 2),
}, null, 2)}
                  </pre>
                </div>
              </motion.div>
            )}

            {!demoResult && !demoBusy && !demoError && (
              <motion.div key="demo-hint" className="text-center py-6 text-white/20 text-sm">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/40 text-xs">Run</kbd> or hit Enter to score any token
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>
      </motion.div>

      {/* ── PLANS ─────────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-black text-white mb-2">Pricing Plans</h2>
          <p className="text-white/40">Scale from prototype to production. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <GlassPanel
                className={cn(
                  "p-6 flex flex-col h-full relative overflow-hidden",
                  plan.badge === "POPULAR" && "border-[#00FF41]/30 shadow-[0_0_30px_rgba(0,255,65,0.15)]"
                )}
                glow={plan.badge === "POPULAR" ? "green" : plan.id === "enterprise" ? "purple" : "none"}
              >
                {/* badge */}
                {plan.badge && (
                  <div className={cn(
                    "absolute top-0 right-0 px-2.5 py-1 text-[10px] font-bold rounded-bl-lg",
                    plan.badge === "POPULAR"  && "bg-[#00FF41] text-black",
                    plan.badge === "LIMITED 444" && "bg-[#FFD700] text-black",
                  )}>
                    {plan.badge}
                  </div>
                )}

                {/* header */}
                <div className="mb-5">
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">{plan.id === "nft" ? "NFT · Solana" : "API Plan"}</p>
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2 mb-1">
                    <span className="text-3xl font-black" style={{ color: plan.accent }}>{plan.price}</span>
                    <span className="text-white/40 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-white/40">{plan.desc}</p>
                </div>

                {/* requests pill */}
                <div className="mb-4 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <span className="text-sm font-mono font-bold" style={{ color: plan.accent }}>{plan.requests}</span>
                </div>

                {/* features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f.text} className="flex items-start gap-2 text-sm">
                      {f.ok
                        ? <Check size={13} className="mt-0.5 shrink-0" style={{ color: plan.accent }} />
                        : <X size={13} className="mt-0.5 shrink-0 text-white/20" />
                      }
                      <span className={f.ok ? "text-white/80" : "text-white/30"}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <PlanCTA plan={plan} onScroll={scrollToForm} />
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── FEATURE MATRIX ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-white mb-4">Compare plans</h2>
        <GlassPanel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-white/40 font-medium w-48">Feature</th>
                {["Free", "PRO", "Enterprise", "OG Pass"].map(h => (
                  <th key={h} className="px-4 py-3 text-center text-white/60 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, i) => (
                <tr key={row.label} className={cn("border-b border-white/5", i % 2 === 0 && "bg-white/[0.02]")}>
                  <td className="px-5 py-3 text-white/60">{row.label}</td>
                  {[row.free, row.pro, row.ent, row.nft].map((v, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      {v === true  ? <Check size={14} className="mx-auto text-[#00FF41]" /> :
                       v === false ? <X    size={14} className="mx-auto text-white/20" /> :
                       <span className="text-white/70 font-mono text-xs">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </motion.div>

      {/* ── ENDPOINTS ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <h2 className="text-2xl font-bold text-white mb-4">API Endpoints</h2>
        <GlassPanel className="divide-y divide-white/5">
          {ENDPOINTS_INFO.map(ep => (
            <div key={ep.path} className="flex items-start gap-4 px-5 py-4">
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-[#00FF41]/20 text-[#00FF41] font-mono mt-0.5">
                {ep.method}
              </span>
              <div className="flex-1 min-w-0">
                <code className="text-white/90 font-mono text-sm">{ep.path}</code>
                <p className="text-white/40 text-xs mt-0.5">{ep.desc}</p>
              </div>
            </div>
          ))}
        </GlassPanel>
      </motion.div>

      {/* ── CODE EXAMPLES ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-2xl font-bold text-white mb-4">Code Examples</h2>
        <GlassPanel className="overflow-hidden">
          {/* tabs */}
          <div className="flex border-b border-white/10 bg-black/20">
            {CODE_TABS.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setCodeTab(i)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                  codeTab === i
                    ? "text-[#00FF41] border-[#00FF41]"
                    : "text-white/40 border-transparent hover:text-white/60"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* code */}
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <CopyBtn text={CODE_TABS[codeTab].code} className="bg-white/5 hover:bg-white/10 rounded" />
            </div>
            <pre className="p-5 text-[13px] font-mono leading-relaxed text-[#00FF41]/80 overflow-x-auto whitespace-pre">
              {CODE_TABS[codeTab].code}
            </pre>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── FREE KEY FORM ─────────────────────────────────────────────────────── */}
      <motion.div
        ref={keyFormRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassPanel className="p-8" glow="green">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-12 h-12 rounded-xl bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center justify-center mx-auto mb-4">
              <Key className="text-[#00FF41]" size={22} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Get Your Free API Key</h2>
            <p className="text-white/40 text-sm mb-6">
              50 requests/day · No credit card · Takes 5 seconds
            </p>

            <AnimatePresence mode="wait">
              {generatedKey ? (
                <motion.div key="key-shown" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="p-4 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/30 mb-4">
                    <p className="text-[10px] text-white/40 font-mono mb-2 uppercase tracking-widest">Your API Key — save it now</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[#00FF41] font-mono text-sm break-all text-left">{generatedKey}</code>
                      <CopyBtn text={generatedKey} />
                    </div>
                  </div>
                  <p className="text-white/40 text-xs">
                    Add <code className="text-white/60">Authorization: Bearer {generatedKey.slice(0, 16)}…</code> to your requests.
                  </p>
                  <button
                    onClick={() => { setGeneratedKey(null); setEmail(""); setKeyLabel(""); }}
                    className="mt-4 text-xs text-white/30 hover:text-white/50"
                  >
                    Generate another key
                  </button>
                </motion.div>
              ) : (
                <motion.div key="key-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="space-y-3 mb-4">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && generateKey()}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#00FF41]/50 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Label (optional) — e.g. my-trading-bot"
                      value={keyLabel}
                      onChange={e => setKeyLabel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#00FF41]/50 focus:outline-none"
                    />
                  </div>
                  {keyError && <p className="text-red-400 text-xs mb-3">{keyError}</p>}
                  <button
                    onClick={generateKey}
                    disabled={keyBusy}
                    className="w-full py-3 rounded-lg bg-[#00FF41] text-black font-bold text-sm hover:bg-[#00e63a] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {keyBusy
                      ? <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      : <><Key size={14} /> Generate Free Key</>
                    }
                  </button>
                  <p className="mt-3 text-[10px] text-white/20">
                    By registering you agree to our fair-use policy. Max 3 free keys per email.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── CHROME EXTENSION + WIDGET ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <h2 className="text-2xl font-bold text-white mb-4">Embed Anywhere</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Chrome Extension */}
          <GlassPanel className="p-6 flex flex-col gap-4" hover>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Chrome size={22} className="text-white/60" />
              </div>
              <div>
                <h3 className="font-bold text-white">Chrome Extension</h3>
                <p className="text-xs text-white/40">Works on any page · Free forever</p>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Automatically detects Solana token addresses on any website and overlays
              a TrustScore badge — DEXScreener, Birdeye, Jupiter, Twitter, anywhere.
            </p>
            <ul className="space-y-1.5">
              {["Works on DEXScreener, Birdeye, Jupiter", "No wallet required", "50 free checks/day anonymously", "Open source on GitHub"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                  <Check size={12} className="text-[#00FF41] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-auto">
              <a
                href="https://github.com/humbletrust/humbletrust/tree/main/extension"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all"
              >
                <ExternalLink size={13} /> View on GitHub
              </a>
              <a
                href="#"
                onClick={e => e.preventDefault()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-sm hover:bg-[#00FF41]/20 transition-all"
              >
                <Chrome size={13} /> Add to Chrome
              </a>
            </div>
            <p className="text-[10px] text-white/20 text-center -mt-2">Chrome Web Store listing coming soon</p>
          </GlassPanel>

          {/* Widget */}
          <GlassPanel className="p-6 flex flex-col gap-4" hover>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Package size={22} className="text-white/60" />
              </div>
              <div>
                <h3 className="font-bold text-white">JS Widget</h3>
                <p className="text-xs text-white/40">1 script tag · Any website</p>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Add a live TrustScore badge to any website with a single{" "}
              <code className="text-white/70">&lt;script&gt;</code> tag.
              No framework, no build step.
            </p>
            <div className="rounded-lg bg-black/40 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                <span className="text-[10px] text-white/30 font-mono">HTML</span>
                <CopyBtn text={`<script src="https://humbletrust.vercel.app/widget.js"></script>\n<ht-score mint="FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr"></ht-score>`} />
              </div>
              <pre className="text-[11px] font-mono p-3 text-[#00FF41]/70 leading-relaxed overflow-x-auto">{`<script src="https://humbletrust.vercel.app/widget.js">
</script>

<ht-score
  mint="FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr"
  api-key="ht_live_YOUR_KEY"
></ht-score>`}</pre>
            </div>
            <div className="flex gap-2 mt-auto">
              <a
                href="https://humbletrust.vercel.app/widget.js"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-sm hover:bg-[#00FF41]/20 transition-all"
              >
                <Code2 size={13} /> View widget.js
              </a>
            </div>
          </GlassPanel>
        </div>
      </motion.div>

      {/* ── NFT OG PASS ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassPanel className="relative overflow-hidden p-8 md:p-10" style={{ borderColor: "rgba(255,215,0,0.2)" }}>
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#FFD700]/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FF8C00] flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.3)]">
                <Crown size={36} className="text-black" />
              </div>
              <div className="text-center">
                <div className="text-[#FFD700] font-black text-lg">4 SOL</div>
                <div className="text-[10px] text-white/30 font-mono">ONE-TIME</div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-[10px] font-mono mb-3">
                <Lock size={9} /> LIMITED · 444 TOTAL
              </div>
              <h2 className="text-2xl font-black text-white mb-2">OG Pass — Lifetime PRO</h2>
              <p className="text-white/50 text-sm mb-4 max-w-md">
                444 NFTs. Once they're gone, they're gone. Holders get permanent PRO API access,
                founding member status, and early access to every future feature — forever, no monthly fee.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                {["Lifetime PRO API", "OG status on platform", "Early feature access", "Only 444 minted"].map(f => (
                  <span key={f} className="px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-xs">{f}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <a
                  href={NFT_EMAIL}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FFD700] text-black font-bold text-sm hover:bg-[#e6c800] transition-all"
                >
                  <Star size={14} /> Join Waitlist
                </a>
                <a
                  href="#"
                  onClick={e => e.preventDefault()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#FFD700]/30 text-[#FFD700] text-sm hover:bg-[#FFD700]/10 transition-all cursor-not-allowed opacity-60"
                >
                  Mint Opens Soon
                </a>
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

    </div>
  );
};
