"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useState, type ReactNode } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

type ProviderChildren = {
  children: ReactNode;
};

const SolanaConnectionProvider = ConnectionProvider as unknown as (
  props: ProviderChildren & { endpoint: string },
) => JSX.Element;

const SolanaWalletProvider = WalletProvider as unknown as (
  props: ProviderChildren & { wallets: ReadonlyArray<unknown>; autoConnect?: boolean },
) => JSX.Element;

const SolanaWalletModalProvider = WalletModalProvider as unknown as (
  props: ProviderChildren,
) => JSX.Element;

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC ??
    clusterApiUrl(
      process.env.NEXT_PUBLIC_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet",
    );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <SolanaWalletModalProvider>{children}</SolanaWalletModalProvider>
        </SolanaWalletProvider>
      </SolanaConnectionProvider>
    </QueryClientProvider>
  );
}
