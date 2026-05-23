import { cn } from "@/lib/utils";
import { scoreColor, scoreLabel, scoreBg } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface TrustBadgeProps {
  score: number;
  className?: string;
  showLabel?: boolean;
  animate?: boolean;
}

export function TrustBadge({ score, className, showLabel = true, animate = true }: TrustBadgeProps) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const bg = scoreBg(score);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold", className)}
      style={{
        background: bg,
        color,
        border: `1px solid ${color}40`,
        boxShadow: animate ? `0 0 12px ${color}30` : "none",
      }}
    >
      <ShieldCheck size={14} />
      <span style={{ fontFamily: "var(--font-mono)" }}>{score}</span>
      {showLabel && <span className="text-xs opacity-80">{label}</span>}
    </span>
  );
}
