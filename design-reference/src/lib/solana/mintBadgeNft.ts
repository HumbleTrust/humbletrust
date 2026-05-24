import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  PublicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { RPC_DEVNET } from "./constants";

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

  // 3. Create the NFT — user signs in Phantom
  const mintSigner = generateSigner(umi);
  const editionStr = String(edition).padStart(3, "0");

  const { signature } = await createNft(umi, {
    mint: mintSigner,
    name: `HumbleTrust ${zodiac} Badge #${editionStr}`,
    symbol: "HTBADGE",
    uri: metadata_uri,
    sellerFeeBasisPoints: percentAmount(0),
    isMutable: false,
  }).sendAndConfirm(umi);

  const badge_mint = mintSigner.publicKey.toString();
  const tx_signature = Buffer.from(signature).toString("base64");

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
