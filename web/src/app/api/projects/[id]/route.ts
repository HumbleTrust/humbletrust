import { NextResponse, type NextRequest } from "next/server";
import { findProject } from "@/lib/mock-data";

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

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const project = findProject(params.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<typeof project>;

  return NextResponse.json({
    project: {
      ...project,
      ...body,
      id: project.id,
      updatedAt: new Date().toISOString(),
    },
  });
}
