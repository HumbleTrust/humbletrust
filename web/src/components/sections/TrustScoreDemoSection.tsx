"use client";
import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrustScoreMeter } from "@/components/ui/TrustScoreMeter";
import { ScoreBreakdownBar } from "@/components/ui/ScoreBreakdownBar";
import type { ScoreBreakdown } from "@/types";

interface Scenario {
  label: string;
  score: number;
  color: string;
  breakdown: ScoreBreakdown;
  desc: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: "Safe Launch",
    score: 95,
    color: "var(--primary)",
    desc: "365-day lock · mint revoked · freeze revoked · vesting on · 3% creator",
    breakdown: { liquidityPresent: 20, lockDuration: 20, mintRevoked: 20, freezeRevoked: 10, vestingEnabled: 10, allocation: 5, age: 10 },
  },
  {
    label: "Moderate Risk",
    score: 53,
    color: "var(--warning)",
    desc: "90-day lock · mint active · freeze revoked · no vesting · 8% creator",
    breakdown: { liquidityPresent: 20, lockDuration: 10, mintRevoked: 0, freezeRevoked: 10, vestingEnabled: 0, allocation: 3, age: 10 },
  },
  {
    label: "High Risk",
    score: 15,
    color: "var(--danger)",
    desc: "14-day lock · mint active · freeze active · no vesting · 10% creator",
    breakdown: { liquidityPresent: 20, lockDuration: 5, mintRevoked: 0, freezeRevoked: 0, vestingEnabled: 0, allocation: 0, age: 0 },
  },
];

const FACTORS = [
  { key: "liquidityPresent" as keyof ScoreBreakdown, label: "Liquidity present", max: 20 },
  { key: "lockDuration" as keyof ScoreBreakdown, label: "Lock duration", max: 20 },
  { key: "mintRevoked" as keyof ScoreBreakdown, label: "Mint revoked", max: 20 },
  { key: "freezeRevoked" as keyof ScoreBreakdown, label: "Freeze revoked", max: 10 },
  { key: "vestingEnabled" as keyof ScoreBreakdown, label: "Vesting enabled", max: 10 },
  { key: "allocation" as keyof ScoreBreakdown, label: "Creator allocation", max: 5 },
  { key: "age" as keyof ScoreBreakdown, label: "Age bonus", max: 15 },
];

export function TrustScoreDemoSection() {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const scenario = SCENARIOS[selected];

  return (
    <section ref={ref} style={{ padding: "100px 24px", background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ textAlign: "center", marginBottom: "3.5rem" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            TrustScore Engine
          </div>
          <h2 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: "clamp(1.8rem,3.5vw,2.6rem)", color: "var(--text-primary)", marginBottom: "1rem" }}>
            Math doesn&apos;t lie
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
            See how different launch configurations affect the score. Try each scenario.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", alignItems: "center" }}>
          {/* Meter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}
          >
            <TrustScoreMeter score={scenario.score} size="xl" animated />
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 260 }}>
              {scenario.desc}
            </p>
            {/* Scenario buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {SCENARIOS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setSelected(i)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `1px solid ${selected === i ? s.color : "var(--border-subtle)"}`,
                    background: selected === i ? s.color + "15" : "transparent",
                    color: selected === i ? s.color : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15 }}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 16,
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Score Breakdown
            </div>
            {FACTORS.map((f) => (
              <ScoreBreakdownBar
                key={f.key}
                label={f.label}
                points={scenario.breakdown[f.key]}
                maxPoints={f.max}
                score={scenario.score}
              />
            ))}
            <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Total</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: scenario.color }}>
                {scenario.score} / 100
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
