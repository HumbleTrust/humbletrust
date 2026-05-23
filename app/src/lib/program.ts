import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
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

export { BN, PublicKey, Keypair };
