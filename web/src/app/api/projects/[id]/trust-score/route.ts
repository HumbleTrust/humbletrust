import { NextResponse, type NextRequest } from "next/server";
import { findProject } from "@/lib/mock-data";
import { buildBreakdownItems, calculateTrustScore } from "@/lib/trust-score";

type RouteContext = {
  params: {
    id: string;
  };
};

export function GET(_request: NextRequest, { params }: RouteContext) {
  const project = findProject(params.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const trust = calculateTrustScore(project);

  return NextResponse.json({
    score: trust.score,
    breakdown: trust.breakdown,
    factors: buildBreakdownItems(trust.breakdown),
    history: project.scoreHistory,
  });
}

export function POST(_request: NextRequest, { params }: RouteContext) {
  const project = findProject(params.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const trust = calculateTrustScore(project);

  return NextResponse.json({
    score: trust.score,
    breakdown: trust.breakdown,
    reason: "Recalculated from latest on-chain state snapshot.",
  });
}
