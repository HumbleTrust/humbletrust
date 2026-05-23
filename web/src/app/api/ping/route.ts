import { NextRequest } from "next/server";
import { json, options } from "../_lib/http";

export const OPTIONS = options;

export function GET(request: NextRequest) {
  return json(request, { pong: true, ts: Date.now() });
}

