import { NextRequest } from "next/server";
import { json, options } from "../../../_lib/http";
import { getClient, hasSupabaseConfig } from "../../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

export async function GET(request: NextRequest, context: { params: Promise<{ mint: string }> }) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  const { mint } = await context.params;
  if (!mint) return json(request, { error: "mint required" }, { status: 400 });
  if (!isValidWallet(mint)) return json(request, { error: "invalid mint address" }, { status: 400 });

  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 500);
    const { data, error } = await getClient()
      .from("trades")
      .select("signature,trader,side,source,token_amount,sol_amount,price_sol,fee_lamports,slot,block_time")
      .eq("mint", mint)
      .order("block_time", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return json(request, { trades: data ?? [] });
  } catch (error) {
    console.error("[api/tokens/[mint]/trades]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

