import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Humbletrust } from "../target/types/humbletrust";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";

describe("humbletrust", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Humbletrust as Program<Humbletrust>;

  const FEE_WALLET = new PublicKey("FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM");

  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId);

  const launchAccounts = (mintKp: Keypair) => {
    const [tokenMetadata] = findPda([Buffer.from("token_metadata"), mintKp.publicKey.toBuffer()]);
    const [lockedVault]   = findPda([Buffer.from("locked_vault"),    mintKp.publicKey.toBuffer()]);
    const [creatorVault]  = findPda([Buffer.from("creator_vault"),   mintKp.publicKey.toBuffer()]);
    const [circVault]     = findPda([Buffer.from("circulation_vault"),mintKp.publicKey.toBuffer()]);
    const [rewardsVault]  = findPda([Buffer.from("rewards_vault"),   mintKp.publicKey.toBuffer()]);
    return {
      creator: provider.wallet.publicKey,
      feeWallet: FEE_WALLET,
      tokenMetadata,
      mint: mintKp.publicKey,
      lockedVault,
      creatorVault,
      circulationVault: circVault,
      rewardsVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    };
  };

  // ─── create_token_with_lock ───────────────────────────────────────────────

  it("creates a token with correct TrustScore, lock_days, and allocation_percent stored", async () => {
    const mintKp = Keypair.generate();
    // lock 30% / 360d / burn 50% / airdrop 8% => 6 + 25 + 12 + 10 = 53
    // circulation = 100 - 30 - 5 = 65% >= 55% — passes
    await program.methods
      .createTokenWithLock(
        "GoodToken", "GOOD", new BN(1_000_000_000),
        30, 360, 50, 5, 8,
        provider.wallet.publicKey, // metrics_authority
        1, 0  // tier = premium, anti_bot = 0
      )
      .accounts(launchAccounts(mintKp))
      .signers([mintKp])
      .rpc();

    const [tokenMetadata] = findPda([Buffer.from("token_metadata"), mintKp.publicKey.toBuffer()]);
    const meta = await program.account.tokenMetadata.fetch(tokenMetadata);

    assert.equal(meta.trustScore, 53, "lock 30%/360d/burn50/airdrop8 = 53");
    assert.isTrue(meta.isPremium, "tier=1 → is_premium");
    assert.equal(meta.lockDays, 360, "lock_days stored explicitly");
    assert.equal(meta.creatorAllocationPercent, 5, "creator_allocation_percent stored");
    assert.isTrue(meta.isLocked);
    // rewards_multiplier_bps for score 53 → bracket 51-65 → 10_000
    assert.equal(meta.rewardsMultiplierBps, 10_000);
  });

  it("rejects when circulation < 55%", async () => {
    const mintKp = Keypair.generate();
    // lock 80% + creator 10% = 90% → circulation 10% < 55%
    try {
      await program.methods
        .createTokenWithLock(
          "BadToken", "BAD", new BN(1_000_000_000),
          80, 90, 25, 10, 0,
          provider.wallet.publicKey, 0, 0
        )
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InsufficientCirculation error");
    } catch (e: any) {
      assert.include(e.message, "InsufficientCirculation");
    }
  });

  it("rejects supply = 0", async () => {
    const mintKp = Keypair.generate();
    try {
      await program.methods
        .createTokenWithLock(
          "ZeroToken", "ZERO", new BN(0),
          30, 90, 25, 5, 0,
          provider.wallet.publicKey, 0, 0
        )
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InvalidSupply error");
    } catch (e: any) {
      assert.include(e.message, "InvalidSupply");
    }
  });

  it("rejects anti_bot_seconds > 600", async () => {
    const mintKp = Keypair.generate();
    try {
      await program.methods
        .createTokenWithLock(
          "BotToken", "BOT", new BN(1_000_000_000),
          30, 90, 25, 5, 0,
          provider.wallet.publicKey, 0, 601
        )
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InvalidAntiBotSeconds");
    } catch (e: any) {
      assert.include(e.message, "InvalidAntiBotSeconds");
    }
  });

  // ─── init_creator_reputation ─────────────────────────────────────────────

  it("initializes creator reputation PDA", async () => {
    const creator = provider.wallet.publicKey;
    const [creatorReputation] = findPda([Buffer.from("creator_reputation"), creator.toBuffer()]);

    try {
      await program.methods
        .initCreatorReputation()
        .accounts({ creator, creatorReputation, systemProgram: SystemProgram.programId })
        .rpc();
    } catch (e: any) {
      if (!e.message.includes("already in use")) throw e;
    }

    const rep = await program.account.creatorReputation.fetch(creatorReputation);
    assert.equal(rep.totalLaunches, 0);
    assert.equal(rep.scoreBonus, 0);
    assert.isTrue(rep.creator.equals(creator));
  });

  // ─── Phase 5: init_global_state ──────────────────────────────────────────

  it("initializes global state with correct default fees", async () => {
    const [globalState] = findPda([Buffer.from("global_state")]);

    try {
      await program.methods
        .initGlobalState()
        .accounts({
          authority: provider.wallet.publicKey,
          globalState,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      if (!e.message.includes("already in use")) throw e;
    }

    const gs = await program.account.globalState.fetch(globalState);
    assert.equal(gs.standardFeeLamports.toNumber(), 56_818_181);
    assert.equal(gs.premiumFeeLamports.toNumber(), 281_818_181);
    assert.isFalse(gs.isLaunchesPaused);
    assert.isTrue(gs.authority.equals(provider.wallet.publicKey));
  });
});
