import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { config } from "./config.js";
import { query } from "./db.js";
import { getCandles } from "./ohlcv.js";
import { attachClient } from "./liveHub.js";
import { Timeframe } from "./types.js";

const timeframeSchema = z.enum(["1s", "5s", "1m", "5m", "1h"]);

// Solana base58 address: 32-44 chars, only base58 alphabet
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isValidAddress = (s: string) => BASE58_RE.test(s);

const sanitizeError = (error: unknown) => {
  if (!(error instanceof Error)) return "Internal server error";
  const msg = error.message;
  // Strip SQL, stack traces, or connection strings from error messages
  if (msg.includes("connect ECONNREFUSED") || msg.includes("password")) return "Database error";
  if (msg.includes("syntax error") || msg.includes("column") || msg.includes("relation")) return "Database error";
  if (msg.length > 200) return msg.slice(0, 200);
  return msg;
};

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
});

// Map of IP → active WS connection count
const wsConnections = new Map<string, number>();
const MAX_WS_PER_IP = 8;

export const createServer = () => {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // API server, CSP not needed; frontend handles its own
  }));

  app.use(express.json({ limit: "64kb" }));
  app.set("trust proxy", 1);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked for ${origin}`));
    },
    methods: ["GET"],
    allowedHeaders: ["Content-Type"],
  }));

  app.use("/tokens", apiLimiter);
  app.use("/wallet", apiLimiter);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      network: config.network,
      programId: config.programId.toBase58(),
      raydiumCpmmProgramId: config.raydiumCpmmProgramId.toBase58(),
    });
  });

  app.get("/tokens", async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? 100), 10) || 100, 250);
      const { rows } = await query(
        `
        select mint, creator, name, symbol, status, raydium_pool, trust_score, launch_score,
               creator_reputation, market_health, community_risk, volume_sol,
               liquidity_sol, trades_count, created_at
        from tokens
        order by created_at desc
        limit $1
        `,
        [limit]
      );
      res.json({ tokens: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get("/tokens/:mint", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.mint)) return res.status(400).json({ error: "Invalid mint address" });
      const { rows } = await query("select * from tokens where mint = $1", [req.params.mint]);
      if (!rows[0]) return res.status(404).json({ error: "Token not indexed yet" });
      res.json({ token: rows[0] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/tokens/:mint/trades", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.mint)) return res.status(400).json({ error: "Invalid mint address" });
      const limit = Math.min(parseInt(String(req.query.limit ?? 100), 10) || 100, 500);
      const { rows } = await query(
        `
        select signature, trader, side, source, token_amount, sol_amount, price_sol, fee_lamports, slot, block_time
        from trades
        where mint = $1
        order by block_time desc, id desc
        limit $2
        `,
        [req.params.mint, limit]
      );
      res.json({ trades: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get("/tokens/:mint/ohlcv", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.mint)) return res.status(400).json({ error: "Invalid mint address" });
      const timeframe = timeframeSchema.parse(req.query.tf ?? "1m") as Timeframe;
      const limit = Math.min(parseInt(String(req.query.limit ?? 500), 10) || 500, 1000);
      res.json({ candles: await getCandles(req.params.mint, timeframe, limit), timeframe });
    } catch (error) {
      next(error);
    }
  });

  app.get("/wallet/:address/reputation", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) return res.status(400).json({ error: "Invalid wallet address" });
      const { rows } = await query("select * from wallets where address = $1", [req.params.address]);
      if (!rows[0]) {
        return res.json({
          wallet: {
            address: req.params.address,
            launches_count: 0,
            trades_count: 0,
            complaints_count: 0,
            rugs_count: 0,
            volume_sol: 0,
            reputation_score: 50,
          },
        });
      }
      res.json({ wallet: rows[0] });
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: sanitizeError(error) });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const ip = req.socket.remoteAddress ?? "unknown";
    const count = wsConnections.get(ip) ?? 0;
    if (count >= MAX_WS_PER_IP) {
      socket.destroy();
      return;
    }

    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/chart\/([^/]+)$/);
    if (!match || !isValidAddress(match[1]!)) {
      socket.destroy();
      return;
    }
    const timeframe = timeframeSchema.safeParse(url.searchParams.get("tf") ?? "1m");
    if (!timeframe.success) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wsConnections.set(ip, (wsConnections.get(ip) ?? 0) + 1);
      ws.on("close", () => {
        const n = (wsConnections.get(ip) ?? 1) - 1;
        if (n <= 0) wsConnections.delete(ip);
        else wsConnections.set(ip, n);
      });
      void attachClient(ws, match[1]!, timeframe.data);
    });
  });

  return { app, server };
};
