import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createInitializeNonTransferableMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";
import idlV2Json from "./idl_v2.json";
import {
  FEE_WALLET,
  HUMBLETRUST_METRICS_AUTHORITY,
  METAPLEX_TOKEN_METADATA_PROGRAM_ID,
  PROGRAM_ID_V2,
} from "./constants";

export const PROGRAM_ID_PK = new PublicKey(PROGRAM_ID_V2);
export const FEE_WALLET_PK = new PublicKey(FEE_WALLET);
export const METAPLEX_TOKEN_METADATA_PROGRAM_PK = new PublicKey(METAPLEX_TOKEN_METADATA_PROGRAM_ID);

export const getProgram = (provider: AnchorProvider) => {
  return new Program(idlV2Json as Idl, provider);
};

const findProgramPda = (seeds: (string | PublicKey)[]) =>
  PublicKey.findProgramAddressSync(
    seeds.map((seed) => typeof seed === "string" ? Buffer.from(seed) : seed.toBuffer()),
    PROGRAM_ID_PK
  );

export const findPdas = (mint: PublicKey) => {
  const [globalState] = findProgramPda(["global_state_v2"]);
  const [tokenMetadata] = findProgramPda(["token_metadata_v2", mint]);
  const [lockedVault] = findProgramPda(["locked_vault_v2", mint]);
  const [creatorVault] = findProgramPda(["creator_vault_v2", mint]);
  const [curvePoolVault] = findProgramPda(["curve_pool_vault_v2", mint]);
  const [circulationVault] = findProgramPda(["circulation_vault_v2", mint]);
  const [airdropVault] = findProgramPda(["airdrop_vault_v2", mint]);
  const [curveTreasurySol] = findProgramPda(["curve_treasury_sol_v2", mint]);
  const [lpLockVault] = findProgramPda(["lp_lock_vault_v2", mint]);
  const [metaplexMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_TOKEN_METADATA_PROGRAM_PK.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_TOKEN_METADATA_PROGRAM_PK
  );

  return {
    globalState,
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

export interface LaunchParams {
  name: string;
  symbol: string;
  lockDays: number;
  burnOption: 0 | 25 | 50;
  lockPercent: number;
  creatorPercent: number;
  curveLiquidityPercent: number;
  circulationPercent: number;
  airdropPercent: 0 | 2 | 5;
  initialSolLamports: number;
  tier: 0 | 1;
  antiBotSeconds: number;
}

export const formatSendTransactionError = async (
  connection: Connection,
  error: unknown
) => {
  const message = error instanceof Error ? error.message : String(error);
  let logs: string[] | null = null;

  if (error instanceof SendTransactionError) {
    try {
      logs = await error.getLogs(connection);
    } catch {
      logs = null;
    }
  }

  if (!logs) {
    const maybeLogs = (error as { logs?: unknown })?.logs;
    if (Array.isArray(maybeLogs)) logs = maybeLogs.map(String);
  }

  return logs?.length ? `${message}\nLogs:\n${logs.join("\n")}` : message;
};

export const launchToken = async (
  program: Program,
  connection: Connection,
  creator: PublicKey,
  params: LaunchParams
) => {
  const mintKp = Keypair.generate();
  const pdas = findPdas(mintKp.publicKey);

  try {
    const signature = await program.methods
      .createTokenWithLockV2(
        params.name,
        params.symbol,
        params.lockDays,
        params.burnOption,
        params.lockPercent,
        params.creatorPercent,
        params.curveLiquidityPercent,
        params.circulationPercent,
        params.airdropPercent,
        new BN(params.initialSolLamports),
        new PublicKey(HUMBLETRUST_METRICS_AUTHORITY),
        params.tier,
        params.antiBotSeconds
      )
      .accounts({
        creator,
        globalState: pdas.globalState,
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
        tokenMetadataProgram: METAPLEX_TOKEN_METADATA_PROGRAM_PK,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKp])
      .rpc();

    return { signature, mint: mintKp.publicKey, pdas };
  } catch (error) {
    throw new Error(await formatSendTransactionError(connection, error));
  }
};

export const findCreatorReputationPda = (creator: PublicKey) =>
  findProgramPda(["creator_reputation_v2", creator]);

export const initCreatorReputation = async (
  program: Program,
  connection: Connection,
  creator: PublicKey
) => {
  const [creatorReputation] = findCreatorReputationPda(creator);
  try {
    const signature = await program.methods
      .initCreatorReputationV2()
      .accounts({
        creator,
        creatorReputation,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { signature, creatorReputation };
  } catch (error) {
    throw new Error(await formatSendTransactionError(connection, error));
  }
};

export const findGlobalStatePda = () => findProgramPda(["global_state_v2"]);

export const findLaunchCertPda = (tokenMint: PublicKey) =>
  findProgramPda(["launch_cert_v2", tokenMint]);

const CERTIFICATE_MINT_EXTENSIONS = [ExtensionType.NonTransferable];

export const buildCertificateMintSetup = async (
  connection: Connection,
  payer: PublicKey
): Promise<{
  certificateMint: Keypair;
  creatorNftAccount: PublicKey;
  instructions: TransactionInstruction[];
}> => {
  const certificateMint = Keypair.generate();
  const mintLen = getMintLen(CERTIFICATE_MINT_EXTENSIONS);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  const creatorNftAccount = getAssociatedTokenAddressSync(
    certificateMint.publicKey,
    payer,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return {
    certificateMint,
    creatorNftAccount,
    instructions: [
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: certificateMint.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeNonTransferableMintInstruction(
        certificateMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMint2Instruction(
        certificateMint.publicKey,
        0,
        payer,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        payer,
        creatorNftAccount,
        payer,
        certificateMint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        certificateMint.publicKey,
        creatorNftAccount,
        payer,
        1,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      createSetAuthorityInstruction(
        certificateMint.publicKey,
        payer,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
    ],
  };
};

export const mintLaunchCertificate = async (
  program: Program,
  connection: Connection,
  creator: PublicKey,
  tokenMint: PublicKey
) => {
  const [tokenMetadata] = findProgramPda(["token_metadata_v2", tokenMint]);
  const [globalState] = findGlobalStatePda();
  const [launchCertificate] = findLaunchCertPda(tokenMint);
  const setup = await buildCertificateMintSetup(connection, creator);

  try {
    const signature = await program.methods
      .mintLaunchCertificateV2(setup.certificateMint.publicKey)
      .accounts({
        creator,
        mint: tokenMint,
        tokenMetadata,
        globalState,
        launchCertificate,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions(setup.instructions)
      .signers([setup.certificateMint])
      .rpc();

    return {
      signature,
      certificateMint: setup.certificateMint.publicKey,
      creatorNftAccount: setup.creatorNftAccount,
      launchCertificate,
    };
  } catch (error) {
    throw new Error(await formatSendTransactionError(connection, error));
  }
};

export { BN, PublicKey, Keypair };
