import { NextRequest } from "next/server";
import { json, options } from "../../_lib/http";
import { getClient, hasSupabaseConfig } from "../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

export async function GET(request: NextRequest, context: { params: Promise<{ mint: string }> }) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  const { mint } = await context.params;
  if (!mint) return json(request, { error: "mint required" }, { status: 400 });
  if (!isValidWallet(mint)) return json(request, { error: "invalid mint address" }, { status: 400 });

  try {
    const { data, error } = await getClient().from("tokens").select("*").eq("mint", mint).single();
    if (error) return json(request, { error: "not found" }, { status: 404 });
    return json(request, { token: data });
  } catch (error) {
    console.error("[api/tokens/[mint]]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

