# Trade Chart Engine — Full Stack Crypto Chart Architecture

Senior engineer skill for designing and implementing production-grade crypto trading charts with real-time trade history, OHLCV aggregation, WebSocket streaming, and DEX swap parsing.

## Required Stack

**Backend:** Node.js / TypeScript; WebSocket, REST, gRPC; streaming data processing
**Blockchain:** EVM + Solana RPC; transaction parsing, smart contract events, log parsing
**Data Engineering:** Kafka / Redis Streams / Pulsar; TimescaleDB / ClickHouse / InfluxDB
**Frontend:** React + TypeScript; canvas/WebGL; TradingView Lightweight Charts, D3
**DevOps:** Docker, Kubernetes, CI/CD, Cloud Run / AWS Lambda, Prometheus + Grafana
**Security:** rate limiting, authentication, input validation, key management

**External Services:**
- RPC: Infura / Alchemy / QuickNode (EVM); Helius / Triton (Solana)
- Indexer: The Graph or custom Web3 RPC + PostgreSQL / ClickHouse
- Message broker: Kafka or Redis Streams
- Time series DB: ClickHouse or TimescaleDB
- Cache: Redis
- Charting: TradingView Lightweight Charts
- Auth: OAuth / JWT; API Gateway (Cloudflare, AWS)
- Monitoring: Prometheus + Grafana, Sentry

---

## Architecture

```
RPC → Ingest → Broker → Processor → TimeSeries DB → API → Frontend (WS/REST)
```

### Components

1. **Ingest Layer** — subscribe to blockchain via RPC + mempool/tx parsing → emit events to broker
2. **Indexer / Processor** — stream events, normalize, aggregate candles, write raw trades → ClickHouse / TimescaleDB
3. **API Layer** — REST/GraphQL for historical data; WebSocket for real-time price + trade stream
4. **Chart Engine** — frontend: candle rendering, indicators, orderbook, trade feed
5. **Swap/Trade Parser** — recognize DEX calls (swap, add/remove liquidity), normalize pairs/amounts
6. **UI** — React modular widget architecture
7. **Auth & Rate Limit** — API key management, JWT, gateway
8. **Observability** — metrics, logging, alerts

---

## Database Schema

### Raw Trades (ClickHouse)

```sql
CREATE TABLE trades (
  timestamp   DateTime,
  tx_hash     String,
  block       UInt64,
  pair        String,
  token_in    String,
  token_out   String,
  amount_in   String,
  amount_out  String,
  price       Float64,
  side        String,     -- 'buy' | 'sell'
  dex         String,
  pair_address String,
  liquidity_pool String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (pair, timestamp);
```

### Candles (ClickHouse)

```sql
CREATE TABLE candles (
  pair       String,
  interval   String,   -- '1m' | '5m' | '1h' | '1d'
  open       Float64,
  high       Float64,
  low        Float64,
  close      Float64,
  volume     Float64,
  start_time DateTime
) ENGINE = MergeTree()
ORDER BY (pair, interval, start_time);
```

**Indexes:** pair, timestamp, tx_hash

---

## WebSocket Message Format

```json
// price update
{ "type": "ticker", "pair": "TOKENA/TOKENB", "price": "0.01234", "timestamp": 1670000000 }

// trade
{ "type": "trade", "pair": "TOKENA/TOKENB", "price": "0.01234", "amount": "1000", "side": "sell", "tx": "0x...", "dex": "UniswapV2", "timestamp": 1670000000 }

// candle update
{ "type": "candle", "pair": "TOKENA/TOKENB", "interval": "1m", "open": "0.012", "high": "0.013", "low": "0.011", "close": "0.0125", "volume": "5000", "start_time": 1670000000 }
```

---

## REST API Contracts

```
GET  /api/v1/candles?pair=PAIR&interval=1m&from=ts&to=ts  → candle[]
GET  /api/v1/trades?pair=PAIR&limit=100&from=ts           → trade[]
GET  /api/v1/pair/meta?pair=PAIR                          → { tokens, decimals, pool_info }
WS   /ws                                                  → subscribe: { type: "ticker", pair: "PAIR" }
```

---

## WebSocket Handler (TypeScript)

```typescript
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });
const subscriptions = new Map<WebSocket, Set<string>>();

wss.on('connection', (ws) => {
  subscriptions.set(ws, new Set());

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.action === 'subscribe') {
      subscriptions.get(ws)?.add(`${data.type}:${data.pair}`);
    }
    if (data.action === 'unsubscribe') {
      subscriptions.get(ws)?.delete(`${data.type}:${data.pair}`);
    }
  });

  ws.on('close', () => subscriptions.delete(ws));
});

function broadcast(event: { type: string; pair: string; [key: string]: any }) {
  const key = `${event.type}:${event.pair}`;
  const payload = JSON.stringify(event);
  subscriptions.forEach((subs, client) => {
    if (client.readyState === WebSocket.OPEN && subs.has(key)) {
      client.send(payload);
    }
  });
}
```

---

## SLA & Performance

- Stream latency: **< 1s** from confirmed block to client
- Historical queries: **1000 candles (1m) < 200ms**
- Scale: thousands of pairs; horizontal scaling of processors and ClickHouse
- Deduplication: idempotency by `tx_hash`
- Replay protection: deduplicate by signature/hash on insert

---

## Security

- Input validation + injection protection
- Rate limiting at API Gateway level
- API keys for paid tiers; JWT for UI
- Replay protection and tx deduplication by hash
- Failover RPC: multiple providers with automatic switching
- Backfill: retroactive block indexing for gaps

---

## UI Features

- **Main chart:** candles, line mode, log scale, indicators (SMA, EMA, RSI, MACD)
- **Trade feed:** color by side, large trade aggregation, filters
- **Orderbook:** depth, cumulative levels, hover for VWAP
- **Swap explorer:** list of swap tx with details (slippage, route, pools)
- **Trader tools:** drawing, orders on chart
- **Pair history:** TVL, liquidity changes, pool events
- **Mobile adaptation** and lazy data loading

---

## Implementation Phases

### Phase 1 — MVP (2–4 weeks)
- Ingest for 1 chain + UniswapV2 / Raydium parser
- Processor for 1m candles
- Basic REST API + WebSocket
- Frontend: candles + trade feed

### Phase 2 — Expansion (4–8 weeks)
- Multi-DEX and multi-chain support
- ClickHouse optimization + backfill
- Orderbook + swap explorer
- Redis caching layer

### Phase 3 — Production Scale
- Kubernetes, autoscaling, multi-region RPC failover
- API monetization, rate limits, API key tiers
- Prometheus + Grafana dashboards
- Structured JSON logging

---

## Launch Checklist

- [ ] RPC keys + failover providers configured
- [ ] ClickHouse + Kafka/Redis deployed
- [ ] Ingest → Processor → API → Frontend pipeline running
- [ ] Real tx tested, deduplication and backfill verified
- [ ] Metrics monitored, alerts configured

---

## HumbleTrust Application

For HumbleTrust specifically, apply this architecture to:
- Bonding curve trades on devnet (Solana RPC)
- Raydium CPMM trades post-migration
- OHLCV from `trades` table in Supabase (current MVP)
- Upgrade path: migrate `trades` from Supabase → ClickHouse when volume justifies it
- Real-time subscription: `onAccountChange` on `curveTreasurySol` PDA → parse tx → broadcast via WS
- Auth: `INTERNAL_API_SECRET` server-side, `VITE_INTERNAL_SECRET` client-side (must match)

## How to Invoke

When user says `/trade-chart-engine [task]` or asks about:
- Trade history not showing / chart empty
- WebSocket real-time trades
- OHLCV aggregation
- DEX swap parsing
- Trade recording / sync pipeline
- Chart performance or latency

1. Apply the architecture above
2. For HumbleTrust: use current Supabase `trades` table as the data store
3. Follow security invariants from CLAUDE.md
4. Generate production-ready TypeScript code only
