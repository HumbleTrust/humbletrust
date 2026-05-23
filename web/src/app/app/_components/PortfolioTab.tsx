"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, Package, ArrowUpRight } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { MOCK_PROJECTS } from "@/lib/mockData";
import { scoreColor } from "@/lib/utils";

// ─── Mock portfolio data ──────────────────────────────────────────────────────

const MOCK_INVESTMENTS = [
  { project: MOCK_PROJECTS[0], invested: 12.5, current: 18.2, tokens: 125000 },
  { project: MOCK_PROJECTS[2], invested: 5.0, current: 7.4, tokens: 50000 },
  { project: MOCK_PROJECTS[5], invested: 3.2, current: 2.9, tokens: 32000 },
];

const MOCK_LAUNCHES = [
  {
    name: "MyToken",
    symbol: "MTK",
    trustScore: 78,
    totalInvestedSol: 45,
    holderCount: 134,
    status: "live",
    createdAt: "2025-04-10T10:00:00Z",
  },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  prefix = "◎ ",
  color,
  sub,
  delay = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  color?: string;
  sub?: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: color ?? "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        <AnimatedNumber value={value} prefix={prefix} decimals={2} />
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
    </motion.div>
  );
}

// ─── Holdings table ───────────────────────────────────────────────────────────

function HoldingsTable() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const bgColors = ["#9945FF", "#14F195", "#00D4FF", "#FF3C6B", "#FFB800", "#3D7FFF"];

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--bg-elevated)",
  };

  const tdStyle = (align: "left" | "right" = "left"): React.CSSProperties => ({
    padding: "14px 16px",
    fontSize: 14,
    textAlign: align,
    borderBottom: "1px solid var(--border-subtle)",
  });

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Token</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Trust</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Invested</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
            <th style={{ ...thStyle, textAlign: "right" }}>P&L</th>
            <th style={{ ...thStyle, textAlign: "center" }}></th>
          </tr>
        </thead>
        <tbody>
          {MOCK_INVESTMENTS.map(({ project, invested, current, tokens }, idx) => {
            const pnl = current - invested;
            const pnlPct = (pnl / invested) * 100;
            const isUp = pnl >= 0;
            const isHovered = hoveredRow === idx;
            const colorIndex = project.name.charCodeAt(0) % bgColors.length;

            return (
              <tr
                key={project.id}
                style={{
                  background: isHovered ? "rgba(255,255,255,0.025)" : "transparent",
                  transition: "background 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Token */}
                <td style={tdStyle()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: bgColors[colorIndex],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {project.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontSize: 14,
                        }}
                      >
                        {project.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {tokens.toLocaleString()} ${project.symbol}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Trust */}
                <td style={{ ...tdStyle("right") }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <TrustBadge score={project.trustScore} showLabel={false} />
                  </div>
                </td>

                {/* Invested */}
                <td
                  style={{
                    ...tdStyle("right"),
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ◎ {invested.toFixed(2)}
                </td>

                {/* Current value */}
                <td
                  style={{
                    ...tdStyle("right"),
                    color: "var(--primary)",
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ◎ {current.toFixed(2)}
                </td>

                {/* P&L */}
                <td style={{ ...tdStyle("right") }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: isUp ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {isUp ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
                      {isUp ? "+" : ""}◎ {Math.abs(pnl).toFixed(2)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isUp ? "var(--success)" : "var(--danger)",
                        opacity: 0.75,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {isUp ? "+" : ""}
                      {pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </td>

                {/* Action */}
                <td style={{ ...tdStyle("right") }}>
                  <button
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      color: "var(--primary)",
                      background: "none",
                      border: "1px solid rgba(0,255,178,0.2)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "var(--font-inter)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(0,255,178,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "none";
                    }}
                  >
                    View <ArrowUpRight size={11} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── My Launches section ──────────────────────────────────────────────────────

function MyLaunches() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {MOCK_LAUNCHES.map((launch, i) => {
        const color = scoreColor(launch.trustScore);
        return (
          <div
            key={i}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              transition: "border-color 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--border-focus)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--border-subtle)";
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: `${color}18`,
                border: `1px solid ${color}35`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                color: color,
                fontFamily: "var(--font-mono)",
                letterSpacing: "-0.02em",
              }}
            >
              {launch.symbol.slice(0, 2)}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: "var(--text-primary)",
                }}
              >
                {launch.name}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 400,
                  }}
                >
                  ${launch.symbol}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Launched{" "}
                {new Date(launch.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Raised
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ◎ {launch.totalInvestedSol}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Holders
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {launch.holderCount.toLocaleString()}
              </div>
            </div>

            <TrustBadge score={launch.trustScore} showLabel />
          </div>
        );
      })}
    </div>
  );
}

// ─── Connected portfolio view ─────────────────────────────────────────────────

function ConnectedPortfolio() {
  const totalInvested = MOCK_INVESTMENTS.reduce((a, b) => a + b.invested, 0);
  const totalCurrent = MOCK_INVESTMENTS.reduce((a, b) => a + b.current, 0);
  const pnl = totalCurrent - totalInvested;
  const pnlPct = (pnl / totalInvested) * 100;

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-geist)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Portfolio
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Track your holdings and launched tokens
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Total Invested"
          value={totalInvested}
          delay={0}
        />
        <StatCard
          label="Current Value"
          value={totalCurrent}
          color="var(--secondary)"
          delay={0.05}
        />
        <StatCard
          label="Unrealized P&L"
          value={Math.abs(pnl)}
          prefix={pnl >= 0 ? "+ ◎ " : "- ◎ "}
          color={pnl >= 0 ? "var(--success)" : "var(--danger)"}
          delay={0.1}
          sub={
            <span
              style={{
                color: pnl >= 0 ? "var(--success)" : "var(--danger)",
                fontWeight: 600,
              }}
            >
              {pnl >= 0 ? "+" : ""}
              {pnlPct.toFixed(1)}% all time
            </span>
          }
        />
      </div>

      {/* Holdings table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ marginBottom: "2rem" }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TrendingUp size={16} color="var(--primary)" />
          My Investments
        </h2>
        <HoldingsTable />
      </motion.div>

      {/* My Launches */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Package size={16} color="var(--accent)" />
          My Launches
        </h2>
        <MyLaunches />
      </motion.div>
    </div>
  );
}

// ─── Disconnected state ───────────────────────────────────────────────────────

function DisconnectedState({ onConnect }: { onConnect: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "5rem 2rem",
        textAlign: "center",
        gap: "1.5rem",
      }}
    >
      {/* Animated wallet illustration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ position: "relative", marginBottom: 8 }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 40%, rgba(0,255,178,0.12), rgba(61,127,255,0.06))",
            border: "1px solid rgba(0,255,178,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wallet size={40} color="var(--primary)" strokeWidth={1.5} />
          </motion.div>
        </div>
        {/* Glow ring */}
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: "1px solid rgba(0,255,178,0.1)",
            pointerEvents: "none",
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2
          style={{
            fontFamily: "var(--font-geist)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 10,
          }}
        >
          Connect your wallet
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            maxWidth: 340,
            lineHeight: 1.65,
            margin: "0 auto",
          }}
        >
          Connect a Solana wallet to view your portfolio holdings, track
          performance, and manage your token launches.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onConnect}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 28px",
          borderRadius: 12,
          border: "none",
          background: "var(--primary)",
          color: "#05080F",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-geist)",
          boxShadow: "0 0 30px rgba(0,255,178,0.2)",
        }}
      >
        <Wallet size={16} />
        Connect Wallet
      </motion.button>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38 }}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {["Track holdings", "Monitor P&L", "Manage launches", "View analytics"].map(
          (f) => (
            <span
              key={f}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {f}
            </span>
          )
        )}
      </motion.div>

      {/* Blurred preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        style={{
          width: "100%",
          maxWidth: 700,
          marginTop: "2rem",
          position: "relative",
        }}
      >
        <div
          style={{
            filter: "blur(3px)",
            opacity: 0.35,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
            }}
          >
            {["Total Invested", "Current Value", "Unrealized P&L"].map((label) => (
              <div
                key={label}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  ◎ —.——
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, var(--bg-base))",
          }}
        />
      </motion.div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function PortfolioTab() {
  const [connected, setConnected] = useState(false);

  if (!connected) {
    return <DisconnectedState onConnect={() => setConnected(true)} />;
  }

  return <ConnectedPortfolio />;
}
