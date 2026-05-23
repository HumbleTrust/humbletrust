"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Rocket, Vault, Lock, BarChart3 } from "lucide-react";

const STEPS = [
  {
    icon: Rocket,
    num: "01",
    title: "Creator launches token",
    body: "Sets vesting schedule, lock duration, and allocation cap — all committed on-chain before a single investor can participate. Parameters are immutable once signed.",
    color: "var(--primary)",
  },
  {
    icon: Vault,
    num: "02",
    title: "Funds flow into vault",
    body: "Investor capital goes directly into a PDA-controlled vault. The creator's wallet never touches it. Smart contract logic is the only key.",
    color: "var(--secondary)",
  },
  {
    icon: Lock,
    num: "03",
    title: "Liquidity locked automatically",
    body: "LP tokens route directly into a PDA lock at creation. No manual step. No workaround. The contract enforces the unlock time without exception.",
    color: "var(--accent)",
  },
  {
    icon: BarChart3,
    num: "04",
    title: "TrustScore goes live",
    body: "A dynamic 0–100 score calculates from on-chain state: lock duration, mint authority, vesting, and age. Updates automatically. Cannot be fabricated.",
    color: "#FFB800",
  },
];

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      ref={ref}
      style={{ padding: "100px 24px", background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            How it works
          </div>
          <h2 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: "clamp(2rem,4vw,2.8rem)", color: "var(--text-primary)", marginBottom: "1rem" }}>
            From launch to verifiable trust
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
            Four steps. Zero promises required. Every guarantee is enforced by the Solana runtime.
          </p>
        </motion.div>

        {/* Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", position: "relative" }}>
          {/* Connector line (desktop) */}
          <div style={{
            position: "absolute",
            top: 40,
            left: "12.5%",
            right: "12.5%",
            height: 1,
            background: "linear-gradient(to right, transparent, var(--border-focus), transparent)",
            pointerEvents: "none",
          }} className="hidden lg:block" />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 16,
                  padding: "1.75rem",
                  position: "relative",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                whileHover={{
                  borderColor: step.color + "60",
                  boxShadow: `0 0 30px ${step.color}15`,
                  y: -4,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: step.color + "15",
                  border: `1px solid ${step.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "1.25rem",
                }}>
                  <Icon size={22} color={step.color} />
                </div>
                <div style={{
                  position: "absolute", top: "1.25rem", right: "1.25rem",
                  fontFamily: "var(--font-mono)", fontSize: "2rem", fontWeight: 700,
                  color: step.color, opacity: 0.12,
                }}>
                  {step.num}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: step.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Step {step.num}
                </div>
                <h3 style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.6rem" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
