import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

export const StatusBanner = () => (
  <div className="status-banner" role="status" aria-label="Network readiness status">
    <div className="status-banner-item status-devnet">
      <CheckCircle2 size={15} />
      <span><strong>DEVNET ACTIVE</strong> launches, curve trading, TrustScore, and certificates use Solana devnet only.</span>
    </div>
    <div className="status-banner-item status-mainnet">
      <ShieldCheck size={15} />
      <span><strong>MAINNET PREP</strong> audit, indexer/API, multisig, production RPC, and real DEX migration are required before launch.</span>
    </div>
    <div className="status-banner-item status-warning">
      <AlertTriangle size={15} />
      <span>No real-value mainnet assets. Devnet SOL and test tokens only.</span>
    </div>
  </div>
);
