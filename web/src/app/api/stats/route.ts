import { NextResponse } from "next/server";

export async function GET() {
  // Real platform stats (would come from DB/on-chain in production)
  const stats = {
    tvl: 31894,
    projectsLaunched: 10,
    investorsProtected: 14238,
    rugsPreventedCount: 0,
  };
  return NextResponse.json(stats);
}
