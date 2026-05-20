import { useEffect, useRef, useState } from "react";
import { createChart, UTCTimestamp, IChartApi, ISeriesApi, LineStyle } from "lightweight-charts";
import { chartWsUrl, getTokenOhlcv, ApiCandle } from "../lib/api";

export type ChartMode = "candles" | "line" | "area";
export interface ChartIndicators {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  rsi: boolean;
}

// ── math helpers ──────────────────────────────────────────────────────────────
const calcSMA = (vals: number[], n: number): (number | null)[] =>
  vals.map((_, i) => i < n - 1 ? null : vals.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);

const calcEMA = (vals: number[], n: number): (number | null)[] => {
  const k = 2 / (n + 1);
  let e: number | null = null;
  return vals.map((v, i) => {
    if (i < n - 1) return null;
    e = i === n - 1 ? vals.slice(0, n).reduce((a, b) => a + b, 0) / n : v * k + e! * (1 - k);
    return e;
  });
};

const calcRSI = (closes: number[], period = 14): (number | null)[] =>
  closes.map((_, i) => {
    if (i < period) return null;
    let g = 0, l = 0;
    for (let j = i - period + 1; j <= i; j++) { const d = closes[j] - closes[j - 1]; if (d > 0) g += d; else l -= d; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  });

const toPoints = <T extends number | null>(times: UTCTimestamp[], vals: T[]) =>
  vals
    .map((v, i) => (v !== null ? { time: times[i], value: v as number } : null))
    .filter(Boolean) as { time: UTCTimestamp; value: number }[];

type LineSeries = ISeriesApi<"Line">;

// ── chart theme constants ─────────────────────────────────────────────────────
const PRICE_BG = "#151b26";
const RSI_BG = "#111520";
const GRID_COLOR = "rgba(101,116,143,.2)";
const SCALE_BORDER = "rgba(101,116,143,.35)";

const priceChartOptions = (tfSeconds: boolean) => ({
  autoSize: true,
  layout: { background: { color: PRICE_BG }, textColor: "#aeb8c8" },
  grid: { vertLines: { color: GRID_COLOR }, horzLines: { color: GRID_COLOR } },
  crosshair: { mode: 1 },
  timeScale: { timeVisible: true, secondsVisible: tfSeconds, borderColor: SCALE_BORDER },
  rightPriceScale: { borderColor: SCALE_BORDER },
});

const rsiChartOptions = (tfSeconds: boolean) => ({
  autoSize: true,
  layout: { background: { color: RSI_BG }, textColor: "#7a8aa0" },
  grid: { vertLines: { color: "rgba(101,116,143,.1)" }, horzLines: { color: "rgba(101,116,143,.1)" } },
  crosshair: { mode: 1 },
  timeScale: { timeVisible: true, secondsVisible: tfSeconds, visible: false },
  rightPriceScale: {
    borderColor: SCALE_BORDER,
    scaleMargins: { top: 0.08, bottom: 0.08 },
    autoScale: false,
    minValue: 0,
    maxValue: 100,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
export const LiveMarketChart = ({
  mint,
  timeframe,
  mode,
  showVolume,
  indicators,
}: {
  mint: string;
  timeframe: string;
  mode: ChartMode;
  showVolume: boolean;
  indicators: ChartIndicators;
}) => {
  const priceHostRef = useRef<HTMLDivElement | null>(null);
  const rsiHostRef = useRef<HTMLDivElement | null>(null);

  const priceChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  const priceSeriesRef = useRef<
    ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null
  >(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20Ref = useRef<LineSeries | null>(null);
  const sma50Ref = useRef<LineSeries | null>(null);
  const ema20Ref = useRef<LineSeries | null>(null);
  const rsiSeriesRef = useRef<LineSeries | null>(null);

  const candlesRef = useRef<ApiCandle[]>([]);
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;

  const [state, setState] = useState<"idle" | "loading" | "live" | "empty" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const showRsi = indicators.rsi;
  const tfSeconds = timeframe.endsWith("s");

  // ── price chart (rebuilt on mode / timeframe change) ──────────────────────
  useEffect(() => {
    const host = priceHostRef.current;
    if (!host) return;
    host.innerHTML = "";

    const chart = createChart(host, priceChartOptions(tfSeconds));
    priceChartRef.current = chart;

    priceSeriesRef.current =
      mode === "line"
        ? chart.addLineSeries({ color: "#12bfa4", lineWidth: 2 })
        : mode === "area"
          ? chart.addAreaSeries({ lineColor: "#12bfa4", topColor: "rgba(18,191,164,.28)", bottomColor: "rgba(18,191,164,0)", lineWidth: 2 })
          : chart.addCandlestickSeries({ upColor: "#12bfa4", downColor: "#ff3b5c", borderUpColor: "#12bfa4", borderDownColor: "#ff3b5c", wickUpColor: "#12bfa4", wickDownColor: "#ff3b5c" });

    volSeriesRef.current = chart.addHistogramSeries({
      color: "rgba(18,191,164,.38)",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volSeriesRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // MA/EMA overlays — always created, toggled via applyIndicatorData
    sma20Ref.current = chart.addLineSeries({ color: "#f7ca4d", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    sma50Ref.current = chart.addLineSeries({ color: "#b98cff", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ema20Ref.current = chart.addLineSeries({ color: "#00D4FF", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    return () => {
      chart.remove();
      priceChartRef.current = null;
      priceSeriesRef.current = null;
      volSeriesRef.current = null;
      sma20Ref.current = null;
      sma50Ref.current = null;
      ema20Ref.current = null;
    };
  }, [mode, timeframe]);

  // ── RSI chart (rebuilt when RSI toggle or timeframe changes) ──────────────
  useEffect(() => {
    const host = rsiHostRef.current;
    if (!host || !showRsi) {
      rsiSeriesRef.current = null;
      rsiChartRef.current = null;
      return;
    }
    host.innerHTML = "";

    const chart = createChart(host, rsiChartOptions(tfSeconds));
    rsiChartRef.current = chart;

    const series = chart.addLineSeries({ color: "#f7ca4d", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    rsiSeriesRef.current = series;

    // Reference lines at 70, 50, 30
    series.createPriceLine({ price: 70, color: "rgba(255,59,92,.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
    series.createPriceLine({ price: 50, color: "rgba(120,130,150,.35)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    series.createPriceLine({ price: 30, color: "rgba(18,191,164,.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });

    // Apply cached candles to RSI
    if (candlesRef.current.length > 0) {
      const closes = candlesRef.current.map(c => c.close);
      const times = candlesRef.current.map(c => c.time as UTCTimestamp);
      series.setData(toPoints(times, calcRSI(closes)));
    }

    // Sync logical range between price chart ↔ RSI chart
    const onPriceRange = (range: any) => {
      if (range && rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
    };
    const onRsiRange = (range: any) => {
      if (range && priceChartRef.current) priceChartRef.current.timeScale().setVisibleLogicalRange(range);
    };
    priceChartRef.current?.timeScale().subscribeVisibleLogicalRangeChange(onPriceRange);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRsiRange);

    return () => {
      priceChartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(onPriceRange);
      chart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [showRsi, timeframe]);

  // ── helper: apply indicator data from a candle set ────────────────────────
  const applyIndicatorData = (candles: ApiCandle[]) => {
    const ind = indicatorsRef.current;
    const closes = candles.map(c => c.close);
    const times = candles.map(c => c.time as UTCTimestamp);

    sma20Ref.current?.setData(ind.sma20 ? toPoints(times, calcSMA(closes, 20)) : []);
    sma50Ref.current?.setData(ind.sma50 ? toPoints(times, calcSMA(closes, 50)) : []);
    ema20Ref.current?.setData(ind.ema20 ? toPoints(times, calcEMA(closes, 20)) : []);
    rsiSeriesRef.current?.setData(ind.rsi ? toPoints(times, calcRSI(closes)) : []);
  };

  // Re-apply when indicator toggles change (no WS reconnect needed)
  useEffect(() => {
    if (candlesRef.current.length > 0) applyIndicatorData(candlesRef.current);
  }, [indicators.sma20, indicators.sma50, indicators.ema20, indicators.rsi]);

  // ── data loading + live WebSocket ─────────────────────────────────────────
  useEffect(() => {
    if (!mint || mint.length < 32 || !priceSeriesRef.current) {
      setState("idle");
      return;
    }
    let closed = false;
    let ws: WebSocket | null = null;

    const applyCandles = (candles: ApiCandle[]) => {
      candlesRef.current = candles;
      const priceData = candles.map(c =>
        mode === "candles"
          ? { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }
          : { time: c.time as UTCTimestamp, value: c.close }
      );
      const volData = candles.map(c => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(18,191,164,.38)" : "rgba(255,59,92,.38)",
      }));

      priceSeriesRef.current?.setData(priceData as never[]);
      volSeriesRef.current?.setData(showVolume ? volData : []);
      priceChartRef.current?.timeScale().fitContent();
      applyIndicatorData(candles);
      setState(candles.length ? "live" : "empty");
    };

    const connect = async () => {
      setState("loading");
      setError(null);
      try {
        const { candles } = await getTokenOhlcv(mint, timeframe);
        if (closed) return;
        applyCandles(candles);

        ws = new WebSocket(chartWsUrl(mint, timeframe));
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === "snapshot") {
            applyCandles(msg.candles ?? []);
          } else if (msg.type === "candle" && priceSeriesRef.current) {
            const c = msg as ApiCandle;
            if (mode === "candles") {
              (priceSeriesRef.current as ISeriesApi<"Candlestick">).update({
                time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
              });
            } else {
              (priceSeriesRef.current as ISeriesApi<"Line"> | ISeriesApi<"Area">).update({
                time: c.time as UTCTimestamp, value: c.close,
              });
            }
            if (showVolume) {
              volSeriesRef.current?.update({
                time: c.time as UTCTimestamp,
                value: c.volume,
                color: c.close >= c.open ? "rgba(18,191,164,.38)" : "rgba(255,59,92,.38)",
              });
            }
            // Extend indicators with the new candle
            const updated = [...candlesRef.current];
            const last = updated[updated.length - 1];
            if (last && last.time === c.time) updated[updated.length - 1] = c;
            else updated.push(c);
            candlesRef.current = updated;
            applyIndicatorData(updated);
            setState("live");
          }
        };
        ws.onerror = () => setState(cur => cur === "live" ? "live" : "error");
      } catch (e: any) {
        if (!closed) { setError(e.message || String(e)); setState("error"); }
      }
    };

    void connect();
    return () => { closed = true; ws?.close(); };
  }, [mint, timeframe, mode, showVolume]);

  return (
    <div className="live-chart-shell" style={{ display: "flex", flexDirection: "column" }}>
      {/* Price chart */}
      <div ref={priceHostRef} style={{ flex: 1, minHeight: 0, position: "relative", background: PRICE_BG }} />

      {/* RSI panel */}
      {showRsi && (
        <div style={{ position: "relative", borderTop: "1px solid #263044" }}>
          <div
            ref={rsiHostRef}
            style={{ height: 120, background: RSI_BG }}
          />
          <div style={{
            position: "absolute", top: 4, left: 10, zIndex: 2,
            fontFamily: "var(--font-mono)", fontSize: ".6rem", color: "#7a8aa0",
            pointerEvents: "none",
          }}>
            RSI(14)
          </div>
        </div>
      )}

      {/* MA legend */}
      {(indicators.sma20 || indicators.sma50 || indicators.ema20) && (
        <div style={{
          display: "flex", gap: ".75rem", padding: "3px 10px",
          background: "#0d1220", borderTop: "1px solid #263044",
          fontFamily: "var(--font-mono)", fontSize: ".62rem",
        }}>
          {indicators.sma20 && <span style={{ color: "#f7ca4d" }}>SMA 20</span>}
          {indicators.sma50 && <span style={{ color: "#b98cff" }}>SMA 50</span>}
          {indicators.ema20 && <span style={{ color: "#00D4FF" }}>EMA 20 - -</span>}
        </div>
      )}

      {/* Overlay for non-live states */}
      {state !== "live" && (
        <div className="live-chart-overlay">
          {state === "idle" && "Paste or select a token mint"}
          {state === "loading" && "Loading indexed candles..."}
          {state === "empty" && "No indexed trades yet"}
          {state === "error" && (error || "Chart backend unavailable")}
        </div>
      )}
    </div>
  );
};
