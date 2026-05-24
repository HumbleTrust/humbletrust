import { Connection } from "@solana/web3.js";

const DEVNET_RPCS = [
  (import.meta.env.VITE_SOLANA_RPC as string | undefined) || "",
  "https://api.devnet.solana.com",
  "https://rpc.ankr.com/solana_devnet",
  "https://devnet.helius-rpc.com/?api-key=1d8e6f5c-1e4a-4c2a-b3f8-9a0d2e7c5b3f",
].filter(Boolean);

const is429 = (e: unknown) => {
  const msg = (e as any)?.message ?? String(e);
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
};

export async function withFallbackRpc<T>(
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const endpoint of DEVNET_RPCS) {
    try {
      return await fn(new Connection(endpoint, "confirmed"));
    } catch (e) {
      lastErr = e;
      if (!is429(e)) throw e;
    }
  }
  throw lastErr;
}

export function primaryRpcEndpoint(): string {
  return DEVNET_RPCS[0];
}
