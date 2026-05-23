"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Rocket,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWallet } from "@solana/wallet-adapter-react";
import { TrustScoreMeter } from "@/components/core/trust-score-meter";
import { ProjectCard } from "@/components/core/project-card";
import { TrustBadge } from "@/components/core/trust-badge";
import { WalletButton } from "@/components/core/wallet-button";
import { NetworkBadge } from "@/components/core/network-badge";
import { ScoreBreakdownBar } from "@/components/core/score-breakdown-bar";
import { Logo } from "@/components/layout/logo";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjects, useStats } from "@/hooks/use-projects";
import { portfolioPositions, projects as mockProjects } from "@/lib/mock-data";
import { buildBreakdownItems, calculateTrustScore, scoreFilterBounds } from "@/lib/trust-score";
import { cn, formatCompact, formatSol } from "@/lib/utils";
import type { DashboardTab, RiskFilter } from "@/types";

type DashboardShellProps = {
  initialTab?: DashboardTab;
};

const navItems = [
  { tab: "explore", label: "Explore", icon: Search },
  { tab: "launch", label: "Launch", icon: Rocket },
  { tab: "portfolio", label: "Portfolio", icon: Briefcase },
  { tab: "analytics", label: "Analytics", icon: BarChart3 },
] satisfies { tab: DashboardTab; label: string; icon: typeof Search }[];

export function DashboardShell({ initialTab = "explore" }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-60 border-r border-border-subtle bg-bg-surface/80 p-4 backdrop-blur-xl lg:flex lg:flex-col">
        <Logo />
        <nav className="relative mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.tab;

            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={cn(
                  "relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition",
                  active ? "text-bg-base" : "text-text-secondary hover:text-text-primary",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="dashboard-active-tab"
                    className="absolute inset-0 rounded-md bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                ) : null}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <NetworkBadge />
          <WalletButton />
        </div>
      </aside>

      <div className="lg:pl-60">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border-subtle bg-bg-base/78 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo compact />
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={cn(
                  "rounded-pill border px-3 py-2 text-xs",
                  activeTab === item.tab
                    ? "border-primary bg-primary text-bg-base"
                    : "border-border-subtle text-text-secondary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          >
            {activeTab === "explore" ? <ExploreTab /> : null}
            {activeTab === "launch" ? <LaunchTab /> : null}
            {activeTab === "portfolio" ? <PortfolioTab /> : null}
            {activeTab === "analytics" ? <AnalyticsTab /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function ExploreTab() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [sort, setSort] = useState<"newest" | "highest-score" | "most-funded" | "ending-soon">(
    "newest",
  );
  const bounds = scoreFilterBounds(filter);
  const { data, isLoading } = useProjects({
    minScore: bounds.min,
    maxScore: bounds.max,
    sort,
  });

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const filtered = useMemo(() => {
    return (data?.projects ?? []).filter((project) => {
      const text = `${project.name} ${project.symbol} ${project.description}`.toLowerCase();
      return text.includes(debouncedQuery.toLowerCase());
    });
  }, [data?.projects, debouncedQuery]);

  return (
    <section>
      <DashboardHeader
        eyebrow="Explore"
        title="Launches with constraints you can inspect."
        copy="Search, filter, and compare projects by score, liquidity lock, and funding activity."
      />
      <div className="mt-8 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, symbols, vaults"
            className="pl-10"
          />
        </div>
        <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="newest">Newest</option>
          <option value="highest-score">Highest Score</option>
          <option value="most-funded">Most Funded</option>
          <option value="ending-soon">Ending Soon</option>
        </Select>
        <div className="flex flex-wrap gap-2">
          {(["all", "verified", "safe", "moderate", "risky"] as RiskFilter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-pill border px-3 py-2 text-xs capitalize transition",
                filter === item
                  ? "border-primary bg-primary text-bg-base"
                  : "border-border-subtle bg-bg-elevated text-text-secondary hover:border-primary/40",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-96 rounded-lg" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {filtered.map((project) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 18 }}
                >
                  <ProjectCard project={project} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card variant="glass" className="grid min-h-80 place-items-center text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <SlidersHorizontal className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-geist text-2xl font-semibold">No projects match your filters</h3>
              <p className="mt-2 text-text-secondary">Adjust the score range or search term.</p>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

const launchSchema = z.object({
  tokenName: z.string().min(2, "Token name is required"),
  symbol: z.string().min(2).max(8).transform((value) => value.toUpperCase()),
  totalSupply: z.coerce.number().min(1),
  decimals: z.coerce.number().min(6).max(9),
  description: z.string().min(12),
  lockDays: z.coerce.number().min(30).max(730),
  creatorAllocationPct: z.coerce.number().min(0).max(10),
  vestingEnabled: z.boolean(),
  mintRevoked: z.boolean(),
  freezeRevoked: z.boolean(),
  initialSol: z.coerce.number().min(0.1),
  liquidityPct: z.coerce.number().min(1).max(80),
  dex: z.enum(["raydium", "orca"]),
});

type LaunchForm = z.infer<typeof launchSchema>;

const defaultLaunchValues: LaunchForm = {
  tokenName: "Proof Circuit",
  symbol: "PROOF",
  totalSupply: 1000000000,
  decimals: 9,
  description: "A token launch where liquidity, vesting and authority state are visible from day one.",
  lockDays: 180,
  creatorAllocationPct: 5,
  vestingEnabled: true,
  mintRevoked: true,
  freezeRevoked: true,
  initialSol: 150,
  liquidityPct: 45,
  dex: "raydium",
};

function LaunchTab() {
  const [step, setStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { connected, publicKey } = useWallet();
  const form = useForm<LaunchForm>({
    resolver: zodResolver(launchSchema),
    defaultValues: defaultLaunchValues,
    mode: "onChange",
  });
  const values = form.watch();
  const trust = calculateTrustScore({
    liquidityLocked: true,
    lockDurationSeconds: values.lockDays * 86400,
    mintRevoked: values.mintRevoked,
    freezeRevoked: values.freezeRevoked,
    vestingEnabled: values.vestingEnabled,
    creatorAllocationPct: values.creatorAllocationPct,
    createdAt: new Date().toISOString(),
  });
  const initialPrice = values.initialSol / ((values.totalSupply * values.liquidityPct) / 100);
  const marketCap = initialPrice * values.totalSupply;

  async function deploy() {
    const valid = await form.trigger();
    if (!valid || !connected) return;
    setDeploying(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.tokenName,
        symbol: values.symbol,
        description: values.description,
        creatorWallet: publicKey?.toBase58(),
        totalSupply: String(values.totalSupply),
        decimals: values.decimals,
        lockDurationSeconds: values.lockDays * 86400,
        vestingEnabled: values.vestingEnabled,
        creatorAllocationPct: values.creatorAllocationPct,
        mintRevoked: values.mintRevoked,
        freezeRevoked: values.freezeRevoked,
        dex: values.dex,
        initialSol: values.initialSol,
      }),
    });
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    setDeploying(false);
    setDeployed(true);
  }

  if (deployed) {
    return (
      <section>
        <DashboardHeader
          eyebrow="Launch complete"
          title="The launch constraints are ready to sign on-chain."
          copy="The prototype recorded the deployment intent and calculated the public TrustScore."
        />
        <Card variant="glass" className="mt-8 grid min-h-96 place-items-center text-center">
          <div>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-primary-glow">
              <Check className="h-9 w-9" />
            </div>
            <h3 className="mt-6 font-geist text-3xl font-semibold">{values.tokenName} is queued</h3>
            <p className="mx-auto mt-3 max-w-xl text-text-secondary">
              TrustScore {trust.score}, {values.lockDays} day liquidity lock, {values.creatorAllocationPct}%
              creator allocation, {values.dex} liquidity route.
            </p>
            <div className="mt-7">
              <Link href="/app" className={buttonClassName({ variant: "outline", size: "lg" })}>
                Back to explorer
              </Link>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <DashboardHeader
        eyebrow="Launch"
        title="Deploy a token with anti-rug constraints before anyone can buy."
        copy="The wizard turns token basics, vault rules, vesting, authorities and liquidity into a verified launch configuration."
      />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card variant="glass" className="p-5">
          <ProgressSteps step={step} />
          <form className="mt-8" onSubmit={(event) => event.preventDefault()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 26 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -26 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                {step === 0 ? (
                  <StepBasics form={form} logoPreview={logoPreview} setLogoPreview={setLogoPreview} />
                ) : null}
                {step === 1 ? <StepAntiRug form={form} trustScore={trust.score} /> : null}
                {step === 2 ? (
                  <StepLiquidity form={form} initialPrice={initialPrice} marketCap={marketCap} />
                ) : null}
                {step === 3 ? (
                  <StepReview values={values} trust={trust} connected={connected} deploy={deploy} deploying={deploying} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </form>
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              icon={<ChevronLeft className="h-4 w-4" />}
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                icon={<ChevronRight className="h-4 w-4" />}
                onClick={() => setStep((current) => Math.min(3, current + 1))}
              >
                Continue
              </Button>
            ) : null}
          </div>
        </Card>
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card variant="glass" className="p-6">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-muted">
              Live TrustScore
            </p>
            <div className="mt-5 grid place-items-center">
              <TrustScoreMeter score={trust.score} size="lg" />
            </div>
            <div className="mt-6 space-y-4">
              {buildBreakdownItems(trust.breakdown).slice(0, 5).map((factor) => (
                <ScoreBreakdownBar
                  key={factor.key}
                  label={factor.label}
                  points={factor.points}
                  maxPoints={factor.maxPoints}
                />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function ProgressSteps({ step }: { step: number }) {
  const labels = ["Basics", "Anti-rug", "Liquidity", "Review"];

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-pill bg-white/[0.06]">
        <motion.div
          className="h-full rounded-pill bg-primary"
          animate={{ width: `${((step + 1) / labels.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {labels.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border font-mono text-xs",
                index <= step
                  ? "border-primary bg-primary text-bg-base"
                  : "border-border-subtle text-text-muted",
              )}
            >
              {index + 1}
            </span>
            <span className="hidden text-sm text-text-secondary sm:inline">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type FormBinding = ReturnType<typeof useForm<LaunchForm>>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-text-secondary">{children}</label>;
}

function StepBasics({
  form,
  logoPreview,
  setLogoPreview,
}: {
  form: FormBinding;
  logoPreview: string | null;
  setLogoPreview: (value: string | null) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <FieldBlock label="Token Name">
        <Input {...form.register("tokenName")} />
      </FieldBlock>
      <FieldBlock label="Symbol">
        <Input maxLength={8} {...form.register("symbol")} />
      </FieldBlock>
      <FieldBlock label="Total Supply">
        <Input type="number" {...form.register("totalSupply", { valueAsNumber: true })} />
      </FieldBlock>
      <FieldBlock label="Decimals">
        <Select {...form.register("decimals", { valueAsNumber: true })}>
          <option value={9}>9 decimals</option>
          <option value={6}>6 decimals</option>
        </Select>
      </FieldBlock>
      <FieldBlock label="Description" className="lg:col-span-2">
        <Textarea {...form.register("description")} />
      </FieldBlock>
      <div className="lg:col-span-2">
        <FieldLabel>Logo</FieldLabel>
        <label className="mt-2 flex min-h-36 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border-focus bg-bg-elevated/50 p-6 text-center transition hover:border-primary/40">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setLogoPreview(URL.createObjectURL(file));
            }}
          />
          {logoPreview ? (
            <Image
              src={logoPreview}
              alt="Token logo preview"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div>
              <ImagePlus className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-3 text-sm text-text-secondary">Drop a logo or choose an image</p>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}

function StepAntiRug({ form, trustScore }: { form: FormBinding; trustScore: number }) {
  const lockDays = form.watch("lockDays");
  const allocation = form.watch("creatorAllocationPct");

  return (
    <div className="space-y-6">
      <SliderField
        label="Liquidity Lock Duration"
        value={lockDays}
        min={30}
        max={365}
        step={1}
        suffix=" days"
        onChange={(value) => form.setValue("lockDays", value, { shouldValidate: true })}
      />
      <SliderField
        label="Creator Allocation"
        value={allocation}
        min={0}
        max={10}
        step={0.1}
        suffix="%"
        onChange={(value) => form.setValue("creatorAllocationPct", value, { shouldValidate: true })}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <ToggleField form={form} name="vestingEnabled" label="Vesting schedule" />
        <ToggleField form={form} name="mintRevoked" label="Revoke mint authority" />
        <ToggleField form={form} name="freezeRevoked" label="Revoke freeze authority" />
      </div>
      <div className="rounded-md border border-primary/20 bg-primary/[0.05] p-4">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-primary">Preview</p>
        <p className="mt-2 text-sm text-text-secondary">
          This configuration currently scores <span className="text-primary">{trustScore}</span>. Anything
          above 10% creator allocation is blocked by validation.
        </p>
      </div>
    </div>
  );
}

function StepLiquidity({
  form,
  initialPrice,
  marketCap,
}: {
  form: FormBinding;
  initialPrice: number;
  marketCap: number;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <FieldBlock label="Initial SOL liquidity">
        <Input type="number" step="0.1" {...form.register("initialSol", { valueAsNumber: true })} />
      </FieldBlock>
      <FieldBlock label="Token supply for LP">
        <Input type="number" {...form.register("liquidityPct", { valueAsNumber: true })} />
      </FieldBlock>
      <FieldBlock label="DEX route">
        <Select {...form.register("dex")}>
          <option value="raydium">Raydium</option>
          <option value="orca">Orca</option>
        </Select>
      </FieldBlock>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Initial price" value={`${initialPrice.toExponential(3)} SOL`} />
        <Metric label="Market cap" value={`${formatCompact(marketCap)} SOL`} />
      </div>
    </div>
  );
}

function StepReview({
  values,
  trust,
  connected,
  deploy,
  deploying,
}: {
  values: LaunchForm;
  trust: ReturnType<typeof calculateTrustScore>;
  connected: boolean;
  deploy: () => void;
  deploying: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <Summary label="Token" value={`${values.tokenName} (${values.symbol})`} />
        <Summary label="Supply" value={new Intl.NumberFormat("en-US").format(values.totalSupply)} />
        <Summary label="Lock" value={`${values.lockDays} days on ${values.dex}`} />
        <Summary label="Creator allocation" value={`${values.creatorAllocationPct}%`} />
        <Summary label="Authorities" value={`${values.mintRevoked ? "Mint revoked" : "Mint active"} / ${values.freezeRevoked ? "Freeze revoked" : "Freeze active"}`} />
        <Summary label="Estimated fees" value="~0.018 SOL" />
        <label className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-elevated/50 p-4 text-sm text-text-secondary">
          <input type="checkbox" className="mt-1" required />
          I understand the creator vesting schedule is enforced by the launch configuration.
        </label>
        <label className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-elevated/50 p-4 text-sm text-text-secondary">
          <input type="checkbox" className="mt-1" required />
          I understand the liquidity unlock time cannot be bypassed by a private key.
        </label>
        <Button
          size="lg"
          className="w-full"
          loading={deploying}
          disabled={!connected}
          onClick={deploy}
        >
          {connected ? "Deploy with wallet signature" : "Connect wallet to deploy"}
        </Button>
      </div>
      <div className="grid place-items-center rounded-lg border border-border-subtle bg-bg-elevated/40 p-5">
        <TrustScoreMeter score={trust.score} size="md" />
      </div>
    </div>
  );
}

function PortfolioTab() {
  const totalInvested = portfolioPositions.reduce((sum, item) => sum + item.investedSol, 0);
  const currentValue = portfolioPositions.reduce((sum, item) => sum + item.currentValueSol, 0);
  const pnl = ((currentValue - totalInvested) / totalInvested) * 100;

  return (
    <section>
      <DashboardHeader
        eyebrow="Portfolio"
        title="Positions, launches, and vesting in one place."
        copy="Track investor exposure and creator unlocks against the same accountability layer."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Metric label="Total Invested" value={`${formatSol(totalInvested)} SOL`} />
        <Metric label="Current Value" value={`${formatSol(currentValue)} SOL`} />
        <Metric label="Unrealized PnL" value={`${pnl.toFixed(1)}%`} positive={pnl >= 0} />
      </div>
      <Card variant="glass" className="mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border-subtle text-text-muted">
              <tr>
                {["Token", "TrustScore", "Invested", "Current Value", "PnL", "Actions"].map((head) => (
                  <th key={head} className="px-5 py-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolioPositions.map((position) => (
                <tr key={position.project.id} className="border-b border-border-subtle/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 font-mono text-xs text-primary">
                        {position.project.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{position.project.name}</p>
                        <p className="font-mono text-xs text-text-muted">${position.project.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><TrustBadge score={position.project.trustScore} compact /></td>
                  <td className="px-5 py-4 font-mono">{position.investedSol} SOL</td>
                  <td className="px-5 py-4 font-mono">{position.currentValueSol} SOL</td>
                  <td className={cn("px-5 py-4 font-mono", position.pnlPct >= 0 ? "text-primary" : "text-danger")}>
                    {position.pnlPct >= 0 ? "+" : ""}{position.pnlPct}%
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/project/${position.project.id}`} className="text-primary hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card variant="glass">
          <h3 className="font-geist text-2xl font-semibold">My launches</h3>
          <div className="mt-5 space-y-3">
            {mockProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-text-muted">{formatSol(project.totalInvestedSol)} SOL raised</p>
                </div>
                <TrustBadge score={project.trustScore} compact />
              </div>
            ))}
          </div>
        </Card>
        <Card variant="glass">
          <h3 className="font-geist text-2xl font-semibold">Vesting schedule</h3>
          <div className="mt-5 space-y-4">
            {mockProjects.slice(0, 3).map((project, index) => (
              <div key={project.id} className="rounded-md border border-border-subtle bg-bg-elevated/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{project.symbol}</p>
                  <Button size="sm" variant={index === 0 ? "primary" : "outline"} disabled={index !== 0}>
                    Claim
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-text-muted">
                  {["Day 0", "Day 30", "Day 60", "Day 90"].map((label, stage) => (
                    <div key={label} className={cn("rounded-sm border p-2", stage <= index ? "border-primary/30 bg-primary/10 text-primary" : "border-border-subtle")}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function AnalyticsTab() {
  const { data } = useStats();
  const tvl = mockProjects.map((project, index) => ({
    day: `D${index + 1}`,
    tvl: Math.round(mockProjects.slice(0, index + 1).reduce((sum, item) => sum + item.totalInvestedSol, 0)),
  }));
  const launches = mockProjects.map((project, index) => ({
    day: project.symbol,
    launches: index % 3 === 0 ? 4 : index % 3 === 1 ? 2 : 3,
  }));
  const scoreDistribution = [
    { range: "90+", count: mockProjects.filter((project) => project.trustScore >= 90).length },
    { range: "70-89", count: mockProjects.filter((project) => project.trustScore >= 70 && project.trustScore < 90).length },
    { range: "40-69", count: mockProjects.filter((project) => project.trustScore >= 40 && project.trustScore < 70).length },
    { range: "0-39", count: mockProjects.filter((project) => project.trustScore < 40).length },
  ];
  const dex = [
    { name: "Raydium", value: mockProjects.filter((project) => project.dex === "raydium").length, color: "#00FFB2" },
    { name: "Orca", value: mockProjects.filter((project) => project.dex === "orca").length, color: "#3D7FFF" },
  ];

  return (
    <section>
      <DashboardHeader
        eyebrow="Analytics"
        title="Protocol health at a glance."
        copy="TVL, launches, TrustScore spread, and DEX routing are modeled from the same project state."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="TVL" value={`${formatCompact(data?.stats.totalLockedSol ?? 0)} SOL`} />
        <Metric label="24h Volume" value={`${formatCompact(data?.stats.volume24h ?? 0)} SOL`} />
        <Metric label="Projects" value={String(mockProjects.length)} />
        <Metric label="Protected" value={formatCompact(data?.stats.investorsProtected ?? 0)} />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="TVL over time">
          <LineChart data={tvl}>
            <CartesianGrid stroke="#1A2436" />
            <XAxis dataKey="day" stroke="#4A5568" />
            <YAxis stroke="#4A5568" />
            <ChartTooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="tvl" stroke="#00FFB2" strokeWidth={3} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Daily launches">
          <BarChart data={launches}>
            <CartesianGrid stroke="#1A2436" />
            <XAxis dataKey="day" stroke="#4A5568" />
            <YAxis stroke="#4A5568" />
            <ChartTooltip contentStyle={tooltipStyle} />
            <Bar dataKey="launches" fill="#3D7FFF" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="TrustScore distribution">
          <BarChart data={scoreDistribution}>
            <CartesianGrid stroke="#1A2436" />
            <XAxis dataKey="range" stroke="#4A5568" />
            <YAxis stroke="#4A5568" />
            <ChartTooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#00FFB2" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Volume by DEX">
          <PieChart>
            <Pie data={dex} dataKey="value" innerRadius={70} outerRadius={112} paddingAngle={6}>
              {dex.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ChartCard>
      </div>
    </section>
  );
}

function DashboardHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 xl:flex-row xl:items-end">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-geist text-[clamp(34px,5vw,64px)] font-bold leading-tight tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-text-secondary">{copy}</p>
      </div>
      <div className="hidden xl:block">
        <WalletButton />
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ToggleField({
  form,
  name,
  label,
}: {
  form: FormBinding;
  name: "vestingEnabled" | "mintRevoked" | "freezeRevoked";
  label: string;
}) {
  const enabled = form.watch(name);

  return (
    <button
      type="button"
      onClick={() => form.setValue(name, !enabled, { shouldValidate: true })}
      className={cn(
        "rounded-md border p-4 text-left transition",
        enabled ? "border-primary/40 bg-primary/10" : "border-border-subtle bg-bg-elevated/40",
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-6 w-10 place-items-center rounded-pill transition",
            enabled ? "bg-primary text-bg-base" : "bg-white/10 text-text-muted",
          )}
        >
          {enabled ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between gap-4">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-sm text-primary">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full accent-primary"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <Card variant="glass" className="p-4">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className={cn("mt-3 font-geist text-2xl font-semibold", positive === true && "text-primary", positive === false && "text-danger")}>
        {value}
      </p>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-bg-elevated/50 p-4">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-right font-mono text-sm text-text-primary">{value}</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card variant="glass" className="h-96 p-5">
      <h3 className="font-geist text-xl font-semibold">{title}</h3>
      <div className="mt-5 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "#0F1624",
  border: "1px solid #1A2436",
  borderRadius: "8px",
  color: "#F0F4FF",
};
