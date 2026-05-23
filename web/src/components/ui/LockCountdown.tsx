"use client";
import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LockCountdownProps {
  unlockAt: string | null | undefined;
  className?: string;
}

function Digit({ value, label }: { value: number; label: string }) {
  const str = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          color: "var(--text-primary)",
        }}
      >
        {str}
      </div>
      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

export function LockCountdown({ unlockAt, className }: LockCountdownProps) {
  const [t, setT] = useState(timeLeft(unlockAt));

  useEffect(() => {
    const id = setInterval(() => setT(timeLeft(unlockAt)), 1000);
    return () => clearInterval(id);
  }, [unlockAt]);

  if (t.expired) {
    return (
      <div className={cn("text-sm", className)} style={{ color: "var(--text-muted)" }}>
        Unlock period ended
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <Digit value={t.days} label="Days" />
      <span className="pb-7 text-lg" style={{ color: "var(--text-muted)" }}>:</span>
      <Digit value={t.hours} label="Hrs" />
      <span className="pb-7 text-lg" style={{ color: "var(--text-muted)" }}>:</span>
      <Digit value={t.mins} label="Min" />
      <span className="pb-7 text-lg" style={{ color: "var(--text-muted)" }}>:</span>
      <Digit value={t.secs} label="Sec" />
    </div>
  );
}
