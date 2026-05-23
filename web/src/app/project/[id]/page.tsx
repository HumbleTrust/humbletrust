"use client";

import { use, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TrustScoreMeter } from "@/components/ui/TrustScoreMeter";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { ScoreBreakdownBar } from "@/components/ui/ScoreBreakdownBar";
import { LockCountdown } from "@/components/ui/LockCountdown";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useProject } from "@/hooks/useProjects";
import {
  formatSol,
  formatNumber,
  truncateAddress,
  scoreColor,
} from "@/lib/utils";
import { calculateTrustScore } from "@/lib/trustScore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUnlockDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function isLockExpired(isoString: string | null | undefined): boolean {
  if (!isoString) return true;
  return new Date(isoString).getTime() < Date.now();
}

function getStatusChip(status: string) {
  switch (status.toLowerCase()) {
    case "live":
      return { label: "LIVE", bg: "rgba(0,255,178,0.12)", color: "#00FFB2", border: "rgba(0,255,178,0.3)" };
    case "locked":
      return { label: "LOCKED", bg: "rgba(255,184,0,0.12)", color: "#FFB800", border: "rgba(255,184,0,0.3)" };
    case "completed":
      return { label: "COMPLETED", bg: "rgba(61,127,255,0.12)", color: "#3D7FFF", border: "rgba(61,127,255,0.3)" };
    default:
      return { label: status.toUpperCase(), bg: "rgba(136,150,179,0.12)", color: "#8896B3", border: "rgba(136,150,179,0.3)" };
  }
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: copied ? "var(--primary)" : "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 4px",
        borderRadius: 4,
        transition: "color 0.15s",
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
}

function Card({ children, style, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "1.5rem",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: "1.25rem",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({ w = "100%", h = 16, br = 6 }: { w?: string | number; h?: number; br?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: br,
        background: "var(--bg-elevated)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function PageSkeleton() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar />
      <div style={{ paddingTop: 80 }}>
        {/* Sticky header skeleton */}
        <div
          style={{
            height: 70,
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 16,
          }}
        >
          <SkeletonBlock w={44} h={44} br={22} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBlock w={140} h={16} />
            <SkeletonBlock w={60} h={11} />
          </div>
          <SkeletonBlock w={70} h={28} br={20} />
          <SkeletonBlock w={55} h={24} br={6} />
        </div>
        {/* Content skeleton */}
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "2rem 24px",
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "1.5rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {[220, 180, 160, 130, 120].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  borderRadius: 16,
                  background: "var(--bg-surface)",
                  animation: "skeleton-pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {[280, 180].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  borderRadius: 16,
                  background: "var(--bg-surface)",
                  animation: "skeleton-pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 state
// ---------------------------------------------------------------------------

function NotFoundState() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar />
      <div
        style={{
          paddingTop: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          padding: "140px 24px 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle size={32} color="var(--danger)" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-geist)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Project Not Found
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 400 }}>
          This project does not exist or has been removed from the registry.
        </p>
        <Link
          href="/app"
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            transition: "border-color 0.15s",
          }}
        >
          <ArrowLeft size={15} />
          Back to Projects
        </Link>
      </div>
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar (invest panel)
// ---------------------------------------------------------------------------

function ProgressBar({ value, max, color = "var(--primary)" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(max > 0 ? (value / max) * 100 : 0, 100);
  return (
    <div style={{ height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: "100%", background: color, borderRadius: 3, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading, error } = useProject(id);
  const [solInput, setSolInput] = useState("");

  if (isLoading) return <PageSkeleton />;
  if (error || !project) return <NotFoundState />;

  const scoreResult = calculateTrustScore(project);
  const { breakdown } = scoreResult;
  const color = scoreColor(project.trustScore);
  const statusChip = getStatusChip(project.status);
  const lockExpired = isLockExpired(project.lockUnlockAt);
  const unlockDateStr = formatUnlockDate(project.lockUnlockAt);
  const supply = Number(project.totalSupply) / Math.pow(10, project.decimals);
  const investGoal = Math.ceil(project.totalInvestedSol * 1.4 / 100) * 100 || 5000;
  const progressPct = Math.min((project.totalInvestedSol / investGoal) * 100, 100);
  const logoLetter = project.name.charAt(0).toUpperCase();

  // Vesting milestones
  const launchDate = new Date(project.createdAt);
  const vestingMilestones = [
    { label: "Day 0", sublabel: "Launch", date: launchDate, pct: "Locked" },
    {
      label: "Day 30",
      sublabel: "+2% unlock",
      date: new Date(launchDate.getTime() + 30 * 86400000),
      pct: "2%",
    },
    {
      label: "Day 60",
      sublabel: "+3% unlock",
      date: new Date(launchDate.getTime() + 60 * 86400000),
      pct: "3%",
    },
    {
      label: "Day 90",
      sublabel: "+5% unlock",
      date: new Date(launchDate.getTime() + 90 * 86400000),
      pct: "5%",
    },
  ];

  const breakdownFactors = [
    { label: "Liquidity Present", points: breakdown.liquidityPresent, max: 20 },
    { label: "Lock Duration", points: breakdown.lockDuration, max: 20 },
    { label: "Mint Revoked", points: breakdown.mintRevoked, max: 20 },
    { label: "Freeze Revoked", points: breakdown.freezeRevoked, max: 10 },
    { label: "Vesting", points: breakdown.vestingEnabled, max: 10 },
    { label: "Creator Allocation", points: breakdown.allocation, max: 5 },
    { label: "Age Bonus", points: breakdown.age, max: 15 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar />

      {/* Sticky project header */}
      <div
        style={{
          position: "sticky",
          top: 64,
          zIndex: 40,
          height: 70,
          background: "rgba(10,15,26,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 14,
        }}
      >
        <Link
          href="/app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "var(--text-muted)",
            textDecoration: "none",
            marginRight: 4,
            transition: "color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft size={18} />
        </Link>

        {/* Logo circle */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}30, ${color}10)`,
            border: `1.5px solid ${color}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-geist)",
            fontWeight: 700,
            fontSize: 16,
            color: color,
            flexShrink: 0,
          }}
        >
          {logoLetter}
        </div>

        {/* Name + symbol */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-geist)",
              fontWeight: 700,
              fontSize: 17,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {project.name}
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
            }}
          >
            {project.symbol}
          </div>
        </div>

        {/* TrustBadge */}
        <TrustBadge score={project.trustScore} />

        {/* Status chip */}
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            background: statusChip.bg,
            border: `1px solid ${statusChip.border}`,
            color: statusChip.color,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: statusChip.color,
              display: "inline-block",
              boxShadow: `0 0 5px ${statusChip.color}`,
              animation: project.status.toLowerCase() === "live" ? "pulse-glow 2s ease-in-out infinite" : "none",
            }}
          />
          {statusChip.label}
        </span>
      </div>

      {/* Main content area */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "2rem 24px 4rem",
        }}
      >
        {/* Project description banner */}
        {project.description && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              marginBottom: "1.5rem",
              padding: "1rem 1.25rem",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.65,
            }}
          >
            {project.description}
          </motion.div>
        )}

        {/* Two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "1.5rem",
            alignItems: "start",
          }}
          className="project-layout"
        >
          {/* ============================================================
              LEFT COLUMN
          ============================================================ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ---- TrustScore Breakdown ---- */}
            <Card delay={0.05}>
              <CardTitle>Trust Score</CardTitle>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
                <TrustScoreMeter score={project.trustScore} size="lg" animated />
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "1rem",
                }}
              >
                Score Breakdown
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {breakdownFactors.map((f) => (
                  <ScoreBreakdownBar
                    key={f.label}
                    label={f.label}
                    points={f.points}
                    maxPoints={f.max}
                    score={project.trustScore}
                  />
                ))}
              </div>

              {/* Total row */}
              <div
                style={{
                  marginTop: "1.25rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                  Total Score
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 20,
                    fontWeight: 700,
                    color: color,
                    textShadow: `0 0 12px ${color}60`,
                  }}
                >
                  {project.trustScore}/100
                </span>
              </div>
            </Card>

            {/* ---- Lock Status ---- */}
            <Card delay={0.1}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.25rem" }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: lockExpired ? "rgba(255,68,68,0.12)" : "rgba(0,255,178,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Lock size={14} color={lockExpired ? "var(--danger)" : "var(--primary)"} />
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Liquidity Lock
                </span>
              </div>

              {lockExpired ? (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: 10,
                    background: "rgba(255,68,68,0.08)",
                    border: "1px solid rgba(255,68,68,0.2)",
                    color: "var(--danger)",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={15} />
                  Lock expired — liquidity may be withdrawn
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                      Time until unlock
                    </div>
                    <LockCountdown unlockAt={project.lockUnlockAt} />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                        Unlock date
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          color: "var(--text-primary)",
                          fontWeight: 600,
                        }}
                      >
                        {unlockDateStr}
                      </div>
                    </div>
                    <a
                      href={`https://solscan.io/account/${project.mintAddress}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "var(--primary)",
                        textDecoration: "none",
                        fontFamily: "var(--font-mono)",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    >
                      Verified on-chain
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}
            </Card>

            {/* ---- Vesting Schedule ---- */}
            <Card delay={0.15}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <CardTitle>Creator Vesting</CardTitle>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    background: project.vestingEnabled ? "rgba(0,255,178,0.1)" : "rgba(255,68,68,0.1)",
                    color: project.vestingEnabled ? "var(--primary)" : "var(--danger)",
                    border: `1px solid ${project.vestingEnabled ? "rgba(0,255,178,0.25)" : "rgba(255,68,68,0.25)"}`,
                  }}
                >
                  {project.vestingEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              {!project.vestingEnabled && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: 10,
                    background: "rgba(255,184,0,0.07)",
                    border: "1px solid rgba(255,184,0,0.2)",
                    color: "#FFB800",
                    fontSize: 13,
                    marginBottom: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={14} />
                  No vesting schedule — creator tokens are fully liquid at launch
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {vestingMilestones.map((m, i) => {
                  const passed = Date.now() > m.date.getTime();
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0.7rem 0.9rem",
                        borderRadius: 10,
                        background: passed ? "rgba(0,255,178,0.04)" : "var(--bg-elevated)",
                        border: `1px solid ${passed ? "rgba(0,255,178,0.15)" : "var(--border-subtle)"}`,
                        opacity: project.vestingEnabled ? 1 : 0.5,
                      }}
                    >
                      {/* Status circle */}
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: passed && project.vestingEnabled
                            ? "rgba(0,255,178,0.2)"
                            : "var(--bg-base)",
                          border: `1.5px solid ${passed && project.vestingEnabled ? "var(--primary)" : "var(--border-focus)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {passed && project.vestingEnabled && (
                          <Check size={11} color="var(--primary)" strokeWidth={2.5} />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: passed && project.vestingEnabled ? "var(--text-primary)" : "var(--text-secondary)",
                          }}
                        >
                          {m.label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {m.sublabel} &mdash; {m.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>

                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          fontWeight: 700,
                          color: passed && project.vestingEnabled ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {m.pct}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ---- Creator Info ---- */}
            <Card delay={0.2}>
              <CardTitle>Creator Info</CardTitle>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {/* Wallet row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                      Wallet Address
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                    >
                      {truncateAddress(project.creatorWallet, 6)}
                    </div>
                  </div>
                  <CopyButton value={project.creatorWallet} />
                </div>

                {/* Activity row */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: "0.75rem 1rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                      Suspicious Activities
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--primary)",
                      }}
                    >
                      <ShieldCheck size={15} color="var(--primary)" />
                      0 detected
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      padding: "0.75rem 1rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                      Projects Launched
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      1
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ---- On-chain Verification ---- */}
            <Card delay={0.25}>
              <CardTitle>On-chain Verification</CardTitle>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {[
                  {
                    label: "Mint Address",
                    value: project.mintAddress,
                    href: `https://solscan.io/token/${project.mintAddress}?cluster=devnet`,
                  },
                  {
                    label: "Program ID",
                    value: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    href: `https://solscan.io/account/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA?cluster=devnet`,
                  },
                  {
                    label: "Network",
                    value: "Devnet",
                    href: null,
                    isStatic: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.isStatic
                          ? item.value
                          : truncateAddress(item.value, 8)}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {!item.isStatic && <CopyButton value={item.value} />}
                      {item.href && (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--text-muted)",
                            transition: "color 0.15s",
                            padding: "2px 4px",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--primary)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {item.isStatic && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "rgba(61,127,255,0.12)",
                            border: "1px solid rgba(61,127,255,0.25)",
                            color: "var(--secondary)",
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                          }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ============================================================
              RIGHT COLUMN
          ============================================================ */}
          <div
            style={{
              position: "sticky",
              top: 150,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* ---- Invest Panel ---- */}
            <Card delay={0.07}>
              <CardTitle>Invest</CardTitle>

              {/* Token price row */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                  Token Price
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    ◎ 0.0001
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      color: "#00FFB2",
                      fontWeight: 600,
                      background: "rgba(0,255,178,0.1)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: "1px solid rgba(0,255,178,0.2)",
                    }}
                  >
                    +12.4%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  24h change
                </div>
              </div>

              {/* Total raised progress */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 7,
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total Raised</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {progressPct.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={project.totalInvestedSol} max={investGoal} color="var(--primary)" />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                    <AnimatedNumber value={project.totalInvestedSol} prefix="◎ " decimals={0} />
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    ◎ {formatNumber(investGoal)} goal
                  </span>
                </div>
              </div>

              {/* SOL input */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                  Amount (SOL)
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={solInput}
                    onChange={(e) => setSolInput(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: "10px 56px 10px 14px",
                      fontSize: 15,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)",
                      outline: "none",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
                  />
                  <button
                    onClick={() => setSolInput(String(project.totalInvestedSol * 0.01))}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(0,255,178,0.1)",
                      border: "1px solid rgba(0,255,178,0.2)",
                      borderRadius: 6,
                      color: "var(--primary)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      padding: "3px 8px",
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                    }}
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Invest button */}
              <button
                disabled
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "var(--font-inter)",
                  cursor: "not-allowed",
                  opacity: 0.7,
                }}
              >
                Connect Wallet to Invest
              </button>

              {/* Your Position */}
              <div
                style={{
                  marginTop: "1.1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.75rem",
                  }}
                >
                  Your Position
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Tokens held</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      0 {project.symbol}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>SOL invested</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      ◎ 0
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ---- Quick Stats ---- */}
            <Card delay={0.12}>
              <CardTitle>Quick Stats</CardTitle>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[
                  {
                    icon: <Users size={14} color="var(--secondary)" />,
                    label: "Holders",
                    value: formatNumber(project.holderCount),
                  },
                  {
                    icon: <BarChart3 size={14} color="var(--accent)" />,
                    label: "Total Supply",
                    value: formatNumber(Number(project.totalSupply) / Math.pow(10, project.decimals)),
                  },
                  {
                    icon: <TrendingUp size={14} color="var(--primary)" />,
                    label: "Market Cap",
                    value: formatSol(
                      (Number(project.totalSupply) / Math.pow(10, project.decimals)) * 0.0001,
                      0
                    ),
                  },
                  {
                    icon: (
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: "linear-gradient(135deg, var(--secondary), var(--accent))",
                          flexShrink: 0,
                        }}
                      />
                    ),
                    label: "DEX",
                    value: project.dex.charAt(0).toUpperCase() + project.dex.slice(1),
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.65rem 0.85rem",
                      background: "var(--bg-elevated)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {stat.icon}
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{stat.label}</span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Footer />

      {/* Responsive styles */}
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] { -moz-appearance: textfield; }
        input::placeholder { color: var(--text-muted); }
        @media (max-width: 768px) {
          .project-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
