"use client";
import { useRef } from "react";
import { motion } from "framer-motion";
import type { Project } from "@/types";
import { TrustBadge } from "./TrustBadge";
import { LockCountdown } from "./LockCountdown";
import { formatSol, formatNumber } from "@/lib/utils";
import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
  };

  const initial = project.name.charAt(0).toUpperCase();
  const bgColors = ["#9945FF", "#14F195", "#00D4FF", "#FF3C6B", "#FFB800", "#3D7FFF"];
  const colorIndex = project.name.charCodeAt(0) % bgColors.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "1.25rem",
          cursor: "pointer",
          transition: "transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease",
          transformStyle: "preserve-3d",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = "var(--border-focus)";
          el.style.boxShadow = "0 0 40px rgba(0,255,178,0.06)";
        }}
        onMouseOut={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = "var(--border-subtle)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", background: bgColors[colorIndex],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {initial}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{project.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>${project.symbol}</div>
            </div>
          </div>
          <TrustBadge score={project.trustScore} showLabel={false} />
        </div>

        {/* Description */}
        {project.description && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "1rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {project.description}
          </p>
        )}

        {/* Countdown */}
        {project.lockUnlockAt && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Locked for</div>
            <LockCountdown unlockAt={project.lockUnlockAt} />
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Invested</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
              {formatSol(project.totalInvestedSol, 0)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Holders</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={12} />
              {formatNumber(project.holderCount)}
            </div>
          </div>
          <Link href={`/project/${project.id}`}>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 13,
              color: "var(--primary)", fontWeight: 600, cursor: "pointer",
              padding: "4px 10px", borderRadius: 8,
              border: "1px solid rgba(0,255,178,0.2)",
              transition: "background 0.15s",
            }}>
              View <ArrowRight size={12} />
            </div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
