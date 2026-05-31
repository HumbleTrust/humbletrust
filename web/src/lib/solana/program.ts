import { Program, AnchorProvider, BN, Idl, BorshAccountsCoder } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TYPE_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createTokenMetadataInstruction,
  pack as packTokenMetadata,
} from "@solana/spl-token-metadata";
import idlJson from "./idl.json";
import idlV2Json from "./idl_v2.json";
import { PROGRAM_ID, PROGRAM_ID_V2, FEE_WALLET, HUMBLETRUST_METRICS_AUTHORITY } from "./constants";

export const PROGRAM_ID_PK = new PublicKey(PROGRAM_ID);
export const PROGRAM_ID_V2_PK = new PublicKey(PROGRAM_ID_V2);
export const FEE_WALLET_PK = new PublicKey(FEE_WALLET);
export const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const getProgram = (provider: AnchorProvider) => {
  return new Program(idlJson as Idl, provider);
};

export const getProgramV2 = (provider: AnchorProvider) => {
  return new Program(idlV2Json as Idl, provider);
};

export const isProgramExecutable = async (connection: Connection, programId: PublicKey) => {
  const account = await connection.getAccountInfo(programId, "confirmed");
  return Boolean(account?.executable);
};

export const findPdas = (mint: PublicKey) => {
  const [tokenMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_metadata"), mint.toBuffer()],
    PROGRAM_ID_PK
  );
  const [lockedVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("locked_vault"), mint.toBuffer()],
    PROGRAM_ID_PK
  );
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), mint.toBuffer()],
    PROGRAM_ID_PK
  );
  const [circulationVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("circulation_vault"), mint.toBuffer()],
    PROGRAM_ID_PK
  );
  const [rewardsVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_vault"), mint.toBuffer()],
    PROGRAM_ID_PK
  );
  return { tokenMetadata, lockedVault, creatorVault, circulationVault, rewardsVault };
};

export const findV2Pdas = (mint: PublicKey) => {
  const [tokenMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_metadata_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [lockedVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("locked_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [curvePoolVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("curve_pool_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [circulationVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("circulation_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [airdropVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("airdrop_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [curveTreasurySol] = PublicKey.findProgramAddressSync(
    [Buffer.from("curve_treasury_sol_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [lpLockVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_lock_vault_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );
  const [metaplexMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_TOKEN_METADATA_PROGRAM_ID
  );
  return {
    tokenMetadata,
    lockedVault,
    creatorVault,
    curvePoolVault,
    circulationVault,
    airdropVault,
    curveTreasurySol,
    lpLockVault,
    metaplexMetadata,
  };
};

export const findGlobalStateV2Pda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("global_state_v2")], PROGRAM_ID_V2_PK);

export const findLaunchCertV2Pda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("launch_cert_v2"), tokenMint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

const getCreatorFeeWalletV2 = async (program: Program, mint: PublicKey) => {
  const pdas = findV2Pdas(mint);
  const accountInfo = await (program.provider as AnchorProvider).connection.getAccountInfo(pdas.tokenMetadata);
  if (!accountInfo || accountInfo.data.length < 40) {
    throw new Error("Token metadata PDA was not found for this mint");
  }
  return new PublicKey(accountInfo.data.slice(8, 40));
};

export interface LaunchParams {
  name: string;
  symbol: string;
  totalSupply: string;
  lockPercent: number;
  lockDays: number;
  burnOption: 25 | 50;
  creatorAllocation: number;
  airdropPercent: 0 | 2 | 5 | 8;
  tier: 0 | 1;
  antiBotSeconds: number;
}

export interface LaunchV2Params {
  name: string;
  symbol: string;
  lockPercent: number;
  lockDays: number;
  burnOption: 0 | 25 | 50;
  creatorAllocation: number;
  curveLiquidityPercent: number;
  circulationPercent: number;
  airdropPercent: number;
  initialSol: number;
  tier: 0 | 1;
  antiBotSeconds: number;
  /** 0 = CPMM (constant-product, default), 1 = Quadratic */
  curveType?: 0 | 1;
  /** 0 = Lock (default/recommended), 1 = Burn, 2 = ToCreator */
  lpPolicy?: 0 | 1 | 2;
}

export const launchToken = async (
  program: Program,
  creator: PublicKey,
  params: LaunchParams
) => {
  const mintKp = Keypair.generate();
  const pdas = findPdas(mintKp.publicKey);

  const supplyInt = Math.floor(parseFloat(params.totalSupply));
  if (!isFinite(supplyInt) || supplyInt <= 0 || supplyInt > 1_000_000_000_000) {
    throw new Error("Invalid supply: must be a whole number between 1 and 1,000,000,000,000");
  }

  const tx = await program.methods
    .createTokenWithLock(
      params.name,
      params.symbol,
      new BN(supplyInt),
      params.lockPercent,
      params.lockDays,
      params.burnOption,
      params.creatorAllocation,
      params.airdropPercent,
      new PublicKey(HUMBLETRUST_METRICS_AUTHORITY), // S1 fix: backend-controlled, not creator
      params.tier,
      params.antiBotSeconds
    )
    .accounts({
      creator,
      feeWallet: FEE_WALLET_PK,
      tokenMetadata: pdas.tokenMetadata,
      mint: mintKp.publicKey,
      lockedVault: pdas.lockedVault,
      creatorVault: pdas.creatorVault,
      circulationVault: pdas.circulationVault,
      rewardsVault: pdas.rewardsVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKp])
    .rpc();

  return { signature: tx, mint: mintKp.publicKey, pdas };
};

export const launchTokenV2 = async (
  program: Program,
  creator: PublicKey,
  params: LaunchV2Params
) => {
  const mintKp = Keypair.generate();
  const pdas = findV2Pdas(mintKp.publicKey);
  const initialSolLamports = Math.floor(params.initialSol * LAMPORTS_PER_SOL);

  const tx = await program.methods
    .createTokenWithLockV2(
      params.name,
      params.symbol,
      params.lockDays,
      params.burnOption,
      params.lockPercent,
      params.creatorAllocation,
      params.curveLiquidityPercent,
      params.circulationPercent,
      params.airdropPercent,
      new BN(initialSolLamports),
      new PublicKey(HUMBLETRUST_METRICS_AUTHORITY),
      params.tier,
      params.antiBotSeconds,
      params.curveType ?? 0,
      params.lpPolicy ?? 0
    )
    .accounts({
      creator,
      globalState: findGlobalStateV2Pda()[0],
      feeWallet: FEE_WALLET_PK,
      tokenMetadata: pdas.tokenMetadata,
      mint: mintKp.publicKey,
      lockedVault: pdas.lockedVault,
      creatorVault: pdas.creatorVault,
      curvePoolVault: pdas.curvePoolVault,
      circulationVault: pdas.circulationVault,
      airdropVault: pdas.airdropVault,
      curveTreasurySol: pdas.curveTreasurySol,
      lpLockVault: pdas.lpLockVault,
      metaplexMetadata: pdas.metaplexMetadata,
      tokenMetadataProgram: METAPLEX_TOKEN_METADATA_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKp])
    .rpc();

  return { signature: tx, mint: mintKp.publicKey, pdas };
};

export const buyOnCurveV2 = async (
  program: Program,
  buyer: PublicKey,
  mint: PublicKey,
  buyerTokenAccount: PublicKey,
  solIn: number,
  minTokensOut: string | number = 0
) => {
  const pdas = findV2Pdas(mint);
  const creatorFeeWallet = await getCreatorFeeWalletV2(program, mint);
  const existingAta = await (program.provider as AnchorProvider).connection.getAccountInfo(buyerTokenAccount);
  const preInstructions = existingAta
    ? []
    : [createAssociatedTokenAccountInstruction(buyer, buyerTokenAccount, buyer, mint)];
  const tx = await program.methods
    .buyV2(new BN(Math.floor(solIn * LAMPORTS_PER_SOL)), new BN(minTokensOut.toString()))
    .accounts({
      buyer,
      tokenMetadata: pdas.tokenMetadata,
      mint,
      curvePoolVault: pdas.curvePoolVault,
      curveTreasurySol: pdas.curveTreasurySol,
      buyerTokenAccount,
      feeWallet: FEE_WALLET_PK,
      creatorFeeWallet,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions(preInstructions)
    .rpc();
  return { signature: tx, pdas };
};

export const sellOnCurveV2 = async (
  program: Program,
  seller: PublicKey,
  mint: PublicKey,
  sellerTokenAccount: PublicKey,
  tokensIn: string,
  minSolOutLamports: string | number = 0
) => {
  const pdas = findV2Pdas(mint);
  const creatorFeeWallet = await getCreatorFeeWalletV2(program, mint);
  const tx = await program.methods
    .sellV2(new BN(tokensIn), new BN(minSolOutLamports.toString()))
    .accounts({
      seller,
      tokenMetadata: pdas.tokenMetadata,
      mint,
      curvePoolVault: pdas.curvePoolVault,
      curveTreasurySol: pdas.curveTreasurySol,
      sellerTokenAccount,
      feeWallet: FEE_WALLET_PK,
      creatorFeeWallet,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature: tx, pdas };
};

const TOKEN_SCALE = 1_000_000_000;
const CURVE_BUY_V2_DISCRIMINATOR = [223, 218, 65, 67, 253, 124, 178, 156];
const CURVE_SELL_V2_DISCRIMINATOR = [9, 22, 19, 150, 232, 92, 244, 40];

export interface CurveTradeRecord {
  trader: string;
  side: "buy" | "sell";
  source: "curve";
  token_amount: number;
  sol_amount: number;
  price_sol: number;
  block_time: string;
}

const decodeBase64 = (value: string) => {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }
  const bufferCtor = (globalThis as any).Buffer;
  return Uint8Array.from(bufferCtor.from(value, "base64"));
};

const sameDiscriminator = (data: Uint8Array, disc: number[]) =>
  data.length >= disc.length && disc.every((byte, index) => data[index] === byte);

const readPubkeyFromEvent = (data: Uint8Array, offset: number) =>
  new PublicKey(data.slice(offset, offset + 32)).toBase58();

const readU64FromEvent = (data: Uint8Array, offset: number) =>
  Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true));

const readI64FromEvent = (data: Uint8Array, offset: number) =>
  Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));

export const parseCurveTradeEvents = (
  logMessages: string[] | null | undefined,
  expectedMint?: string
): CurveTradeRecord[] => {
  const events: CurveTradeRecord[] = [];

  for (const log of logMessages || []) {
    const match = /^Program data: (.+)$/.exec(log);
    if (!match) continue;

    try {
      const data = decodeBase64(match[1]);
      if (sameDiscriminator(data, CURVE_BUY_V2_DISCRIMINATOR)) {
        let offset = 8;
        const mint = readPubkeyFromEvent(data, offset); offset += 32;
        const trader = readPubkeyFromEvent(data, offset); offset += 32;
        const solInLamports = readU64FromEvent(data, offset); offset += 8;
        offset += 8; // platform_fee_lamports
        offset += 8; // creator_fee_lamports
        const tokensOut = readU64FromEvent(data, offset); offset += 8;
        const priceLamportsPerToken = readU64FromEvent(data, offset); offset += 8;
        const timestamp = readI64FromEvent(data, offset);
        if (!expectedMint || mint === expectedMint) {
          events.push({
            trader,
            side: "buy",
            source: "curve",
            token_amount: tokensOut / TOKEN_SCALE,
            sol_amount: solInLamports / LAMPORTS_PER_SOL,
            price_sol: priceLamportsPerToken / LAMPORTS_PER_SOL,
            block_time: new Date(timestamp * 1000).toISOString(),
          });
        }
      } else if (sameDiscriminator(data, CURVE_SELL_V2_DISCRIMINATOR)) {
        let offset = 8;
        const mint = readPubkeyFromEvent(data, offset); offset += 32;
        const trader = readPubkeyFromEvent(data, offset); offset += 32;
        const tokensIn = readU64FromEvent(data, offset); offset += 8;
        const grossSolOutLamports = readU64FromEvent(data, offset); offset += 8;
        offset += 8; // platform_fee_lamports
        offset += 8; // creator_fee_lamports
        offset += 8; // seller_receives_lamports
        const priceLamportsPerToken = readU64FromEvent(data, offset); offset += 8;
        const timestamp = readI64FromEvent(data, offset);
        if (!expectedMint || mint === expectedMint) {
          events.push({
            trader,
            side: "sell",
            source: "curve",
            token_amount: tokensIn / TOKEN_SCALE,
            sol_amount: grossSolOutLamports / LAMPORTS_PER_SOL,
            price_sol: priceLamportsPerToken / LAMPORTS_PER_SOL,
            block_time: new Date(timestamp * 1000).toISOString(),
          });
        }
      }
    } catch (error) {
      console.warn("[curve-events] failed to parse event log", error);
    }
  }

  return events;
};

export const fetchCurveTradeFromTransaction = async (
  connection: Connection,
  signature: string,
  mint: PublicKey,
  expectedSide?: "buy" | "sell"
) => {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const events = parseCurveTradeEvents(tx?.meta?.logMessages, mint.toBase58());
  const event = expectedSide ? events.find((item) => item.side === expectedSide) : events[0];
  if (!event) return null;
  return {
    ...event,
    block_time: tx?.blockTime ? new Date(tx.blockTime * 1000).toISOString() : event.block_time,
  };
};

export const mintLaunchCertificateV2 = async (
  program: Program,
  creator: PublicKey,
  tokenMint: PublicKey,
  tokenName = "HumbleTrust Token"
) => {
  const provider = program.provider as AnchorProvider;
  const connection = provider.connection;
  const pdas = findV2Pdas(tokenMint);
  const [globalState] = findGlobalStateV2Pda();
  const [launchCertificate] = findLaunchCertV2Pda(tokenMint);

  const globalInfo = await connection.getAccountInfo(globalState, "confirmed");
  if (!globalInfo) {
    throw new Error("global_state_v2 is not initialized on devnet yet");
  }

  const existingCertificate = await connection.getAccountInfo(launchCertificate, "confirmed");
  if (existingCertificate) {
    return {
      signature: "",
      certificateMint: PublicKey.default,
      certificateTokenAccount: PublicKey.default,
      launchCertificate,
      alreadyMinted: true,
    };
  }

  const certificateMint = Keypair.generate();
  const certificateTokenAccount = getAssociatedTokenAddressSync(
    certificateMint.publicKey,
    creator,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const certName = tokenName ? `${tokenName} Certificate` : "HumbleTrust Launch Certificate";
  const certSymbol = "CERT";
  const certUri = "https://humbletrust.vercel.app/cert-meta.json";

  // ── Tx1: create and initialize the mint ────────────────────────────────────
  // Allocate ONLY the mint + MetadataPointer extension space here.
  // Pre-allocating metadata space in the same account causes InitializeMint2 to
  // see unrecognized trailing bytes and return InvalidAccountData.
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx1 = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: creator,
      newAccountPubkey: certificateMint.publicKey,
      space: mintLen,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      certificateMint.publicKey,
      creator,
      certificateMint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(certificateMint.publicKey, 0, creator, null, TOKEN_2022_PROGRAM_ID),
  );

  await provider.sendAndConfirm(tx1, [certificateMint]);

  // ── Tx2: write metadata, create ATA, mint, lock ─────────────────────────
  // Token-2022 metadata initialize reallocates the mint account in-place.
  // We must transfer the extra lamports BEFORE calling the instruction so the
  // account can cover the new rent-exempt minimum.
  const baseMetadataObj = {
    mint: certificateMint.publicKey,
    updateAuthority: creator,
    name: certName,
    symbol: certSymbol,
    uri: certUri,
    additionalMetadata: [] as [string, string][],
  };
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + packTokenMetadata(baseMetadataObj).length;
  const totalRent = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
  const rentDelta = totalRent - mintRent;

  const certificateIx = await program.methods
    .mintLaunchCertificateV2(certificateMint.publicKey)
    .accounts({
      creator,
      mint: tokenMint,
      tokenMetadata: pdas.tokenMetadata,
      globalState,
      launchCertificate,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx2 = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: creator,
      toPubkey: certificateMint.publicKey,
      lamports: rentDelta,
    }),
    createTokenMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: certificateMint.publicKey,
      updateAuthority: creator,
      mint: certificateMint.publicKey,
      mintAuthority: creator,
      name: certName,
      symbol: certSymbol,
      uri: certUri,
    }),
    createAssociatedTokenAccountInstruction(
      creator,
      certificateTokenAccount,
      creator,
      certificateMint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createMintToInstruction(
      certificateMint.publicKey,
      certificateTokenAccount,
      creator,
      1,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      certificateMint.publicKey,
      creator,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    certificateIx
  );

  const signature = await provider.sendAndConfirm(tx2);
  return {
    signature,
    certificateMint: certificateMint.publicKey,
    certificateTokenAccount,
    launchCertificate,
    alreadyMinted: false,
  };
};

// ─── Phase 4.5 ───────────────────────────────────────────────────────────────

export const findCreatorReputationPda = (creator: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("creator_reputation"), creator.toBuffer()],
    PROGRAM_ID_PK
  );

export const findCreatorReputationV2Pda = (creator: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("creator_reputation_v2"), creator.toBuffer()],
    PROGRAM_ID_V2_PK
  );

export const initCreatorReputation = async (
  program: Program,
  creator: PublicKey
) => {
  const [creatorReputation] = findCreatorReputationPda(creator);
  const tx = await program.methods
    .initCreatorReputation()
    .accounts({ creator, creatorReputation, systemProgram: SystemProgram.programId })
    .rpc();
  return { signature: tx, creatorReputation };
};

export const initCreatorReputationV2 = async (
  program: Program,
  creator: PublicKey
) => {
  const [creatorReputation] = findCreatorReputationV2Pda(creator);
  const tx = await program.methods
    .initCreatorReputationV2()
    .accounts({ creator, creatorReputation, systemProgram: SystemProgram.programId })
    .rpc();
  return { signature: tx, creatorReputation };
};

// ─── Phase 4 ─────────────────────────────────────────────────────────────────

export const findLpLockPda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("lp_lock"), tokenMint.toBuffer()],
    PROGRAM_ID_PK
  );

export const findLpVaultPda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("lp_vault"), tokenMint.toBuffer()],
    PROGRAM_ID_PK
  );

export const lockLpTokens = async (
  program: Program,
  creator: PublicKey,
  tokenMint: PublicKey,
  lpMint: PublicKey,
  creatorLpAccount: PublicKey,
  lpAmount: number,
  lockDays: number
) => {
  const [tokenMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_metadata"), tokenMint.toBuffer()],
    PROGRAM_ID_PK
  );
  const [lpLock] = findLpLockPda(tokenMint);
  const [lpVault] = findLpVaultPda(tokenMint);

  const tx = await program.methods
    .lockLpTokens(new BN(lpAmount), lockDays)
    .accounts({
      creator,
      tokenMetadata,
      tokenMint,
      lpMint,
      creatorLpAccount,
      lpLock,
      lpVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { signature: tx, lpLock, lpVault };
};

// ─── Phase 4.6 ───────────────────────────────────────────────────────────────

export const findGlobalStatePda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("global_state")], PROGRAM_ID_PK);

export const findLaunchCertPda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("launch_cert"), tokenMint.toBuffer()],
    PROGRAM_ID_PK
  );

// ─── Raydium CPMM ────────────────────────────────────────────────────────────

export const WSOL_MINT          = new PublicKey("So11111111111111111111111111111111111111112");
export const RAYDIUM_CPMM_DEVNET      = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
export const RAYDIUM_DEVNET_AUTHORITY = new PublicKey("CXniRufdq5xL8t8jZAPxsPZDpuudwuJSPWnbcD5Y5Nxq");
export const RAYDIUM_DEVNET_POOL_FEE  = new PublicKey("3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy");
export const TOKEN_2022_PROGRAM_PK    = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPF5SJEMi4xg92qGZJzk");
export const ASSOC_TOKEN_PROGRAM_PK   = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export const findRaydiumMigrationAuthorityV2Pda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("raydium_migration_authority_v2"), mint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

export const findLpLockV2Pda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("lp_lock_v2"), tokenMint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

export const findLpVaultV2Pda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("lp_vault_v2"), tokenMint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

export const findLpFeePoolV2Pda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("lp_fee_pool_v2"), tokenMint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

export const findRaydiumLpCustodyV2Pda = (tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("raydium_lp_custody_v2"), tokenMint.toBuffer()],
    PROGRAM_ID_V2_PK
  );

function sortMintsForRaydium(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

export const findRaydiumCpmmPdas = (tokenMint: PublicKey, programId = RAYDIUM_CPMM_DEVNET) => {
  const [token0, token1] = sortMintsForRaydium(WSOL_MINT, tokenMint);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), new BN(0).toArrayLike(Buffer, "le", 2)],
    programId
  );
  const [poolState] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), ammConfig.toBuffer(), token0.toBuffer(), token1.toBuffer()],
    programId
  );
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
    programId
  );
  const [token0Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolState.toBuffer(), token0.toBuffer()],
    programId
  );
  const [token1Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolState.toBuffer(), token1.toBuffer()],
    programId
  );
  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from("observation"), poolState.toBuffer()],
    programId
  );
  return { ammConfig, poolState, lpMint, token0Vault, token1Vault, observationState, token0, token1 };
};

// ─── Migration state (read-only, no wallet needed) ───────────────────────────

export interface MigrationState {
  thresholdLamports: number;
  currentSolLamports: number;
  isMigrated: boolean;
  raydiumPool: string;
  migratedAt: number;
  progressPct: number;
  isPrepared: boolean;
  migrationTokenAmount: number;
  migrationWsolLamports: number;
}

export const fetchMigrationState = async (
  connection: Connection,
  mint: PublicKey
): Promise<MigrationState | null> => {
  try {
    const pdas = findV2Pdas(mint);
    const [migrationAuthority] = findRaydiumMigrationAuthorityV2Pda(mint);
    const migrationTokenAccount = getAssociatedTokenAddressSync(mint, migrationAuthority, true);
    const migrationWsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, migrationAuthority, true);
    const coder = new BorshAccountsCoder(idlV2Json as Idl);
    const [metaInfo, treasuryInfo, migrationTokenBalance, migrationWsolInfo, wsolRent] = await Promise.all([
      connection.getAccountInfo(pdas.tokenMetadata),
      connection.getAccountInfo(pdas.curveTreasurySol),
      connection.getTokenAccountBalance(migrationTokenAccount)
        .then((balance) => Number(balance.value.amount || 0))
        .catch(() => 0),
      connection.getAccountInfo(migrationWsolAccount),
      connection.getMinimumBalanceForRentExemption(165).catch(() => 2_039_280),
    ]);
    if (!metaInfo) return null;

    // CurveTreasurySol: 8 discriminator + 32 mint + 32 creator + 8 initial + 8 current
    let currentSolLamports = 0;
    if (treasuryInfo && treasuryInfo.data.length >= 88) {
      const view = new DataView(treasuryInfo.data.buffer, treasuryInfo.data.byteOffset);
      currentSolLamports = Number(view.getBigUint64(80, true));
    }

    const migrationWsolLamports = Math.max(0, (migrationWsolInfo?.lamports ?? 0) - wsolRent);

    // Decode — old accounts (created before a program upgrade) may have fewer bytes than
    // the current IDL expects. In that case fall back to a minimal partial state so the UI
    // doesn't show "No v2 launch data" for tokens that are genuine HumbleTrust v2 tokens.
    let meta: any;
    try {
      meta = coder.decode("TokenMetadataV2", metaInfo.data);
    } catch {
      return {
        thresholdLamports: 0,
        currentSolLamports,
        isMigrated: false,
        raydiumPool: PublicKey.default.toBase58(),
        migratedAt: 0,
        progressPct: 0,
        isPrepared: migrationTokenBalance > 0 && migrationWsolLamports > 0,
        migrationTokenAmount: migrationTokenBalance,
        migrationWsolLamports,
      };
    }

    const threshold = Number(meta.migrationThresholdLamports ?? meta.migration_threshold_lamports ?? 0);
    return {
      thresholdLamports: threshold,
      currentSolLamports,
      isMigrated: !!(meta.isMigrated ?? meta.is_migrated),
      raydiumPool: (meta.raydiumPool ?? meta.raydium_pool ?? PublicKey.default).toBase58?.() ?? PublicKey.default.toBase58(),
      migratedAt: Number(meta.migratedAt ?? meta.migrated_at ?? 0),
      progressPct: threshold > 0 ? Math.min(100, (currentSolLamports / threshold) * 100) : 0,
      isPrepared: migrationTokenBalance > 0 && (migrationWsolInfo?.lamports ?? 0) > wsolRent,
      migrationTokenAmount: migrationTokenBalance,
      migrationWsolLamports,
    };
  } catch {
    return null;
  }
};

// ─── LP lock state ────────────────────────────────────────────────────────────

export interface LpLockState {
  lpMint: string;
  lpAmount: number;
  lockDays: number;
  unlockTime: number;
  lockedAt: number;
  lastClaimTime: number;
  totalFeesClaimed: number;
}

export const fetchLpLockState = async (
  connection: Connection,
  tokenMint: PublicKey
): Promise<LpLockState | null> => {
  try {
    const [lpLockPda] = findLpLockV2Pda(tokenMint);
    const coder = new BorshAccountsCoder(idlV2Json as Idl);
    const info = await connection.getAccountInfo(lpLockPda);
    if (!info) return null;
    const lock = coder.decode("LpLockV2", info.data) as any;
    return {
      lpMint: (lock.lpMint ?? lock.lp_mint).toBase58(),
      lpAmount: Number(lock.lpAmount ?? lock.lp_amount ?? 0),
      lockDays: Number(lock.lockDays ?? lock.lock_days ?? 0),
      unlockTime: Number(lock.unlockTime ?? lock.unlock_time ?? 0),
      lockedAt: Number(lock.lockedAt ?? lock.locked_at ?? 0),
      lastClaimTime: Number(lock.lastClaimTime ?? lock.last_claim_time ?? 0),
      totalFeesClaimed: Number(lock.totalFeesClaimed ?? lock.total_fees_claimed_lamports ?? 0),
    };
  } catch {
    return null;
  }
};

// ─── Migration + LP instructions ─────────────────────────────────────────────

export const migrateToRaydiumV2 = async (
  program: Program,
  triggerer: PublicKey,
  mint: PublicKey,
  payerBufferLamports = 250_000_000
) => {
  const pdas = findV2Pdas(mint);
  const ray = findRaydiumCpmmPdas(mint);
  const [migrationAuthority] = findRaydiumMigrationAuthorityV2Pda(mint);
  const provider = program.provider as AnchorProvider;

  const migrationTokenAccount = getAssociatedTokenAddressSync(mint, migrationAuthority, true);
  const migrationWsolAccount  = getAssociatedTokenAddressSync(WSOL_MINT, migrationAuthority, true);
  const triggererTokenAccount = getAssociatedTokenAddressSync(mint, triggerer, false);
  const triggererWsolAccount  = getAssociatedTokenAddressSync(WSOL_MINT, triggerer, false);
  const raydiumUserLpToken    = getAssociatedTokenAddressSync(ray.lpMint, triggerer, false);
  const [raydiumLpVault]      = findRaydiumLpCustodyV2Pda(mint);

  const preInstructions = [];
  const [tokInfo, wsolInfo, triggererTokInfo, triggererWsolInfo] = await Promise.all([
    provider.connection.getAccountInfo(migrationTokenAccount),
    provider.connection.getAccountInfo(migrationWsolAccount),
    provider.connection.getAccountInfo(triggererTokenAccount),
    provider.connection.getAccountInfo(triggererWsolAccount),
  ]);
  if (!tokInfo)  preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, migrationTokenAccount, migrationAuthority, mint));
  if (!wsolInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, migrationWsolAccount,  migrationAuthority, WSOL_MINT));
  if (!triggererTokInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, triggererTokenAccount, triggerer, mint));
  if (!triggererWsolInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, triggererWsolAccount, triggerer, WSOL_MINT));

  const tx = await program.methods
    .migrateToRaydiumV2(
      PublicKey.default,
      new BN(1),
      new BN(payerBufferLamports),
      new BN(0)
    )
    .accounts({
      triggerer,
      tokenMetadata:           pdas.tokenMetadata,
      mint,
      curvePoolVault:          pdas.curvePoolVault,
      curveTreasurySol:        pdas.curveTreasurySol,
      lpLockVault:             pdas.lpLockVault,
      raydiumMigrationAuthority: migrationAuthority,
      migrationTokenAccount,
      migrationWsolAccount,
      triggererTokenAccount,
      triggererWsolAccount,
      wsolMint:                WSOL_MINT,
      raydiumProgram:          RAYDIUM_CPMM_DEVNET,
      raydiumAmmConfig:        ray.ammConfig,
      raydiumAuthority:        RAYDIUM_DEVNET_AUTHORITY,
      raydiumPoolState:        ray.poolState,
      raydiumLpMint:           ray.lpMint,
      raydiumUserLpToken,
      raydiumLpVault,
      raydiumToken0Vault:      ray.token0Vault,
      raydiumToken1Vault:      ray.token1Vault,
      raydiumCreatePoolFee:    RAYDIUM_DEVNET_POOL_FEE,
      raydiumObservationState: ray.observationState,
      tokenProgram:            TOKEN_PROGRAM_ID,
      tokenProgram2022:        TOKEN_2022_PROGRAM_PK,
      associatedTokenProgram:  ASSOC_TOKEN_PROGRAM_PK,
      systemProgram:           SystemProgram.programId,
      rent:                    SYSVAR_RENT_PUBKEY,
    })
    .preInstructions(preInstructions)
    .rpc();

  return { signature: tx, poolState: ray.poolState };
};

export const prepareRaydiumMigrationV2 = async (
  program: Program,
  triggerer: PublicKey,
  mint: PublicKey,
  payerBufferLamports = 250_000_000
) => {
  const pdas = findV2Pdas(mint);
  const ray = findRaydiumCpmmPdas(mint);
  const [migrationAuthority] = findRaydiumMigrationAuthorityV2Pda(mint);
  const provider = program.provider as AnchorProvider;

  const migrationTokenAccount = getAssociatedTokenAddressSync(mint, migrationAuthority, true);
  const migrationWsolAccount  = getAssociatedTokenAddressSync(WSOL_MINT, migrationAuthority, true);
  const triggererTokenAccount = getAssociatedTokenAddressSync(mint, triggerer, false);
  const triggererWsolAccount  = getAssociatedTokenAddressSync(WSOL_MINT, triggerer, false);
  const raydiumUserLpToken    = getAssociatedTokenAddressSync(ray.lpMint, triggerer, false);
  const [raydiumLpVault]      = findRaydiumLpCustodyV2Pda(mint);

  const preInstructions = [];
  const [tokInfo, wsolInfo, triggererTokInfo, triggererWsolInfo] = await Promise.all([
    provider.connection.getAccountInfo(migrationTokenAccount),
    provider.connection.getAccountInfo(migrationWsolAccount),
    provider.connection.getAccountInfo(triggererTokenAccount),
    provider.connection.getAccountInfo(triggererWsolAccount),
  ]);
  if (!tokInfo)  preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, migrationTokenAccount, migrationAuthority, mint));
  if (!wsolInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, migrationWsolAccount,  migrationAuthority, WSOL_MINT));
  if (!triggererTokInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, triggererTokenAccount, triggerer, mint));
  if (!triggererWsolInfo) preInstructions.push(createAssociatedTokenAccountInstruction(triggerer, triggererWsolAccount, triggerer, WSOL_MINT));

  const tx = await program.methods
    .prepareRaydiumMigrationV2(new BN(payerBufferLamports))
    .accounts({
      triggerer,
      tokenMetadata:           pdas.tokenMetadata,
      mint,
      curvePoolVault:          pdas.curvePoolVault,
      curveTreasurySol:        pdas.curveTreasurySol,
      lpLockVault:             pdas.lpLockVault,
      raydiumMigrationAuthority: migrationAuthority,
      migrationTokenAccount,
      migrationWsolAccount,
      triggererTokenAccount,
      triggererWsolAccount,
      wsolMint:                WSOL_MINT,
      raydiumProgram:          RAYDIUM_CPMM_DEVNET,
      raydiumAmmConfig:        ray.ammConfig,
      raydiumAuthority:        RAYDIUM_DEVNET_AUTHORITY,
      raydiumPoolState:        ray.poolState,
      raydiumLpMint:           ray.lpMint,
      raydiumUserLpToken,
      raydiumLpVault,
      raydiumToken0Vault:      ray.token0Vault,
      raydiumToken1Vault:      ray.token1Vault,
      raydiumCreatePoolFee:    RAYDIUM_DEVNET_POOL_FEE,
      raydiumObservationState: ray.observationState,
      tokenProgram:            TOKEN_PROGRAM_ID,
      tokenProgram2022:        TOKEN_2022_PROGRAM_PK,
      associatedTokenProgram:  ASSOC_TOKEN_PROGRAM_PK,
      systemProgram:           SystemProgram.programId,
      rent:                    SYSVAR_RENT_PUBKEY,
    })
    .preInstructions(preInstructions)
    .rpc();

  return { signature: tx };
};

export const lockLpTokensV2 = async (
  program: Program,
  creator: PublicKey,
  tokenMint: PublicKey,
  lpMint: PublicKey,
  lpAmount: number,
  lockDays: number
) => {
  const pdas     = findV2Pdas(tokenMint);
  const [lpLock] = findLpLockV2Pda(tokenMint);
  const [lpVault]   = findLpVaultV2Pda(tokenMint);
  const [lpFeePool] = findLpFeePoolV2Pda(tokenMint);
  const creatorLpAccount = getAssociatedTokenAddressSync(lpMint, creator, false);

  const tx = await program.methods
    .lockLpTokensV2(new BN(lpAmount), lockDays)
    .accounts({
      creator,
      tokenMetadata: pdas.tokenMetadata,
      tokenMint,
      lpMint,
      creatorLpAccount,
      lpLock,
      lpVault,
      lpFeePool,
      tokenProgram:  TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent:          SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  return { signature: tx, lpLock, lpVault };
};

export const claimLpFeesV2 = async (
  program: Program,
  creator: PublicKey,
  tokenMint: PublicKey
) => {
  const [lpLock]    = findLpLockV2Pda(tokenMint);
  const [lpFeePool] = findLpFeePoolV2Pda(tokenMint);
  const tx = await program.methods
    .claimLpFeesV2()
    .accounts({
      creator, lpLock, lpFeePool,
      feeWallet: FEE_WALLET_PK,
      rewardsSolWallet: creator,
    })
    .rpc();
  return { signature: tx };
};

export const unlockLpTokensV2 = async (
  program: Program,
  creator: PublicKey,
  tokenMint: PublicKey,
  lpMint: PublicKey
) => {
  const [lpLock] = findLpLockV2Pda(tokenMint);
  const [lpVault] = findLpVaultV2Pda(tokenMint);
  const creatorLpAccount = getAssociatedTokenAddressSync(lpMint, creator, false);
  const tx = await program.methods
    .unlockLpTokensV2()
    .accounts({
      creator, lpLock, lpVault, creatorLpAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature: tx };
};

export const initGlobalStateV2 = async (program: Program, authority: PublicKey) => {
  const [globalState] = findGlobalStateV2Pda();
  const tx = await program.methods
    .initGlobalStateV2()
    .accounts({ authority, globalState, systemProgram: SystemProgram.programId })
    .rpc();
  return { signature: tx, globalState };
};

// ─── Creator lock / vesting state ────────────────────────────────────────────

export interface CreatorLockState {
  creator: string;
  isLocked: boolean;
  unlockTime: number;
  lockedAmountAfterBurn: number;
  plannedBurnAmount: number;
  createdAt: number;
  lockDays: number;
  lockPercent: number;
  burnOption: number;
  isMigrated: boolean;
  creatorAllocationAmount: number;
  vestingT1Done: boolean;
  vestingT2Done: boolean;
  vestingT3Done: boolean;
  vestingT1Action: number;
  vestingT2Action: number;
  vestingT3Action: number;
}

export const fetchCreatorLockState = async (
  connection: Connection,
  mint: PublicKey
): Promise<CreatorLockState | null> => {
  try {
    const pdas = findV2Pdas(mint);
    const coder = new BorshAccountsCoder(idlV2Json as Idl);
    const metaInfo = await connection.getAccountInfo(pdas.tokenMetadata);
    if (!metaInfo) return null;
    const m = coder.decode("TokenMetadataV2", metaInfo.data) as any;
    return {
      creator:               (m.creator ?? m.Creator)?.toBase58?.() ?? "",
      isLocked:              !!(m.isLocked ?? m.is_locked),
      unlockTime:            Number(m.unlockTime ?? m.unlock_time ?? 0),
      lockedAmountAfterBurn: Number(m.lockedAmountAfterBurn ?? m.locked_amount_after_burn ?? 0),
      plannedBurnAmount:     Number(m.plannedBurnAmount ?? m.planned_burn_amount ?? 0),
      createdAt:             Number(m.createdAt ?? m.created_at ?? 0),
      lockDays:              Number(m.lockDays ?? m.lock_days ?? 0),
      lockPercent:           Number(m.lockPercent ?? m.lock_percent ?? 0),
      burnOption:            Number(m.burnOption ?? m.burn_option ?? 0),
      isMigrated:            !!(m.isMigrated ?? m.is_migrated),
      creatorAllocationAmount: Number(m.creatorAllocationAmount ?? m.creator_allocation_amount ?? 0),
      vestingT1Done:         !!(m.vestingT1Done ?? m.vesting_t1_done),
      vestingT2Done:         !!(m.vestingT2Done ?? m.vesting_t2_done),
      vestingT3Done:         !!(m.vestingT3Done ?? m.vesting_t3_done),
      vestingT1Action:       Number(m.vestingT1Action ?? m.vesting_t1_action ?? 0),
      vestingT2Action:       Number(m.vestingT2Action ?? m.vesting_t2_action ?? 0),
      vestingT3Action:       Number(m.vestingT3Action ?? m.vesting_t3_action ?? 0),
    };
  } catch {
    return null;
  }
};

export const unlockLockedTokensV2 = async (
  program: Program,
  creator: PublicKey,
  mint: PublicKey
) => {
  const pdas = findV2Pdas(mint);
  const tx = await program.methods
    .unlockLockedTokensV2()
    .accounts({
      creator,
      tokenMetadata:    pdas.tokenMetadata,
      mint,
      lockedVault:      pdas.lockedVault,
      circulationVault: pdas.circulationVault,
      tokenProgram:     TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature: tx };
};

export const useVestingTrancheV2 = async (
  program: Program,
  creator: PublicKey,
  mint: PublicKey,
  tranche: number,
  action: number, // 1=send to wallet, 2=burn, 3=add to circulation
  connection: Connection
) => {
  const pdas = findV2Pdas(mint);
  const creatorReceiveAccount = getAssociatedTokenAddressSync(mint, creator, false, TOKEN_PROGRAM_ID);

  // Auto-create creator ATA if missing
  const ataInfo = await connection.getAccountInfo(creatorReceiveAccount);
  if (!ataInfo) {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      creator, creatorReceiveAccount, creator, mint,
      TOKEN_PROGRAM_ID
    );
    const setupTx = new Transaction().add(createAtaIx);
    const provider = (program.provider as AnchorProvider);
    await provider.sendAndConfirm(setupTx);
  }

  const tx = await program.methods
    .useVestingTrancheV2(tranche, action)
    .accounts({
      creator,
      tokenMetadata:         pdas.tokenMetadata,
      mint,
      creatorVault:          pdas.creatorVault,
      circulationVault:      pdas.circulationVault,
      creatorReceiveAccount,
      tokenProgram:          TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature: tx };
};

export { BN, PublicKey, Keypair };
