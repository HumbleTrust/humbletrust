import {
  PublicKey, Transaction, TransactionInstruction, AccountMeta,
  SystemProgram, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
} from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  RAYDIUM_CPMM_DEVNET,
  RAYDIUM_DEVNET_AUTHORITY,
  TOKEN_2022_PROGRAM_PK,
  findRaydiumCpmmPdas,
} from "./program";

/**
 * Detect whether a mint is a Token-2022 token by checking its owner program.
 * Returns TOKEN_2022_PROGRAM_ID if so, otherwise TOKEN_PROGRAM_ID.
 */
async function detectTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  try {
    const info = await connection.getAccountInfo(mint);
    if (info?.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  } catch {
    // fallthrough to default
  }
  return TOKEN_PROGRAM_ID;
}

// Anchor discriminator for swap_base_input = sha256("global:swap_base_input")[0..8]
const SWAP_BASE_INPUT_DISCM = Buffer.from([143, 190, 90, 218, 196, 30, 51, 222]);

export interface CpmmSwapResult {
  signature: string;
  amountIn: number;
  estimatedOut: number;
}

// Fetch vault token balances to estimate swap output (constant product formula)
export async function estimateCpmmSwap(
  connection: Connection,
  tokenMint: PublicKey,
  amountIn: number,
  isBuy: boolean,
): Promise<{ estimatedOut: number; priceImpactPct: number }> {
  const pdas = findRaydiumCpmmPdas(tokenMint);
  const wsolIsToken0 = pdas.token0.equals(NATIVE_MINT);

  const [wsolVault, tokenVault] = wsolIsToken0
    ? [pdas.token0Vault, pdas.token1Vault]
    : [pdas.token1Vault, pdas.token0Vault];

  const [wsolInfo, tokenInfo] = await Promise.all([
    connection.getTokenAccountBalance(wsolVault),
    connection.getTokenAccountBalance(tokenVault),
  ]);

  const solReserve  = Number(wsolInfo.value.uiAmount ?? 0);
  const tokReserve  = Number(tokenInfo.value.uiAmount ?? 0);
  const k = solReserve * tokReserve;

  let estimatedOut: number;
  let priceImpactPct: number;

  if (isBuy) {
    // SOL → token: give solIn, get tokens
    const newSolReserve = solReserve + amountIn;
    const newTokReserve = k / newSolReserve;
    estimatedOut = tokReserve - newTokReserve;
    const priceBefore = solReserve / tokReserve;
    const priceAfter  = newSolReserve / newTokReserve;
    priceImpactPct = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
  } else {
    // token → SOL: give tokens, get SOL
    const newTokReserve = tokReserve + amountIn;
    const newSolReserve = k / newTokReserve;
    estimatedOut = solReserve - newSolReserve;
    const priceBefore = solReserve / tokReserve;
    const priceAfter  = newSolReserve / newTokReserve;
    priceImpactPct = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
  }

  return { estimatedOut: Math.max(0, estimatedOut), priceImpactPct };
}

function buildSwapIx(
  payer: PublicKey,
  pdas: ReturnType<typeof findRaydiumCpmmPdas>,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputTokenAccount: PublicKey,
  outputTokenAccount: PublicKey,
  amountInRaw: bigint,
  minAmountOutRaw: bigint,
  inputTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  outputTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const wsolIsToken0 = pdas.token0.equals(NATIVE_MINT);
  const isBuy = inputMint.equals(NATIVE_MINT);

  const [inputVault, outputVault] = isBuy
    ? (wsolIsToken0 ? [pdas.token0Vault, pdas.token1Vault] : [pdas.token1Vault, pdas.token0Vault])
    : (wsolIsToken0 ? [pdas.token1Vault, pdas.token0Vault] : [pdas.token0Vault, pdas.token1Vault]);

  const data = Buffer.alloc(8 + 8 + 8);
  SWAP_BASE_INPUT_DISCM.copy(data, 0);
  data.writeBigUInt64LE(amountInRaw, 8);
  data.writeBigUInt64LE(minAmountOutRaw, 16);

  const keys: AccountMeta[] = [
    { pubkey: payer,                  isSigner: true,  isWritable: true  },
    { pubkey: RAYDIUM_DEVNET_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: pdas.ammConfig,         isSigner: false, isWritable: false },
    { pubkey: pdas.poolState,         isSigner: false, isWritable: true  },
    { pubkey: inputTokenAccount,      isSigner: false, isWritable: true  },
    { pubkey: outputTokenAccount,     isSigner: false, isWritable: true  },
    { pubkey: inputVault,             isSigner: false, isWritable: true  },
    { pubkey: outputVault,            isSigner: false, isWritable: true  },
    { pubkey: inputTokenProgram,      isSigner: false, isWritable: false }, // input token program (SPL or Token-2022)
    { pubkey: outputTokenProgram,     isSigner: false, isWritable: false }, // output token program (SPL or Token-2022)
    { pubkey: inputMint,              isSigner: false, isWritable: false },
    { pubkey: outputMint,             isSigner: false, isWritable: false },
    { pubkey: pdas.observationState,  isSigner: false, isWritable: true  },
  ];

  return new TransactionInstruction({ programId: RAYDIUM_CPMM_DEVNET, keys, data });
}

export async function swapOnRaydiumCpmm(
  wallet: WalletContextState,
  connection: Connection,
  tokenMint: PublicKey,
  isBuy: boolean,
  amountIn: number,       // SOL for buy, token UI amount for sell
  slippageBps = 100,
  tokenDecimals = 9,
): Promise<CpmmSwapResult> {
  if (tokenDecimals === undefined || tokenDecimals === null || tokenDecimals < 0 || tokenDecimals > 18)
    throw new Error("tokenDecimals required and must be between 0 and 18");
  if (!wallet.publicKey || !wallet.signTransaction)
    throw new Error("Wallet not connected");

  const payer = wallet.publicKey;
  const pdas  = findRaydiumCpmmPdas(tokenMint);

  const { estimatedOut } = await estimateCpmmSwap(connection, tokenMint, amountIn, isBuy);
  const slippageMul = 1 - slippageBps / 10_000;

  const userTokenAta  = getAssociatedTokenAddressSync(tokenMint, payer);
  const userWsolAta   = getAssociatedTokenAddressSync(NATIVE_MINT, payer);

  const instructions: TransactionInstruction[] = [];
  const cleanupIxs:   TransactionInstruction[] = [];

  // Check / create ATAs
  const [wsolAccInfo, tokenAccInfo] = await Promise.all([
    connection.getAccountInfo(userWsolAta),
    connection.getAccountInfo(userTokenAta),
  ]);

  if (!wsolAccInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, userWsolAta, payer, NATIVE_MINT),
    );
  }
  if (!tokenAccInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, userTokenAta, payer, tokenMint),
    );
  }

  let amountInRaw: bigint;
  let minAmountOutRaw: bigint;

  if (isBuy) {
    // Wrap SOL → WSOL
    const lamports = Math.floor(amountIn * LAMPORTS_PER_SOL);
    amountInRaw    = BigInt(lamports);
    minAmountOutRaw = BigInt(Math.floor(estimatedOut * slippageMul * Math.pow(10, tokenDecimals)));
    if (minAmountOutRaw === 0n) minAmountOutRaw = 1n;

    instructions.push(
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: userWsolAta, lamports }),
      createSyncNativeInstruction(userWsolAta),
    );

    instructions.push(buildSwapIx(
      payer, pdas, NATIVE_MINT, tokenMint,
      userWsolAta, userTokenAta,
      amountInRaw, minAmountOutRaw,
    ));

    // Close WSOL ATA after swap (return any leftover SOL)
    cleanupIxs.push(createCloseAccountInstruction(userWsolAta, payer, payer));
  } else {
    // Sell token → WSOL → SOL
    const tokenUnits = Math.floor(amountIn * Math.pow(10, tokenDecimals));
    amountInRaw    = BigInt(tokenUnits);
    minAmountOutRaw = BigInt(Math.floor(estimatedOut * slippageMul * LAMPORTS_PER_SOL));
    if (minAmountOutRaw === 0n) minAmountOutRaw = 1n;

    if (!wsolAccInfo) {
      // WSOL ATA was just created above; it's already in instructions
    }

    instructions.push(buildSwapIx(
      payer, pdas, tokenMint, NATIVE_MINT,
      userTokenAta, userWsolAta,
      amountInRaw, minAmountOutRaw,
    ));

    // Unwrap WSOL → SOL
    cleanupIxs.push(createCloseAccountInstruction(userWsolAta, payer, payer));
  }

  const tx = new Transaction();
  tx.add(...instructions, ...cleanupIxs);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer;

  const signed = await wallet.signTransaction(tx);
  const raw    = signed.serialize();
  const sig    = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction(
    { signature: sig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
    "confirmed",
  );

  return { signature: sig, amountIn, estimatedOut };
}
