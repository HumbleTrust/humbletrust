"use client";

import { motion } from "framer-motion";
import { getScoreColor, getTrustScoreLabel } from "@/lib/trust-score";
import { cn } from "@/lib/utils";

type TrustScoreMeterProps = {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
};

const sizeMap = {
  sm: 96,
  md: 136,
  lg: 188,
  xl: 248,
};

export function TrustScoreMeter({
  score,
  size = "md",
  animated = true,
  className,
}: TrustScoreMeterProps) {
  const px = sizeMap[size];
  const stroke = Math.max(8, px * 0.055);
  const radius = px / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.78;
  const gap = circumference - arcLength;
  const offset = arcLength - (arcLength * score) / 100;
  const color = getScoreColor(score);
  const label = getTrustScoreLabel(score);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="overflow-visible">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gap}`}
          transform={`rotate(129 ${px / 2} ${px / 2})`}
        />
        <motion.circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gap}`}
          strokeDashoffset={animated ? arcLength : offset}
          transform={`rotate(129 ${px / 2} ${px / 2})`}
          initial={animated ? { strokeDashoffset: arcLength } : false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 16px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <motion.div
            key={score}
            initial={animated ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="font-geist text-[clamp(28px,18%,58px)] font-bold"
            style={{ color }}
          >
            {score}
          </motion.div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
