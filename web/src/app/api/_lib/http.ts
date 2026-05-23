import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://humbletrust.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
]);

export const corsHeaders = (request?: NextRequest) => {
  const origin = request?.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://humbletrust.vercel.app",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-internal-secret",
    Vary: "Origin",
  };
};

export const json = (request: NextRequest, body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init?.headers ?? {}),
    },
  });

export const options = (request: NextRequest) =>
  new NextResponse(null, { status: 204, headers: corsHeaders(request) });

export const methodNotAllowed = (request: NextRequest) =>
  json(request, { error: "Method not allowed" }, { status: 405 });

