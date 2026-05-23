import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 rounded-md border border-border-subtle bg-bg-elevated/90 px-4 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
