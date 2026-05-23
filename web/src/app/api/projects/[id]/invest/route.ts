import { NextResponse, type NextRequest } from "next/server";
import { findProject } from "@/lib/mock-data";

type RouteContext = {
  params: {
    id: string;
  };
};

type InvestmentBody = {
  txSignature?: string;
  walletAddress?: string;
  amountSol?: number;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const project = findProject(params.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: InvestmentBody;

  try {
    body = (await request.json()) as InvestmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.txSignature || !body.walletAddress || !body.amountSol) {
    return NextResponse.json(
      { error: "txSignature, walletAddress and amountSol are required" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    investment: {
      id: `investment-${Date.now()}`,
      projectId: project.id,
      walletAddress: body.walletAddress,
      amountSol: body.amountSol,
      tokenAmount: `${Math.round(body.amountSol * 100000)}`,
      txSignature: body.txSignature,
      createdAt: new Date().toISOString(),
    },
  });
}
