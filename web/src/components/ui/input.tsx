import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-border-subtle bg-bg-elevated/80 px-4 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
