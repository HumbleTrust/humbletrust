import { WebSocket } from "ws";
import { getCandles } from "./ohlcv.js";
import { query } from "./db.js";
import { Timeframe } from "./types.js";

const clients = new Map<string, Set<WebSocket>>();

const keyFor = (mint: string, timeframe: string) => `${mint}:${timeframe}`;

export const attachClient = async (ws: WebSocket, mint: string, timeframe: Timeframe) => {
  const key = keyFor(mint, timeframe);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key)!.add(ws);
  ws.on("close", () => clients.get(key)?.delete(ws));
  const candles = await getCandles(mint, timeframe, 300);
  ws.send(JSON.stringify({ type: "snapshot", mint, timeframe, candles }));
};

export const broadcastMintUpdate = async (mint: string) => {
  for (const [key, sockets] of clients) {
    const [subMint, timeframe] = key.split(":") as [string, Timeframe];
    if (subMint !== mint || sockets.size === 0) continue;
    const { rows } = await query(
      `
      select extract(epoch from bucket)::bigint as time, open, high, low, close, volume_token, volume_sol
      from ohlcv
      where mint = $1 and timeframe = $2
      order by bucket desc
      limit 1
      `,
      [mint, timeframe]
    );
    const row = rows[0];
    if (!row) continue;
    const message = JSON.stringify({
      type: "candle",
      mint,
      timeframe,
      time: Number(row.time),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume_token),
      volumeSol: Number(row.volume_sol),
    });
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
};
