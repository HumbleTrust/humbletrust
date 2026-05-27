import { useState } from "react";
import { X, Radio } from "lucide-react";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative flex items-center justify-center gap-2 px-4 py-2 bg-[#00FF41]/8 border-b border-[#00FF41]/20">
      <Radio size={11} className="text-[#00FF41] shrink-0 animate-pulse" />
      <p className="text-[11px] text-[#00FF41]/70 font-mono text-center leading-tight">
        <span className="font-bold text-[#00FF41]">DEVNET ACTIVE</span>
        {" · "}TrustScore &amp; Launches run on Solana Devnet &nbsp;·&nbsp; Mainnet preparation underway
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 text-white/20 hover:text-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}
