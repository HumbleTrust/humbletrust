import { NextResponse, type NextRequest } from "next/server";
import { projects } from "@/lib/mock-data";
import { calculateTrustScore } from "@/lib/trust-score";
import type { DexChoice, Project } from "@/types";

function filteredProjects(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const minScore = Number(params.get("minScore") ?? 0);
  const maxScore = Number(params.get("maxScore") ?? 100);
  const sort = params.get("sort") ?? "newest";

  const filtered = projects
    .filter((project) => (status ? project.status === status : true))
    .filter((project) => project.trustScore >= minScore && project.trustScore <= maxScore);

  if (sort === "highest-score") {
    return filtered.sort((a, b) => b.trustScore - a.trustScore);
  }

  if (sort === "most-funded") {
    return filtered.sort((a, b) => b.totalInvestedSol - a.totalInvestedSol);
  }

  if (sort === "ending-soon") {
    return filtered.sort(
      (a, b) => new Date(a.lockUnlockAt).getTime() - new Date(b.lockUnlockAt).getTime(),
    );
  }

  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function GET(request: NextRequest) {
  return NextResponse.json({ projects: filteredProjects(request) });
}

type CreateProjectBody = {
  name?: string;
  symbol?: string;
  description?: string;
  creatorWallet?: string;
  totalSupply?: string;
  decimals?: 6 | 9;
  lockDurationSeconds?: number;
  vestingEnabled?: boolean;
  creatorAllocationPct?: number;
  mintRevoked?: boolean;
  freezeRevoked?: boolean;
  dex?: DexChoice;
  initialSol?: number;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateProjectBody;
  const createdAt = new Date().toISOString();
  const lockDurationSeconds = body.lockDurationSeconds ?? 90 * 86400;
  const totalInvestedSol = Number(body.initialSol ?? 0);
  const id = `${body.symbol?.toLowerCase() ?? "launch"}-${Date.now()}`;

  const draft = {
    liquidityLocked: true,
    lockDurationSeconds,
    mintRevoked: body.mintRevoked ?? true,
    freezeRevoked: body.freezeRevoked ?? true,
    vestingEnabled: body.vestingEnabled ?? true,
    creatorAllocationPct: body.creatorAllocationPct ?? 5,
    createdAt,
  };

  const trust = calculateTrustScore(draft);
  const project: Project = {
    id,
    mintAddress: `MockMint${id}`,
    name: body.name ?? "Untitled Launch",
    symbol: (body.symbol ?? "NEW").toUpperCase(),
    description: body.description ?? "New HumbleTrust launch.",
    creatorWallet: body.creatorWallet ?? "WalletSignatureRequired",
    totalSupply: body.totalSupply ?? "1000000000",
    decimals: body.decimals ?? 9,
    trustScore: trust.score,
    liquidityLocked: true,
    lockDurationSeconds,
    lockUnlockAt: new Date(Date.now() + lockDurationSeconds * 1000).toISOString(),
    vestingEnabled: draft.vestingEnabled,
    creatorAllocationPct: draft.creatorAllocationPct,
    mintRevoked: draft.mintRevoked,
    freezeRevoked: draft.freezeRevoked,
    dex: body.dex ?? "raydium",
    vaultPda: `VaultPDA${id}`,
    programId: process.env.NEXT_PUBLIC_PROGRAM_ID ?? "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr",
    status: "pending",
    totalInvestedSol,
    holderCount: 0,
    createdAt,
    updatedAt: createdAt,
    sevenDayActivity: [],
    volume24h: 0,
    price: 0,
    change24h: 0,
    goalSol: Math.max(totalInvestedSol * 2, 1000),
    marketCap: 0,
    circulatingSupply: "0",
    investments: [],
    scoreHistory: [
      {
        id: `${id}-score-1`,
        projectId: id,
        score: trust.score,
        breakdown: trust.breakdown,
        reason: "Draft launch calculated from submitted anti-rug configuration.",
        createdAt,
      },
    ],
  };

  return NextResponse.json({ project }, { status: 201 });
}
