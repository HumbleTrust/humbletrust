import { NextRequest } from "next/server";
import { json, options } from "../../_lib/http";
import { getClient, hasSupabaseConfig } from "../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return json(request, { error: "wallet required" }, { status: 400 });
  if (!isValidWallet(wallet)) return json(request, { error: "invalid wallet address" }, { status: 400 });

  try {
    const db = getClient();
    const [{ data: badge }, { data: premiumToken }] = await Promise.all([
      db.from("badges").select("*").eq("wallet", wallet).maybeSingle(),
      db.from("tokens").select("mint").eq("creator", wallet).eq("tier", "premium").limit(1).maybeSingle(),
    ]);

    const isPremium = Boolean(premiumToken);
    if (!badge) {
      if (!isPremium) return json(request, { can_mint: false, reason: "not_premium_creator", badge: null });
      return json(request, { can_mint: true, reason: null, badge: null });
    }

    if (badge.status === "active") {
      return json(request, { can_mint: false, reason: "already_owns", badge });
    }

    if (badge.status === "sold" || badge.status === "cooldown") {
      const now = new Date();
      const cooldownUntil = new Date(badge.cooldown_until);
      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return json(request, {
          can_mint: false,
          reason: "cooldown",
          cooldown_until: badge.cooldown_until,
          days_left: daysLeft,
          badge,
        });
      }

      if (!isPremium) return json(request, { can_mint: false, reason: "not_premium_creator", badge });
      return json(request, { can_mint: true, reason: "cooldown_expired", badge });
    }

    if (!isPremium) return json(request, { can_mint: false, reason: "not_premium_creator", badge });
    return json(request, { can_mint: true, reason: null, badge });
  } catch (error) {
    console.error("[api/badges/eligibility]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

