import { NextResponse, type NextRequest } from "next/server";
import { portfolioPositions, projects } from "@/lib/mock-data";

type RouteContext = {
  params: {
    wallet: string;
  };
};

export function GET(_request: NextRequest, { params }: RouteContext) {
  return NextResponse.json({
    wallet: params.wallet,
    investments: portfolioPositions,
    launches: projects.slice(0, 2),
    vesting: projects.slice(0, 3).map((project, index) => ({
      projectId: project.id,
      symbol: project.symbol,
      claimedPct: index * 2,
      claimablePct: index === 0 ? 2 : 0,
      lockedPct: Math.max(0, project.creatorAllocationPct - index * 2),
    })),
  });
}
