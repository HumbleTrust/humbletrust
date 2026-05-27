/**
 * Diagnostic: fetch Raydium CPMM devnet amm_config and compute all PDAs.
 * Usage: node scripts/diagnose-raydium.mjs <MINT>
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

const RPC = "https://api.devnet.solana.com";
const RAYDIUM_CPMM = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
const HUMBLETRUST_V2 = new PublicKey("FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr");

const [,, mintArg] = process.argv;
if (!mintArg) { console.error("Usage: node scripts/diagnose-raydium.mjs <MINT>"); process.exit(1); }
const MINT = new PublicKey(mintArg);
const connection = new Connection(RPC, "confirmed");

function pda(seeds, program) {
  return PublicKey.findProgramAddressSync(seeds, program)[0];
}

// ── Raydium PDAs ──────────────────────────────────────────────────────────────
const ammConfig = pda([Buffer.from("amm_config"), Buffer.from([0, 0])], RAYDIUM_CPMM);

// Token ordering: sort by public key bytes
const [token0, token1] = WSOL.toBuffer().compare(MINT.toBuffer()) < 0
  ? [WSOL, MINT]
  : [MINT, WSOL];

console.log("\n══════════ Token Ordering ══════════");
console.log(" token0:", token0.toBase58());
console.log(" token1:", token1.toBase58());
console.log(" humbleToken is token0:", !token0.equals(WSOL));

const poolState = pda([Buffer.from("pool"), ammConfig.toBuffer(), token0.toBuffer(), token1.toBuffer()], RAYDIUM_CPMM);
const lpMint = pda([Buffer.from("pool_lp_mint"), poolState.toBuffer()], RAYDIUM_CPMM);
const token0Vault = pda([Buffer.from("pool_vault"), poolState.toBuffer(), token0.toBuffer()], RAYDIUM_CPMM);
const token1Vault = pda([Buffer.from("pool_vault"), poolState.toBuffer(), token1.toBuffer()], RAYDIUM_CPMM);
const observationState = pda([Buffer.from("observation"), poolState.toBuffer()], RAYDIUM_CPMM);

// HumbleTrust PDAs
const migrationAuthority = pda([Buffer.from("raydium_migration_authority_v2"), MINT.toBuffer()], HUMBLETRUST_V2);
const userLpToken = await getAssociatedTokenAddress(lpMint, migrationAuthority, true);

console.log("\n══════════ Raydium PDAs ══════════");
console.log(" ammConfig:        ", ammConfig.toBase58());
console.log(" poolState:        ", poolState.toBase58());
console.log(" lpMint:           ", lpMint.toBase58());
console.log(" token0Vault:      ", token0Vault.toBase58());
console.log(" token1Vault:      ", token1Vault.toBase58());
console.log(" observationState: ", observationState.toBase58());
console.log(" migrationAuth:    ", migrationAuthority.toBase58());
console.log(" userLpToken:      ", userLpToken.toBase58());

// ── Fetch amm_config ──────────────────────────────────────────────────────────
console.log("\n══════════ amm_config Account ══════════");
const ammConfigInfo = await connection.getAccountInfo(ammConfig);
if (!ammConfigInfo) {
  console.log(" ❌ amm_config NOT FOUND at", ammConfig.toBase58());
} else {
  console.log(" ✅ amm_config found, owner:", ammConfigInfo.owner.toBase58());
  console.log(" data length:", ammConfigInfo.data.length);
  // Decode AmmConfig:
  // discriminant(8) + bump(1) + disable_create_pool(1) + index(2) +
  // trade_fee_rate(8) + protocol_fee_rate(8) + fund_fee_rate(8) + create_pool_fee(8)
  const data = ammConfigInfo.data;
  const bump = data[8];
  const disableCreatePool = data[9] !== 0;
  const index = data.readUInt16LE(10);
  const tradeFeeRate = data.readBigUInt64LE(12);
  const protocolFeeRate = data.readBigUInt64LE(20);
  const fundFeeRate = data.readBigUInt64LE(28);
  const createPoolFee = data.readBigUInt64LE(36);
  console.log(" bump:              ", bump);
  console.log(" disable_create_pool:", disableCreatePool);
  console.log(" index:             ", index);
  console.log(" trade_fee_rate:    ", tradeFeeRate.toString());
  console.log(" protocol_fee_rate: ", protocolFeeRate.toString());
  console.log(" fund_fee_rate:     ", fundFeeRate.toString());
  console.log(" create_pool_fee:   ", createPoolFee.toString(), "lamports =", Number(createPoolFee) / 1e9, "SOL");
}

// ── Check existing accounts ───────────────────────────────────────────────────
console.log("\n══════════ Account Existence ══════════");
const accounts = [
  ["poolState",        poolState],
  ["lpMint",          lpMint],
  ["token0Vault",     token0Vault],
  ["token1Vault",     token1Vault],
  ["observationState", observationState],
  ["userLpToken",     userLpToken],
  ["migrationAuth",   migrationAuthority],
];
for (const [name, pubkey] of accounts) {
  const info = await connection.getAccountInfo(pubkey);
  if (info) {
    console.log(` ✅ ${name.padEnd(16)} exists — owner: ${info.owner.toBase58()}, lamports: ${info.lamports}, data: ${info.data.length}B`);
  } else {
    console.log(` ⬜ ${name.padEnd(16)} not created yet`);
  }
}

// ── Rent estimates ────────────────────────────────────────────────────────────
console.log("\n══════════ Rent Estimates (lamports) ══════════");
const rentExempt = async (bytes) => await connection.getMinimumBalanceForRentExemption(bytes);
const poolStateRent = await rentExempt(4128); // typical poolState size
const lpMintRent = await rentExempt(82);
const vaultRent = await rentExempt(165); // ATA size
const observationRent = await rentExempt(4104); // typical observation size
const ataRent = await rentExempt(165);

const totalRentNeeded = poolStateRent + lpMintRent + vaultRent + vaultRent + observationRent + ataRent;
console.log(" poolState rent:        ", poolStateRent);
console.log(" lpMint rent:           ", lpMintRent);
console.log(" token0Vault rent:      ", vaultRent, " (PDA ATA)");
console.log(" token1Vault rent:      ", vaultRent, " (PDA ATA)");
console.log(" observationState rent: ", observationRent);
console.log(" userLpToken rent:      ", ataRent, " (creator ATA)");
console.log(" ─────────────────────────────────────────────");
console.log(" TOTAL rent needed:     ", totalRentNeeded);

// ── HumbleTrust curve state ───────────────────────────────────────────────────
console.log("\n══════════ HumbleTrust Curve State ══════════");
const curveTreasurySol = pda([Buffer.from("curve_treasury_sol_v2"), MINT.toBuffer()], HUMBLETRUST_V2);
const tokenMetadata = pda([Buffer.from("token_metadata_v2"), MINT.toBuffer()], HUMBLETRUST_V2);

const treasuryInfo = await connection.getAccountInfo(curveTreasurySol);
if (treasuryInfo) {
  const solLamports = treasuryInfo.data.readBigUInt64LE(8); // current_sol_lamports
  console.log(" curve_treasury_sol lamports: ", treasuryInfo.lamports);
  console.log(" current_sol_lamports field:  ", solLamports.toString());
}

const metaInfo = await connection.getAccountInfo(tokenMetadata);
if (metaInfo) {
  const isMigrated = metaInfo.data[8 + 1 + 32 + 32 + 8 + 8 + 1]; // rough offset
  console.log(" token metadata exists, data:", metaInfo.data.length, "bytes");
}

console.log();
