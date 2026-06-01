import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  publicKey as umiPublicKey,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { RPC_DEVNET, FEE_WALLET } from "./constants";

const BADGE_PRICE_LAMPORTS = 200_000_000; // 0.2 SOL

export type MintBadgeResult = {
  badge_mint: string;
  tx_signature: string;
  zodiac: string;
  element: string;
  aura_color: string;
  edition: number;
};

// walletAdapter must be the connected wallet from @solana/wallet-adapter-react
// (the object that has publicKey, signTransaction, signAllTransactions)
export async function mintBadgeNft(
  walletAdapter: Parameters<typeof walletAdapterIdentity>[0]
): Promise<MintBadgeResult> {
  const wallet = walletAdapter.publicKey?.toBase58();
  if (!wallet) throw new Error("Wallet not connected");

  // 1. Reserve edition + get metadata URI from backend
  const prepRes = await fetch("/api/badges/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const prep = await prepRes.json();
  if (!prepRes.ok) {
    const msg: Record<string, string> = {
      not_premium_creator: "Only Premium token creators can mint a badge",
      already_owns: "You already own a badge",
      cooldown: `Cooldown active — ${prep.days_left} days remaining`,
    };
    throw new Error(msg[prep.error] ?? prep.error ?? "Prepare failed");
  }

  const { zodiac, element, aura_color, edition, metadata_uri } = prep as {
    zodiac: string;
    element: string;
    aura_color: string;
    edition: number;
    metadata_uri: string;
  };

  // 2. Build Umi with the user's wallet as signer
  const umi = createUmi(RPC_DEVNET).use(mplTokenMetadata());
  umi.use(walletAdapterIdentity(walletAdapter));

  // 3. Create the NFT + SOL payment in one transaction — user signs once
  const mintSigner = generateSigner(umi);
  const editionStr = String(edition).padStart(3, "0");

  // Encode SystemProgram.transfer (instruction index 2, little-endian u64 lamports)
  const transferData = new Uint8Array(12);
  const dv = new DataView(transferData.buffer);
  dv.setUint32(0, 2, true);
  dv.setBigUint64(4, BigInt(BADGE_PRICE_LAMPORTS), true);

  const { signature } = await transactionBuilder()
    .add({
      instruction: {
        programId: umiPublicKey("11111111111111111111111111111111"),
        keys: [
          { pubkey: umi.identity.publicKey, isSigner: true, isWritable: true },
          { pubkey: umiPublicKey(FEE_WALLET), isSigner: false, isWritable: true },
        ],
        data: transferData,
      },
      signers: [umi.identity],
      bytesCreatedOnChain: 0,
    })
    .add(createNft(umi, {
      mint: mintSigner,
      name: `HumbleTrust ${zodiac} Badge #${editionStr}`,
      symbol: "HTBADGE",
      uri: metadata_uri,
      sellerFeeBasisPoints: percentAmount(0),
      isMutable: false,
    }))
    .sendAndConfirm(umi);

  const badge_mint = mintSigner.publicKey.toString();
  // UMI returns raw bytes — convert to base58 (standard Solana tx signature format)
  const tx_signature = bs58.encode(Buffer.from(signature));

  // 4. Confirm with backend — store badge_mint + tx_signature
  const confirmRes = await fetch("/api/badges/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      badge_mint,
      tx_signature,
      zodiac,
      element,
      aura_color,
      edition,
    }),
  });
  const confirmed = await confirmRes.json();
  if (!confirmRes.ok) throw new Error(confirmed.error ?? "Confirm failed");

  return { badge_mint, tx_signature, zodiac, element, aura_color, edition };
}
