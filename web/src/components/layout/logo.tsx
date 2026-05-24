import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative grid h-10 w-10 place-items-center rounded-md border border-primary/25 bg-primary/10 shadow-primary-glow">
        <span className="absolute h-5 w-5 rounded-sm border border-primary/70" />
        <span className="h-2.5 w-2.5 rounded-[4px] bg-primary" />
      </span>
      {!compact ? (
        <span className="font-geist text-lg font-semibold tracking-[-0.02em] text-text-primary">
          HumbleTrust
        </span>
      ) : null}
    </Link>
  );
}
