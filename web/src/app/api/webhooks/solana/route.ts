import { NextResponse, type NextRequest } from "next/server";

type SolanaWebhookEvent = {
  signature?: string;
  type?: string;
  projectId?: string;
};

export async function POST(request: NextRequest) {
  const event = (await request.json()) as SolanaWebhookEvent;

  return NextResponse.json({
    received: true,
    signature: event.signature ?? null,
    type: event.type ?? "unknown",
    projectId: event.projectId ?? null,
  });
}
