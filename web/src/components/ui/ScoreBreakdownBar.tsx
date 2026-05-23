"use client";
import { useEffect, useState } from "react";
import { scoreColor } from "@/lib/utils";

interface ScoreBreakdownBarProps {
  label: string;
  points: number;
  maxPoints: number;
  score: number;
}

export function ScoreBreakdownBar({ label, points, maxPoints, score }: ScoreBreakdownBarProps) {
  const [width, setWidth] = useState(0);
  const color = scoreColor(score);

  useEffect(() => {
    const timeout = setTimeout(() => setWidth((points / maxPoints) * 100), 100);
    return () => clearTimeout(timeout);
  }, [points, maxPoints]);

  return (
    <div className="flex items-center gap-3">
      <span style={{ width: 140, fontSize: 13, color: "var(--text-secondary)", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: color,
            borderRadius: 3,
            transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <span style={{ width: 40, textAlign: "right", fontSize: 13, fontFamily: "var(--font-mono)", color, flexShrink: 0 }}>
        +{points}
      </span>
    </div>
  );
}
