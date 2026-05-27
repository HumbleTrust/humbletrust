import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  HistogramData,
} from "lightweight-charts";
import type { ApiTrade } from "../../lib/solana/api";

type ChartMode = "candles" | "line" | "area";

interface Props {
  trades: ApiTrade[];
  periodSec: number;
  height?: number;
  showVolume?: boolean;
  showSma20?: boolean;
  showSma50?: boolean;
  showEma20?: boolean;
  showRsi?: boolean;
  mode?: ChartMode;
}

interface Bucket {
  open: number; high: number; low: number; close: number; vol: number; buyVol: number; sellVol: number;
}

function buildBuckets(trades: ApiTrade[], periodSec: number): Map<number, Bucket> {
  const sorted = [...trades]
    .filter(t => Number(t.price_sol) > 0)
    .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime());

  const buckets = new Map<number, Bucket>();
  for (const t of sorted) {
    const ts = Math.floor(new Date(t.block_time).getTime() / 1000);
    const bucket = Math.floor(ts / periodSec) * periodSec;
    const p = Number(t.price_sol);
    const v = Number(t.sol_amount);
    const b = buckets.get(bucket);
    if (!b) {
      buckets.set(bucket, {
        open: p,
        high: p,
        low: p,
        close: p,
        vol: v,
        buyVol: t.side === "buy" ? v : 0,
        sellVol: t.side === "sell" ? v : 0,
      });
    } else {
      b.high = Math.max(b.high, p);
      b.low = Math.min(b.low, p);
      b.close = p;
      b.vol += v;
      if (t.side === "sell") b.sellVol += v;
      else b.buyVol += v;
    }
  }
  return buckets;
}

function buildCandles(buckets: Map<number, Bucket>): CandlestickData[] {
  let previousClose: number | null = null;
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => {
      const open = previousClose ?? c.open;
      const candle = {
        time: time as UTCTimestamp,
        open,
        high: Math.max(open, c.high, c.close),
        low: Math.min(open, c.low, c.close),
        close: c.close,
      };
      previousClose = c.close;
      return candle;
    });
}

function buildLine(buckets: Map<number, Bucket>): LineData[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => ({ time: time as UTCTimestamp, value: c.close }));
}

function buildArea(buckets: Map<number, Bucket>): AreaData[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => ({ time: time as UTCTimestamp, value: c.close }));
}

function buildVolume(buckets: Map<number, Bucket>, candles: CandlestickData[]): HistogramData[] {
  const directionByTime = new Map(candles.map((c) => [Number(c.time), c.close >= c.open]));
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, b]) => ({
      time: time as UTCTimestamp,
      value: b.vol,
      color: (b.sellVol > b.buyVol || directionByTime.get(time) === false)
        ? "rgba(255,60,107,0.32)"
        : "rgba(0,255,65,0.28)",
    }));
}

function calcSma(data: LineData[], period: number): LineData[] {
  const result: LineData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const avg = data.slice(i - period + 1, i + 1).reduce((s, c) => s + c.value, 0) / period;
    result.push({ time: data[i].time, value: avg });
  }
  return result;
}

function calcEma(data: LineData[], period: number): LineData[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, c) => s + c.value, 0) / period;
  const result: LineData[] = [{ time: data[period - 1].time, value: ema }];
  for (let i = period; i < data.length; i++) {
    ema = data[i].value * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function calcRsi(data: LineData[], period = 14): LineData[] {
  if (data.length < period + 1) return [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i].value - data[i - 1].value;
    if (d > 0) avgGain += d; else avgLoss += -d;
  }
  avgGain /= period;
  avgLoss /= period;
  const result: LineData[] = [];
  result.push({ time: data[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].value - data[i - 1].value;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    result.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  }
  return result;
}

export function LightweightTradeChart({
  trades,
  periodSec,
  height = 260,
  showVolume = true,
  showSma20 = false,
  showSma50 = false,
  showEma20 = false,
  showRsi = false,
  mode = "candles",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [tooltip, setTooltip] = useState<{
    price: string; time: string; open?: string; high?: string; low?: string; close: string; rsi?: string;
  } | null>(null);

  // Create/destroy chart when height or volume layout changes
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
        scaleMargins: { top: 0.05, bottom: showVolume ? 0.28 : 0.08 },
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
      wickUpColor: "rgba(0,255,65,0.85)",
      wickDownColor: "rgba(255,60,107,0.85)",
      priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
    });

    const line = chart.addLineSeries({
      color: "#00FF41",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
    });

    const area = chart.addAreaSeries({
      lineColor: "#00FF41",
      topColor: "rgba(0,255,65,0.3)",
      bottomColor: "rgba(0,255,65,0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
    });

    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const sma20 = chart.addLineSeries({ color: "#FFD700", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const sma50 = chart.addLineSeries({ color: "#B026FF", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ema20 = chart.addLineSeries({ color: "#00BFFF", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    const rsi = chart.addLineSeries({
      priceScaleId: "rsi",
      color: "#FF9500",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("rsi").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      textColor: "rgba(255,149,0,0.6)",
    });
    rsi.createPriceLine({ price: 70, color: "rgba(255,60,107,0.5)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
    rsi.createPriceLine({ price: 30, color: "rgba(0,255,65,0.5)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
    rsi.createPriceLine({ price: 50, color: "rgba(255,255,255,0.2)", lineWidth: 1, lineStyle: 3, axisLabelVisible: false, title: "" });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) { setTooltip(null); return; }
      const fmt = (v: number) => v < 0.000001 ? v.toExponential(2) : v.toFixed(9);
      const t = new Date((param.time as number) * 1000);
      const timeStr = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const rsiData = param.seriesData.get(rsi) as LineData | undefined;
      const rsiStr = rsiData ? rsiData.value.toFixed(1) : undefined;

      const cd = param.seriesData.get(candle) as CandlestickData | undefined;
      if (cd) { setTooltip({ price: fmt(cd.close), time: timeStr, open: fmt(cd.open), high: fmt(cd.high), low: fmt(cd.low), close: fmt(cd.close), rsi: rsiStr }); return; }
      const ld = param.seriesData.get(line) as LineData | undefined;
      if (ld) { setTooltip({ price: fmt(ld.value), time: timeStr, close: fmt(ld.value), rsi: rsiStr }); return; }
      const ad = param.seriesData.get(area) as AreaData | undefined;
      if (ad) { setTooltip({ price: fmt(ad.value), time: timeStr, close: fmt(ad.value), rsi: rsiStr }); return; }
      setTooltip(null);
    });

    chartRef.current = chart;
    candleRef.current = candle;
    lineRef.current = line;
    areaRef.current = area;
    volRef.current = vol;
    sma20Ref.current = sma20;
    sma50Ref.current = sma50;
    ema20Ref.current = ema20;
    rsiRef.current = rsi;

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

  // Update data when trades / mode / period / indicators change
  useEffect(() => {
    if (!candleRef.current || !lineRef.current || !areaRef.current) return;

    const buckets = buildBuckets(trades, periodSec);
    const candles = buildCandles(buckets);
    const lineData = buildLine(buckets);

    // Adjust scale margins dynamically based on active overlays
    const mainBottom = showVolume && showRsi ? 0.5 : (showVolume || showRsi) ? 0.3 : 0.08;
    chartRef.current?.applyOptions({
      rightPriceScale: { scaleMargins: { top: 0.05, bottom: mainBottom } },
    });
    if (showVolume && showRsi) {
      chartRef.current?.priceScale("vol").applyOptions({ scaleMargins: { top: 0.62, bottom: 0.22 } });
      chartRef.current?.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    } else {
      chartRef.current?.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      chartRef.current?.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }

    // Show only the active series, clear others
    if (mode === "candles") {
      candleRef.current.setData(candles);
      lineRef.current.setData([]);
      areaRef.current.setData([]);
    } else if (mode === "line") {
      candleRef.current.setData([]);
      lineRef.current.setData(lineData);
      areaRef.current.setData([]);
    } else {
      candleRef.current.setData([]);
      lineRef.current.setData([]);
      areaRef.current.setData(buildArea(buckets));
    }

    if (volRef.current) {
      volRef.current.setData(showVolume ? buildVolume(buckets, candles) : []);
    }

    const baseForIndicators = lineData;
    if (sma20Ref.current) sma20Ref.current.setData(showSma20 ? calcSma(baseForIndicators, 20) : []);
    if (sma50Ref.current) sma50Ref.current.setData(showSma50 ? calcSma(baseForIndicators, 50) : []);
    if (ema20Ref.current) ema20Ref.current.setData(showEma20 ? calcEma(baseForIndicators, 20) : []);
    if (rsiRef.current) rsiRef.current.setData(showRsi ? calcRsi(baseForIndicators, 14) : []);

    if (candles.length > 0 || lineData.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [trades, periodSec, mode, showVolume, showSma20, showSma50, showEma20, showRsi]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {tooltip && (
        <div className="absolute top-2 left-2 z-10 bg-black/80 border border-white/10 rounded px-2.5 py-1.5 text-[10px] font-mono text-white/70 pointer-events-none space-y-0.5">
          {tooltip.open ? (
            <div className="flex gap-3 flex-wrap">
              <span className="text-white/40">O</span><span>{tooltip.open}</span>
              <span className="text-white/40">H</span><span className="text-[#00FF41]">{tooltip.high}</span>
              <span className="text-white/40">L</span><span className="text-[#FF3C6B]">{tooltip.low}</span>
              <span className="text-white/40">C</span><span>{tooltip.close}</span>
              {tooltip.rsi && <><span className="text-white/40">RSI</span><span className="text-[#FF9500]">{tooltip.rsi}</span></>}
            </div>
          ) : (
            <div className="flex gap-3">
              <span className="text-white/40">P</span><span>{tooltip.close}</span>
              {tooltip.rsi && <><span className="text-white/40">RSI</span><span className="text-[#FF9500]">{tooltip.rsi}</span></>}
            </div>
          )}
          <div className="text-white/30">{tooltip.time}</div>
        </div>
      )}
    </div>
  );
}
