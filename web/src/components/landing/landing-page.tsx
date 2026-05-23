"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Gauge,
  KeyRound,
  Lock,
  MessageCircle,
  PieChart,
  Rocket,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/core/animated-number";
import { NetworkBadge } from "@/components/core/network-badge";
import { ProjectCard } from "@/components/core/project-card";
import { ScoreBreakdownBar } from "@/components/core/score-breakdown-bar";
import { TrustScoreMeter } from "@/components/core/trust-score-meter";
import { WalletButton } from "@/components/core/wallet-button";
import { Logo } from "@/components/layout/logo";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useStats } from "@/hooks/use-projects";
import { buildBreakdownItems, calculateTrustScore, scoreFilterBounds } from "@/lib/trust-score";
import { cn } from "@/lib/utils";
import type { Project, RiskFilter } from "@/types";

const ParticleField = dynamic(() => import("@/components/core/particle-field"), {
  ssr: false,
});

const words = "Trust infrastructure for launches that cannot fake accountability.".split(" ");

const problemRows = [
  ["Liquidity promise", "LP tokens live in a creator wallet"],
  ["Team allocation", "Supply can hit the market before the community sees it"],
  ["Mint authority", "A private key can inflate supply after launch"],
  ["Risk signals", "Investors read tweets instead of state"],
] as const;

const solutionRows = [
  ["PDA vault", "Funds move only under program rules"],
  ["Staged vesting", "Creator unlocks follow the 30/60/90 day schedule"],
  ["Revoked authority", "Fixed supply and no holder freeze path"],
  ["TrustScore", "Risk updates as on-chain state changes"],
] as const;

const features = [
  {
    icon: Lock,
    title: "On-chain enforcement",
    copy: "Rules written in Rust, not in promises.",
  },
  {
    icon: ShieldCheck,
    title: "Liquidity vault",
    copy: "LP tokens go in. Only time lets them out.",
  },
  {
    icon: CalendarClock,
    title: "Creator vesting",
    copy: "Token allocation unlocks on schedule. No exceptions.",
  },
  {
    icon: Gauge,
    title: "TrustScore engine",
    copy: "Every launch gets a score. Math does not need charisma.",
  },
  {
    icon: PieChart,
    title: "Fee sharing economy",
    copy: "Creators earn from success, not from exit.",
  },
  {
    icon: KeyRound,
    title: "Multisig protocol",
    copy: "No single key controls anything critical.",
  },
] as const;

const scenarios = [
  {
    label: "Verified Launch",
    input: {
      liquidityLocked: true,
      lockDurationSeconds: 365 * 86400,
      mintRevoked: true,
      freezeRevoked: true,
      vestingEnabled: true,
      creatorAllocationPct: 4,
      createdAt: new Date(Date.now() - 95 * 86400000).toISOString(),
    },
  },
  {
    label: "Moderate Risk",
    input: {
      liquidityLocked: true,
      lockDurationSeconds: 30 * 86400,
      mintRevoked: true,
      freezeRevoked: false,
      vestingEnabled: false,
      creatorAllocationPct: 9,
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    },
  },
  {
    label: "High Risk",
    input: {
      liquidityLocked: false,
      lockDurationSeconds: 0,
      mintRevoked: false,
      freezeRevoked: false,
      vestingEnabled: false,
      creatorAllocationPct: 14,
      createdAt: new Date().toISOString(),
    },
  },
] as const;

const section = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <LandingNav />
      <HeroSection />
      <ProblemSolution />
      <HowItWorks />
      <TrustScoreDemo />
      <LiveProjects />
      <FeatureGrid />
      <StatsBanner />
      <FinalCta />
      <Footer />
    </main>
  );
}

function LandingNav() {
  const links = [
    ["How it works", "#how"],
    ["Projects", "#projects"],
    ["Launch", "/app/launch"],
    ["Docs", "#docs"],
  ] as const;

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/[0.04] bg-bg-base/62 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 rounded-pill border border-border-subtle bg-white/[0.03] p-1 md:flex">
          {links.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="group relative rounded-pill px-4 py-2 text-sm text-text-secondary transition hover:text-text-primary"
            >
              {label}
              <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-primary transition group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <NetworkBadge />
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  const { data } = useStats();
  const stats = data?.stats;

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pb-20 pt-28">
      <ParticleField />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,rgba(0,255,178,0.08),transparent_28rem),linear-gradient(180deg,rgba(5,8,15,0.28),#05080f_92%)]" />
      <div className="section-shell z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-7 inline-flex items-center gap-3 rounded-pill border border-primary/20 bg-primary/10 px-4 py-2"
        >
          <SolanaMark />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            Built on Solana
          </span>
        </motion.div>
        <h1 className="mx-auto max-w-5xl font-geist text-[clamp(46px,8vw,92px)] font-extrabold leading-[0.95] tracking-[-0.04em] text-text-primary">
          {words.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              initial={{ opacity: 0, filter: "blur(20px)", y: 18 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="mr-[0.22em] inline-block"
            >
              {word}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-text-secondary"
        >
          HumbleTrust turns launch promises into Solana-enforced rules: vault custody,
          locked liquidity, staged vesting, and a TrustScore everyone can verify.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/app/launch" className={buttonClassName({ size: "lg" })}>
            Launch a Token
            <Rocket className="h-4 w-4" />
          </Link>
          <Link
            href="/app"
            className={buttonClassName({ variant: "ghost", size: "lg" })}
          >
            Explore Projects
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.05 }}
          className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-bg-surface/60 p-3 backdrop-blur sm:grid-cols-3"
        >
          <HeroStat label="Total locked" value={stats?.totalLockedSol ?? 0} suffix=" SOL" />
          <HeroStat label="Projects live" value={stats?.projectsLive ?? 0} />
          <HeroStat label="Rugs prevented" value={stats?.rugsPrevented ?? 0} />
        </motion.div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-black/15 p-4 text-left">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 font-geist text-2xl font-semibold text-text-primary">
        <AnimatedNumber value={value} compact suffix={suffix} />
      </p>
    </div>
  );
}

function ProblemSolution() {
  return (
    <MotionSection className="section-shell grid gap-6 py-24 lg:grid-cols-[1fr_80px_1fr]">
      <Card className="border-danger/20 bg-danger/[0.035] p-6">
        <p className="eyebrow border-danger/20 bg-danger/10 text-danger">What breaks</p>
        <h2 className="mt-5 font-geist text-4xl font-bold tracking-[-0.03em]">
          Rugs begin where control is invisible.
        </h2>
        <div className="mt-7 space-y-3">
          {problemRows.map(([title, copy], index) => (
            <motion.div
              key={title}
              variants={section}
              transition={{ delay: index * 0.06 }}
              className="flex gap-3 rounded-md border border-danger/10 bg-black/15 p-4"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                <X className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm leading-6 text-text-secondary">{copy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
      <div className="hidden items-center justify-center lg:flex">
        <div className="h-full w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
      </div>
      <Card className="border-primary/20 bg-primary/[0.035] p-6">
        <p className="eyebrow">What changes</p>
        <h2 className="mt-5 font-geist text-4xl font-bold tracking-[-0.03em]">
          HumbleTrust makes the escape route unreachable.
        </h2>
        <div className="mt-7 space-y-3">
          {solutionRows.map(([title, copy], index) => (
            <motion.div
              key={title}
              variants={section}
              transition={{ delay: index * 0.06 }}
              className="flex gap-3 rounded-md border border-primary/10 bg-black/15 p-4"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm leading-6 text-text-secondary">{copy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </MotionSection>
  );
}

function HowItWorks() {
  const steps = [
    ["Creator launches token", "Vesting, lock duration, allocation cap, and authority choices are committed before investors participate."],
    ["Funds enter the vault", "Investor SOL moves into a PDA-controlled vault. The creator never receives direct custody."],
    ["Liquidity locks itself", "Raydium or Orca LP tokens go directly to the program lock, with unlock time enforced on-chain."],
    ["TrustScore goes live", "Risk updates as vault state, authority state, and time-based factors change."],
  ] as const;

  return (
    <MotionSection id="how" className="section-shell py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Execution path</p>
        <h2 className="mt-5 font-geist text-5xl font-bold tracking-[-0.03em]">
          Accountability, compiled.
        </h2>
      </div>
      <div className="relative mt-12 grid gap-4 lg:grid-cols-4">
        <motion.div
          className="absolute left-0 top-10 hidden h-px bg-gradient-to-r from-primary via-secondary to-accent lg:block"
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {steps.map(([title, copy], index) => (
          <motion.div
            key={title}
            variants={section}
            transition={{ delay: index * 0.08 }}
            className="relative rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-card-glow"
          >
            <div className="grid h-10 w-10 place-items-center rounded-md border border-primary/25 bg-primary/10 font-mono text-sm text-primary">
              0{index + 1}
            </div>
            <h3 className="mt-6 font-geist text-xl font-semibold">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{copy}</p>
          </motion.div>
        ))}
      </div>
    </MotionSection>
  );
}

function TrustScoreDemo() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const trust = useMemo(() => calculateTrustScore(scenarios[scenarioIndex].input), [scenarioIndex]);
  const factors = useMemo(() => buildBreakdownItems(trust.breakdown), [trust.breakdown]);

  return (
    <MotionSection className="section-shell py-24">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow">TrustScore engine</p>
          <h2 className="mt-5 font-geist text-5xl font-bold tracking-[-0.03em]">
            Risk that updates when reality updates.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario, index) => (
            <button
              key={scenario.label}
              onClick={() => setScenarioIndex(index)}
              className={cn(
                "rounded-pill border px-4 py-2 text-sm transition",
                scenarioIndex === index
                  ? "border-primary bg-primary text-bg-base"
                  : "border-border-subtle bg-bg-surface text-text-secondary hover:border-primary/40",
              )}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1fr]">
        <Card variant="glass" className="grid min-h-96 place-items-center p-8">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={trust.score}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <TrustScoreMeter score={trust.score} size="xl" />
            </motion.div>
          </AnimatePresence>
        </Card>
        <Card variant="glass" className="p-6">
          <div className="space-y-5">
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
        </Card>
      </div>
    </MotionSection>
  );
}

function LiveProjects() {
  const [filter, setFilter] = useState<RiskFilter>("all");
  const bounds = scoreFilterBounds(filter);
  const { data, isLoading } = useProjects({
    minScore: bounds.min,
    maxScore: bounds.max,
    sort: "highest-score",
  });
  const projects = data?.projects.slice(0, 6) ?? [];
  const filters: RiskFilter[] = ["all", "verified", "safe", "moderate", "risky"];

  return (
    <MotionSection id="projects" className="section-shell py-24">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Live projects</p>
          <h2 className="mt-5 font-geist text-5xl font-bold tracking-[-0.03em]">
            Explore launches with enforceable constraints.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-pill border px-4 py-2 text-sm capitalize transition",
                filter === item
                  ? "border-primary bg-primary text-bg-base"
                  : "border-border-subtle bg-bg-surface text-text-secondary hover:border-primary/40",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-96 rounded-lg" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div layout className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
      <div className="mt-8 text-center">
        <Link href="/app" className={buttonClassName({ variant: "outline", size: "lg" })}>
          Open full explorer
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </MotionSection>
  );
}

function FeatureGrid() {
  return (
    <MotionSection className="section-shell py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Protocol surface</p>
        <h2 className="mt-5 font-geist text-5xl font-bold tracking-[-0.03em]">
          Built for builders who want their code to be believed.
        </h2>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.div
              key={feature.title}
              variants={section}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -8 }}
              className="rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-card-glow transition hover:border-primary/25"
            >
              <div className="grid h-12 w-12 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary transition group-hover:rotate-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-geist text-2xl font-semibold">{feature.title}</h3>
              <p className="mt-3 leading-7 text-text-secondary">{feature.copy}</p>
            </motion.div>
          );
        })}
      </div>
    </MotionSection>
  );
}

function StatsBanner() {
  const { data } = useStats();
  const stats = data?.stats;
  const rows = [
    ["Total Value Locked", stats?.totalLockedSol ?? 0, " SOL"],
    ["Projects Launched", stats?.projectsLive ?? 0, ""],
    ["Investors Protected", stats?.investorsProtected ?? 0, ""],
    ["Rugs Prevented", stats?.rugsPrevented ?? 0, ""],
  ] as const;

  return (
    <MotionSection className="border-y border-primary/15 bg-gradient-to-r from-primary/[0.04] via-secondary/[0.035] to-accent/[0.04] py-16">
      <div className="section-shell grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value, suffix]) => (
          <div key={label}>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-muted">{label}</p>
            <p className="mt-3 font-geist text-4xl font-bold">
              <AnimatedNumber value={value} compact suffix={suffix} />
            </p>
          </div>
        ))}
      </div>
    </MotionSection>
  );
}

function FinalCta() {
  return (
    <MotionSection className="section-shell py-28 text-center">
      <p className="eyebrow">Launch layer</p>
      <h2 className="mx-auto mt-6 max-w-3xl font-geist text-5xl font-bold tracking-[-0.03em]">
        Stop asking investors to believe. Give them code that refuses to cheat.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-text-secondary">
        Start with locked liquidity, staged vesting, and a public score that keeps watching.
      </p>
      <div className="mt-9">
        <Link href="/app/launch" className={buttonClassName({ size: "lg" })}>
          Start Building Trust
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-4 font-mono text-xs text-text-muted">No KYC. No permission. Just code.</p>
    </MotionSection>
  );
}

function Footer() {
  const columns = [
    ["Product", "Explore", "Launch", "Analytics"],
    ["Developers", "Docs", "Program", "API"],
    ["Community", "X", "Discord", "Telegram"],
    ["Legal", "Terms", "Risk", "Disclosures"],
  ] as const;

  return (
    <footer id="docs" className="section-shell border-t border-border-subtle py-10">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_2fr_0.7fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-text-secondary">
            HumbleTrust turns accountability into executable infrastructure.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {columns.map(([title, ...items]) => (
            <div key={title}>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">{title}</p>
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <a key={item} href="#" className="block text-sm text-text-secondary hover:text-primary">
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 lg:justify-end">
          {["X", "GH", "DC"].map((label, index) => (
            <a
              key={index}
              href="#"
              className="grid h-10 w-10 place-items-center rounded-full border border-border-subtle bg-bg-surface text-text-secondary transition hover:border-primary/40 hover:text-primary"
            >
              {label === "DC" ? <MessageCircle className="h-4 w-4" /> : <span className="font-mono text-xs">{label}</span>}
            </a>
          ))}
        </div>
      </div>
      <div className="mt-10 flex flex-col justify-between gap-4 border-t border-border-subtle pt-6 text-sm text-text-muted sm:flex-row">
        <span>© 2026 HumbleTrust. Built on Solana.</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Network status: live
        </span>
      </div>
    </footer>
  );
}

function MotionSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.06,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function SolanaMark() {
  return (
    <span className="grid gap-0.5">
      <span className="block h-1.5 w-5 rounded-full bg-gradient-to-r from-accent via-secondary to-primary" />
      <span className="block h-1.5 w-5 rounded-full bg-gradient-to-r from-primary via-secondary to-accent" />
      <span className="block h-1.5 w-5 rounded-full bg-gradient-to-r from-accent via-secondary to-primary" />
    </span>
  );
}
