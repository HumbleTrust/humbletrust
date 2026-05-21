import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { config } from "./config.js";
import { query } from "./db.js";
import { getCandles } from "./ohlcv.js";
import { attachClient } from "./liveHub.js";
import { Timeframe } from "./types.js";

const timeframeSchema = z.enum(["1s", "5s", "1m", "5m", "1h"]);

export const createServer = () => {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked for ${origin}`));
    },
  }));

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
      const { rows } = await query("select * from tokens where mint = $1", [req.params.mint]);
      if (!rows[0]) return res.status(404).json({ error: "Token not indexed yet" });
      res.json({ token: rows[0] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/tokens/:mint/trades", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
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
      const timeframe = timeframeSchema.parse(req.query.tf ?? "1m") as Timeframe;
      const limit = Math.min(Number(req.query.limit ?? 500), 1000);
      res.json({ candles: await getCandles(req.params.mint, timeframe, limit), timeframe });
    } catch (error) {
      next(error);
    }
  });

  app.get("/wallet/:address/reputation", async (req, res, next) => {
    try {
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

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/chart\/([^/]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const timeframe = timeframeSchema.safeParse(url.searchParams.get("tf") ?? "1m");
    if (!timeframe.success) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      void attachClient(ws, match[1]!, timeframe.data);
    });
  });

  return { app, server };
};
