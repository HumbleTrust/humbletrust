import "dotenv/config";
import { PublicKey } from "@solana/web3.js";

export type NetworkStage = "devnet" | "mainnet";

const network = (process.env.HT_NETWORK ?? "devnet") as NetworkStage;

export const config = {
  network,
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL ?? "",
  solanaRpcHttp: process.env.SOLANA_RPC_HTTP ?? "https://api.devnet.solana.com",
  solanaRpcWs: process.env.SOLANA_RPC_WS ?? "wss://api.devnet.solana.com",
  programId: new PublicKey(
    process.env.HUMBLETRUST_V2_PROGRAM_ID ?? "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr"
  ),
  raydiumCpmmProgramId: new PublicKey(
    process.env.RAYDIUM_CPMM_PROGRAM_ID ??
      (network === "mainnet"
        ? "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
        : "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb")
  ),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export const assertConfig = () => {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required. Use Supabase/Postgres for the devnet source of truth.");
  }
};
