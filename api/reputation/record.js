/**
 * POST /api/reputation/record
 * Internal endpoint — calls record_reputation_event_v2 on-chain.
 *
 * Body: { mint: string, creator: string, event_type: 1|2|3|4 }
 *   event_type: 1=launch, 2=unlock, 3=complaint, 4=bonus
 *
 * Auth: Authorization: Bearer <INTERNAL_API_SECRET>
 */

const crypto = require("crypto");
const { isValidWallet, setCors } = require("../_lib/validate");
const { getClient } = require("../_lib/db");

const PROGRAM_ID_V2 = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RPC_ENDPOINT  = process.env.SOLANA_RPC || "https://api.devnet.solana.com";

// record_reputation_event_v2 discriminator (Anchor sha256 hash of namespace + name)
const DISCRIMINATOR = Buffer.from([124, 173, 10, 238, 10, 211, 199, 133]);

let web3;
function getWeb3() {
  if (!web3) web3 = require("@solana/web3.js");
  return web3;
}

function checkAuth(req) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function loadMetricsKeypair() {
  const raw = process.env.METRICS_AUTHORITY_PRIVATE_KEY;
  if (!raw) throw new Error("METRICS_AUTHORITY_PRIVATE_KEY not configured");
  const { Keypair } = getWeb3();
  let bytes;
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error("METRICS_AUTHORITY_PRIVATE_KEY must be a JSON array of 64 bytes");
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error("METRICS_AUTHORITY_PRIVATE_KEY must be exactly 64 bytes");
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function derivePdas(mintPk, creatorPk) {
  const { PublicKey } = getWeb3();
  const programPk = new PublicKey(PROGRAM_ID_V2);
  const enc = s => Buffer.from(s);
  const pda = seeds => PublicKey.findProgramAddressSync(seeds, programPk)[0];
  return {
    tokenMetadata:     pda([enc("token_metadata_v2"), mintPk.toBuffer()]),
    creatorReputation: pda([enc("creator_reputation_v2"), creatorPk.toBuffer()]),
  };
}

async function buildAndSendInstruction(mintPk, creatorPk, eventType) {
  const { Connection, Transaction, TransactionInstruction, PublicKey } = getWeb3();
  const keypair = loadMetricsKeypair();
  const { tokenMetadata, creatorReputation } = derivePdas(mintPk, creatorPk);
  const programId = new PublicKey(PROGRAM_ID_V2);

  // Instruction data: 8-byte discriminator + 1-byte event_type
  const data = Buffer.alloc(9);
  DISCRIMINATOR.copy(data, 0);
  data.writeUInt8(eventType, 8);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: keypair.publicKey,  isSigner: true,  isWritable: false },
      { pubkey: tokenMetadata,      isSigner: false, isWritable: false },
      { pubkey: mintPk,             isSigner: false, isWritable: false },
      { pubkey: creatorReputation,  isSigner: false, isWritable: true  },
    ],
    data,
  });

  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = blockhash;
  tx.add(ix);
  tx.sign(keypair);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!checkAuth(req)) return res.status(401).json({ error: "unauthorized" });

  const { mint, creator, event_type } = req.body || {};

  if (!mint || !creator || event_type == null) {
    return res.status(400).json({ error: "mint, creator, and event_type are required" });
  }
  if (!isValidWallet(mint))    return res.status(400).json({ error: "invalid mint address" });
  if (!isValidWallet(creator)) return res.status(400).json({ error: "invalid creator address" });

  const evType = Number(event_type);
  if (![1, 2, 3, 4].includes(evType)) {
    return res.status(400).json({ error: "event_type must be 1 (launch), 2 (unlock), 3 (complaint), or 4 (bonus)" });
  }

  // Validate creator against DB to prevent PDA manipulation
  const db = getClient();
  const { data: tokenRow, error: dbErr } = await db
    .from("tokens")
    .select("creator")
    .eq("mint", mint)
    .maybeSingle();

  if (dbErr) {
    console.error("[reputation/record] DB error:", dbErr.message);
    return res.status(500).json({ error: "database_error" });
  }
  if (!tokenRow) {
    return res.status(404).json({ error: "token not found" });
  }
  if (tokenRow.creator !== creator) {
    return res.status(403).json({ error: "creator mismatch" });
  }

  try {
    const { PublicKey } = getWeb3();
    const mintPk    = new PublicKey(mint);
    const creatorPk = new PublicKey(creator);
    const signature = await buildAndSendInstruction(mintPk, creatorPk, evType);
    console.log(`[reputation/record] event=${evType} mint=${mint.slice(0, 8)} sig=${signature.slice(0, 16)}`);
    return res.json({ ok: true, signature, event_type: evType });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[reputation/record] on-chain error:", msg);
    // Distinguish between config errors (503) and on-chain failures (422)
    if (msg.includes("not configured") || msg.includes("64 bytes")) {
      return res.status(503).json({ error: msg });
    }
    return res.status(422).json({ error: msg });
  }
};
