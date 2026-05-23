"use client";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Zap, Activity, BarChart2 } from "lucide-react";

const TVL_DATA = [
  { day: "Mon", tvl: 18200 },
  { day: "Tue", tvl: 22100 },
  { day: "Wed", tvl: 21400 },
  { day: "Thu", tvl: 25800 },
  { day: "Fri", tvl: 24900 },
  { day: "Sat", tvl: 28700 },
  { day: "Sun", tvl: 31894 },
];

const LAUNCHES_DATA = [
  { day: "Mon", count: 1 },
  { day: "Tue", count: 2 },
  { day: "Wed", count: 0 },
  { day: "Thu", count: 3 },
  { day: "Fri", count: 1 },
  { day: "Sat", count: 2 },
  { day: "Sun", count: 1 },
];

const SCORE_DIST = [
  { range: "0–19", count: 0, color: "#FF4444" },
  { range: "20–39", count: 1, color: "#FF7A00" },
  { range: "40–69", count: 3, color: "#FFB800" },
  { range: "70–89", count: 3, color: "#00D4FF" },
  { range: "90–100", count: 3, color: "#00FFB2" },
];

const DEX_DATA = [
  { name: "Raydium", value: 60, color: "#00FFB2" },
  { name: "Orca", value: 40, color: "#3D7FFF" },
];

const SUMMARY_STATS = [
  { label: "7d TVL", value: "◎ 31,894", change: "+75.2%", up: true, icon: TrendingUp, color: "var(--primary)" },
  { label: "Launches This Week", value: "10", change: "+25%", up: true, icon: Zap, color: "var(--secondary)" },
  { label: "Avg Trust Score", value: "76.1", change: "+4.2", up: true, icon: Activity, color: "#00D4FF" },
  { label: "Unique Protocols", value: "10", change: "+2", up: true, icon: BarChart2, color: "var(--accent)" },
];

const tooltipStyle: React.CSSProperties = {
  background: "#0F1624",
  border: "1px solid #1A2436",
  borderRadius: 8,
  color: "#F0F4FF",
  fontSize: 12,
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}

function ChartCard({ title, subtitle, children, delay = 0 }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "1.5rem",
      }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{subtitle}</div>}
      </div>
      {children}
    </motion.div>
  );
}

export default function AnalyticsTab() {
  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Platform Analytics
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>7-day overview across all projects on Devnet</p>
      </motion.div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {SUMMARY_STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                padding: "1.1rem 1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${stat.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={stat.color} />
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: stat.up ? "var(--success)" : "var(--danger)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                {stat.up ? "▲" : "▼"} {stat.change} vs last week
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* TVL */}
        <ChartCard title="Total Value Locked" subtitle="◎ SOL locked across all projects — 7 days" delay={0.1}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TVL_DATA}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#4A5568" }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`◎ ${Number(v).toLocaleString()}`, "TVL"]} />
              <Line type="monotone" dataKey="tvl" stroke="#00FFB2" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#00FFB2", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily Launches */}
        <ChartCard title="Daily Launches" subtitle="Tokens deployed per day — 7 days" delay={0.15}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={LAUNCHES_DATA} barSize={28}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#4A5568" }} />
              <YAxis hide allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Launches"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {LAUNCHES_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.count > 0 ? "#3D7FFF" : "#1A2436"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Score Distribution */}
        <ChartCard title="TrustScore Distribution" subtitle="Projects by score range" delay={0.2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={SCORE_DIST} barSize={40}>
              <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#4A5568" }} />
              <YAxis hide allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Projects"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {SCORE_DIST.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {SCORE_DIST.map((entry) => (
              <div key={entry.range} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                {entry.range}
              </div>
            ))}
          </div>
        </ChartCard>

        {/* DEX Volume */}
        <ChartCard title="Volume by DEX" subtitle="Trading volume split this week" delay={0.25}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={DEX_DATA} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {DEX_DATA.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingRight: "1rem", flex: 1 }}>
              {DEX_DATA.map((d) => (
                <div key={d.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, boxShadow: `0 0 8px ${d.color}80`, flexShrink: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{d.name}</div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden" }}>
                    <div style={{ width: `${d.value}%`, height: "100%", background: d.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: d.color, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {d.value}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
