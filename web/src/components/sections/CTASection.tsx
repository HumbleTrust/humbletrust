"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} style={{ padding: "120px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,178,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, var(--primary), var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2rem" }}
        >
          <Shield size={30} color="#05080F" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.5rem" }}
        >
          Ready to build trust?
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15 }}
          style={{ fontFamily: "var(--font-geist)", fontWeight: 800, fontSize: "clamp(2rem, 5vw, 3.2rem)", color: "var(--text-primary)", marginBottom: "1rem", lineHeight: 1.1 }}
        >
          Start building trust
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          style={{ color: "var(--text-secondary)", fontSize: "1.05rem", marginBottom: "2.5rem", lineHeight: 1.6 }}
        >
          Launch a token where the rules are written in code, not words. No KYC. No permission. Just provable accountability.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.25 }}
          style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link
            href="/app?tab=launch"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "14px 32px", borderRadius: 12,
              background: "var(--primary)", color: "var(--bg-base)",
              fontWeight: 700, fontSize: 16, textDecoration: "none",
              boxShadow: "0 0 40px rgba(0,255,178,0.25)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(0,255,178,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(0,255,178,0.25)"; }}
          >
            Launch your token <ArrowRight size={16} />
          </Link>
          <Link
            href="/app"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "14px 24px", borderRadius: 12,
              border: "1px solid var(--border-focus)", color: "var(--text-secondary)",
              fontWeight: 600, fontSize: 16, textDecoration: "none",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)"; }}
          >
            Browse projects
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.35 }}
          style={{ marginTop: "1.5rem", fontSize: 13, color: "var(--text-muted)" }}
        >
          No KYC. No permission required. Just code.
        </motion.p>
      </div>
    </section>
  );
}
