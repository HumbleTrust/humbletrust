import { ReactNode, HTMLAttributes } from "react";
import { cn } from "./ui/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "green" | "purple" | "none";
}

export function GlassPanel({ children, className, hover = false, glow = "none", ...rest }: GlassPanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-lg backdrop-blur-xl bg-[rgba(20,20,30,0.5)] border border-white/10",
        "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
        hover && "transition-all duration-300 hover:border-white/20 hover:bg-[rgba(20,20,30,0.7)]",
        glow === "green" && "shadow-[0_0_20px_rgba(0,255,65,0.2)]",
        glow === "purple" && "shadow-[0_0_20px_rgba(176,38,255,0.2)]",
        className
      )}
    >
      {children}
    </div>
  );
}
