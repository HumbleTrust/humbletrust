import { NextRequest } from "next/server";
import { json, options } from "../../_lib/http";
import { getAuraColor, getZodiac } from "../../_lib/zodiac";
import { getClient, hasSupabaseConfig } from "../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

const MINT_PRICE_SOL = 0.2;

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const { wallet, tx_signature, token_created_at } = body;
  if (!wallet) return json(request, { error: "wallet required" }, { status: 400 });
  if (!isValidWallet(wallet)) return json(request, { error: "invalid wallet address" }, { status: 400 });

  try {
    const db = getClient();
    const [{ data: existing }, { data: premiumToken }] = await Promise.all([
      db.from("badges").select("*").eq("wallet", wallet).maybeSingle(),
      db.from("tokens").select("mint").eq("creator", wallet).eq("tier", "premium").limit(1).maybeSingle(),
    ]);

    if (!premiumToken) {
      return json(request, { error: "not_premium_creator", message: "Only Premium token creators can mint a badge" }, { status: 403 });
    }

    if (existing?.status === "active") {
      return json(request, { error: "already_owns", message: "Wallet already owns a badge", badge: existing }, { status: 409 });
    }

    if (existing?.status === "sold" || existing?.status === "cooldown") {
      const now = new Date();
      const cooldownUntil = new Date(existing.cooldown_until);
      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return json(request, {
          error: "cooldown_active",
          message: `Badge sold. Can re-mint in ${daysLeft} day(s).`,
          cooldown_until: existing.cooldown_until,
          days_left: daysLeft,
        }, { status: 403 });
      }
    }

    const refDate = token_created_at ? new Date(token_created_at) : new Date();
    const { name: zodiac, element } = getZodiac(Number.isNaN(refDate.getTime()) ? new Date() : refDate);
    const auraColor = getAuraColor(wallet);

    const { data: rpcEdition, error: rpcError } = await db.rpc("increment_badge_edition", { z: zodiac });
    let edition = Number(rpcEdition || 0);
    if (rpcError || !edition) {
      const { count } = await db.from("badges").select("wallet", { count: "exact", head: true }).eq("zodiac", zodiac);
      edition = (count ?? 0) + 1;
    }

    const { data: badge, error } = await db
      .from("badges")
      .upsert({
        wallet,
        zodiac,
        element,
        aura_color: auraColor,
        edition,
        tx_signature: tx_signature || null,
        price_sol: MINT_PRICE_SOL,
        status: "active",
        minted_at: new Date().toISOString(),
        sold_at: null,
      }, { onConflict: "wallet" })
      .select()
      .single();

    if (error) throw error;

    return json(request, {
      ok: true,
      badge: badge ?? { wallet, zodiac, element, aura_color: auraColor, edition, status: "active" },
    });
  } catch (error) {
    console.error("[api/badges/mint]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

