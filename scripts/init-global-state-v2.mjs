/**
 * One-time script: initializes GlobalStateV2 PDA on devnet.
 * Run with: node scripts/init-global-state-v2.mjs
 * Requires ~/.config/solana/id.json (the program deploy keypair).
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const require = createRequire(import.meta.url);
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

const PROGRAM_ID_V2 = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RPC = "https://api.devnet.solana.com";

// Load admin keypair
const keyPath = join(homedir(), ".config", "solana", "id.json");
const rawKey = JSON.parse(readFileSync(keyPath, "utf8"));
const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(rawKey));

console.log("Admin pubkey:", adminKeypair.publicKey.toBase58());

// Derive GlobalStateV2 PDA
const [globalStatePda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("global_state_v2")],
  new PublicKey(PROGRAM_ID_V2)
);
console.log("GlobalStateV2 PDA:", globalStatePda.toBase58(), "bump:", bump);

// Check if already initialized
const connection = new Connection(RPC, "confirmed");
const existing = await connection.getAccountInfo(globalStatePda);
if (existing && existing.owner.toBase58() === PROGRAM_ID_V2) {
  console.log("GlobalStateV2 already initialized. Owner:", existing.owner.toBase58());
  process.exit(0);
}
console.log(
  "GlobalStateV2 not initialized (owner:",
  existing ? existing.owner.toBase58() : "null",
  ") — calling init_global_state_v2..."
);

// Load IDL
const idl = JSON.parse(readFileSync("web/src/lib/solana/idl_v2.json", "utf8"));

// Build provider
const wallet = new anchor.Wallet(adminKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new anchor.Program(idl, provider);

// Call init_global_state_v2
const tx = await program.methods
  .initGlobalStateV2()
  .accounts({
    authority: adminKeypair.publicKey,
    globalState: globalStatePda,
    systemProgram: SystemProgram.programId,
  })
  .signers([adminKeypair])
  .rpc();

console.log("init_global_state_v2 tx:", tx);

// Verify
const info = await connection.getAccountInfo(globalStatePda);
console.log(
  "GlobalStateV2 owner after init:",
  info?.owner.toBase58(),
  info?.owner.toBase58() === PROGRAM_ID_V2 ? "✓ OK" : "✗ WRONG"
);
