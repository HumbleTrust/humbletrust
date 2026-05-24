import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-md border border-border-subtle bg-bg-elevated/80 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
