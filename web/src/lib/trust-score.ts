import type {
  Project,
  ScoreBreakdownItem,
  TrustScoreBreakdown,
  TrustScoreLabel,
  TrustScoreResult,
} from "@/types";

type ScoreInput = Pick<
  Project,
  | "liquidityLocked"
  | "lockDurationSeconds"
  | "mintRevoked"
  | "freezeRevoked"
  | "vestingEnabled"
  | "creatorAllocationPct"
  | "createdAt"
>;

export function calculateTrustScore(project: ScoreInput): TrustScoreResult {
  const breakdown: TrustScoreBreakdown = {
    liquidityPresent: 0,
    lockDuration: 0,
    mintRevoked: 0,
    freezeRevoked: 0,
    vestingEnabled: 0,
    allocation: 0,
    age: 0,
  };

  if (project.liquidityLocked) {
    breakdown.liquidityPresent = 20;
    const days = project.lockDurationSeconds / 86400;
    if (days >= 365) breakdown.lockDuration = 20;
    else if (days >= 180) breakdown.lockDuration = 15;
    else if (days >= 90) breakdown.lockDuration = 10;
    else if (days >= 30) breakdown.lockDuration = 5;
  }

  breakdown.mintRevoked = project.mintRevoked ? 20 : 0;
  breakdown.freezeRevoked = project.freezeRevoked ? 10 : 0;
  breakdown.vestingEnabled = project.vestingEnabled ? 10 : 0;

  if (project.creatorAllocationPct <= 5) breakdown.allocation = 5;
  else if (project.creatorAllocationPct <= 10) breakdown.allocation = 3;

  const ageDays = (Date.now() - new Date(project.createdAt).getTime()) / 86400000;
  if (ageDays >= 90) breakdown.age = 15;
  else if (ageDays >= 30) breakdown.age = 10;
  else if (ageDays >= 7) breakdown.age = 5;

  const score = Math.min(
    Object.values(breakdown).reduce((sum, points) => sum + points, 0),
    100,
  );

  return { score, breakdown };
}

export function getTrustScoreLabel(score: number): TrustScoreLabel {
  if (score >= 90) return "Verified";
  if (score >= 70) return "Safe";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Risky";
  return "Danger";
}

export function getScoreColor(score: number) {
  if (score >= 90) return "#00FFB2";
  if (score >= 70) return "#00D4FF";
  if (score >= 40) return "#FFB800";
  if (score >= 20) return "#FF7A00";
  return "#FF4444";
}

export function buildBreakdownItems(
  breakdown: TrustScoreBreakdown,
): ScoreBreakdownItem[] {
  return [
    {
      key: "liquidityPresent",
      label: "Liquidity vault",
      points: breakdown.liquidityPresent,
      maxPoints: 20,
      description: "Investor funds and LP tokens are held by program PDAs.",
    },
    {
      key: "lockDuration",
      label: "Lock duration",
      points: breakdown.lockDuration,
      maxPoints: 20,
      description: "Longer immutable liquidity locks earn higher weight.",
    },
    {
      key: "mintRevoked",
      label: "Mint authority",
      points: breakdown.mintRevoked,
      maxPoints: 20,
      description: "Fixed supply after launch, no surprise inflation.",
    },
    {
      key: "freezeRevoked",
      label: "Freeze authority",
      points: breakdown.freezeRevoked,
      maxPoints: 10,
      description: "Holders cannot be frozen out by a privileged key.",
    },
    {
      key: "vestingEnabled",
      label: "Creator vesting",
      points: breakdown.vestingEnabled,
      maxPoints: 10,
      description: "Creator allocation unlocks on the 30/60/90 day schedule.",
    },
    {
      key: "allocation",
      label: "Allocation cap",
      points: breakdown.allocation,
      maxPoints: 5,
      description: "Creator ownership stays inside the 10% protocol cap.",
    },
    {
      key: "age",
      label: "Age bonus",
      points: breakdown.age,
      maxPoints: 15,
      description: "The score matures as the launch survives more on-chain time.",
    },
  ];
}

export function scoreFilterBounds(filter: string) {
  if (filter === "verified") return { min: 90, max: 100 };
  if (filter === "safe") return { min: 70, max: 89 };
  if (filter === "moderate") return { min: 40, max: 69 };
  if (filter === "risky") return { min: 0, max: 39 };
  return { min: 0, max: 100 };
}
