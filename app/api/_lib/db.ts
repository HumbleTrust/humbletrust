import { Pool } from "pg";

let pool: Pool | undefined;

export const getPool = (): Pool => {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString: url,
      ssl: url && !url.includes("localhost") && !url.includes("127.0.0.1")
        ? { rejectUnauthorized: false }
        : false,
      max: 5,
    });
  }
  return pool;
};

export const query = (text: string, params?: unknown[]) =>
  getPool().query(text, params as unknown[]);
