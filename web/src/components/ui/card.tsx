import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "glass";

const variants: Record<CardVariant, string> = {
  default: "border-border-subtle bg-bg-surface",
  elevated: "border-border-focus bg-bg-elevated shadow-card-glow",
  glass: "glass-panel",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  children: ReactNode;
};

export function Card({ className, variant = "default", children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border p-5 text-text-primary", variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
