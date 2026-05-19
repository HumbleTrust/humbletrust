import { query } from "./db.js";
import { TIMEFRAME_SECONDS, Timeframe, IndexedTrade } from "./types.js";

const bucketStart = (date: Date, timeframe: Timeframe) => {
  const seconds = TIMEFRAME_SECONDS[timeframe];
  const unix = Math.floor(date.getTime() / 1000);
  return new Date(Math.floor(unix / seconds) * seconds * 1000);
};

export const upsertOhlcv = async (trade: IndexedTrade) => {
  const timeframes = Object.keys(TIMEFRAME_SECONDS) as Timeframe[];
  for (const timeframe of timeframes) {
    const bucket = bucketStart(trade.blockTime, timeframe);
    await query(
      `
      insert into ohlcv (mint, timeframe, bucket, open, high, low, close, volume_token, volume_sol, trades_count)
      values ($1,$2,$3,$4,$4,$4,$4,$5,$6,1)
      on conflict (mint, timeframe, bucket) do update set
        high = greatest(ohlcv.high, excluded.high),
        low = least(ohlcv.low, excluded.low),
        close = excluded.close,
        volume_token = ohlcv.volume_token + excluded.volume_token,
        volume_sol = ohlcv.volume_sol + excluded.volume_sol,
        trades_count = ohlcv.trades_count + 1
      `,
      [trade.mint, timeframe, bucket, trade.priceSol, trade.tokenAmount, trade.solAmount]
    );
  }
};

export const getCandles = async (mint: string, timeframe: Timeframe, limit = 500) => {
  const { rows } = await query(
    `
    select extract(epoch from bucket)::bigint as time, open, high, low, close, volume_token, volume_sol
    from ohlcv
    where mint = $1 and timeframe = $2
    order by bucket desc
    limit $3
    `,
    [mint, timeframe, limit]
  );
  return rows.reverse().map((row) => ({
    time: Number(row.time),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume_token),
    volumeSol: Number(row.volume_sol),
  }));
};
