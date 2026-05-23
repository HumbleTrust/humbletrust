"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useStats } from "@/hooks/useProjects";

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const { data: stats } = useStats();

  const STATS = [
    { label: "Total Value Locked", value: stats?.tvl ?? 31894, prefix: "◎ ", decimals: 0 },
    { label: "Projects Launched", value: stats?.projectsLaunched ?? 10, decimals: 0 },
    { label: "Investors Protected", value: stats?.investorsProtected ?? 14238, decimals: 0 },
    { label: "Rugs Prevented", value: 0, decimals: 0 },
  ];

  return (
    <section ref={ref} style={{ padding: "80px 24px", background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "relative", overflow: "hidden" }}>
      {/* Gradient border top */}
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(to right, transparent, var(--primary), transparent)" }} />
      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(to right, transparent, var(--primary), transparent)" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem", textAlign: "center" }}>
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "var(--primary)", marginBottom: "0.5rem" }}>
                {inView && (
                  <AnimatedNumber value={s.value} prefix={s.prefix ?? ""} decimals={s.decimals} duration={1800} />
                )}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
