"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ParticleField } from "./ParticleField";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ArrowRight, Zap } from "lucide-react";

const HEADLINE = ["Code", "that", "can't", "lie."];
const SUB = "HumbleTrust enforces token accountability on-chain. Liquidity locked. Vesting immutable. TrustScore public. No promises — just provable math.";

const STATS = [
  { value: 31894, prefix: "◎ ", label: "Total Locked" },
  { value: 10, label: "Projects Live" },
  { value: 14238, label: "Investors Protected" },
];

export function HeroSection() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        textAlign: "center",
        padding: "0 24px",
      }}
      className="grid-bg"
    >
      <ParticleField />

      {/* Radial glow */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,255,178,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "6px 14px", borderRadius: 20, background: "rgba(0,255,178,0.08)", border: "1px solid rgba(0,255,178,0.2)", marginBottom: "2rem" }}
        >
          <Zap size={13} color="var(--primary)" />
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--primary)", letterSpacing: "0.05em" }}>
            BUILT ON SOLANA · DEVNET LIVE
          </span>
        </motion.div>

        {/* Headline */}
        <h1 style={{ fontFamily: "var(--font-geist)", fontWeight: 800, lineHeight: 1.0, marginBottom: "1.5rem" }}>
          {HEADLINE.map((word, i) => (
            <motion.span
              key={word + i}
              initial={{ opacity: 0, filter: "blur(20px)", y: 20 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{
                delay: 0.2 + i * 0.08,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                display: "inline-block",
                marginRight: "0.3em",
                fontSize: "clamp(3.5rem, 8vw, 6rem)",
                color: i === 2 ? "var(--primary)" : "var(--text-primary)",
                textShadow: i === 2 ? "0 0 60px rgba(0,255,178,0.4)" : "none",
              }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          style={{
            fontSize: "clamp(1rem, 2vw, 1.15rem)",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            maxWidth: 580,
            margin: "0 auto 2.5rem",
          }}
        >
          {SUB}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "4rem" }}
        >
          <Link
            href="/app?tab=launch"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "14px 28px",
              borderRadius: 12,
              background: "var(--primary)",
              color: "var(--bg-base)",
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
              transition: "all 0.15s",
              boxShadow: "0 0 40px rgba(0,255,178,0.2)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(0,255,178,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(0,255,178,0.2)"; }}
          >
            Launch a Token <ArrowRight size={16} />
          </Link>
          <Link
            href="/app"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "14px 28px",
              borderRadius: 12,
              background: "transparent",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              border: "1px solid var(--border-focus)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          >
            Explore Projects
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "3rem",
            flexWrap: "wrap",
            paddingTop: "2rem",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.4rem", color: "var(--primary)" }}>
                <AnimatedNumber value={s.value} prefix={s.prefix ?? ""} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          opacity: 0.4,
        }}
      >
        <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, var(--primary))" }} />
        <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--text-muted)", textTransform: "uppercase" }}>scroll</span>
      </motion.div>
    </section>
  );
}
