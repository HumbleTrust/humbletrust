import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  CandlestickData,
} from "lightweight-charts";
import type { ApiTrade } from "../../lib/solana/api";

interface Props {
  trades: ApiTrade[];
  periodSec: number;
  height?: number;
}

function buildCandles(trades: ApiTrade[], periodSec: number): CandlestickData[] {
  const sorted = [...trades]
    .filter(t => Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime());

  const buckets = new Map<number, { open: number; high: number; low: number; close: number }>();
  for (const t of sorted) {
    const ts = Math.floor(new Date(t.block_time).getTime() / 1000);
    const bucket = Math.floor(ts / periodSec) * periodSec;
    const p = Number(t.price_sol);
    const b = buckets.get(bucket);
    if (!b) {
      buckets.set(bucket, { open: p, high: p, low: p, close: p });
    } else {
      b.high = Math.max(b.high, p);
      b.low = Math.min(b.low, p);
      b.close = p;
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => ({ time: time as UTCTimestamp, ...c }));
}

function buildMarkers(trades: ApiTrade[]): SeriesMarker<UTCTimestamp>[] {
  return [...trades]
    .filter(t => (t.side === "buy" || t.side === "sell") && Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime())
    .map(t => ({
      time: Math.floor(new Date(t.block_time).getTime() / 1000) as UTCTimestamp,
      position: (t.side === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
      color: t.side === "buy" ? "#00FF41" : "#FF3C6B",
      shape: (t.side === "buy" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
      size: 1,
    }));
}

export function LightweightTradeChart({ trades, periodSec, height = 208 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.4)",
        fontFamily: "monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(0,255,65,0.4)", labelBackgroundColor: "#00FF41", style: 2 },
        horzLine: { color: "rgba(0,255,65,0.4)", labelBackgroundColor: "#00FF41", style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.35)",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#00FF41",
      downColor: "#FF3C6B",
      borderUpColor: "#00FF41",
      borderDownColor: "#FF3C6B",
      wickUpColor: "rgba(0,255,65,0.6)",
      wickDownColor: "rgba(255,60,107,0.6)",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new (window as any).ResizeObserver(([entry]: any[]) => {
      if (chartRef.current) chartRef.current.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const candles = buildCandles(trades, periodSec);
    seriesRef.current.setData(candles);
    try { seriesRef.current.setMarkers(buildMarkers(trades)); } catch { /* noop */ }
    if (candles.length > 0) chartRef.current?.timeScale().fitContent();
  }, [trades, periodSec]);

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height }} />
  );
}
