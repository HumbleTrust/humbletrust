"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Lock, Vault, CalendarClock, BarChart2, Coins, Key } from "lucide-react";

const FEATURES = [
  {
    icon: Lock,
    title: "On-Chain Enforcement",
    body: "Rules written in Rust, not in promises. Every constraint lives in an auditable Anchor program — not a Terms of Service.",
    color: "var(--primary)",
  },
  {
    icon: Vault,
    title: "Liquidity Vault",
    body: "LP tokens go into a PDA lock at creation. Only time lets them out — not a multisig, not an admin key, not goodwill.",
    color: "var(--secondary)",
  },
  {
    icon: CalendarClock,
    title: "Creator Vesting",
    body: "Allocation unlocks on Day 30/60/90 — enforced by contract. No exceptions. No extensions. No rug.",
    color: "var(--accent)",
  },
  {
    icon: BarChart2,
    title: "TrustScore Engine",
    body: "0–100 dynamic score derived from on-chain state. Updates as parameters change. Visible to everyone. Cannot be faked.",
    color: "#FFB800",
  },
  {
    icon: Coins,
    title: "Fee Sharing Economy",
    body: "~1% of trading volume goes to creators, DAO treasury, and the platform. Creators earn from success — not from exit.",
    color: "var(--success)",
  },
  {
    icon: Key,
    title: "Multisig Protocol",
    body: "Protocol parameters controlled by Squads v4 multisig. No single key can modify anything critical to user funds.",
    color: "#FF7A00",
  },
];

export function FeaturesSection() {
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
            Features
          </div>
          <h2 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: "clamp(1.8rem,3.5vw,2.6rem)", color: "var(--text-primary)" }}>
            Every layer of trust, enforced
          </h2>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 400, damping: 30 } }}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 16,
                  padding: "1.75rem",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  cursor: "default",
                }}
                onHoverStart={(e) => {
                  (e.target as HTMLElement).style?.setProperty("border-color", f.color + "50");
                  (e.target as HTMLElement).style?.setProperty("box-shadow", `0 0 30px ${f.color}10`);
                }}
              >
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: f.color + "15",
                    border: `1px solid ${f.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Icon size={20} color={f.color} />
                </motion.div>
                <h3 style={{ fontFamily: "var(--font-geist)", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.6rem" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {f.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
