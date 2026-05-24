"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownUp,
  Award,
  BarChart3,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Info,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Zap,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  { tab: "market", label: "Market", icon: TrendingUp },
  { tab: "trade", label: "Trade", icon: ArrowDownUp },
  { tab: "nft", label: "Badges", icon: Award },
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
            {activeTab === "market" ? <MarketTab /> : null}
            {activeTab === "trade" ? <TradeTab /> : null}
            {activeTab === "nft" ? <NftTab /> : null}
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

// ─── Market Tab ───────────────────────────────────────────────────────────────

const POPULAR_ADDRESSES = [
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwt2nCfxKdGS",
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
].join(",");

type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity?: { usd: number };
  fdv?: number;
  info?: { imageUrl?: string };
};

function fmtUsd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(p?: string) {
  if (!p) return "—";
  const n = Number(p);
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(3)}`;
}

function dedupe(pairs: DexPair[]) {
  const best = new Map<string, DexPair>();
  for (const p of pairs) {
    const k = p.baseToken.address;
    if (!best.has(k) || (p.volume?.h24 ?? 0) > (best.get(k)!.volume?.h24 ?? 0)) best.set(k, p);
  }
  return Array.from(best.values()).sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
}

function MarketTab() {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<DexPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"popular" | "search">("popular");
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const fetchPopular = useCallback(async () => {
    cancelPending();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setMode("popular");
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${POPULAR_ADDRESSES}`,
        { signal: ctrl.signal },
      );
      const data = await res.json();
      const sol = ((data.pairs ?? []) as DexPair[]).filter((p) => p.chainId === "solana");
      setPairs(dedupe(sol).slice(0, 24));
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError")
        setError("DexScreener unavailable. Try again later.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    cancelPending();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setMode("search");
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
        { signal: ctrl.signal },
      );
      const data = await res.json();
      const sol = ((data.pairs ?? []) as DexPair[]).filter((p) => p.chainId === "solana");
      setPairs(dedupe(sol).slice(0, 24));
      if (sol.length === 0) setError(`No Solana results for "${q}"`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError")
        setError("Search failed. Try again.");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => void fetchSearch(val), 500);
    }
  };

  useEffect(() => {
    void fetchPopular();
    return cancelPending;
  }, [fetchPopular]);

  return (
    <section>
      <DashboardHeader
        eyebrow="Market Watch · Mainnet"
        title="Solana live market."
        copy="Real tokens · DexScreener data · Live charts. Monitor only — your tokens are on devnet."
      />

      {/* Search bar */}
      <form
        className="mt-8 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3 md:flex-row md:items-center"
        onSubmit={(e) => { e.preventDefault(); void fetchSearch(query); }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Token name, symbol, or address…"
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} icon={<Search className="h-4 w-4" />}>
            Search
          </Button>
          <Button
            type="button"
            variant={mode === "popular" ? "primary" : "outline"}
            disabled={busy}
            icon={<TrendingUp className="h-4 w-4" />}
            onClick={() => { setQuery(""); void fetchPopular(); }}
          >
            Popular
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => mode === "popular" ? fetchPopular() : fetchSearch(query)}
          >
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
          </Button>
        </div>
      </form>

      {error && (
        <Card variant="glass" className="mt-4 p-4 text-sm text-danger">
          {error}
        </Card>
      )}

      {/* Chart modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border-subtle p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-semibold">
                  {selected.baseToken.name}
                  <span className="ml-1 text-text-muted font-normal">/ {selected.quoteToken.symbol}</span>
                </span>
                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] uppercase text-text-muted">
                  {selected.dexId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  DexScreener <ExternalLink className="ml-1 h-3 w-3" />
                </a>
                <button
                  onClick={() => setSelected(null)}
                  className="grid h-8 w-8 place-items-center rounded border border-border-subtle text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Price row */}
            <div className="flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-3">
              <span className="font-geist text-2xl font-bold">{fmtPrice(selected.priceUsd)}</span>
              {(() => {
                const c = selected.priceChange?.h24 ?? 0;
                const col = c > 0 ? "text-primary" : c < 0 ? "text-danger" : "text-text-muted";
                return (
                  <span className={cn("font-mono text-sm font-bold", col)}>
                    {c > 0 ? "▲" : c < 0 ? "▼" : "–"} {Math.abs(c).toFixed(2)}%
                  </span>
                );
              })()}
              <span className="font-mono text-xs text-text-muted">
                Vol 24h: {fmtUsd(selected.volume?.h24 ?? 0)}
              </span>
              <span className="font-mono text-xs text-text-muted">
                Liq: {fmtUsd(selected.liquidity?.usd ?? 0)}
              </span>
              {selected.fdv ? (
                <span className="font-mono text-xs text-text-muted">FDV: {fmtUsd(selected.fdv)}</span>
              ) : null}
            </div>
            <iframe
              src={`${selected.url}?embed=1&theme=dark&info=0&trades=1`}
              className="h-[480px] w-full border-0"
              title={`${selected.baseToken.symbol} chart`}
              sandbox="allow-scripts allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}

      {/* States */}
      {pairs.length === 0 && busy && (
        <div className="mt-10 grid place-items-center">
          <div className="text-center text-text-muted">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3">Loading market data…</p>
          </div>
        </div>
      )}
      {pairs.length === 0 && !busy && !error && (
        <Card variant="glass" className="mt-6 grid min-h-60 place-items-center text-center">
          <div>
            <TrendingUp className="mx-auto h-8 w-8 text-primary" />
            <h3 className="mt-3 font-geist text-xl font-semibold">No results</h3>
            <p className="mt-1 text-text-muted">Try a different query.</p>
          </div>
        </Card>
      )}

      {/* Token grid */}
      {pairs.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pairs.map((pair) => {
            const change = pair.priceChange?.h24 ?? 0;
            const positive = change > 0;
            const negative = change < 0;
            const initials = pair.baseToken.symbol.slice(0, 2).toUpperCase();
            return (
              <button
                key={pair.pairAddress}
                onClick={() => setSelected(pair)}
                className="group rounded-lg border border-border-subtle bg-bg-surface p-4 text-left transition hover:border-primary/30 hover:shadow-[0_0_24px_rgba(0,255,178,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
                    <span>{initials}</span>
                    {pair.info?.imageUrl ? (
                      <img
                        src={pair.info.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{pair.baseToken.symbol}</p>
                    <p className="text-xs text-text-muted truncate">{pair.baseToken.name} · {pair.dexId}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-xs font-bold",
                      positive
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : negative
                          ? "border-danger/20 bg-danger/10 text-danger"
                          : "border-border-subtle text-text-muted",
                    )}
                  >
                    {positive ? "▲" : negative ? "▼" : "–"} {Math.abs(change).toFixed(2)}%
                  </span>
                </div>
                <p className="mt-3 font-geist text-xl font-bold">{fmtPrice(pair.priceUsd)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">Vol 24h</p>
                    <p className="font-mono font-semibold">{fmtUsd(pair.volume?.h24 ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Liquidity</p>
                    <p className="font-mono font-semibold">{fmtUsd(pair.liquidity?.usd ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">FDV</p>
                    <p className="font-mono font-semibold">{pair.fdv ? fmtUsd(pair.fdv) : "—"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-text-muted group-hover:text-primary">
                  <TrendingUp className="h-3 w-3" /> Live chart
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Trade Tab ────────────────────────────────────────────────────────────────

const CURVE_FEE = 0.01;
const INITIAL_TOKEN_RESERVE = 350_000_000;
const INITIAL_SOL_RESERVE = 0.5;

function calcBuy(solIn: number, solReserve: number, tokenReserve: number) {
  const k = solReserve * tokenReserve;
  const newSol = solReserve + solIn * (1 - CURVE_FEE);
  const newToken = k / newSol;
  return Math.max(0, tokenReserve - newToken);
}

function calcSell(tokensIn: number, solReserve: number, tokenReserve: number) {
  const k = solReserve * tokenReserve;
  const newToken = tokenReserve + tokensIn;
  const newSol = k / newToken;
  return Math.max(0, solReserve - newSol) * (1 - CURVE_FEE);
}

function spotPrice(solReserve: number, tokenReserve: number) {
  return solReserve / tokenReserve;
}

function TradeTab() {
  const { connected } = useWallet();
  const { data } = useProjects();
  const projects = data?.projects ?? mockProjects;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [amount, setAmount] = useState("1");
  const [slippage, setSlippage] = useState(1);
  const [showSlippage, setShowSlippage] = useState(false);

  const project = projects.find((p) => p.id === selectedId) ?? projects[0];

  const solReserve = INITIAL_SOL_RESERVE + (project?.totalInvestedSol ?? 0) * 0.6;
  const tokenReserve = INITIAL_TOKEN_RESERVE - calcBuy(project?.totalInvestedSol ?? 0, INITIAL_SOL_RESERVE, INITIAL_TOKEN_RESERVE);
  const price = spotPrice(solReserve, tokenReserve);

  const amountNum = parseFloat(amount) || 0;
  const outputAmount = side === "buy"
    ? calcBuy(amountNum, solReserve, tokenReserve)
    : calcSell(amountNum, solReserve, tokenReserve);
  const priceImpact = amountNum > 0
    ? Math.abs((outputAmount / (amountNum / price) - 1) * 100)
    : 0;
  const minReceived = side === "buy"
    ? outputAmount * (1 - slippage / 100)
    : outputAmount * (1 - slippage / 100);

  const fmtTokens = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K` : n.toFixed(2);

  return (
    <section>
      <DashboardHeader
        eyebrow="Trade"
        title="Buy and sell on the bonding curve."
        copy="Devnet · Prices are simulated from on-chain reserves. Connect your wallet to execute real trades."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Token selector + stats */}
        <div className="space-y-4">
          <Card variant="glass" className="p-5">
            <h3 className="mb-3 font-geist text-lg font-semibold">Select token</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {projects.slice(0, 6).map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      active
                        ? "border-primary/50 bg-primary/10"
                        : "border-border-subtle bg-bg-elevated/40 hover:border-primary/20",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                        {p.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.symbol}</p>
                        <p className="text-xs text-text-muted">{p.name}</p>
                      </div>
                    </div>
                    <p className={cn("mt-2 font-mono text-xs", active ? "text-primary" : "text-text-muted")}>
                      TrustScore {p.trustScore}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Market stats */}
          {project ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Spot Price" value={`${(price * 1000).toFixed(4)}m◎`} />
              <Metric label="SOL Reserve" value={`◎ ${solReserve.toFixed(2)}`} />
              <Metric label="TVL" value={`◎ ${formatSol(project.totalInvestedSol)}`} />
              <Metric label="TrustScore" value={String(project.trustScore)} />
            </div>
          ) : null}

          {/* Bonding curve visual */}
          <Card variant="glass" className="p-5">
            <h3 className="mb-4 font-geist text-lg font-semibold">Bonding curve</h3>
            <div className="relative h-40 w-full overflow-hidden rounded-lg bg-bg-elevated/60">
              <svg viewBox="0 0 300 120" className="h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FFB2" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00FFB2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 120 C30 115 60 100 100 70 C140 40 180 20 220 10 C250 4 280 2 300 1 L300 120 Z"
                  fill="url(#curveGrad)"
                />
                <path
                  d="M0 120 C30 115 60 100 100 70 C140 40 180 20 220 10 C250 4 280 2 300 1"
                  fill="none"
                  stroke="#00FFB2"
                  strokeWidth="2"
                />
                {/* Current position dot */}
                <circle cx={Math.min(280, 20 + (project?.totalInvestedSol ?? 0) * 3)} cy={Math.max(5, 118 - (project?.totalInvestedSol ?? 0) * 3)} r="5" fill="#00FFB2" />
              </svg>
              <div className="absolute bottom-2 left-3 font-mono text-xs text-text-muted">SOL in →</div>
              <div className="absolute left-2 top-2 rotate-[-90deg] font-mono text-xs text-text-muted">Price ↑</div>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Price increases as more SOL enters the pool. The curve is constant-product (x·y=k).
            </p>
          </Card>
        </div>

        {/* Trade panel */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card variant="glass" className="p-5">
            {/* Buy / Sell toggle */}
            <div className="mb-5 grid grid-cols-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={cn(
                    "rounded-md py-2 text-sm font-semibold capitalize transition",
                    side === s
                      ? s === "buy" ? "bg-primary text-bg-base" : "bg-danger text-white"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {s === "buy" ? "▲ Buy" : "▼ Sell"}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-text-muted">
                  <span>You pay</span>
                  <span>{side === "buy" ? "SOL" : project?.symbol}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-2.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-lg text-text-primary outline-none"
                    placeholder="0.00"
                  />
                  <span className="font-mono text-sm text-primary">
                    {side === "buy" ? "◎" : project?.symbol}
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setSide(side === "buy" ? "sell" : "buy")}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border-subtle bg-bg-elevated text-text-muted transition hover:border-primary/40 hover:text-primary"
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <div className="mb-1.5 flex justify-between text-xs text-text-muted">
                  <span>You receive</span>
                  <span>{side === "buy" ? project?.symbol : "SOL"}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-2.5">
                  <span className="flex-1 font-mono text-lg text-text-primary">
                    {amountNum > 0
                      ? side === "buy"
                        ? fmtTokens(outputAmount)
                        : outputAmount.toFixed(4)
                      : "—"}
                  </span>
                  <span className="font-mono text-sm text-text-muted">
                    {side === "buy" ? project?.symbol : "◎"}
                  </span>
                </div>
              </div>
            </div>

            {/* Trade details */}
            {amountNum > 0 && (
              <div className="mt-4 space-y-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Price impact</span>
                  <span className={priceImpact > 5 ? "text-danger" : priceImpact > 2 ? "text-warning" : "text-primary"}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Min received ({slippage}%)</span>
                  <span className="font-mono">
                    {side === "buy" ? fmtTokens(minReceived) : minReceived.toFixed(4)}{" "}
                    {side === "buy" ? project?.symbol : "◎"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Protocol fee (1%)</span>
                  <span className="font-mono">
                    {(amountNum * 0.01).toFixed(4)} {side === "buy" ? "◎" : project?.symbol}
                  </span>
                </div>
              </div>
            )}

            {/* Slippage */}
            <div className="mt-3">
              <button
                onClick={() => setShowSlippage(!showSlippage)}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
              >
                <Settings2 className="h-3 w-3" /> Slippage: {slippage}%
              </button>
              {showSlippage && (
                <div className="mt-2 flex gap-2">
                  {[0.5, 1, 2, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={cn(
                        "rounded border px-2 py-1 text-xs transition",
                        slippage === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-subtle text-text-muted hover:border-primary/40",
                      )}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-5">
              {connected ? (
                <Button size="lg" className="w-full" icon={<Zap className="h-4 w-4" />}>
                  {side === "buy" ? "Buy" : "Sell"} {project?.symbol}
                </Button>
              ) : (
                <WalletButton className="w-full" />
              )}
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-text-secondary">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Devnet only. Trades execute against the on-chain bonding curve program.
                Connect Phantom or Solflare configured for Devnet.
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}

// ─── NFT / Zodiac Badges Tab ──────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  { name: "Aries",       symbol: "♈", element: "Fire",  color: "#FF4444", season: "21 Mar – 19 Apr" },
  { name: "Taurus",      symbol: "♉", element: "Earth", color: "#00FFB2", season: "20 Apr – 20 May" },
  { name: "Gemini",      symbol: "♊", element: "Air",   color: "#00D4FF", season: "21 May – 20 Jun" },
  { name: "Cancer",      symbol: "♋", element: "Water", color: "#3D7FFF", season: "21 Jun – 22 Jul" },
  { name: "Leo",         symbol: "♌", element: "Fire",  color: "#FF7A00", season: "23 Jul – 22 Aug" },
  { name: "Virgo",       symbol: "♍", element: "Earth", color: "#00FFB2", season: "23 Aug – 22 Sep" },
  { name: "Libra",       symbol: "♎", element: "Air",   color: "#7B4FFF", season: "23 Sep – 22 Oct" },
  { name: "Scorpio",     symbol: "♏", element: "Water", color: "#FF3C6B", season: "23 Oct – 21 Nov" },
  { name: "Sagittarius", symbol: "♐", element: "Fire",  color: "#FFB800", season: "22 Nov – 21 Dec" },
  { name: "Capricorn",   symbol: "♑", element: "Earth", color: "#00D4FF", season: "22 Dec – 19 Jan" },
  { name: "Aquarius",    symbol: "♒", element: "Air",   color: "#7B4FFF", season: "20 Jan – 18 Feb" },
  { name: "Pisces",      symbol: "♓", element: "Water", color: "#3D7FFF", season: "19 Feb – 20 Mar" },
] as const;

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Launch with Premium tier",
    body: "Select Premium when launching a token on HumbleTrust. Only Premium creators are eligible to mint a Zodiac Badge.",
  },
  {
    num: "02",
    title: "Zodiac assigned by launch date",
    body: "Your zodiac sign is locked to the calendar date of your token launch. The aura color is hashed from your wallet address.",
  },
  {
    num: "03",
    title: "Unique NFT minted on-chain",
    body: "A Token-2022 NFT is created on Solana with your shield, zodiac glyph, element sigil and aura encoded as on-chain metadata.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I sell my Zodiac Badge?",
    a: "Yes. The badge is a standard Token-2022 NFT and can be listed on any compatible marketplace. After selling, a 30-day cooldown applies before you can mint again.",
  },
  {
    q: "Can I own more than one badge?",
    a: "No. Each wallet can hold one active Zodiac Badge at a time. Selling your badge resets eligibility after the 30-day cooldown.",
  },
  {
    q: "Is it tradeable on Magic Eden?",
    a: "Yes. Zodiac Badges are compatible with Magic Eden, Tensor, and other Solana NFT marketplaces that support Token-2022.",
  },
];

function NftTab() {
  const { connected } = useWallet();
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  const signIndex =
    (month === 2 && day >= 21) || (month === 3 && day <= 19) ? 0 :
    (month === 3 && day >= 20) || (month === 4 && day <= 20) ? 1 :
    (month === 4 && day >= 21) || (month === 5 && day <= 20) ? 2 :
    (month === 5 && day >= 21) || (month === 6 && day <= 22) ? 3 :
    (month === 6 && day >= 23) || (month === 7 && day <= 22) ? 4 :
    (month === 7 && day >= 23) || (month === 8 && day <= 22) ? 5 :
    (month === 8 && day >= 23) || (month === 9 && day <= 22) ? 6 :
    (month === 9 && day >= 23) || (month === 10 && day <= 21) ? 7 :
    (month === 10 && day >= 22) || (month === 11 && day <= 21) ? 8 :
    (month === 11 && day >= 22) || (month === 0 && day <= 19) ? 9 :
    (month === 0 && day >= 20) || (month === 1 && day <= 18) ? 10 : 11;

  const currentSign = ZODIAC_SIGNS[signIndex];

  async function handleMint() {
    if (!connected) return;
    setMinting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setMinting(false);
    setMinted(true);
  }

  return (
    <section>
      <DashboardHeader
        eyebrow="Zodiac Badge NFT"
        title="Your on-chain identity, written in the stars."
        copy="Zodiac Badge NFTs are unique, on-chain shields awarded exclusively to Premium token creators on HumbleTrust."
      />

      {/* Hero badge preview */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Today's sign */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary">Today's sign</span>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border text-5xl"
                style={{
                  borderColor: `${currentSign.color}40`,
                  background: `${currentSign.color}10`,
                  color: currentSign.color,
                  textShadow: `0 0 30px ${currentSign.color}80`,
                }}
              >
                {currentSign.symbol}
              </div>
              <div>
                <h3 className="font-geist text-3xl font-bold" style={{ color: currentSign.color }}>
                  {currentSign.name}
                </h3>
                <p className="mt-1 text-text-secondary">{currentSign.element} · {currentSign.season}</p>
                <p className="mt-2 font-mono text-xs text-text-muted">
                  Token launched today → {currentSign.name} badge
                </p>
              </div>
            </div>
          </Card>

          {/* All 12 signs grid */}
          <Card variant="glass" className="p-5">
            <h3 className="mb-4 font-geist text-lg font-semibold">All 12 Signs</h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {ZODIAC_SIGNS.map((sign) => (
                <div
                  key={sign.name}
                  className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition hover:scale-105"
                  style={{
                    borderColor: `${sign.color}30`,
                    background: `${sign.color}08`,
                  }}
                >
                  <span
                    className="text-3xl"
                    style={{ color: sign.color, textShadow: `0 0 20px ${sign.color}60` }}
                  >
                    {sign.symbol}
                  </span>
                  <p className="text-xs font-semibold">{sign.name}</p>
                  <p className="text-[10px] text-text-muted">{sign.element}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* How it works */}
          <Card variant="glass" className="p-5">
            <h3 className="mb-4 font-geist text-lg font-semibold">How it works</h3>
            <div className="space-y-4">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.num} className="flex gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-mono text-sm font-bold text-primary">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* FAQ */}
          <Card variant="glass" className="p-5">
            <h3 className="mb-4 font-geist text-lg font-semibold">FAQ</h3>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="rounded-lg border border-border-subtle overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between p-4 text-left text-sm font-medium hover:bg-bg-elevated/40"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {item.q}
                    <span className="ml-3 text-primary">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-border-subtle bg-bg-elevated/30 px-4 py-3 text-sm text-text-secondary">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Mint panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card variant="glass" className="p-5">
            {minted ? (
              <div className="grid min-h-64 place-items-center text-center">
                <div>
                  <div
                    className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-xl text-5xl"
                    style={{
                      background: `${currentSign.color}15`,
                      color: currentSign.color,
                      textShadow: `0 0 30px ${currentSign.color}`,
                    }}
                  >
                    {currentSign.symbol}
                  </div>
                  <h3 className="font-geist text-xl font-bold text-primary">Badge minted!</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    Your {currentSign.name} badge is on-chain.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Your badge</p>
                  <div
                    className="mt-3 grid h-36 w-36 mx-auto place-items-center rounded-xl border text-7xl"
                    style={{
                      borderColor: `${currentSign.color}40`,
                      background: `linear-gradient(135deg, ${currentSign.color}15, ${currentSign.color}05)`,
                      color: currentSign.color,
                      textShadow: `0 0 40px ${currentSign.color}80`,
                      boxShadow: `0 0 40px ${currentSign.color}20`,
                    }}
                  >
                    {currentSign.symbol}
                  </div>
                  <p className="mt-3 text-center font-geist text-xl font-bold" style={{ color: currentSign.color }}>
                    {currentSign.name}
                  </p>
                  <p className="text-center text-sm text-text-muted">{currentSign.element} · {currentSign.season}</p>
                </div>

                <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Standard</span>
                    <span>Token-2022 NFT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Network</span>
                    <span className="text-primary">Devnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Eligibility</span>
                    <span>Premium launches only</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Mint fee</span>
                    <span>~0.01 SOL</span>
                  </div>
                </div>

                <div className="mt-5">
                  {connected ? (
                    <Button
                      size="lg"
                      className="w-full"
                      loading={minting}
                      onClick={handleMint}
                      icon={<Award className="h-4 w-4" />}
                    >
                      Mint {currentSign.name} Badge
                    </Button>
                  ) : (
                    <WalletButton className="w-full" />
                  )}
                </div>
              </>
            )}
          </Card>
        </aside>
      </div>
    </section>
  );
}
