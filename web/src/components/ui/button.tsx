"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary/60 bg-primary text-[#03110c] shadow-primary-glow hover:border-primary hover:shadow-[0_0_38px_rgba(0,255,178,0.34)]",
  secondary:
    "border-secondary/50 bg-secondary text-white shadow-blue-glow hover:border-secondary",
  ghost:
    "border-white/5 bg-white/[0.03] text-text-primary hover:border-primary/30 hover:bg-primary/10",
  outline:
    "border-border-subtle bg-transparent text-text-primary hover:border-primary/40 hover:bg-primary/5",
  danger:
    "border-danger/50 bg-danger text-white shadow-danger-glow hover:border-danger",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-base",
  icon: "h-10 w-10 p-0",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-pill border font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  success?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  success = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={{ type: "spring", stiffness: 600, damping: 35 }}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : success ? (
        <Check className="h-4 w-4" />
      ) : (
        icon
      )}
      {children ? (
        <span className={cn("transition-opacity", loading && "opacity-70")}>{children}</span>
      ) : null}
    </motion.button>
  );
}
