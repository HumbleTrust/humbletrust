"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { getScoreColor, getTrustScoreLabel } from "@/lib/trust-score";
import { cn } from "@/lib/utils";

type TrustBadgeProps = {
  score: number;
  compact?: boolean;
  className?: string;
};

export function TrustBadge({ score, compact = false, className }: TrustBadgeProps) {
  const color = getScoreColor(score);
  const label = getTrustScoreLabel(score);
  const Icon = score >= 40 ? ShieldCheck : AlertTriangle;

  return (
    <motion.span
      animate={{
        boxShadow: [
          `0 0 0 rgba(0,0,0,0)`,
          `0 0 18px ${color}44`,
          `0 0 0 rgba(0,0,0,0)`,
        ],
      }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 font-mono text-xs font-semibold",
        className,
      )}
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}10`,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{score}</span>
      {!compact ? <span>{label}</span> : null}
    </motion.span>
  );
}
