"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TiltCardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

export function TiltCard({ children, className, onMouseMove, onMouseLeave, ...props }: TiltCardProps) {
  const rotateX = useSpring(useMotionValue(0), { stiffness: 400, damping: 30 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 400, damping: 30 });
  const shineX = useMotionValue(50);
  const shineY = useMotionValue(50);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.12), transparent 35%)`;

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        rotateX.set((0.5 - y) * 8);
        rotateY.set((x - 0.5) * 8);
        shineX.set(x * 100);
        shineY.set(y * 100);
        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        rotateX.set(0);
        rotateY.set(0);
        onMouseLeave?.(event);
      }}
      className={cn("group relative", className)}
      {...props}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: shine }}
      />
      {children}
    </motion.div>
  );
}
