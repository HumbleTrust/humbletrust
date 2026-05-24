"use client";

import { motion } from "framer-motion";
import { getScoreColor } from "@/lib/trust-score";
import { cn } from "@/lib/utils";

type ScoreBreakdownBarProps = {
  label: string;
  points: number;
  maxPoints: number;
  description?: string;
  className?: string;
};

export function ScoreBreakdownBar({
  label,
  points,
  maxPoints,
  description,
  className,
}: ScoreBreakdownBarProps) {
  const percentage = maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100);
  const color = getScoreColor(percentage);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{label}</p>
          {description ? <p className="text-xs text-text-muted">{description}</p> : null}
        </div>
        <span className="font-mono text-xs text-text-secondary">
          +{points}/{maxPoints}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-white/[0.06]">
        <motion.div
          className="h-full rounded-pill"
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: color, boxShadow: `0 0 18px ${color}40` }}
        />
      </div>
    </div>
  );
}
