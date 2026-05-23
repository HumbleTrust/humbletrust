import { NextRequest } from "next/server";
import { json, options } from "../_lib/http";
import { getClient, hasSupabaseConfig } from "../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  const wallet = request.nextUrl.searchParams.get("wallet");
  if (wallet && !isValidWallet(wallet)) return json(request, { error: "invalid wallet address" }, { status: 400 });

  try {
    const db = getClient();

    if (wallet) {
      const { data, error } = await db
        .from("badges")
        .select("wallet,zodiac,element,aura_color,edition,status,minted_at,cooldown_until")
        .eq("wallet", wallet)
        .maybeSingle();
      if (error) throw error;
      return json(request, { badge: data });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);
    const { data, error } = await db
      .from("badges")
      .select("wallet,zodiac,element,aura_color,edition,status,minted_at")
      .eq("status", "active")
      .order("edition", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return json(request, { badges: data ?? [] });
  } catch (error) {
    console.error("[api/badges]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

