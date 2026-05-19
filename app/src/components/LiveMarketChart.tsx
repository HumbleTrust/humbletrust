import { useEffect, useRef, useState } from "react";
import { createChart, UTCTimestamp, IChartApi, ISeriesApi } from "lightweight-charts";
import { chartWsUrl, getTokenOhlcv, ApiCandle } from "../lib/api";

type Mode = "candles" | "line" | "area";

export const LiveMarketChart = ({
  mint,
  timeframe,
  mode,
  showVolume,
}: {
  mint: string;
  timeframe: string;
  mode: Mode;
  showVolume: boolean;
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "live" | "empty" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const chart = createChart(host, {
      autoSize: true,
      layout: { background: { color: "#151b26" }, textColor: "#aeb8c8" },
      grid: {
        vertLines: { color: "rgba(101,116,143,.22)" },
        horzLines: { color: "rgba(101,116,143,.22)" },
      },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: timeframe.endsWith("s") },
      rightPriceScale: { borderColor: "rgba(101,116,143,.35)" },
    });
    chartRef.current = chart;
    priceSeriesRef.current =
      mode === "line"
        ? chart.addLineSeries({ color: "#12bfa4", lineWidth: 2 })
        : mode === "area"
          ? chart.addAreaSeries({
              lineColor: "#12bfa4",
              topColor: "rgba(18,191,164,.28)",
              bottomColor: "rgba(18,191,164,0)",
              lineWidth: 2,
            })
          : chart.addCandlestickSeries({
              upColor: "#12bfa4",
              downColor: "#ff3b5c",
              borderUpColor: "#12bfa4",
              borderDownColor: "#ff3b5c",
              wickUpColor: "#12bfa4",
              wickDownColor: "#ff3b5c",
            });
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: "rgba(18,191,164,.38)",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [mode, timeframe]);

  useEffect(() => {
    if (!mint || mint.length < 32 || !priceSeriesRef.current) {
      setState("idle");
      return;
    }
    let closed = false;
    let ws: WebSocket | null = null;
    const applyCandles = (candles: ApiCandle[]) => {
      const priceData = candles.map((candle) =>
        mode === "candles"
          ? {
              time: candle.time as UTCTimestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }
          : { time: candle.time as UTCTimestamp, value: candle.close }
      );
      const volumeData = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(18,191,164,.38)" : "rgba(255,59,92,.38)",
      }));
      priceSeriesRef.current?.setData(priceData as never[]);
      volumeSeriesRef.current?.setData(showVolume ? volumeData : []);
      chartRef.current?.timeScale().fitContent();
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
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "snapshot") applyCandles(msg.candles ?? []);
          if (msg.type === "candle" && priceSeriesRef.current) {
            const candle = msg as ApiCandle;
            if (mode === "candles") {
              (priceSeriesRef.current as ISeriesApi<"Candlestick">).update({
                time: candle.time as UTCTimestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
              });
            } else {
              (priceSeriesRef.current as ISeriesApi<"Line"> | ISeriesApi<"Area">).update({
                time: candle.time as UTCTimestamp,
                value: candle.close,
              });
            }
            if (showVolume) {
              volumeSeriesRef.current?.update({
                time: candle.time as UTCTimestamp,
                value: candle.volume,
                color: candle.close >= candle.open ? "rgba(18,191,164,.38)" : "rgba(255,59,92,.38)",
              });
            }
            setState("live");
          }
        };
        ws.onerror = () => setState((current) => current === "live" ? "live" : "error");
      } catch (e: any) {
        if (!closed) {
          setError(e.message || String(e));
          setState("error");
        }
      }
    };
    void connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [mint, timeframe, mode, showVolume]);

  return (
    <div className="live-chart-shell">
      <div ref={hostRef} className="live-chart-host" />
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
