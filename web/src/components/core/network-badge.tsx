"use client";

import { Wifi } from "lucide-react";

export function NetworkBadge() {
  const network = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";
  const label = network === "mainnet-beta" ? "MAINNET" : "DEVNET";

  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-bg-elevated/80 px-3 py-1.5 font-mono text-xs text-text-secondary">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <Wifi className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}
