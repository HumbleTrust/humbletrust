import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { json, options } from "../../_lib/http";
import { getClient, hasSupabaseConfig } from "../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

const timingSafeEqual = (a: string | null, b: string | undefined) => {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, Buffer.alloc(left.length));
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig) return json(request, { error: "Supabase not configured" }, { status: 503 });
  if (!timingSafeEqual(request.headers.get("x-internal-secret"), process.env.INTERNAL_SECRET)) {
    return json(request, { error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { wallet } = body;
  if (!wallet) return json(request, { error: "wallet required" }, { status: 400 });
  if (!isValidWallet(wallet)) return json(request, { error: "invalid wallet address" }, { status: 400 });

  try {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { error } = await getClient()
      .from("badges")
      .update({
        status: "sold",
        sold_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString(),
      })
      .eq("wallet", wallet)
      .eq("status", "active");

    if (error) throw error;
    return json(request, { ok: true, sold_at: now.toISOString(), cooldown_until: cooldownUntil.toISOString() });
  } catch (error) {
    console.error("[api/badges/sold]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

