import { useState } from "react";
import { cn } from "../components/ui/utils";

export interface Chain { name: string; category: string; logo?: string; }

const TW = (k: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${k}/info/logo.png`;
const LL = (k: string) =>
  `https://icons.llamao.fi/icons/chains/rsz_${k}.jpg`;

export const CHAINS: Chain[] = [
  { name: "Solana",        category: "solana-ecosystem",       logo: TW("solana") },
  { name: "Base",          category: "base-ecosystem",         logo: TW("base") },
  { name: "Ethereum",      category: "ethereum-ecosystem",     logo: TW("ethereum") },
  { name: "BSC",           category: "binance-smart-chain",    logo: TW("smartchain") },
  { name: "Polygon",       category: "polygon-ecosystem",      logo: TW("polygon") },
  { name: "TON",           category: "ton-ecosystem",          logo: LL("ton") },
  { name: "Avalanche",     category: "avalanche-ecosystem",    logo: TW("avalanchec") },
  { name: "Arbitrum",      category: "arbitrum-ecosystem",     logo: TW("arbitrum") },
  { name: "Optimism",      category: "optimism-ecosystem",     logo: TW("optimism") },
  { name: "Near",          category: "near-protocol-ecosystem",logo: TW("near") },
  { name: "Sui",           category: "sui-ecosystem",          logo: LL("sui") },
  { name: "Aptos",         category: "aptos-ecosystem",        logo: LL("aptos") },
  { name: "Tron",          category: "tron-ecosystem",         logo: TW("tron") },
  { name: "Fantom",        category: "fantom-ecosystem",       logo: TW("fantom") },
  { name: "zkSync",        category: "zksync-ecosystem",       logo: LL("zksync era") },
  { name: "Starknet",      category: "starknet-ecosystem",     logo: LL("starknet") },
  { name: "Injective",     category: "injective-ecosystem",    logo: LL("injective") },
  { name: "ICP",           category: "internet-computer",      logo: LL("icp") },
  { name: "Cardano",       category: "cardano-ecosystem",      logo: TW("cardano") },
  { name: "Polkadot",      category: "polkadot-ecosystem",     logo: TW("polkadot") },
  { name: "XRPL",          category: "xrp-ledger",             logo: TW("xrp") },
  { name: "Hedera",        category: "hedera-ecosystem",       logo: TW("hedera") },
  { name: "Algorand",      category: "algorand-ecosystem",     logo: TW("algorand") },
  { name: "Blast",         category: "blast-l2-ecosystem",     logo: LL("blast") },
  { name: "Mantle",        category: "mantle-ecosystem",       logo: LL("mantle") },
  { name: "Linea",         category: "linea-ecosystem",        logo: LL("linea") },
  { name: "Scroll",        category: "scroll-ecosystem",       logo: LL("scroll") },
  { name: "Berachain",     category: "berachain-ecosystem",    logo: LL("berachain") },
  { name: "Sei V2",        category: "sei-ecosystem",          logo: LL("sei") },
  { name: "Osmosis",       category: "osmosis-ecosystem",      logo: TW("osmosis") },
  { name: "Celo",          category: "celo-ecosystem",         logo: TW("celo") },
  { name: "Harmony",       category: "harmony-ecosystem",      logo: TW("harmony") },
  { name: "Moonbeam",      category: "moonbeam-ecosystem",     logo: TW("moonbeam") },
  { name: "Moonriver",     category: "moonriver-ecosystem",    logo: TW("moonriver") },
  { name: "Kava",          category: "kava",                   logo: TW("kava") },
  { name: "Flow EVM",      category: "flow-ecosystem",         logo: TW("flow") },
  { name: "Manta",         category: "manta-network",          logo: LL("manta") },
  { name: "Taiko",         category: "taiko",                  logo: LL("taiko") },
  { name: "Mode",          category: "mode-network",           logo: LL("mode") },
  { name: "Movement",      category: "movement-ecosystem",     logo: LL("movement") },
  { name: "Zora",          category: "zora-ecosystem",         logo: LL("zora") },
  { name: "Metis",         category: "metis-ecosystem",        logo: TW("metis") },
  { name: "Cronos",        category: "cronos-ecosystem",       logo: TW("cronos") },
  { name: "Conflux",       category: "conflux-ecosystem",      logo: LL("conflux") },
  { name: "Stacks",        category: "stacks-ecosystem",       logo: LL("stacks") },
  { name: "Telos",         category: "telos-ecosystem",        logo: LL("telos") },
  { name: "MultiversX",    category: "multiversx-ecosystem",   logo: LL("multiversx") },
  { name: "opBNB",         category: "opbnb-ecosystem",        logo: LL("op bnb") },
  { name: "Flare",         category: "flare-ecosystem",        logo: LL("flare") },
  { name: "Sonic",         category: "sonic-ecosystem",        logo: LL("sonic") },
  { name: "Hyperliquid",   category: "hyperliquid-ecosystem",  logo: LL("hyperliquid") },
  { name: "Beam",          category: "beam",                   logo: LL("beam") },
  { name: "PulseChain",    category: "",                       logo: LL("pulse") },
  { name: "HyperEVM",      category: "" },
  { name: "Monad",         category: "",                       logo: LL("monad") },
  { name: "World Chain",   category: "",                       logo: LL("worldchain") },
  { name: "Abstract",      category: "",                       logo: LL("abstract") },
  { name: "MegaETH",       category: "",                       logo: LL("megaeth") },
  { name: "Ink",           category: "",                       logo: LL("ink") },
  { name: "Plasma",        category: "" },
  { name: "Soneium",       category: "",                       logo: LL("soneium") },
  { name: "ApeChain",      category: "",                       logo: LL("apechain") },
  { name: "Dogechain",     category: "",                       logo: LL("dogechain") },
  { name: "Unichain",      category: "",                       logo: LL("unichain") },
  { name: "Story",         category: "",                       logo: LL("story") },
  { name: "Katana",        category: "" },
  { name: "EthereumPoW",   category: "",                       logo: LL("ethereumpow") },
  { name: "Merlin Chain",  category: "",                       logo: LL("merlin") },
  { name: "Vana",          category: "",                       logo: LL("vana") },
  { name: "Fogo",          category: "" },
  { name: "Venom",         category: "" },
  { name: "Elastos",       category: "",                       logo: LL("elastos") },
  { name: "Neon EVM",      category: "",                       logo: LL("neon evm") },
  { name: "Oasis Sapphire",category: "",                       logo: LL("oasis sapphire") },
  { name: "Fuse",          category: "",                       logo: LL("fuse") },
  { name: "Zircuit",       category: "",                       logo: LL("zircuit") },
  { name: "Oasis Emerald", category: "",                       logo: LL("oasis emerald") },
  { name: "ZKFair",        category: "",                       logo: LL("zkfair") },
  { name: "Step Network",  category: "",                       logo: LL("step") },
];

const LETTER_COLORS = [
  "#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7",
  "#DDA0DD","#98D8C8","#F7B731","#A29BFE","#FD79A8",
];

export const ChainIcon = ({ chain, size = 14 }: { chain: Chain; size?: number }) => {
  const [err, setErr] = useState(false);
  if (!chain.logo || err) {
    const bg = LETTER_COLORS[chain.name.charCodeAt(0) % LETTER_COLORS.length];
    return (
      <span
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.55, flexShrink: 0 }}
        className="rounded-full flex items-center justify-center font-bold text-black"
      >
        {chain.name[0]}
      </span>
    );
  }
  return (
    <img
      src={chain.logo}
      alt={chain.name}
      style={{ width: size, height: size, flexShrink: 0 }}
      className="rounded-full object-cover"
      onError={() => setErr(true)}
    />
  );
};

export const TrustScoreBadge = ({ mint }: { mint: string }) => {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);

  const load = async () => {
    if (tried || loading) return;
    setLoading(true); setTried(true);
    try {
      const r = await fetch(`/api/score/${mint}`);
      if (r.ok) {
        const d = await r.json();
        setScore(d.trust_score ?? d.score ?? null);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  if (!tried && !loading) load();

  if (loading) return (
    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-white/30 border border-white/10 animate-pulse">
      TS…
    </span>
  );
  if (score === null) return null;

  const color = score >= 70 ? "#00FF41" : score >= 40 ? "#F7B731" : "#FF6B6B";
  const bg    = score >= 70 ? "rgba(0,255,65,0.1)" : score >= 40 ? "rgba(247,183,49,0.1)" : "rgba(255,107,107,0.1)";
  const border= score >= 70 ? "rgba(0,255,65,0.3)" : score >= 40 ? "rgba(247,183,49,0.3)" : "rgba(255,107,107,0.3)";

  return (
    <span
      className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border")}
      style={{ color, backgroundColor: bg, borderColor: border }}
      title="HumbleTrust Score"
    >
      TS {score}
    </span>
  );
};
