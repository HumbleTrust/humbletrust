import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { HumbletrustV2 } from "../target/types/humbletrust_v2";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";

describe("humbletrust_v2", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HumbletrustV2 as Program<HumbletrustV2>;
  const initialSol = new BN(500_000_000);
  const FEE_WALLET = new PublicKey("FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM");

  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId);

  const launchAccounts = (mintKp: Keypair) => {
    const [tokenMetadata] = findPda([Buffer.from("token_metadata_v2"), mintKp.publicKey.toBuffer()]);
    const [lockedVault] = findPda([Buffer.from("locked_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [creatorVault] = findPda([Buffer.from("creator_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [curvePoolVault] = findPda([Buffer.from("curve_pool_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [circulationVault] = findPda([Buffer.from("circulation_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [airdropVault] = findPda([Buffer.from("airdrop_vault_v2"), mintKp.publicKey.toBuffer()]);
    const [curveTreasurySol] = findPda([Buffer.from("curve_treasury_sol_v2"), mintKp.publicKey.toBuffer()]);
    const [lpLockVault] = findPda([Buffer.from("lp_lock_vault_v2"), mintKp.publicKey.toBuffer()]);

    return {
      creator: provider.wallet.publicKey,
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
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    };
  };

  it("creates a v2 token with fixed supply, curve treasury, burn, and TrustScore breakdown", async () => {
    const mintKp = Keypair.generate();

    await program.methods
      .createTokenWithLockV2(
        "TrustV2",
        "TRV2",
        90,
        50,
        40,
        0,
        45,
        15,
        0,
        initialSol,
        provider.wallet.publicKey,
        0,
        0
      )
      .accounts(launchAccounts(mintKp))
      .signers([mintKp])
      .rpc();

    const [tokenMetadata] = findPda([Buffer.from("token_metadata_v2"), mintKp.publicKey.toBuffer()]);
    const [curveTreasurySol] = findPda([Buffer.from("curve_treasury_sol_v2"), mintKp.publicKey.toBuffer()]);
    const meta = await program.account.tokenMetadataV2.fetch(tokenMetadata);
    const treasury = await program.account.curveTreasurySol.fetch(curveTreasurySol);

    assert.equal(meta.totalSupply.toString(), "1000000000000000000");
    assert.equal(meta.lockedAllocationAmount.toString(), "400000000000000000");
    assert.equal(meta.plannedBurnAmount.toString(), "200000000000000000");
    assert.equal(meta.lockedAmountAfterBurn.toString(), "200000000000000000");
    assert.equal(meta.curveLiquidityAmount.toString(), "450000000000000000");
    assert.equal(meta.circulationAmount.toString(), "150000000000000000");
    assert.equal(meta.trustScore, 87);
    assert.equal(meta.scoreCurveLiquidityTenths, 250);
    assert.equal(meta.scoreCirculationTenths, 60);
    assert.equal(meta.rawScoreTenths, 960);
    assert.equal(meta.trustLevel, 3);
    assert.isFalse(meta.isMigrated);
    assert.equal(treasury.initialSolLamports.toString(), "500000000");
  });

  it("rejects Q + R below 50%", async () => {
    const mintKp = Keypair.generate();

    try {
      await program.methods
        .createTokenWithLockV2("BadV2", "BAD2", 90, 25, 50, 0, 25, 20, 5, initialSol, provider.wallet.publicKey, 0, 0)
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
        .createTokenWithLockV2("SumV2", "SUM2", 90, 25, 40, 0, 40, 15, 0, initialSol, provider.wallet.publicKey, 0, 0)
        .accounts(launchAccounts(mintKp))
        .signers([mintKp])
        .rpc();
      assert.fail("Expected InvalidSupplyDistribution");
    } catch (e: any) {
      assert.include(e.message, "InvalidSupplyDistribution");
    }
  });
});
