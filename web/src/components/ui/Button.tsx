"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "ghost" | "danger" | "outline" | "secondary";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  "aria-label"?: string;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--bg-base)] font-semibold hover:shadow-[0_0_30px_rgba(0,255,178,0.4)] hover:brightness-110",
  ghost:
    "bg-transparent border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
  danger:
    "bg-[var(--danger)] text-white font-semibold hover:shadow-[0_0_30px_rgba(255,68,68,0.4)] hover:brightness-110",
  outline:
    "bg-transparent border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--bg-base)]",
  secondary:
    "bg-[var(--secondary)] text-white font-semibold hover:shadow-[0_0_30px_rgba(61,127,255,0.4)] hover:brightness-110",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-sm rounded-md",
  md: "px-6 py-3 text-base rounded-lg",
  lg: "px-8 py-4 text-lg rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, icon, className, children, disabled, onClick, type = "button", style, "aria-label": ariaLabel },
    ref
  ) => {
    const motionProps: HTMLMotionProps<"button"> = {
      ref,
      type,
      disabled: disabled || loading,
      onClick,
      style,
      "aria-label": ariaLabel,
      whileTap: { scale: 0.97 },
      whileHover: { scale: 1.02 },
      transition: { type: "spring", stiffness: 400, damping: 30 },
      className: cn(
        "relative inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer select-none",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      ),
    };

    return (
      <motion.button {...motionProps}>
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && icon}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
