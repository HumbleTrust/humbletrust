import pg from "pg";
import { config } from "./config.js";

const isSupabase = config.databaseUrl.includes("supabase.co") || config.databaseUrl.includes("pooler.supabase");

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: isSupabase
    ? { rejectUnauthorized: true, ca: undefined }
    : config.databaseUrl.startsWith("postgres://") && config.databaseUrl.includes("sslmode=require")
      ? { rejectUnauthorized: true }
      : undefined,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const query = <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) =>
  pool.query<T>(text, params);

export const closeDb = () => pool.end();
