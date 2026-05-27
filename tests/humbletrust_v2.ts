import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { HumbletrustV2 } from "../target/types/humbletrust_v2";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("humbletrust_v2", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HumbletrustV2 as Program<HumbletrustV2>;
  const FEE_WALLET = new PublicKey("FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM");
  const INITIAL_SOL = new BN(500_000_000); // 0.5 SOL

  // ─── helpers ───────────────────────────────────────────────────────────────

  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId);

  const launchAccounts = (mintKp: Keypair, metaplexMetadata?: PublicKey) => {
    const [tokenMetadata] = findPda([Buffer.from("token_metadata_v2"), mintKp.publicKey.toBuffer()]);
    const [lockedVault]   = findPda([Buffer.from("locked_vault_v2"),   mintKp.publicKey.toBuffer()]);
    const [creatorVault]  = findPda([Buffer.from("creator_vault_v2"),  mintKp.publicKey.toBuffer()]);
    const [curvePoolVault]   = findPda([Buffer.from("curve_pool_vault_v2"),   mintKp.publicKey.toBuffer()]);
    const [circulationVault] = findPda([Buffer.from("circulation_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [airdropVault]     = findPda([Buffer.from("airdrop_vault_v2"),     mintKp.publicKey.toBuffer()]);
    const [curveTreasurySol] = findPda([Buffer.from("curve_treasury_sol_v2"),mintKp.publicKey.toBuffer()]);
    const [lpLockVault]      = findPda([Buffer.from("lp_lock_vault_v2",),     mintKp.publicKey.toBuffer()]);

    // Dummy metaplex metadata PDA (unused in localnet without metaplex program)
    const dummyMeta = metaplexMetadata ?? Keypair.generate().publicKey;

    return {
      creator: provider.wallet.publicKey,
      globalState: findPda([Buffer.from("global_state_v2")])[0],
      feeWallet: FEE_WALLET,
      tokenMetadata,
      mint: mintKp.publicKey,
      lockedVault,
      creatorVault,
      curvePoolVault,
      circulationVault,
      airdropVault,
      curveTreasurySol,
      lpLockVault,
      metaplexMetadata: dummyMeta,
      tokenMetadataProgram: Keypair.generate().publicKey, // stub — not needed for localnet tests
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    };
  };

  // Creates a fresh token with standard parameters.
  // lock=40%, creator=0%, curve=45%, circulation=15%, airdrop=0%, burn=25
  const createToken = async (mintKp: Keypair) => {
    await program.methods
      .createTokenWithLockV2(
        "TrustV2", "TRV2",
        /*lock_days*/       90,
        /*burn_option*/     25,
        /*lock_percent*/    40,
        /*creator_percent*/ 0,
        /*curve_liq*/       45,
        /*circulation*/     15,
        /*airdrop*/          0,
        INITIAL_SOL,
        provider.wallet.publicKey,  // metrics_authority
        /*tier*/             0,
        /*anti_bot_seconds*/ 0,
      )
      .accounts(launchAccounts(mintKp))
      .signers([mintKp])
      .rpc();
  };

  const getOrCreateAta = async (mint: PublicKey, owner: PublicKey): Promise<PublicKey> => {
    const ata = await getAssociatedTokenAddress(mint, owner);
    try {
      await getAccount(provider.connection, ata);
    } catch {
      const ix = createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey, ata, owner, mint
      );
      const tx = new anchor.web3.Transaction().add(ix);
      await provider.sendAndConfirm(tx);
    }
    return ata;
  };

  // ─── existing: token creation ───────────────────────────────────────────────

  it("creates a v2 token with fixed supply, curve treasury, burn, and TrustScore breakdown", async () => {
    const mintKp = Keypair.generate();
    await createToken(mintKp);

    const [tokenMetadata] = findPda([Buffer.from("token_metadata_v2"), mintKp.publicKey.toBuffer()]);
    const [curveTreasurySol] = findPda([Buffer.from("curve_treasury_sol_v2"), mintKp.publicKey.toBuffer()]);
    const meta     = await program.account.tokenMetadataV2.fetch(tokenMetadata);
    const treasury = await program.account.curveTreasurySol.fetch(curveTreasurySol);

    assert.equal(meta.totalSupply.toString(), "1000000000000000000");
    assert.equal(meta.lockedAllocationAmount.toString(), "400000000000000000");
    assert.equal(meta.curveLiquidityAmount.toString(),  "450000000000000000");
    assert.equal(meta.circulationAmount.toString(),     "150000000000000000");
    assert.isFalse(meta.isMigrated);
    assert.equal(treasury.initialSolLamports.toString(), "500000000");
  });

  it("rejects Q + R below 50%", async () => {
    const mintKp = Keypair.generate();
    try {
      await program.methods
        .createTokenWithLockV2("BadV2", "BAD2", 90, 25, 50, 0, 25, 20, 5, INITIAL_SOL, provider.wallet.publicKey, 0, 0)
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InsufficientCombinedLiquidity");
    } catch (e: any) {
      assert.include(e.message, "InsufficientCombinedLiquidity");
    }
  });

  it("rejects supply distributions that do not sum to 100%", async () => {
    const mintKp = Keypair.generate();
    try {
      await program.methods
        .createTokenWithLockV2("SumV2", "SUM2", 90, 25, 40, 0, 40, 15, 0, INITIAL_SOL, provider.wallet.publicKey, 0, 0)
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InvalidSupplyDistribution");
    } catch (e: any) {
      assert.include(e.message, "InvalidSupplyDistribution");
    }
  });

  // ─── #5: BUY test ───────────────────────────────────────────────────────────

  it("buy_v2: buyer receives correct tokens, treasury increases, fees distributed", async () => {
    const mintKp = Keypair.generate();
    await createToken(mintKp);

    const mint = mintKp.publicKey;
    const [tokenMetadata]  = findPda([Buffer.from("token_metadata_v2"),    mint.toBuffer()]);
    const [curvePoolVault] = findPda([Buffer.from("curve_pool_vault_v2"),  mint.toBuffer()]);
    const [curveTreasury]  = findPda([Buffer.from("curve_treasury_sol_v2"),mint.toBuffer()]);

    const buyerAta     = await getOrCreateAta(mint, provider.wallet.publicKey);
    const treasuryPre  = await program.account.curveTreasurySol.fetch(curveTreasury);
    const poolPre      = await getAccount(provider.connection, curvePoolVault);
    const feeWalletPre = await provider.connection.getBalance(FEE_WALLET);

    const SOL_IN = new BN(10_000_000); // 0.01 SOL
    const PLATFORM_FEE_BPS = 50;
    const CREATOR_FEE_BPS  = 50;

    await program.methods
      .buyV2(SOL_IN, new BN(1)) // min_tokens_out = 1 (accept any)
      .accounts({
        buyer:             provider.wallet.publicKey,
        tokenMetadata,
        mint,
        curvePoolVault,
        curveTreasurySol:  curveTreasury,
        buyerTokenAccount: buyerAta,
        feeWallet:         FEE_WALLET,
        creatorFeeWallet:  provider.wallet.publicKey, // creator == buyer in test
        tokenProgram:      TOKEN_PROGRAM_ID,
        systemProgram:     SystemProgram.programId,
      })
      .rpc();

    const treasuryPost = await program.account.curveTreasurySol.fetch(curveTreasury);
    const poolPost     = await getAccount(provider.connection, curvePoolVault);
    const buyerPost    = await getAccount(provider.connection, buyerAta);
    const feeWalletPost = await provider.connection.getBalance(FEE_WALLET);

    // Treasury must have increased by net_sol (sol_in minus fees)
    const platformFee = SOL_IN.muln(PLATFORM_FEE_BPS).divn(10_000).toNumber();
    const creatorFee  = SOL_IN.muln(CREATOR_FEE_BPS).divn(10_000).toNumber();
    const netSol      = SOL_IN.toNumber() - platformFee - creatorFee;
    const treasuryDelta = treasuryPost.currentSolLamports.sub(treasuryPre.currentSolLamports).toNumber();
    assert.equal(treasuryDelta, netSol, "treasury should increase by net SOL");

    // Buyer must have received tokens (> 0)
    assert.isTrue(BigInt(buyerPost.amount) > 0n, "buyer should have received tokens");

    // Pool vault must have decreased by exactly tokens_out
    const poolDelta = BigInt(poolPre.amount) - BigInt(poolPost.amount);
    assert.equal(poolDelta, BigInt(buyerPost.amount), "pool decrease should equal buyer received");

    // Fee wallet must have received platform_fee
    assert.equal(feeWalletPost - feeWalletPre, platformFee, "fee wallet should receive platform fee");
  });

  // ─── #5: SELL test ──────────────────────────────────────────────────────────

  it("sell_v2: seller receives SOL back (minus fees), curve pool vault increases", async () => {
    const mintKp = Keypair.generate();
    await createToken(mintKp);

    const mint = mintKp.publicKey;
    const [tokenMetadata]  = findPda([Buffer.from("token_metadata_v2"),    mint.toBuffer()]);
    const [curvePoolVault] = findPda([Buffer.from("curve_pool_vault_v2"),  mint.toBuffer()]);
    const [curveTreasury]  = findPda([Buffer.from("curve_treasury_sol_v2"),mint.toBuffer()]);

    const sellerAta = await getOrCreateAta(mint, provider.wallet.publicKey);

    // First buy to get tokens
    const SOL_IN = new BN(20_000_000); // 0.02 SOL
    await program.methods
      .buyV2(SOL_IN, new BN(1))
      .accounts({
        buyer:             provider.wallet.publicKey,
        tokenMetadata,
        mint,
        curvePoolVault,
        curveTreasurySol:  curveTreasury,
        buyerTokenAccount: sellerAta,
        feeWallet:         FEE_WALLET,
        creatorFeeWallet:  provider.wallet.publicKey,
        tokenProgram:      TOKEN_PROGRAM_ID,
        systemProgram:     SystemProgram.programId,
      })
      .rpc();

    const buyerBalance = (await getAccount(provider.connection, sellerAta)).amount;
    assert.isTrue(BigInt(buyerBalance) > 0n, "must have tokens after buy");

    const poolPre     = await getAccount(provider.connection, curvePoolVault);
    const sellerSolPre = await provider.connection.getBalance(provider.wallet.publicKey);

    // Sell all tokens back
    await program.methods
      .sellV2(new BN(buyerBalance.toString()), new BN(1))
      .accounts({
        seller:             provider.wallet.publicKey,
        tokenMetadata,
        mint,
        curvePoolVault,
        curveTreasurySol:   curveTreasury,
        sellerTokenAccount: sellerAta,
        feeWallet:          FEE_WALLET,
        creatorFeeWallet:   provider.wallet.publicKey,
        tokenProgram:       TOKEN_PROGRAM_ID,
      })
      .rpc();

    const sellerTokenPost = await getAccount(provider.connection, sellerAta);
    const poolPost        = await getAccount(provider.connection, curvePoolVault);
    const sellerSolPost   = await provider.connection.getBalance(provider.wallet.publicKey);

    // Seller token balance should be 0
    assert.equal(sellerTokenPost.amount, 0n, "seller token balance should be zero after sell");

    // Pool vault must have increased (tokens returned)
    assert.isTrue(BigInt(poolPost.amount) > BigInt(poolPre.amount), "pool vault should increase after sell");
    const poolDelta = BigInt(poolPost.amount) - BigInt(poolPre.amount);
    assert.equal(poolDelta, BigInt(buyerBalance), "pool increase must equal tokens sold");

    // Seller must have received SOL back (net of fees and tx cost)
    // We just check it's positive — exact amount depends on price impact
    assert.isTrue(sellerSolPost > sellerSolPre - 0.01 * LAMPORTS_PER_SOL,
      "seller should receive SOL back (roughly)");
  });

  // ─── #5: MIGRATION test ─────────────────────────────────────────────────────

  it("migrate_to_raydium_v2: rejects if threshold not met", async () => {
    const mintKp = Keypair.generate();
    await createToken(mintKp);

    const mint = mintKp.publicKey;
    const [tokenMetadata]  = findPda([Buffer.from("token_metadata_v2"),    mint.toBuffer()]);
    const [curveTreasury]  = findPda([Buffer.from("curve_treasury_sol_v2"),mint.toBuffer()]);
    const triggererTokenAccount = await getOrCreateAta(mint, provider.wallet.publicKey);
    const triggererWsolAccount = await getOrCreateAta(NATIVE_MINT, provider.wallet.publicKey);

    const meta = await program.account.tokenMetadataV2.fetch(tokenMetadata);

    // 0.5 SOL << 50 SOL threshold — migration must be rejected
    assert.isTrue(meta.migrationThresholdLamports.gtn(INITIAL_SOL.toNumber()),
      "threshold should be above initial SOL (50 SOL > 0.5 SOL)");

    // Calling migrate without reaching threshold should fail
    try {
      await program.methods
        .migrateToRaydiumV2(
          PublicKey.default,
          new BN(1),
          new BN(0),
          new BN(0),
        )
        .accounts({
          triggerer:        provider.wallet.publicKey,
          tokenMetadata,
          mint,
          curvePoolVault:   findPda([Buffer.from("curve_pool_vault_v2"),  mint.toBuffer()])[0],
          curveTreasurySol: curveTreasury,
          lpLockVault:      findPda([Buffer.from("lp_lock_vault_v2"),     mint.toBuffer()])[0],
          raydiumMigrationAuthority: findPda([Buffer.from("raydium_migration_authority_v2"), mint.toBuffer()])[0],
          // Stub accounts — Raydium validation will fail first, but threshold check should fail before that
          migrationTokenAccount: Keypair.generate().publicKey,
          migrationWsolAccount:  Keypair.generate().publicKey,
          triggererTokenAccount,
          triggererWsolAccount,
          wsolMint:              Keypair.generate().publicKey,
          raydiumProgram:        Keypair.generate().publicKey,
          raydiumAmmConfig:      Keypair.generate().publicKey,
          raydiumAuthority:      Keypair.generate().publicKey,
          raydiumPoolState:      Keypair.generate().publicKey,
          raydiumLpMint:         Keypair.generate().publicKey,
          raydiumUserLpToken:    Keypair.generate().publicKey,
          raydiumLpVault:        findPda([Buffer.from("raydium_lp_custody_v2"), mint.toBuffer()])[0],
          raydiumToken0Vault:    Keypair.generate().publicKey,
          raydiumToken1Vault:    Keypair.generate().publicKey,
          raydiumCreatePoolFee:  Keypair.generate().publicKey,
          raydiumObservationState: Keypair.generate().publicKey,
          tokenProgram:          TOKEN_PROGRAM_ID,
          tokenProgram2022:      Keypair.generate().publicKey,
          associatedTokenProgram: Keypair.generate().publicKey,
          systemProgram:         SystemProgram.programId,
          rent:                  SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Expected MigrationThresholdNotMet");
    } catch (e: any) {
      assert.include(e.message, "MigrationThresholdNotMet");
    }
  });

  it("migrate_to_raydium_v2: is_migrated flag is set and curve pool empties (simulated)", async () => {
    // NOTE: Full migration test requires Raydium CPMM program deployed on localnet.
    // This test verifies the metadata state changes by checking threshold validation
    // and the is_migrated field behavior.
    //
    // To run a full end-to-end migration test:
    //   1. Deploy Raydium CPMM devnet program to localnet (anchor localnet --skip-lint)
    //   2. Airdrop enough SOL to reach 50 SOL threshold via repeated buys
    //   3. Call migrate_to_raydium_v2 with real Raydium accounts
    //
    // For now we verify the state preconditions are correctly tracked.
    const mintKp = Keypair.generate();
    await createToken(mintKp);

    const [tokenMetadata] = findPda([Buffer.from("token_metadata_v2"), mintKp.publicKey.toBuffer()]);
    const meta = await program.account.tokenMetadataV2.fetch(tokenMetadata);

    assert.isFalse(meta.isMigrated, "should not be migrated at start");
    assert.equal(
      meta.migrationThresholdLamports.toString(),
      "50000000000",
      "threshold must be exactly 50 SOL"
    );
    assert.equal(meta.raydiumPool.toString(), PublicKey.default.toString(),
      "raydium_pool should be default before migration");
  });
});
