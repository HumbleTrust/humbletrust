"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/utils";

export function WalletButton() {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  if (!connected || !address) {
    return (
      <Button
        variant="primary"
        size="md"
        loading={connecting}
        icon={<Wallet className="h-4 w-4" />}
        onClick={() => setVisible(true)}
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex h-11 items-center gap-3 rounded-pill border border-primary/30 bg-primary/10 px-3 text-sm text-text-primary transition hover:border-primary/60">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-bg-base">
            {address.slice(0, 2)}
          </span>
          <span className="hidden font-mono sm:inline">{shortAddress(address)}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        sideOffset={10}
        className="z-50 w-72 rounded-md border border-border-subtle bg-bg-elevated p-2 shadow-card-glow"
      >
        <div className="px-3 py-2">
          <p className="text-xs text-text-muted">Connected wallet</p>
          <p className="mt-1 break-all font-mono text-xs text-text-secondary">{address}</p>
          <p className="mt-2 text-xs text-primary">{wallet?.adapter.name ?? "Solana wallet"}</p>
        </div>
        <DropdownMenu.Separator className="my-2 h-px bg-border-subtle" />
        <DropdownItem
          icon={<Copy className="h-4 w-4" />}
          label="Copy address"
          onClick={() => navigator.clipboard.writeText(address)}
        />
        <DropdownItem
          icon={<ExternalLink className="h-4 w-4" />}
          label="View explorer"
          onClick={() =>
            window.open(`https://explorer.solana.com/address/${address}?cluster=devnet`, "_blank")
          }
        />
        <DropdownItem
          icon={<LogOut className="h-4 w-4" />}
          label="Disconnect"
          onClick={() => void disconnect()}
        />
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenu.Item
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-text-secondary outline-none transition hover:bg-white/[0.06] hover:text-text-primary"
    >
      {icon}
      {label}
    </DropdownMenu.Item>
  );
}
