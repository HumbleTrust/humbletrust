import { NextRequest } from "next/server";
import { getClient, hasSupabaseConfig } from "../_lib/supabase";
import { isValidWallet, sanitizeApiError, scoreLevel } from "../_lib/validate";
import { json, options } from "../_lib/http";

export const runtime = "nodejs";

export const OPTIONS = options;

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 200);
    const { data, error } = await getClient()
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return json(request, { tokens: data ?? [] });
  } catch (error) {
    console.error("[api/tokens]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const { mint, creator, name, symbol, signature, launchScore, lockPercent, burnOption, certificateMint, tier } = body;
    const logoUrl = body.logoUrl || body.logo_url || null;

    if (!mint || !creator) return json(request, { error: "mint and creator required" }, { status: 400 });
    if (!isValidWallet(mint)) return json(request, { error: "invalid mint address" }, { status: 400 });
    if (!isValidWallet(creator)) return json(request, { error: "invalid creator address" }, { status: 400 });
    if (name && typeof name === "string" && name.length > 64) return json(request, { error: "name too long (max 64)" }, { status: 400 });
    if (symbol && typeof symbol === "string" && symbol.length > 10) return json(request, { error: "symbol too long (max 10)" }, { status: 400 });
    if (logoUrl && typeof logoUrl !== "string") return json(request, { error: "invalid logo" }, { status: 400 });
    if (logoUrl && logoUrl.length > 180_000) return json(request, { error: "logo too large" }, { status: 400 });
    if (logoUrl && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(logoUrl) && !/^https?:\/\//.test(logoUrl)) {
      return json(request, { error: "invalid logo url" }, { status: 400 });
    }

    const score = Math.min(100, Math.max(0, Number(launchScore) || 0));
    const tierValue = tier === 1 ? "premium" : "standard";
    const row: Record<string, unknown> = {
      mint,
      creator,
      name: name || null,
      symbol: symbol || null,
      launch_tx: signature || null,
      launch_score: score,
      trust_score: score,
      trust_level: scoreLevel(score),
      lock_percent: lockPercent || null,
      burn_option: burnOption || null,
      tier: tierValue,
      updated_at: new Date().toISOString(),
    };
    if (certificateMint) row.certificate_mint = certificateMint;
    if (logoUrl) row.logo_url = logoUrl;

    const { error } = await getClient().from("tokens").upsert(row, { onConflict: "mint", ignoreDuplicates: false });
    if (error) throw error;
    return json(request, { ok: true });
  } catch (error) {
    console.error("[api/tokens]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

