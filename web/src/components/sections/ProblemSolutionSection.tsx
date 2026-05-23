"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { X, Check } from "lucide-react";

const PROBLEMS = [
  "Creator controls all liquidity — can drain anytime",
  "Token supply fully unlocked at launch — instant dump possible",
  "No verifiable commitment — just website promises",
  "Mint authority retained — supply can inflate forever",
  "LP tokens held in creator wallet — exit at will",
];

const SOLUTIONS = [
  "Liquidity in PDA vault — creator wallet has zero access",
  "Vesting enforced by contract — Day 30/60/90 unlock schedule",
  "All parameters committed on-chain before investors join",
  "Mint authority revoked at launch — supply is mathematically fixed",
  "LP tokens locked in PDA — contract enforces the unlock date",
];

export function ProblemSolutionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ textAlign: "center", marginBottom: "3.5rem" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            The Problem
          </div>
          <h2 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: "clamp(1.8rem,3.5vw,2.6rem)", color: "var(--text-primary)" }}>
            Why crypto keeps getting rugged
          </h2>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="block md:grid">
          {/* Problems */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 }}
            style={{
              background: "rgba(255,68,68,0.04)",
              border: "1px solid rgba(255,68,68,0.15)",
              borderRadius: 16,
              padding: "2rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: "1.1rem", color: "var(--danger)", marginBottom: "1.5rem" }}>
              The Old Way
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {PROBLEMS.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <X size={11} color="var(--danger)" />
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15 }}
            style={{
              background: "rgba(0,255,178,0.03)",
              border: "1px solid rgba(0,255,178,0.15)",
              borderRadius: 16,
              padding: "2rem",
            }}
          >
            <div style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: "1.1rem", color: "var(--primary)", marginBottom: "1.5rem" }}>
              With HumbleTrust
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {SOLUTIONS.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,255,178,0.12)", border: "1px solid rgba(0,255,178,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <Check size={11} color="var(--primary)" />
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{s}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
