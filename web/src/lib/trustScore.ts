import type { Project, TrustScoreResult, ScoreBreakdown } from "@/types";
import { scoreColor, scoreLabel } from "./utils";

export function calculateTrustScore(project: Partial<Project>): TrustScoreResult {
  const breakdown: ScoreBreakdown = {
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
    const days = (project.lockDurationSeconds ?? 0) / 86400;
    if (days >= 365) breakdown.lockDuration = 20;
    else if (days >= 180) breakdown.lockDuration = 15;
    else if (days >= 90) breakdown.lockDuration = 10;
    else if (days >= 30) breakdown.lockDuration = 5;
  }

  breakdown.mintRevoked = project.mintRevoked ? 20 : 0;
  breakdown.freezeRevoked = project.freezeRevoked ? 10 : 0;
  breakdown.vestingEnabled = project.vestingEnabled ? 10 : 0;

  const alloc = project.creatorAllocationPct ?? 0;
  if (alloc <= 5) breakdown.allocation = 5;
  else if (alloc <= 10) breakdown.allocation = 3;

  const ageDays = project.createdAt
    ? (Date.now() - new Date(project.createdAt).getTime()) / 86400000
    : 0;
  if (ageDays >= 90) breakdown.age = 15;
  else if (ageDays >= 30) breakdown.age = 10;
  else if (ageDays >= 7) breakdown.age = 5;

  const score = Math.min(
    Object.values(breakdown).reduce((a, b) => a + b, 0),
    100
  );

  return { score, breakdown, label: scoreLabel(score), color: scoreColor(score) };
}
