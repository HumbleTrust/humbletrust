"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { BarChart3, Lock, Wallet } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { LockCountdown } from "@/components/core/lock-countdown";
import { TiltCard } from "@/components/core/tilt-card";
import { TrustBadge } from "@/components/core/trust-badge";
import { formatSol } from "@/lib/utils";
import type { Project } from "@/types";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const { connected } = useWallet();

  return (
    <TiltCard className="h-full">
      <article className="glass-panel flex h-full flex-col rounded-lg p-5 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/25">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary/90 via-secondary/80 to-accent/80 font-geist text-sm font-bold text-bg-base shadow-primary-glow">
              {project.symbol.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-geist text-lg font-semibold">{project.name}</h3>
              <p className="font-mono text-xs text-text-muted">${project.symbol}</p>
            </div>
          </div>
          <TrustBadge score={project.trustScore} compact />
        </div>

        <p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-text-secondary">
          {project.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-sm border border-border-subtle bg-black/15 p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Lock className="h-3.5 w-3.5" />
              Lock
            </div>
            <LockCountdown unlockAt={project.lockUnlockAt} compact className="mt-2 block" />
          </div>
          <div className="rounded-sm border border-border-subtle bg-black/15 p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Wallet className="h-3.5 w-3.5" />
              Invested
            </div>
            <p className="mt-2 font-mono text-xs text-text-primary">
              {formatSol(project.totalInvestedSol)} SOL
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-sm border border-border-subtle bg-black/15 p-3">
          <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5" />
              7d activity
            </span>
            <span className={project.change24h >= 0 ? "text-primary" : "text-danger"}>
              {project.change24h >= 0 ? "+" : ""}
              {project.change24h}%
            </span>
          </div>
          <div className="flex h-14 items-end gap-1">
            {project.sevenDayActivity.map((point) => (
              <div
                key={point.label}
                className="flex-1 rounded-t-[3px] bg-gradient-to-t from-primary/25 to-primary"
                style={{ height: `${Math.max(18, point.value)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Link
            href={`/project/${project.id}`}
            className={buttonClassName({ variant: "outline", size: "md", className: "flex-1" })}
          >
            View Project
          </Link>
          <Button className="flex-1" variant="primary" disabled={!connected}>
            Invest
          </Button>
        </div>
      </article>
    </TiltCard>
  );
}
