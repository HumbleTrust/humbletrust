import { VersionedTransaction } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_API = "https://quote-api.jup.ag/v6";

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 100,
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(Math.floor(amount)),
    slippageBps: String(slippageBps),
  });
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`${JUPITER_API}/quote?${params}`, { signal: ctrl.signal });
    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      throw new Error(`Jupiter: ${text}`);
    }
    return r.json();
  } finally {
    clearTimeout(id);
  }
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function executeJupiterSwap(
  wallet: WalletContextState,
  connection: Connection,
  quote: JupiterQuote,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction)
    throw new Error("Wallet not connected");

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 15000);
  let swapTransaction: string;
  try {
    const r = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 10000,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      throw new Error(`Jupiter swap: ${text}`);
    }
    ({ swapTransaction } = await r.json());
  } finally {
    clearTimeout(id);
  }

  const tx = VersionedTransaction.deserialize(base64ToUint8Array(swapTransaction));
  // Extract blockhash from the transaction (Jupiter embeds it at creation time)
  const recentBlockhash = tx.message.recentBlockhash;
  // Fetch lastValidBlockHeight before sending so confirmTransaction has a valid window
  const { lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash: recentBlockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}
