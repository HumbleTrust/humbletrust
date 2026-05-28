import { useState } from "react";
import { motion } from "motion/react";
import {
  Shield, Search, ExternalLink, Copy, CheckCircle2,
  Zap, Globe, Activity, AlertTriangle, TrendingUp, Code2,
} from "lucide-react";
import { GlassPanel } from "../components/GlassPanel";
import { getTrustScore, getWalletRisk, type TrustScore, type WalletRisk } from "../../lib/solana/api";

const BASE = "https://humbletrust.vercel.app/api";

const SCORE_COLORS: Record<string, string> = {
  ELITE: "#00FF41", STRONG: "#14F195", OK: "#FFDB2B", WEAK: "#FF7A2F",
};
const RISK_COLORS: Record<string, string> = {
  LOW: "#00FF41", MEDIUM: "#FFDB2B", HIGH: "#FF7A2F", CRITICAL: "#FF4444",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-auto p-1.5 rounded text-white/30 hover:text-white/70 transition-colors"
    >
      {copied ? <CheckCircle2 size={13} className="text-[#00FF41]" /> : <Copy size={13} />}
    </button>
  );
}

const ENDPOINTS = [
  {
    method: "GET",
    path: "/score/{mint}",
    desc: "TrustScore for any Solana token — HumbleTrust tokens get full score, external tokens get on-chain mint analysis.",
    params: [{ name: "mint", type: "string", desc: "Solana token mint address (base58)" }],
    example: `curl "${BASE}/score/FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr"`,
  },
  {
    method: "GET",
    path: "/wallets/{wallet}",
    desc: "Reputation score and risk profile for a creator wallet based on launch history and trade patterns.",
    params: [{ name: "wallet", type: "string", desc: "Solana wallet address (base58)" }],
    example: `curl "${BASE}/wallets/{wallet}"`,
  },
  {
    method: "GET",
    path: "/tokens/{mint}?check=health",
    desc: "Real-time token health: 24h volume, buy/sell ratio, price change, anomaly detection.",
    params: [{ name: "mint", type: "string", desc: "Solana token mint address (base58)" }],
    example: `curl "${BASE}/tokens/{mint}?check=health"`,
  },
  {
    method: "GET",
    path: "/tokens",
    desc: "List all tokens registered on HumbleTrust with TrustScore, status, and metadata.",
    params: [{ name: "limit", type: "integer", desc: "Max results (1–200, default 100)" }],
    example: `curl "${BASE}/tokens?limit=20"`,
  },
];

const CODE_JS = `// JavaScript / TypeScript
const getScore = async (mint) => {
  const r = await fetch(\`${BASE}/score/\${mint}\`);
  const { score, trust_level, source, token } = await r.json();
  console.log(\`Score: \${score}/100 [\${trust_level}] via \${source}\`);
};

const getWalletRisk = async (wallet) => {
  const r = await fetch(\`${BASE}/wallets/\${wallet}\`);
  const { reputation_score, risk_level, flags } = await r.json();
  return { reputation_score, risk_level, flags };
};`;

const CODE_PY = `# Python
import requests

def get_score(mint: str) -> dict:
    r = requests.get(f"${BASE}/score/{mint}", timeout=8)
    d = r.json()
    print(f"Score: {d['score']}/100 [{d['trust_level']}]")
    return d

def get_health(mint: str) -> dict:
    return requests.get(f"${BASE}/tokens/{mint}?check=health", timeout=8).json()`;

export function ScorePage() {
  const [mintInput, setMintInput]     = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [scoreResult, setScoreResult] = useState<TrustScore | null>(null);
  const [riskResult, setRiskResult]   = useState<WalletRisk | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingRisk, setLoadingRisk]   = useState(false);
  const [scoreErr, setScoreErr] = useState<string | null>(null);
  const [riskErr, setRiskErr]   = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<"js" | "py">("js");

  const fetchScore = async () => {
    if (!mintInput.trim()) return;
    setLoadingScore(true); setScoreErr(null); setScoreResult(null);
    try { setScoreResult(await getTrustScore(mintInput.trim())); }
    catch (e: any) { setScoreErr(e.message); }
    finally { setLoadingScore(false); }
  };

  const fetchRisk = async () => {
    if (!walletInput.trim()) return;
    setLoadingRisk(true); setRiskErr(null); setRiskResult(null);
    try { setRiskResult(await getWalletRisk(walletInput.trim())); }
    catch (e: any) { setRiskErr(e.message); }
    finally { setLoadingRisk(false); }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassPanel className="p-8 relative overflow-hidden" glow="green">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#00FF41]/5 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00FF41] to-[#B026FF] flex items-center justify-center"
              style={{ boxShadow: "0 0 24px rgba(0,255,65,0.3)" }}>
              <Shield className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60">Public API</div>
              <h1 className="text-2xl font-extrabold text-white">TrustScore Infrastructure</h1>
            </div>
          </div>
          <p className="text-white/55 text-sm leading-relaxed max-w-2xl mb-5">
            Free, public, no authentication required. Score any Solana token or wallet directly from your app, dashboard, or trading bot.
            HumbleTrust is building trust-layer infrastructure for the entire Solana ecosystem.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { icon: Zap,      label: "No API key" },
              { icon: Globe,    label: "100 req/min per IP" },
              { icon: Activity, label: "Live on-chain data" },
              { icon: Code2,    label: "JSON · REST" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/55 font-mono">
                <Icon size={11} className="text-[#00FF41]" /> {label}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 p-3 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/20">
            <span className="text-xs text-white/40 font-mono">Base URL</span>
            <code className="text-xs text-[#00FF41] font-mono ml-2">{BASE}</code>
            <CopyButton text={BASE} />
          </div>
        </GlassPanel>
      </motion.div>

      {/* Endpoints */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassPanel className="p-6">
          <h2 className="text-base font-bold text-white mb-5">Endpoints</h2>
          <div className="space-y-4">
            {ENDPOINTS.map(({ method, path, desc, params, example }) => (
              <div key={path} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00FF41]/15 text-[#00FF41]">{method}</span>
                  <code className="text-sm font-mono text-white/80">{path}</code>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-white/45 mb-3 leading-relaxed">{desc}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {params.map(p => (
                      <span key={p.name} className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-[#B026FF]">{p.name}</span>
                        <span className="text-white/30 mx-1">·</span>
                        <span className="text-white/40">{p.type}</span>
                        <span className="text-white/25 mx-1">·</span>
                        <span className="text-white/35">{p.desc}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <code className="text-[10px] text-white/45 font-mono flex-1 truncate">{example}</code>
                    <CopyButton text={example} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Live Try It — Score */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <GlassPanel className="p-6">
          <h2 className="text-base font-bold text-white mb-1">Try It — Token Score</h2>
          <p className="text-xs text-white/40 mb-4">Enter any Solana token mint address to get its TrustScore live.</p>
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#00FF41]/50 font-mono"
              value={mintInput}
              onChange={e => setMintInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchScore()}
              placeholder="Paste any Solana mint address…"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={fetchScore}
              disabled={loadingScore || !mintInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00FF41] text-black font-bold text-sm disabled:opacity-40"
            >
              {loadingScore ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Search size={14} />}
              Score
            </motion.button>
          </div>
          {scoreErr && <p className="text-red-400 text-xs mb-3">{scoreErr}</p>}
          {scoreResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-extrabold font-mono" style={{ color: SCORE_COLORS[scoreResult.trust_level] }}>
                    {scoreResult.score}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: SCORE_COLORS[scoreResult.trust_level] }}>
                    {scoreResult.trust_level}
                  </div>
                </div>
                <div className="flex-1">
                  {scoreResult.token?.name && (
                    <p className="text-white font-semibold text-sm">{scoreResult.token.name} ({scoreResult.token.symbol})</p>
                  )}
                  <p className="text-white/40 text-xs font-mono mt-0.5">
                    Source: <span className="text-white/60">{scoreResult.source}</span>
                    {scoreResult.token?.verified_issuer && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[#00FF41]/15 text-[#00FF41]">✓ VERIFIED</span>
                    )}
                  </p>
                  {scoreResult.token?.status && (
                    <p className="text-white/30 text-xs mt-0.5">Status: {scoreResult.token.status}</p>
                  )}
                </div>
              </div>
              {scoreResult.warning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15 mb-3">
                  <AlertTriangle size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-yellow-400/70 text-xs">{scoreResult.warning}</p>
                </div>
              )}
              <details className="group">
                <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                  Show breakdown →
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/40 text-[10px] text-white/40 font-mono overflow-auto max-h-48">
                  {JSON.stringify(scoreResult.breakdown, null, 2)}
                </pre>
              </details>
            </motion.div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Live Try It — Wallet Risk */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassPanel className="p-6">
          <h2 className="text-base font-bold text-white mb-1">Try It — Wallet Risk</h2>
          <p className="text-xs text-white/40 mb-4">Enter any Solana wallet to see creator reputation and risk profile.</p>
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#B026FF]/50 font-mono"
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchRisk()}
              placeholder="Paste any Solana wallet address…"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={fetchRisk}
              disabled={loadingRisk || !walletInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B026FF] text-white font-bold text-sm disabled:opacity-40"
            >
              {loadingRisk ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={14} />}
              Analyze
            </motion.button>
          </div>
          {riskErr && <p className="text-red-400 text-xs mb-3">{riskErr}</p>}
          {riskResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-extrabold font-mono" style={{ color: RISK_COLORS[riskResult.risk_level] }}>
                    {riskResult.reputation_score}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: RISK_COLORS[riskResult.risk_level] }}>
                    {riskResult.risk_level} RISK
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {[
                    { label: "Launches",    val: riskResult.launches.total },
                    { label: "Graduated",   val: riskResult.launches.graduated },
                    { label: "Avg Score",   val: riskResult.launches.avg_trust_score ?? "—" },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-base font-bold text-white font-mono">{val}</div>
                      <div className="text-[10px] text-white/35">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {riskResult.flags.length > 0 && (
                <div className="space-y-1.5">
                  {riskResult.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        f.severity === "warning" ? "bg-yellow-400" :
                        f.severity === "info" ? "bg-[#00FF41]" : "bg-red-400"
                      }`} />
                      <p className="text-xs text-white/55">{f.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Code Examples */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Code Examples</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              {(["js", "py"] as const).map(lang => (
                <button key={lang}
                  onClick={() => setActiveCode(lang)}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    activeCode === lang ? "bg-[#00FF41] text-black font-bold" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {lang === "js" ? "JavaScript" : "Python"}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <pre className="p-4 rounded-xl bg-black/50 border border-white/[0.07] text-xs text-white/60 font-mono overflow-auto leading-relaxed">
              {activeCode === "js" ? CODE_JS : CODE_PY}
            </pre>
            <CopyButton text={activeCode === "js" ? CODE_JS : CODE_PY} />
          </div>
        </GlassPanel>
      </motion.div>

      {/* Use cases */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6">
          <h2 className="text-base font-bold text-white mb-5">Integration Use Cases</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: TrendingUp, color: "#00FF41", title: "Trading Bots", desc: "Filter buy signals by TrustScore. Only trade tokens with STRONG+ rating." },
              { icon: Shield,     color: "#B026FF", title: "Wallet UI",    desc: "Show TrustScore badge next to any token in a wallet app (Phantom, Backpack)." },
              { icon: Search,     color: "#00D4FF", title: "Token Aggregators", desc: "Jupiter, DexScreener, Birdeye — embed HumbleTrust score in token listings." },
              { icon: Activity,   color: "#FFD700", title: "Risk Dashboards", desc: "Monitor creator wallet reputation before investing in a new launch." },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Rate limits */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap gap-6 items-center">
          <p className="text-xs text-white/30 font-mono">
            <span className="text-white/50">Rate limit:</span> 100 req/min per IP
          </p>
          <p className="text-xs text-white/30 font-mono">
            <span className="text-white/50">Auth:</span> None required
          </p>
          <p className="text-xs text-white/30 font-mono">
            <span className="text-white/50">Cache:</span> External scores cached 2h
          </p>
          <a href="mailto:humble.trust@outlook.com"
            className="ml-auto text-xs text-[#00FF41]/50 hover:text-[#00FF41] transition-colors flex items-center gap-1">
            Enterprise / higher limits <ExternalLink size={10} />
          </a>
        </div>
      </motion.div>

    </div>
  );
}
