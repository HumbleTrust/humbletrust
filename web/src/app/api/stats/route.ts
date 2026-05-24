import { NextResponse } from "next/server";
import { platformStats } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json({ stats: platformStats });
}
