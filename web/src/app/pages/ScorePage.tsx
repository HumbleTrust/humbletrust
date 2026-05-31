import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { HexAvatar, HexScore } from "../components/HexAvatar";
import {
  Shield, Search, ExternalLink, Copy, CheckCircle2,
  Zap, Globe, Activity, AlertTriangle, TrendingUp, Code2,
} from "lucide-react";
import { GlassPanel } from "../components/GlassPanel";
import { getTrustScore, getWalletRisk, type TrustScore, type WalletRisk } from "../../lib/solana/api";

const BASE = "/api";

const SCORE_COLORS: Record<string, string> = {
  ELITE: "#00FF41", STRONG: "#14F195", OK: "#FFDB2B", WEAK: "#FF7A2F", DANGER: "#FF4444",
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

const CODE_JS = `// Fetch a TrustScore
const r = await fetch(\`${BASE}/score/\${mint}\`);
const d = await r.json();
// d.score        — 0-100
// d.trust_level  — "ELITE" | "STRONG" | "OK" | "WEAK" | "DANGER"
// d.rug_risk     — "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
// d.token        — { name, symbol, logo_uri, description }
// d.signals      — scored components array
// d.flags        — active risk flags

if (d.score < 50 || d.rug_risk === "HIGH") {
  console.warn(\`⚠️ Risky token: \${d.trust_level} \${d.score}/100\`);
}`;

const CODE_REACT = `import { useState, useEffect } from "react";

const COLORS = {
  ELITE: "#00FF41", STRONG: "#14F195",
  OK: "#FFDB2B", WEAK: "#FF7A2F", DANGER: "#FF4444",
};

// Drop-in badge — add to any token listing row
export function TrustBadge({ mint }: { mint: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    fetch(\`${BASE}/score/\${mint}\`)
      .then(r => r.json()).then(setD);
  }, [mint]);

  if (!d) return null;
  return (
    <a href="https://humbletrust.vercel.app" target="_blank"
      style={{ display: "inline-flex", alignItems: "center", gap: 4,
               fontSize: 11, fontWeight: 700, fontFamily: "monospace",
               color: COLORS[d.trust_level], textDecoration: "none" }}>
      <img src={\`${BASE}/score/\${mint}?format=badge\`}
           alt={\`TrustScore: \${d.score}/100\`} height={20} />
    </a>
  );
}`;

const CODE_PY = `import requests

def get_score(mint: str) -> dict:
    r = requests.get(f"${BASE}/score/{mint}", timeout=8)
    return r.json()

def is_safe(mint: str, min_score: int = 60) -> bool:
    d = get_score(mint)
    return (
        d.get("score", 0) >= min_score and
        d.get("rug_risk") not in ("HIGH", "CRITICAL")
    )

# Trading bot filter
for mint in watchlist:
    if not is_safe(mint):
        print(f"SKIP {mint} — trust below threshold")
    else:
        place_buy_order(mint)`;

const CODE_CURL = `# Token TrustScore (JSON)
curl "${BASE}/score/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"

# SVG badge — link directly in any HTML or README
# <img src="${BASE}/score/{MINT}?format=badge" alt="TrustScore" />
# ![TrustScore](${BASE}/score/{MINT}?format=badge)

# Score history (trend over time)
curl "${BASE}/score/{MINT}?view=history"

# Wallet reputation score
curl "${BASE}/wallets/{WALLET}"

# Token health (volume, buy/sell ratio, anomalies)
curl "${BASE}/tokens/{MINT}?check=health"`;

// ── Radar chart (SVG, no external lib) ───────────────────────────────────────

function RadarChart({ categories, color }: {
  categories: NonNullable<TrustScore["categories"]>;
  color: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t); }, []);

  const CATS = [
    { key: "supply_control" as const, label: "Supply",       angle: -90 },
    { key: "liquidity"      as const, label: "Liquidity",    angle:   0 },
    { key: "distribution"   as const, label: "Distribution", angle:  90 },
    { key: "legitimacy"     as const, label: "Legitimacy",   angle: 180 },
  ];
  const cx = 110, cy = 110, r = 72;
  const pt = (angle: number, radius: number): [number, number] => {
    const rad = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const values = CATS.map(c => {
    const v = categories[c.key];
    return v && v.max > 0 ? Math.max(0, Math.min(1, v.earned / v.max)) : 0;
  });
  const zeroPolygon = CATS.map(c => `${cx},${cy}`).join(" ");
  const polygon     = CATS.map((c, i) => pt(c.angle, values[i] * r).join(",")).join(" ");

  return (
    <svg viewBox="0 0 220 220" className="w-full h-full">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((lvl, i) => (
        <circle key={lvl} cx={cx} cy={cy} r={r * lvl}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          style={{ opacity: ready ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.08}s` }} />
      ))}
      {/* Axes */}
      {CATS.map((c, i) => {
        const [x, y] = pt(c.angle, r);
        return <line key={c.key} x1={cx} y1={cy} x2={x} y2={y}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          style={{ opacity: ready ? 1 : 0, transition: `opacity 0.3s ease ${0.2 + i * 0.07}s` }} />;
      })}
      {/* Filled polygon — grows from center */}
      <polygon
        points={ready ? polygon : zeroPolygon}
        fill={`${color}22`} stroke={color} strokeWidth="1.5" strokeLinejoin="round"
        style={{ transition: "points 0.9s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
      {/* Data points */}
      {CATS.map((c, i) => {
        const [x, y] = pt(c.angle, values[i] * r);
        return <circle key={c.key} cx={x} cy={y} r="3.5" fill={color}
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? "scale(1)" : "scale(0)",
            transformOrigin: `${x}px ${y}px`,
            transition: `opacity 0.3s ease ${0.7 + i * 0.1}s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.7 + i * 0.1}s`,
            filter: `drop-shadow(0 0 5px ${color})`,
          }} />;
      })}
      {/* Labels */}
      {CATS.map((c, i) => {
        const [x, y] = pt(c.angle, r + 20);
        const v = categories[c.key];
        const valColor = v && v.earned < 0 ? "#FF4444" : color;
        return (
          <g key={c.key} style={{ opacity: ready ? 1 : 0, transition: `opacity 0.4s ease ${0.9 + i * 0.08}s` }}>
            <text x={x} y={y - 6} textAnchor="middle" dominantBaseline="middle"
              fontSize="8" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
              {c.label.toUpperCase()}
            </text>
            <text x={x} y={y + 7} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill={valColor} fontFamily="monospace" fontWeight="bold">
              {v ? `${v.earned}/${v.max}` : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ScoreRing is replaced by HexScore (imported from HexAvatar.tsx)

// ── Reputation bars chart (wallet) ───────────────────────────────────────────

function ReputationChart({ risk, color }: { risk: WalletRisk; color: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t); }, []);

  const gradRate   = risk.launches.total > 0 ? risk.launches.graduated / risk.launches.total : 0;
  const avgScore   = (risk.launches.avg_trust_score ?? 0) / 100;
  const buyRatio   = (risk.trading.buys + risk.trading.sells) > 0
    ? risk.trading.buys / (risk.trading.buys + risk.trading.sells) : null;
  const highScore  = (risk.launches.high_score ?? 0) / 100;

  const bars = [
    {
      label: "Graduation rate",
      value: gradRate,
      display: risk.launches.total > 0 ? `${risk.launches.graduated} / ${risk.launches.total}` : "No launches",
      color: gradRate > 0.5 ? "#00FF41" : gradRate > 0.2 ? "#FFDB2B" : "#FF7A2F",
    },
    {
      label: "Avg trust score",
      value: avgScore,
      display: risk.launches.avg_trust_score != null ? `${risk.launches.avg_trust_score}/100` : "—",
      color: avgScore > 0.7 ? "#00FF41" : avgScore > 0.4 ? "#FFDB2B" : "#FF7A2F",
    },
    {
      label: "Best token score",
      value: highScore,
      display: risk.launches.high_score > 0 ? `${risk.launches.high_score} ↑ / ${risk.launches.low_score} ↓` : "—",
      color: "#B026FF",
    },
    {
      label: "Buy/sell ratio",
      value: buyRatio ?? 0,
      display: buyRatio != null
        ? `${risk.trading.buys}B · ${risk.trading.sells}S`
        : `${risk.trading.total_trades} trades`,
      color: "#00D4FF",
    },
  ];

  return (
    <div className="w-full space-y-4 py-1">
      {bars.map((bar, i) => (
        <div key={bar.label}
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? "translateX(0)" : "translateX(-14px)",
            transition: `opacity 0.4s ease ${i * 0.1}s, transform 0.4s ease ${i * 0.1}s`,
          }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono text-white/35 uppercase tracking-wider">{bar.label}</span>
            <span className="text-[10px] font-mono font-bold" style={{ color: bar.color }}>{bar.display}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{
              width: ready ? `${Math.max(2, Math.round(bar.value * 100))}%` : "2%",
              background: bar.color,
              boxShadow: `0 0 8px ${bar.color}50`,
              transition: `width 0.9s cubic-bezier(0.4,0,0.2,1) ${0.15 + i * 0.12}s`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ScorePage() {
  const [mintInput, setMintInput]     = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [scoreResult, setScoreResult] = useState<TrustScore | null>(null);
  const [riskResult, setRiskResult]   = useState<WalletRisk | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingRisk, setLoadingRisk]   = useState(false);
  const [scoreErr, setScoreErr] = useState<string | null>(null);
  const [riskErr, setRiskErr]   = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<"js" | "react" | "py" | "curl">("js");

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
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">

              {/* Token header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
                <HexAvatar
                  src={scoreResult.token?.logo_uri}
                  label={scoreResult.token?.symbol || scoreResult.token?.name || "?"}
                  size={36}
                  color={SCORE_COLORS[scoreResult.trust_level] || "#00FF41"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {scoreResult.token?.name ?? mintInput.slice(0, 12) + "…"}
                    {scoreResult.token?.symbol && (
                      <span className="text-white/40 ml-1.5 font-normal">({scoreResult.token.symbol})</span>
                    )}
                  </p>
                  {scoreResult.token?.description && (
                    <p className="text-[11px] text-white/50 mt-0.5 leading-tight line-clamp-2">{scoreResult.token.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[9px] font-mono text-white/30">via {scoreResult.source}</span>
                    {scoreResult.chain && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 uppercase">{scoreResult.chain}</span>
                    )}
                    {scoreResult.known_token && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41]">✓ VERIFIED</span>
                    )}
                    {scoreResult.token?.status && (
                      <span className="text-[9px] font-mono text-white/25">{scoreResult.token.status}</span>
                    )}
                  </div>
                </div>
                {scoreResult.data_quality && (
                  <span className="text-[9px] font-mono px-2 py-1 rounded border shrink-0" style={{
                    borderColor: scoreResult.data_quality === "FULL" ? "#00FF4130" : scoreResult.data_quality === "PARTIAL" ? "#FF7A2F30" : "#FF444430",
                    color:       scoreResult.data_quality === "FULL" ? "#00FF41"   : scoreResult.data_quality === "PARTIAL" ? "#FF7A2F"   : "#FF4444",
                    background:  scoreResult.data_quality === "FULL" ? "#00FF4108" : scoreResult.data_quality === "PARTIAL" ? "#FF7A2F08" : "#FF444408",
                  }}>{scoreResult.data_quality}</span>
                )}
              </div>

              {/* Main visual */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto]">
                <div className="flex items-center justify-center p-4 sm:border-r border-white/[0.06] h-64">
                  {scoreResult.categories
                    ? <RadarChart categories={scoreResult.categories} color={SCORE_COLORS[scoreResult.trust_level]} />
                    : <span className="text-white/20 text-xs font-mono">No category breakdown</span>
                  }
                </div>
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 sm:min-w-[180px]">
                  <HexScore score={scoreResult.score} color={SCORE_COLORS[scoreResult.trust_level]} />
                  <span className="text-sm font-bold font-mono tracking-widest"
                    style={{ color: SCORE_COLORS[scoreResult.trust_level] }}>
                    {scoreResult.trust_level}
                  </span>
                  {scoreResult.rug_risk && (
                    <div className="w-full px-3 py-2 rounded-lg border text-center" style={{
                      borderColor: `${RISK_COLORS[scoreResult.rug_risk]}30`,
                      background:  `${RISK_COLORS[scoreResult.rug_risk]}08`,
                    }}>
                      <div className="text-[9px] font-mono text-white/30 mb-0.5">RUG RISK</div>
                      <div className="font-bold text-sm font-mono" style={{ color: RISK_COLORS[scoreResult.rug_risk] }}>
                        {scoreResult.rug_risk}
                        <span className="text-white/30 font-normal text-[10px] ml-1.5">{scoreResult.rug_risk_score}/100</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {(scoreResult.data_quality === "INSUFFICIENT" || (scoreResult.data_quality === "PARTIAL" && !scoreResult.known_token) || (scoreResult.warning && scoreResult.data_quality !== "INSUFFICIENT")) && (
                <div className="px-4 pb-3 space-y-2 border-t border-white/[0.06] pt-3">
                  {scoreResult.data_quality === "INSUFFICIENT" && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/25">
                      <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-red-400 text-xs font-semibold">Score unverifiable — insufficient on-chain data</p>
                        <p className="text-red-400/60 text-[10px] mt-0.5">Most signals could not be fetched. Treat as HIGH RISK.</p>
                      </div>
                    </div>
                  )}
                  {scoreResult.data_quality === "PARTIAL" && !scoreResult.known_token && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <AlertTriangle size={12} className="text-orange-400 mt-0.5 shrink-0" />
                      <p className="text-orange-400/70 text-xs">Partial data — some signals could not be verified.</p>
                    </div>
                  )}
                  {scoreResult.warning && scoreResult.data_quality !== "INSUFFICIENT" && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
                      <AlertTriangle size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-yellow-400/70 text-xs">{scoreResult.warning}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rug indicators */}
              {scoreResult.rug_indicators?.length > 0 && (
                <div className="px-4 py-3 border-t border-white/[0.06] space-y-1.5">
                  <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">Risk Indicators</p>
                  {scoreResult.rug_indicators.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        f.severity === "critical" ? "bg-[#FF4444]" :
                        f.severity === "high"     ? "bg-[#FF7A2F]" :
                        f.severity === "medium"   ? "bg-[#FFDB2B]" : "bg-white/30"
                      }`} />
                      <p className="text-xs text-white/55">{f.msg}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Signals */}
              <div className="px-4 py-3 border-t border-white/[0.06]">
                {scoreResult.signals?.length ? (
                  <details className="group">
                    <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors select-none">
                      Show all signals ({scoreResult.signals.length}) →
                    </summary>
                    <div className="mt-2 space-y-1">
                      {scoreResult.signals.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded bg-black/30 border border-white/[0.04]">
                          <span className={`text-[9px] mt-0.5 shrink-0 ${s.ok === true ? "text-[#00FF41]" : s.ok === false ? "text-[#FF7A2F]" : "text-white/25"}`}>
                            {s.ok === true ? "✓" : s.ok === false ? "✗" : "–"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-white/60">{s.label}</p>
                            {s.detail && <p className="text-[9px] text-white/30 mt-0.5">{s.detail}</p>}
                          </div>
                          <span className="text-[9px] font-mono text-white/30 shrink-0">{s.earned}/{s.max}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : (
                  <p className="text-[10px] text-white/25 font-mono">No signal breakdown available.</p>
                )}
              </div>
            </motion.div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Badge embed preview — shown after a score is fetched */}
      {scoreResult && mintInput && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassPanel className="p-6" glow="purple">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#B026FF]/15 border border-[#B026FF]/25 flex items-center justify-center">
                <Code2 size={14} className="text-[#B026FF]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Embed This Badge</h2>
                <p className="text-[11px] text-white/35">One line — works in any HTML, README, or token listing</p>
              </div>
              {/* Live badge rendered by the API */}
              <div className="ml-auto shrink-0">
                <img
                  src={`${BASE}/score/${mintInput.trim()}?format=badge`}
                  alt="TrustScore badge"
                  height={20}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {/* HTML snippet */}
              <div>
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">HTML</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.07]">
                  <code className="text-[10px] text-[#00FF41]/80 font-mono flex-1 truncate">
                    {`<img src="${BASE}/score/${mintInput.trim()}?format=badge" alt="TrustScore" />`}
                  </code>
                  <CopyButton text={`<img src="${BASE}/score/${mintInput.trim()}?format=badge" alt="TrustScore" />`} />
                </div>
              </div>
              {/* Markdown snippet */}
              <div>
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">Markdown (GitHub / README)</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.07]">
                  <code className="text-[10px] text-[#B026FF]/80 font-mono flex-1 truncate">
                    {`![TrustScore](${BASE}/score/${mintInput.trim()}?format=badge)`}
                  </code>
                  <CopyButton text={`![TrustScore](${BASE}/score/${mintInput.trim()}?format=badge)`} />
                </div>
              </div>
              {/* JSON endpoint */}
              <div>
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">API (JSON)</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.07]">
                  <code className="text-[10px] text-white/45 font-mono flex-1 truncate">
                    {`curl "${BASE}/score/${mintInput.trim()}"`}
                  </code>
                  <CopyButton text={`curl "${BASE}/score/${mintInput.trim()}"`} />
                </div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}

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
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">

              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full bg-[#B026FF]/20 border border-[#B026FF]/30 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-mono text-[#B026FF] font-bold">W</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm font-mono truncate">
                    {walletInput.slice(0, 8)}…{walletInput.slice(-6)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[9px] font-mono text-white/30">via {riskResult.launches.platform ?? "humbletrust"}</span>
                    {riskResult.verified_issuer && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41]">✓ VERIFIED ISSUER</span>
                    )}
                  </div>
                </div>
                {riskResult.data_quality && (
                  <span className="text-[9px] font-mono px-2 py-1 rounded border shrink-0" style={{
                    borderColor: riskResult.data_quality === "FULL" ? "#00FF4130" : riskResult.data_quality === "PARTIAL" ? "#FF7A2F30" : "#FF444430",
                    color:       riskResult.data_quality === "FULL" ? "#00FF41"   : riskResult.data_quality === "PARTIAL" ? "#FF7A2F"   : "#FF4444",
                    background:  riskResult.data_quality === "FULL" ? "#00FF4108" : riskResult.data_quality === "PARTIAL" ? "#FF7A2F08" : "#FF444408",
                  }}>{riskResult.data_quality}</span>
                )}
              </div>

              {/* Main visual: bars + score ring */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto]">
                <div className="flex items-center px-5 py-5 sm:border-r border-white/[0.06]">
                  <ReputationChart risk={riskResult} color={RISK_COLORS[riskResult.risk_level]} />
                </div>
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 sm:min-w-[180px]">
                  <HexScore score={riskResult.reputation_score} color={RISK_COLORS[riskResult.risk_level]} />
                  <span className="text-sm font-bold font-mono tracking-widest"
                    style={{ color: RISK_COLORS[riskResult.risk_level] }}>
                    {riskResult.risk_level} RISK
                  </span>
                  <div className="w-full grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Launches", val: riskResult.launches.total },
                      { label: "Graduated", val: riskResult.launches.graduated },
                    ].map(({ label, val }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <div className="text-sm font-bold text-white font-mono">{val}</div>
                        <div className="text-[9px] text-white/30">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* INSUFFICIENT warning */}
              {riskResult.data_quality === "INSUFFICIENT" && (
                <div className="px-4 py-3 border-t border-white/[0.06]">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/25">
                    <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-400 text-xs font-semibold">Unverified wallet — no HumbleTrust launch history</p>
                      <p className="text-red-400/60 text-[10px] mt-0.5">Score based on zero launches. Creator risk unknown — proceed with caution.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Flags */}
              {riskResult.flags.length > 0 && (
                <div className="px-4 py-3 border-t border-white/[0.06] space-y-1.5">
                  <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">Risk Flags</p>
                  {riskResult.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        f.severity === "warning" || f.severity === "high" ? "bg-[#FF7A2F]" :
                        f.severity === "critical" ? "bg-[#FF4444]" :
                        f.severity === "info"     ? "bg-[#00FF41]" : "bg-[#FFDB2B]"
                      }`} />
                      <p className="text-xs text-white/55">{f.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent launches (collapsible) */}
              {riskResult.launches.recent?.length > 0 && (
                <div className="px-4 py-3 border-t border-white/[0.06]">
                  <details>
                    <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors select-none">
                      Recent launches ({riskResult.launches.recent.length}) →
                    </summary>
                    <div className="mt-2 space-y-1">
                      {riskResult.launches.recent.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-black/30 border border-white/[0.04]">
                          <span className="text-[9px] font-mono text-white/30 shrink-0">{t.trust_score}</span>
                          <span className="text-[10px] text-white/60 truncate flex-1">{t.name ?? t.mint.slice(0, 8) + "…"}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded text-white/30 bg-white/5">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </motion.div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Code Examples */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-bold text-white">Code Examples</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              {([
                { id: "js",   label: "JS" },
                { id: "react", label: "React" },
                { id: "py",   label: "Python" },
                { id: "curl", label: "cURL" },
              ] as const).map(({ id, label }) => (
                <button key={id}
                  onClick={() => setActiveCode(id)}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    activeCode === id ? "bg-[#00FF41] text-black font-bold" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <pre className="p-4 rounded-xl bg-black/50 border border-white/[0.07] text-xs text-white/60 font-mono overflow-auto leading-relaxed max-h-64">
              {activeCode === "js" ? CODE_JS : activeCode === "react" ? CODE_REACT : activeCode === "py" ? CODE_PY : CODE_CURL}
            </pre>
            <CopyButton text={activeCode === "js" ? CODE_JS : activeCode === "react" ? CODE_REACT : activeCode === "py" ? CODE_PY : CODE_CURL} />
          </div>
        </GlassPanel>
      </motion.div>

      {/* Platform integration mockups */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-white">Works Everywhere</h2>
            <p className="text-xs text-white/35 mt-1">One API — any platform. Drop into your existing stack in minutes.</p>
          </div>

          <div className="space-y-4">
            {/* DEX Aggregator mockup */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                <Search size={10} className="text-white/25" />
                <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">DEX Aggregator  ·  Jupiter / DexScreener style</span>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { name: "JUP", full: "Jupiter", price: "$0.782", chg: "+3.4%", score: 91, level: "ELITE" },
                  { name: "WIF", full: "dogwifhat", price: "$2.14", chg: "-1.2%", score: 72, level: "OK" },
                  { name: "???", full: "New Token", price: "$0.00041", chg: "+218%", score: 27, level: "WEAK" },
                ].map(({ name, full, price, chg, score, level }) => {
                  const c = SCORE_COLORS[level] || "#888";
                  const pos = chg.startsWith("+");
                  return (
                    <div key={name} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <HexAvatar label={name} size={24} color={c} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-white">{name}</span>
                        <span className="text-[10px] text-white/35 ml-1.5">{full}</span>
                      </div>
                      <span className="text-[11px] font-mono text-white/70">{price}</span>
                      <span className={`text-[10px] font-mono w-12 text-right ${pos ? "text-[#00FF41]" : "text-[#FF7A2F]"}`}>{chg}</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ color: c, background: `${c}18`, border: `1px solid ${c}30` }}>
                        {level} {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wallet extension mockup */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                <Shield size={10} className="text-white/25" />
                <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Wallet Extension  ·  Phantom / Backpack style</span>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { sym: "SOL",  name: "Solana",    bal: "12.5",  usd: "$1,562", score: 97, level: "ELITE" },
                  { sym: "USDC", name: "USD Coin",  bal: "420.0", usd: "$420",   score: 95, level: "ELITE" },
                  { sym: "BONK", name: "Bonk",      bal: "2.4M",  usd: "$36",    score: 65, level: "OK"    },
                ].map(({ sym, name, bal, usd, score, level }) => {
                  const c = SCORE_COLORS[level] || "#888";
                  return (
                    <div key={sym} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <HexAvatar label={sym} size={28} color={SCORE_COLORS[level]} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-white">{sym}</span>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: c, background: `${c}15` }}>
                            <Shield size={7} style={{ display: "inline", marginRight: 2 }} />{score}
                          </span>
                        </div>
                        <span className="text-[9px] text-white/30">{name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-white/70 font-mono">{bal}</p>
                        <p className="text-[9px] text-white/30 font-mono">{usd}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trading bot / Discord alert mockup */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                <TrendingUp size={10} className="text-white/25" />
                <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Trading Bot / Discord Alert</span>
              </div>
              <div className="p-3 font-mono text-[11px] space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-white/20">$</span>
                  <span className="text-[#00FF41]/70">GET /api/score/DezXAZ8z7Pnrn...</span>
                </div>
                <div className="flex gap-2 pl-3">
                  <span className="text-white/20">→</span>
                  <span className="text-white/50">score: <span className="text-[#00FF41] font-bold">65</span>  trust_level: <span className="text-[#FFDB2B]">"OK"</span>  rug_risk: <span className="text-[#00FF41]">"LOW"</span></span>
                </div>
                <div className="flex gap-2 pl-3">
                  <span className="text-white/20">→</span>
                  <span className="text-[#00FF41]/70">✓ Score ≥ 60 and rug_risk LOW — placing buy order…</span>
                </div>
                <div className="mt-2 h-px bg-white/[0.05]" />
                <div className="flex gap-2">
                  <span className="text-white/20">$</span>
                  <span className="text-[#00FF41]/70">GET /api/score/FGQ16c5cmDkm...</span>
                </div>
                <div className="flex gap-2 pl-3">
                  <span className="text-white/20">→</span>
                  <span className="text-white/50">score: <span className="text-[#FF4444] font-bold">22</span>  trust_level: <span className="text-[#FF4444]">"DANGER"</span>  rug_risk: <span className="text-[#FF4444]">"CRITICAL"</span></span>
                </div>
                <div className="flex gap-2 pl-3">
                  <span className="text-white/20">→</span>
                  <span className="text-[#FF7A2F]/80">⚠ SKIP — score below threshold, high rug risk</span>
                </div>
              </div>
            </div>
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
