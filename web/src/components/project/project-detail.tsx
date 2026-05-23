"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Gauge,
  Lock,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LockCountdown } from "@/components/core/lock-countdown";
import { NetworkBadge } from "@/components/core/network-badge";
import { ScoreBreakdownBar } from "@/components/core/score-breakdown-bar";
import { TrustBadge } from "@/components/core/trust-badge";
import { TrustScoreMeter } from "@/components/core/trust-score-meter";
import { WalletButton } from "@/components/core/wallet-button";
import { buildBreakdownItems, calculateTrustScore } from "@/lib/trust-score";
import { cn, formatCompact, formatSol, shortAddress } from "@/lib/utils";
import type { Project } from "@/types";

type ProjectDetailProps = {
  project: Project;
};

export function ProjectDetail({ project }: ProjectDetailProps) {
  const trust = useMemo(() => calculateTrustScore(project), [project]);
  const factors = useMemo(() => buildBreakdownItems(trust.breakdown), [trust.breakdown]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-base/82 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-[min(1320px,calc(100%-32px))] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/app" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-subtle text-text-secondary hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary via-secondary to-accent font-geist font-bold text-bg-base">
              {project.symbol.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-geist text-2xl font-semibold">{project.name}</h1>
              <p className="font-mono text-xs text-text-muted">${project.symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrustBadge score={project.trustScore} />
            <span className="hidden rounded-pill border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-xs uppercase text-primary sm:inline-flex">
              {project.status}
            </span>
            <div className="hidden md:block">
              <NetworkBadge />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1320px,calc(100%-32px))] gap-6 py-8 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <Card variant="glass" className="p-6">
            <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
              <div className="grid place-items-center">
                <TrustScoreMeter score={project.trustScore} size="xl" />
              </div>
              <div>
                <p className="eyebrow">TrustScore breakdown</p>
                <h2 className="mt-5 font-geist text-3xl font-semibold tracking-[-0.03em]">
                  Every point comes from a concrete launch constraint.
                </h2>
                <div className="mt-6 space-y-5">
                  {factors.map((factor) => (
                    <ScoreBreakdownBar
                      key={factor.key}
                      label={factor.label}
                      points={factor.points}
                      maxPoints={factor.maxPoints}
                      description={factor.description}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="glass" className="p-6">
              <SectionTitle icon={Lock} title="Lock status" />
              <div className="mt-6 overflow-x-auto">
                <LockCountdown unlockAt={project.lockUnlockAt} />
              </div>
              <p className="mt-5 text-sm text-text-secondary">
                Unlock date: {new Date(project.lockUnlockAt).toLocaleString()}
              </p>
              <a
                href={`https://explorer.solana.com/address/${project.vaultPda}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Verified on-chain
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Card>

            <Card variant="glass" className="p-6">
              <SectionTitle icon={Gauge} title="Vesting schedule" />
              <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs text-text-muted">
                {[
                  ["Day 0", "0%"],
                  ["Day 30", "2%"],
                  ["Day 60", "+3%"],
                  ["Day 90", "+5%"],
                ].map(([day, pct], index) => (
                  <div
                    key={day}
                    className={cn(
                      "rounded-md border p-3",
                      index === 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border-subtle",
                    )}
                  >
                    <p className="font-mono">{day}</p>
                    <p className="mt-2 font-geist text-lg font-semibold">{pct}</p>
                  </div>
                ))}
              </div>
              <Button className="mt-5 w-full" variant="outline" disabled>
                No claimable tokens yet
              </Button>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="glass" className="p-6">
              <SectionTitle icon={UserRound} title="Creator info" />
              <div className="mt-5 space-y-3">
                <CopyRow label="Wallet" value={project.creatorWallet} />
                <div className="rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
                  <p className="text-sm text-text-muted">Behavior history</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-primary">
                    <Check className="h-4 w-4" />
                    No suspicious activity detected
                  </p>
                </div>
                <div className="rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
                  <p className="text-sm text-text-muted">Projects launched</p>
                  <p className="mt-2 font-geist text-2xl font-semibold">3</p>
                </div>
              </div>
            </Card>

            <Card variant="glass" className="p-6">
              <SectionTitle icon={ShieldCheck} title="On-chain verification" />
              <div className="mt-5 space-y-3">
                <CopyRow label="Program ID" value={project.programId} />
                <CopyRow label="Mint Address" value={project.mintAddress} />
                <CopyRow label="Vault PDA" value={project.vaultPda} />
              </div>
            </Card>
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
          <InvestPanel project={project} />
          <Card variant="glass" className="p-5">
            <h3 className="font-geist text-xl font-semibold">Quick stats</h3>
            <div className="mt-5 space-y-3">
              <StatRow label="Holders" value={formatCompact(project.holderCount)} />
              <StatRow label="Total supply" value={formatCompact(Number(project.totalSupply))} />
              <StatRow label="Circulating" value={formatCompact(Number(project.circulatingSupply))} />
              <StatRow label="Market cap" value={`$${formatCompact(project.marketCap)}`} />
              <StatRow label="DEX" value={project.dex.toUpperCase()} />
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function InvestPanel({ project }: { project: Project }) {
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { connected, publicKey } = useWallet();
  const progress = Math.min(100, (project.totalInvestedSol / project.goalSol) * 100);

  async function invest() {
    if (!connected || !publicKey) return;
    setLoading(true);
    await fetch(`/api/projects/${project.id}/invest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txSignature: `mock-${Date.now()}`,
        walletAddress: publicKey.toBase58(),
        amountSol: Number(amount),
      }),
    });
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setLoading(false);
    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 1200);
  }

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">Current price</p>
          <p className="mt-1 font-geist text-3xl font-semibold">{project.price} SOL</p>
        </div>
        <span className={cn("font-mono text-sm", project.change24h >= 0 ? "text-primary" : "text-danger")}>
          {project.change24h >= 0 ? "+" : ""}{project.change24h}% 24h
        </span>
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>Total raised</span>
          <span>{formatSol(project.totalInvestedSol)} / {formatSol(project.goalSol)} SOL</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-pill bg-white/[0.06]">
          <div className="h-full rounded-pill bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-6">
        <label className="text-sm text-text-secondary">Amount SOL</label>
        <div className="mt-2 flex gap-2">
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="0.1" />
          <Button variant="outline" onClick={() => setAmount("10")}>Max</Button>
        </div>
      </div>
      <Button className="mt-5 w-full" size="lg" disabled={!connected} loading={loading} success={success} onClick={invest}>
        {connected ? "Invest" : "Connect wallet to invest"}
      </Button>
      <div className="mt-5 rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
        <p className="text-sm text-text-muted">Your position</p>
        <p className="mt-2 font-mono text-sm text-text-secondary">
          {connected ? `${shortAddress(publicKey?.toBase58() ?? "")}: 0.00 ${project.symbol}` : "Wallet not connected"}
        </p>
      </div>
      <div className="mt-5 hidden md:block">
        <WalletButton />
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Lock; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="font-geist text-2xl font-semibold">{title}</h2>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
      <div className="min-w-0">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="mt-1 truncate font-mono text-xs text-text-secondary">{value}</p>
      </div>
      <button
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border-subtle text-text-secondary transition hover:border-primary/40 hover:text-primary"
        onClick={() => navigator.clipboard.writeText(value)}
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-bg-elevated/35 px-3 py-2">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="font-mono text-sm text-text-primary">{value}</span>
    </div>
  );
}
