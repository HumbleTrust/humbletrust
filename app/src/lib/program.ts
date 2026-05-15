import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "./idl.json";
import { PROGRAM_ID, FEE_WALLET } from "./constants";

export const PROGRAM_ID_PK = new PublicKey(PROGRAM_ID);
export const FEE_WALLET_PK = new PublicKey(FEE_WALLET);

export const getProgram = (provider: AnchorProvider) => {
  return new Program(idlJson as Idl, provider);
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
      creator, // metrics_authority = creator self
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

// ─── Phase 4.5 ───────────────────────────────────────────────────────────────

export const findCreatorReputationPda = (creator: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("creator_reputation"), creator.toBuffer()],
    PROGRAM_ID_PK
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
