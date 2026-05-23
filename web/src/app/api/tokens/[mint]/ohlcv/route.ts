import { NextRequest } from "next/server";
import { json, options } from "../../../_lib/http";
import { getClient, hasSupabaseConfig } from "../../../_lib/supabase";
import { isValidWallet, sanitizeApiError } from "../../../_lib/validate";

export const runtime = "nodejs";

export const OPTIONS = options;

const TIMEFRAMES = new Set(["1s", "5s", "1m", "5m", "1h"]);

export async function GET(request: NextRequest, context: { params: Promise<{ mint: string }> }) {
  if (!hasSupabaseConfig) return json(request, { candles: [], timeframe: "1m" }, { status: 200 });

  const { mint } = await context.params;
  if (!mint) return json(request, { error: "mint required" }, { status: 400 });
  if (!isValidWallet(mint)) return json(request, { error: "invalid mint address" }, { status: 400 });

  const timeframe = request.nextUrl.searchParams.get("tf") || "1m";
  if (!TIMEFRAMES.has(timeframe)) return json(request, { error: "invalid timeframe" }, { status: 400 });
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 500, 1000);

  try {
    const { data, error } = await getClient()
      .from("ohlcv")
      .select("bucket,open,high,low,close,volume_token,volume_sol")
      .eq("mint", mint)
      .eq("timeframe", timeframe)
      .order("bucket", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const candles = [...(data ?? [])].reverse().map((row) => ({
      time: Math.floor(new Date(row.bucket as string).getTime() / 1000),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume_token),
      volumeSol: Number(row.volume_sol),
    }));
    return json(request, { candles, timeframe });
  } catch (error) {
    console.error("[api/tokens/[mint]/ohlcv]", error);
    return json(request, { error: sanitizeApiError(error) }, { status: 500 });
  }
}

