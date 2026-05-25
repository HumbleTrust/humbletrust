import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  CandlestickData,
  LineData,
  HistogramData,
} from "lightweight-charts";
import type { ApiTrade } from "../../lib/solana/api";

interface Props {
  trades: ApiTrade[];
  periodSec: number;
  height?: number;
  showVolume?: boolean;
  showSma20?: boolean;
  showSma50?: boolean;
  showEma20?: boolean;
}

function buildCandles(trades: ApiTrade[], periodSec: number): CandlestickData[] {
  const sorted = [...trades]
    .filter(t => Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime());

  const buckets = new Map<number, { open: number; high: number; low: number; close: number; vol: number }>();
  for (const t of sorted) {
    const ts = Math.floor(new Date(t.block_time).getTime() / 1000);
    const bucket = Math.floor(ts / periodSec) * periodSec;
    const p = Number(t.price_sol);
    const v = Number(t.sol_amount);
    const b = buckets.get(bucket);
    if (!b) {
      buckets.set(bucket, { open: p, high: p, low: p, close: p, vol: v });
    } else {
      b.high = Math.max(b.high, p);
      b.low = Math.min(b.low, p);
      b.close = p;
      b.vol += v;
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => ({ time: time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }));
}

function buildVolume(trades: ApiTrade[], periodSec: number): HistogramData[] {
  const sorted = [...trades]
    .filter(t => Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime());

  const buckets = new Map<number, { vol: number; isBuy: boolean }>();
  for (const t of sorted) {
    const ts = Math.floor(new Date(t.block_time).getTime() / 1000);
    const bucket = Math.floor(ts / periodSec) * periodSec;
    const v = Number(t.sol_amount);
    const b = buckets.get(bucket);
    if (!b) {
      buckets.set(bucket, { vol: v, isBuy: t.side === "buy" });
    } else {
      b.vol += v;
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, b]) => ({
      time: time as UTCTimestamp,
      value: b.vol,
      color: b.isBuy ? "rgba(0,255,65,0.25)" : "rgba(255,60,107,0.25)",
    }));
}

function calcSma(candles: CandlestickData[], period: number): LineData[] {
  const result: LineData[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period;
    result.push({ time: candles[i].time, value: avg });
  }
  return result;
}

function calcEma(candles: CandlestickData[], period: number): LineData[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  const result: LineData[] = [];
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  result.push({ time: candles[period - 1].time, value: ema });
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: ema });
  }
  return result;
}

function buildMarkers(trades: ApiTrade[], periodSec: number): SeriesMarker<UTCTimestamp>[] {
  return [...trades]
    .filter(t => (t.side === "buy" || t.side === "sell") && Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime())
    .map(t => {
      const ts = Math.floor(new Date(t.block_time).getTime() / 1000);
      const bucket = Math.floor(ts / periodSec) * periodSec;
      return {
        time: bucket as UTCTimestamp,
        position: (t.side === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
        color: t.side === "buy" ? "#00FF41" : "#FF3C6B",
        shape: (t.side === "buy" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
        size: 1,
      };
    });
}

export function LightweightTradeChart({
  trades,
  periodSec,
  height = 260,
  showVolume = true,
  showSma20 = false,
  showSma50 = false,
  showEma20 = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);

  // hover tooltip state
  const [tooltip, setTooltip] = useState<{ price: string; time: string; open: string; high: string; low: string; close: string } | null>(null);

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
        vertLine: { color: "rgba(0,255,65,0.4)", labelBackgroundColor: "#111", style: 2 },
        horzLine: { color: "rgba(0,255,65,0.4)", labelBackgroundColor: "#111", style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.35)",
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.28 : 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candle = chart.addCandlestickSeries({
      upColor: "#00FF41",
      downColor: "#FF3C6B",
      borderUpColor: "#00FF41",
      borderDownColor: "#FF3C6B",
      wickUpColor: "rgba(0,255,65,0.6)",
      wickDownColor: "rgba(255,60,107,0.6)",
    });

    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const sma20 = chart.addLineSeries({ color: "#FFD700", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const sma50 = chart.addLineSeries({ color: "#B026FF", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ema20 = chart.addLineSeries({ color: "#00BFFF", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) { setTooltip(null); return; }
      const d = param.seriesData.get(candle) as CandlestickData | undefined;
      if (!d) { setTooltip(null); return; }
      const fmt = (v: number) => v < 0.000001 ? v.toExponential(2) : v.toFixed(9);
      const t = new Date((d.time as number) * 1000);
      setTooltip({
        price: fmt(d.close),
        time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        open: fmt(d.open), high: fmt(d.high), low: fmt(d.low), close: fmt(d.close),
      });
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    sma20Ref.current = sma20;
    sma50Ref.current = sma50;
    ema20Ref.current = ema20;

    const ro = new ResizeObserver(([entry]) => {
      chartRef.current?.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height, showVolume]);

  useEffect(() => {
    if (!candleRef.current) return;
    const candles = buildCandles(trades, periodSec);
    candleRef.current.setData(candles);

    if (volRef.current) {
      volRef.current.setData(showVolume ? buildVolume(trades, periodSec) : []);
    }
    if (sma20Ref.current) sma20Ref.current.setData(showSma20 ? calcSma(candles, 20) : []);
    if (sma50Ref.current) sma50Ref.current.setData(showSma50 ? calcSma(candles, 50) : []);
    if (ema20Ref.current) ema20Ref.current.setData(showEma20 ? calcEma(candles, 20) : []);

    try { candleRef.current.setMarkers(buildMarkers(trades, periodSec)); } catch { /* noop */ }
    if (candles.length > 0) chartRef.current?.timeScale().fitContent();
  }, [trades, periodSec, showVolume, showSma20, showSma50, showEma20]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {tooltip && (
        <div className="absolute top-2 left-2 z-10 bg-black/80 border border-white/10 rounded px-2.5 py-1.5 text-[10px] font-mono text-white/70 pointer-events-none space-y-0.5">
          <div className="flex gap-3">
            <span className="text-white/40">O</span><span>{tooltip.open}</span>
            <span className="text-white/40">H</span><span className="text-[#00FF41]">{tooltip.high}</span>
            <span className="text-white/40">L</span><span className="text-[#FF3C6B]">{tooltip.low}</span>
            <span className="text-white/40">C</span><span>{tooltip.close}</span>
          </div>
          <div className="text-white/30">{tooltip.time}</div>
        </div>
      )}
    </div>
  );
}
