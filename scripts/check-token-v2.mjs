/**
 * Devnet token status checker + unlock/vesting script for humbletrust-v2.
 * Usage:
 *   node scripts/check-token-v2.mjs <MINT>
 *   node scripts/check-token-v2.mjs <MINT> unlock          # unlock locked tokens (30%)
 *   node scripts/check-token-v2.mjs <MINT> vesting 1       # claim vesting tranche 1 (send to circulation)
 *   node scripts/check-token-v2.mjs <MINT> vesting 2
 *   node scripts/check-token-v2.mjs <MINT> vesting 3
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const require = createRequire(import.meta.url);
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require("@solana/spl-token");

const PROGRAM_ID_V2 = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RPC = "https://api.devnet.solana.com";

const [, , mintArg, action, trancheArg] = process.argv;
if (!mintArg) {
  console.error("Usage: node scripts/check-token-v2.mjs <MINT> [unlock|vesting <1|2|3>]");
  process.exit(1);
}

const MINT = new PublicKey(mintArg);
const connection = new Connection(RPC, "confirmed");

const keyPath = join(homedir(), ".config", "solana", "id.json");
const rawKey = JSON.parse(readFileSync(keyPath, "utf8"));
const creatorKeypair = Keypair.fromSecretKey(Uint8Array.from(rawKey));
const idl = JSON.parse(readFileSync("web/src/lib/solana/idl_v2.json", "utf8"));
const wallet = new anchor.Wallet(creatorKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new anchor.Program(idl, provider);

const PROG = new PublicKey(PROGRAM_ID_V2);

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROG)[0];
}

const tokenMetadataPda  = pda([Buffer.from("token_metadata_v2"), MINT.toBuffer()]);
const lockedVaultPda    = pda([Buffer.from("locked_vault_v2"),   MINT.toBuffer()]);
const creatorVaultPda   = pda([Buffer.from("creator_vault_v2"),  MINT.toBuffer()]);
const circulationVaultPda = pda([Buffer.from("circulation_vault_v2"), MINT.toBuffer()]);

// ── Status check ─────────────────────────────────────────────────────────────
const meta = await program.account.tokenMetadataV2.fetch(tokenMetadataPda);
const now = Math.floor(Date.now() / 1000);

console.log("\n══════════════════════════════════════════");
console.log(" Token:", MINT.toBase58());
console.log("══════════════════════════════════════════");
console.log(" Creator:        ", meta.creator.toBase58());
console.log(" is_locked:      ", meta.isLocked);
console.log(" unlock_time:    ", new Date(meta.unlockTime * 1000).toISOString());
console.log(" now:            ", new Date(now * 1000).toISOString());
const secsToUnlock = meta.unlockTime - now;
if (secsToUnlock > 0) {
  console.log(" ⏳ Locked for:  ", secsToUnlock, "more seconds");
} else if (meta.isLocked) {
  console.log(" ✅ READY TO UNLOCK (time passed)");
} else {
  console.log(" ✅ Already unlocked");
}

console.log("\n── Locked vault (30%) ──");
console.log(" locked_amount_after_burn:", meta.lockedAmountAfterBurn.toString());

console.log("\n── Creator vesting (5%) ──");
const created = meta.createdAt;
const SECS_PER_DAY = 60; // test-mode: 1 day = 60 seconds
const elapsed = now - created;
const elapsedDays = Math.floor(elapsed / SECS_PER_DAY);
console.log(" created_at:      ", new Date(created * 1000).toISOString());
console.log(" elapsed:         ", elapsed, "seconds /", elapsedDays, "test-days");
console.log(" creator_allocation:", meta.creatorAllocationAmount?.toString() ?? "n/a");
console.log(" T1 (day 30 =", 30*SECS_PER_DAY, "s):", meta.vestingT1Done ? "✅ done" : elapsedDays >= 30 ? "✅ READY" : `⏳ ${30*SECS_PER_DAY - elapsed}s left`);
console.log(" T2 (day 60 =", 60*SECS_PER_DAY, "s):", meta.vestingT2Done ? "✅ done" : elapsedDays >= 60 ? "✅ READY" : `⏳ ${60*SECS_PER_DAY - elapsed}s left`);
console.log(" T3 (day 90 =", 90*SECS_PER_DAY, "s):", meta.vestingT3Done ? "✅ done" : elapsedDays >= 90 ? "✅ READY" : `⏳ ${90*SECS_PER_DAY - elapsed}s left`);

console.log("\n── Vault balances ──");
const lockedInfo = await connection.getTokenAccountBalance(lockedVaultPda).catch(() => null);
const circInfo   = await connection.getTokenAccountBalance(circulationVaultPda).catch(() => null);
const creatorInfo = await connection.getTokenAccountBalance(creatorVaultPda).catch(() => null);
console.log(" locked_vault:      ", lockedInfo?.value.uiAmountString ?? "n/a");
console.log(" circulation_vault: ", circInfo?.value.uiAmountString ?? "n/a");
console.log(" creator_vault:     ", creatorInfo?.value.uiAmountString ?? "n/a");

// ── Actions ───────────────────────────────────────────────────────────────────
if (!action) { console.log("\nNo action — pass 'unlock' or 'vesting <1|2|3>' to execute.\n"); process.exit(0); }

if (action === "unlock") {
  console.log("\n→ Calling unlock_locked_tokens_v2...");
  const tx = await program.methods
    .unlockLockedTokensV2()
    .accounts({
      creator: creatorKeypair.publicKey,
      tokenMetadata: tokenMetadataPda,
      mint: MINT,
      lockedVault: lockedVaultPda,
      circulationVault: circulationVaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([creatorKeypair])
    .rpc();
  console.log("✅ unlock tx:", tx);
  console.log("🔗 https://solscan.io/tx/" + tx + "?cluster=devnet");
}

if (action === "vesting") {
  const tranche = parseInt(trancheArg);
  if (![1, 2, 3].includes(tranche)) {
    console.error("Tranche must be 1, 2 or 3");
    process.exit(1);
  }
  // Action 1 = send to circulation, 2 = burn, 3 = lock further
  const vestingAction = 1; // send to circulation
  console.log(`\n→ Calling use_vesting_tranche_v2 (tranche=${tranche}, action=send_to_circulation)...`);

  const creatorReceiveAccount = await getAssociatedTokenAddress(MINT, creatorKeypair.publicKey);

  const tx = await program.methods
    .useVestingTrancheV2(tranche, vestingAction)
    .accounts({
      creator: creatorKeypair.publicKey,
      tokenMetadata: tokenMetadataPda,
      mint: MINT,
      creatorVault: creatorVaultPda,
      circulationVault: circulationVaultPda,
      creatorReceiveAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([creatorKeypair])
    .rpc();
  console.log(`✅ vesting T${tranche} tx:`, tx);
  console.log("🔗 https://solscan.io/tx/" + tx + "?cluster=devnet");
}
