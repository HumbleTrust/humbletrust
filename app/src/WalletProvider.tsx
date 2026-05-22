import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const AnyConnectionProvider = ConnectionProvider as any;
const AnySolanaWalletProvider = SolanaWalletProvider as any;
const AnyWalletModalProvider = WalletModalProvider as any;

export const AppWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <AnyConnectionProvider endpoint={endpoint}>
      <AnySolanaWalletProvider wallets={wallets} autoConnect>
        <AnyWalletModalProvider>{children}</AnyWalletModalProvider>
      </AnySolanaWalletProvider>
    </AnyConnectionProvider>
  );
};
