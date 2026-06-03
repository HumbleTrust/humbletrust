import type { Connection } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface ParsedSplToken {
  mint: string;
  balance: number;
  decimals: number;
}

/**
 * Fetches and parses all SPL token accounts for an owner.
 * Returns one entry per mint (first account wins), sorted by balance descending.
 * Excludes zero and non-finite balances.
 */
export async function fetchParsedSplTokens(
  connection: Connection,
  owner: PublicKey,
): Promise<ParsedSplToken[]> {
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const seen = new Set<string>();
  const result: ParsedSplToken[] = [];

  for (const { account } of value) {
    const info = (account.data as any).parsed?.info;
    const amountInfo = info?.tokenAmount;
    const mint = info?.mint as string | undefined;
    if (!mint || !amountInfo || seen.has(mint)) continue;
    const balance = Number(amountInfo.uiAmountString ?? amountInfo.uiAmount ?? 0);
    if (!Number.isFinite(balance) || balance <= 0) continue;
    seen.add(mint);
    result.push({ mint, balance, decimals: amountInfo.decimals ?? 9 });
  }

  return result.sort((a, b) => b.balance - a.balance);
}
