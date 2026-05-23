"use client";
import { useEffect, useState, useRef } from "react";
import { scoreColor, scoreLabel } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, { size: number; stroke: number; fontSize: number; labelSize: number }> = {
  sm: { size: 80, stroke: 6, fontSize: 20, labelSize: 9 },
  md: { size: 120, stroke: 8, fontSize: 28, labelSize: 11 },
  lg: { size: 180, stroke: 10, fontSize: 40, labelSize: 13 },
  xl: { size: 240, stroke: 12, fontSize: 56, labelSize: 15 },
};

interface TrustScoreMeterProps {
  score: number;
  size?: Size;
  animated?: boolean;
}

export function TrustScoreMeter({ score, size = "md", animated = true }: TrustScoreMeterProps) {
  const { size: sz, stroke, fontSize, labelSize } = SIZE_MAP[size];
  const [displayed, setDisplayed] = useState(animated ? 0 : score);
  const color = scoreColor(displayed);
  const label = scoreLabel(Math.round(displayed));
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) { setDisplayed(score); return; }
    startRef.current = null;
    const duration = 1500;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(eased * score);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [score, animated]);

  const radius = (sz - stroke) / 2;
  const cx = sz / 2;
  const cy = sz / 2;
  // 270° arc, starts from 135° (bottom-left)
  const startAngle = 135;
  const totalAngle = 270;
  const circumference = (totalAngle / 360) * 2 * Math.PI * radius;
  const progress = Math.min(displayed / 100, 1);
  const offset = circumference * (1 - progress);

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number) {
    const start = polarToCartesian(endDeg);
    const end = polarToCartesian(startDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  const arcPath = describeArc(startAngle, startAngle + totalAngle);
  const progressPath = describeArc(startAngle, startAngle + totalAngle);

  return (
    <div style={{ position: "relative", width: sz, height: sz }}>
      <svg width={sz} height={sz} style={{ overflow: "visible" }}>
        {/* Track */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={progressPath}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 8px ${color}80)`,
            transition: animated ? "none" : "stroke-dashoffset 0.3s ease",
          }}
        />
        {/* Center text */}
        <text
          x={cx}
          y={cy - fontSize * 0.15}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="var(--font-mono)"
        >
          {Math.round(displayed)}
        </text>
        <text
          x={cx}
          y={cy + fontSize * 0.7}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--text-secondary)"
          fontSize={labelSize}
          fontFamily="var(--font-sans)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
