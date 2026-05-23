import { NextRequest, NextResponse } from "next/server";
import { MOCK_PROJECTS } from "@/lib/mockData";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}
