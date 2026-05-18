import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "./idl.json";
import idlV2Json from "./idl_v2.json";
import { PROGRAM_ID, PROGRAM_ID_V2, FEE_WALLET, HUMBLETRUST_METRICS_AUTHORITY } from "./constants";

export const PROGRAM_ID_PK = new PublicKey(PROGRAM_ID);
export const PROGRAM_ID_V2_PK = new PublicKey(PROGRAM_ID_V2);
export const FEE_WALLET_PK = new PublicKey(FEE_WALLET);

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
  return {
    tokenMetadata,
    lockedVault,
    creatorVault,
    curvePoolVault,
    circulationVault,
    airdropVault,
    curveTreasurySol,
    lpLockVault,
  };
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
      params.antiBotSeconds
    )
    .accounts({
      creator,
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
  creatorFeeWallet: PublicKey,
  solIn: number,
  minTokensOut = 0
) => {
  const pdas = findV2Pdas(mint);
  const existingAta = await (program.provider as AnchorProvider).connection.getAccountInfo(buyerTokenAccount);
  const preInstructions = existingAta
    ? []
    : [createAssociatedTokenAccountInstruction(buyer, buyerTokenAccount, buyer, mint)];
  const tx = await program.methods
    .buyV2(new BN(Math.floor(solIn * LAMPORTS_PER_SOL)), new BN(minTokensOut))
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
  creatorFeeWallet: PublicKey,
  tokensIn: string,
  minSolOutLamports = 0
) => {
  const pdas = findV2Pdas(mint);
  const tx = await program.methods
    .sellV2(new BN(tokensIn), new BN(minSolOutLamports))
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

export { BN, PublicKey, Keypair };
