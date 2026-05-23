import { NextRequest } from "next/server";
import { json, options } from "../_lib/http";

export const OPTIONS = options;

export function GET(request: NextRequest) {
  return json(request, {
    ok: true,
    message: "Schema is managed via Supabase dashboard SQL editor",
  });
}

