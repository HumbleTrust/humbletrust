import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Lock,
  Activity,
  Clock,
  User,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreFactor {
  label: string;
  score: number;
  max: 100;
  icon: React.ElementType;
}

interface AssetProfile {
  id: "safe" | "risky";
  label: string;
  score: number;
  fraudRisk: string;
  statusMessage: string;
  statusOk: boolean;
  factors: ScoreFactor[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ASSETS: Record<"safe" | "risky", AssetProfile> = {
  safe: {
    id: "safe",
    label: "Safe Asset",
    score: 84,
    fraudRisk: "LOW",
    statusMessage:
      "VERIFIED — This asset passed all fraud prevention checks.",
    statusOk: true,
    factors: [
      { label: "Liquidity Locked", score: 95, max: 100, icon: Lock },
      { label: "Creator Allocation", score: 88, max: 100, icon: User },
      { label: "Vesting Schedule", score: 90, max: 100, icon: Clock },
      { label: "Trade Pattern", score: 75, max: 100, icon: Activity },
      { label: "Creator History", score: 82, max: 100, icon: TrendingUp },
      { label: "Smart Contract Audit", score: 80, max: 100, icon: Cpu },
    ],
  },
  risky: {
    id: "risky",
    label: "High Risk",
    score: 21,
    fraudRisk: "CRITICAL",
    statusMessage:
      "HIGH RISK — Multiple fraud indicators detected. Exercise extreme caution.",
    statusOk: false,
    factors: [
      { label: "Liquidity Locked", score: 0, max: 100, icon: Lock },
      { label: "Creator Allocation", score: 15, max: 100, icon: User },
      { label: "Vesting Schedule", score: 0, max: 100, icon: Clock },
      { label: "Trade Pattern", score: 45, max: 100, icon: Activity },
      { label: "Creator History", score: 12, max: 100, icon: TrendingUp },
      { label: "Smart Contract Audit", score: 55, max: 100, icon: Cpu },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return "#00FF41";
  if (score >= 40) return "#FFDB2B";
  return "#FF4444";
}

function riskLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "LOW", color: "#00FF41" };
  if (score >= 40) return { label: "MODERATE", color: "#FFDB2B" };
  if (score >= 25) return { label: "HIGH", color: "#FF6B35" };
  return { label: "CRITICAL", color: "#FF4444" };
}

function factorStatus(score: number): {
  icon: React.ElementType;
  color: string;
  label: string;
} {
  if (score >= 70)
    return { icon: CheckCircle2, color: "#00FF41", label: "PASS" };
  if (score >= 40)
    return { icon: AlertTriangle, color: "#FFDB2B", label: "WARN" };
  return { icon: XCircle, color: "#FF4444", label: "FAIL" };
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────

const GAUGE_SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// We use 270° arc (3/4 of circle), starting from bottom-left
const ARC_FRACTION = 0.75;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

interface CircularGaugeProps {
  score: number;
  animatedScore: number;
}

function CircularGauge({ score, animatedScore }: CircularGaugeProps) {
  const color = scoreColor(score);
  const animColor = scoreColor(animatedScore);
  const fillFraction = (animatedScore / 100) * ARC_FRACTION;
  const fillLength = CIRCUMFERENCE * fillFraction;
  const risk = riskLabel(score);

  // SVG: arc starts at 225° (bottom-left), goes clockwise 270°
  // transform rotates the SVG so the arc begins at bottom-left
  const rotation = 135; // degrees — positions start of arc at bottom-left

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
        <svg
          width={GAUGE_SIZE}
          height={GAUGE_SIZE}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Track */}
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#1A2332"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          />
          {/* Fill */}
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={animColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
            style={{
              filter: `drop-shadow(0 0 8px ${animColor}80)`,
              transition: "stroke 0.3s ease",
            }}
          />
        </svg>

        {/* Center content — absolutely positioned over SVG */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingBottom: 10 }}
        >
          <span
            className="font-mono font-black leading-none"
            style={{
              fontSize: 56,
              color: animColor,
              textShadow: `0 0 24px ${animColor}60`,
              fontFamily: "'JetBrains Mono', monospace",
              transition: "color 0.3s ease",
            }}
          >
            {Math.round(animatedScore)}
          </span>
          <span
            className="uppercase tracking-widest font-mono"
            style={{
              fontSize: 10,
              color: "#64748B",
              letterSpacing: "0.2em",
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: 4,
            }}
          >
            TRUST SCORE
          </span>
        </div>
      </div>

      {/* Risk label */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 rounded-full border"
        style={{
          borderColor: risk.color + "40",
          backgroundColor: risk.color + "12",
        }}
      >
        <span
          className="font-mono font-bold tracking-widest uppercase"
          style={{
            fontSize: 11,
            color: "#64748B",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          FRAUD RISK:
        </span>
        <span
          className="font-mono font-black tracking-widest uppercase"
          style={{
            fontSize: 11,
            color: risk.color,
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: `0 0 8px ${risk.color}60`,
          }}
        >
          {risk.label}
        </span>
      </div>
    </div>
  );
}

// ─── Factor Row ───────────────────────────────────────────────────────────────

interface FactorRowProps {
  factor: ScoreFactor;
  index: number;
  visible: boolean;
}

function FactorRow({ factor, index, visible }: FactorRowProps) {
  const status = factorStatus(factor.score);
  const barColor = scoreColor(factor.score);
  const StatusIcon = status.icon;
  const FactorIcon = factor.icon;
  const pct = factor.score;

  return (
    <div
      className="flex flex-col gap-1"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(12px)",
        transition: `opacity 0.35s ease ${index * 60}ms, transform 0.35s ease ${index * 60}ms`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FactorIcon
            size={13}
            style={{ color: "#64748B", flexShrink: 0 }}
          />
          <span
            className="font-mono uppercase tracking-wide"
            style={{
              fontSize: 11,
              color: "#94A3B8",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            {factor.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-bold"
            style={{
              fontSize: 12,
              color: barColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {factor.score}
            <span style={{ color: "#334155", fontWeight: 400 }}>/100</span>
          </span>
          <StatusIcon size={13} style={{ color: status.color }} />
        </div>
      </div>
      {/* Bar track */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 4, backgroundColor: "#1A2332" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: visible ? `${pct}%` : "0%",
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}50`,
            transition: `width 0.6s cubic-bezier(0.4,0,0.2,1) ${
              index * 60 + 100
            }ms`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrustScoreDemo() {
  const [activeAsset, setActiveAsset] = useState<"safe" | "risky">("safe");
  const [animatedScore, setAnimatedScore] = useState(0);
  const [factorsVisible, setFactorsVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startScoreRef = useRef(0);

  const asset = ASSETS[activeAsset];
  const targetScore = asset.score;

  // Animate score gauge
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    setFactorsVisible(false);

    const from = animatedScore;
    const to = targetScore;
    startScoreRef.current = from;
    startTimeRef.current = null;
    const DURATION = 900; // ms

    function tick(timestamp: number) {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setAnimatedScore(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAnimatedScore(to);
        // Show factors after gauge animation completes
        setTimeout(() => setFactorsVisible(true), 80);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAsset]);

  const color = scoreColor(targetScore);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #050A0E 0%, #0A0F14 100%)",
        border: "1px solid #1A2332",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        maxWidth: 780,
        margin: "0 auto",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid #1A2332" }}
      >
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1.5 px-3 py-1 rounded-full font-mono uppercase tracking-wider"
            style={{
              fontSize: 10,
              backgroundColor: "#0F1923",
              border: "1px solid #1A2332",
              color: "#00FF41",
              letterSpacing: "0.12em",
            }}
          >
            <ShieldCheck size={11} color="#00FF41" />
            Financial Security &amp; Fraud Prevention
          </span>
          <span
            className="flex items-center gap-1.5 px-3 py-1 rounded-full font-mono uppercase tracking-wider"
            style={{
              fontSize: 10,
              backgroundColor: "#0F1923",
              border: "1px solid #1A2332",
              color: "#64748B",
              letterSpacing: "0.12em",
            }}
          >
            <Cpu size={11} color="#64748B" />
            Powered by AWS
          </span>
        </div>

        {/* Toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid #1A2332" }}
        >
          {(["safe", "risky"] as const).map((key) => {
            const isActive = activeAsset === key;
            const accentColor = key === "safe" ? "#00FF41" : "#FF4444";
            return (
              <button
                key={key}
                onClick={() => setActiveAsset(key)}
                className="flex items-center gap-2 px-4 py-2 font-mono uppercase tracking-wider transition-all duration-200"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  backgroundColor: isActive
                    ? accentColor + "18"
                    : "transparent",
                  color: isActive ? accentColor : "#64748B",
                  borderRight: key === "safe" ? "1px solid #1A2332" : undefined,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {key === "safe" ? (
                  <ShieldCheck size={13} />
                ) : (
                  <ShieldAlert size={13} />
                )}
                {key === "safe" ? "Safe Asset" : "High Risk"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-0">
        {/* Left — Gauge */}
        <div
          className="flex flex-col items-center justify-center px-6 py-8"
          style={{
            minWidth: 260,
            borderRight: "1px solid #1A2332",
          }}
        >
          <CircularGauge score={targetScore} animatedScore={animatedScore} />

          {/* Divider */}
          <div
            className="w-full mt-6 mb-4"
            style={{ height: 1, backgroundColor: "#1A2332" }}
          />

          {/* Mini stats */}
          <div className="w-full flex flex-col gap-2">
            {[
              { label: "Score Range", value: "0 – 100" },
              { label: "Factors", value: "6 indicators" },
              { label: "Updated", value: "Real-time" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between"
              >
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em" }}
                >
                  {label}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: "#64748B" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Breakdown */}
        <div className="flex-1 px-6 py-6 flex flex-col gap-4">
          {/* Section label */}
          <div className="flex items-center gap-3">
            <span
              className="font-mono uppercase tracking-widest"
              style={{
                fontSize: 10,
                color: "#334155",
                letterSpacing: "0.2em",
              }}
            >
              Risk Factor Breakdown
            </span>
            <div className="flex-1" style={{ height: 1, backgroundColor: "#1A2332" }} />
          </div>

          {/* Factors list */}
          <div className="flex flex-col gap-3.5">
            {asset.factors.map((factor, i) => (
              <FactorRow
                key={`${activeAsset}-${factor.label}`}
                factor={factor}
                index={i}
                visible={factorsVisible}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-1">
            {[
              { color: "#00FF41", label: "PASS  ≥70" },
              { color: "#FFDB2B", label: "WARN  40–69" },
              { color: "#FF4444", label: "FAIL  <40" },
            ].map(({ color: c, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: c }}
                />
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{
          borderTop: "1px solid #1A2332",
          backgroundColor: asset.statusOk ? "#00FF4108" : "#FF444408",
        }}
      >
        {asset.statusOk ? (
          <CheckCircle2 size={16} color="#00FF41" style={{ flexShrink: 0 }} />
        ) : (
          <ShieldAlert size={16} color="#FF4444" style={{ flexShrink: 0 }} />
        )}
        <span
          className="font-mono uppercase tracking-wide"
          style={{
            fontSize: 11,
            color: asset.statusOk ? "#00FF41" : "#FF4444",
            letterSpacing: "0.08em",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {asset.statusMessage}
        </span>
        {/* Score pill aligned right */}
        <div className="flex-1" />
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full font-mono font-bold"
          style={{
            fontSize: 11,
            backgroundColor: color + "14",
            border: `1px solid ${color}30`,
            color: color,
          }}
        >
          <span style={{ color: "#64748B", fontWeight: 400 }}>TrustScore™</span>
          <span>{targetScore}/100</span>
        </div>
      </div>
    </div>
  );
}
