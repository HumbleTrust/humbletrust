import { cn } from "@/lib/utils";

type Variant = "default" | "elevated" | "glass";

interface CardProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-[var(--bg-surface)] border border-[var(--border-subtle)]",
  elevated: "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-[0_0_60px_rgba(0,255,178,0.04)]",
  glass: "glass",
};

export function Card({ variant = "default", className, children, style }: CardProps) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-lg transition-all duration-200",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
