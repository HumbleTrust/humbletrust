"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function getParts(unlockAt: string): CountdownParts {
  const diff = new Date(unlockAt).getTime() - Date.now();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: diff <= 0,
  };
}

function Segment({ value, label, tone }: { value: number; label: string; tone: string }) {
  const formatted = label === "DD" ? String(value).padStart(2, "0") : String(value).padStart(2, "0");

  return (
    <div className="min-w-0">
      <div className="relative grid h-12 min-w-14 place-items-center overflow-hidden rounded-sm border border-white/10 bg-black/20 px-2 font-mono text-lg font-semibold sm:h-14 sm:min-w-16 sm:text-xl">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={formatted}
            initial={{ rotateX: -70, opacity: 0, y: -8 }}
            animate={{ rotateX: 0, opacity: 1, y: 0 }}
            exit={{ rotateX: 70, opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            style={{ color: tone }}
          >
            {formatted}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-text-muted">{label}</div>
    </div>
  );
}

type LockCountdownProps = {
  unlockAt: string;
  compact?: boolean;
  className?: string;
};

export function LockCountdown({ unlockAt, compact = false, className }: LockCountdownProps) {
  const [parts, setParts] = useState(() => getParts(unlockAt));

  useEffect(() => {
    const id = window.setInterval(() => setParts(getParts(unlockAt)), 1000);
    return () => window.clearInterval(id);
  }, [unlockAt]);

  const tone = useMemo(() => {
    if (parts.expired) return "#4A5568";
    if (parts.days < 1) return "#FF4444";
    if (parts.days < 7) return "#FFB800";
    return "#00FFB2";
  }, [parts.days, parts.expired]);

  if (compact) {
    return (
      <span className={cn("font-mono text-xs", className)} style={{ color: tone }}>
        {parts.expired ? "Unlocked" : `${parts.days}d ${parts.hours}h locked`}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Segment value={parts.days} label="DD" tone={tone} />
      <Segment value={parts.hours} label="HH" tone={tone} />
      <Segment value={parts.minutes} label="MM" tone={tone} />
      <Segment value={parts.seconds} label="SS" tone={tone} />
    </div>
  );
}
