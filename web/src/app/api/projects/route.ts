import { NextRequest, NextResponse } from "next/server";
import { MOCK_PROJECTS } from "@/lib/mockData";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minScore = Number(searchParams.get("minScore") ?? 0);
  const maxScore = Number(searchParams.get("maxScore") ?? 100);
  const sort = searchParams.get("sort") ?? "trustScore";
  const search = searchParams.get("search") ?? "";

  let projects = MOCK_PROJECTS.filter(
    (p) =>
      p.trustScore >= minScore &&
      p.trustScore <= maxScore &&
      (search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.symbol.toLowerCase().includes(search.toLowerCase()))
  );

  if (sort === "trustScore") projects = projects.sort((a, b) => b.trustScore - a.trustScore);
  else if (sort === "invested") projects = projects.sort((a, b) => b.totalInvestedSol - a.totalInvestedSol);
  else if (sort === "newest") projects = projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  else if (sort === "ending") projects = projects.sort((a, b) => new Date(a.lockUnlockAt ?? "").getTime() - new Date(b.lockUnlockAt ?? "").getTime());

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // In production: validate + save to DB
  return NextResponse.json({ success: true, id: "mock-" + Date.now(), ...body }, { status: 201 });
}
