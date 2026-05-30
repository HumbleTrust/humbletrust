// Detect blockchain from address format
const BS58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE  = /^0x[0-9a-fA-F]{40}$/;
const TON_RE  = /^(EQ|UQ)[0-9A-Za-z_-]{46}$/;
const BTC_RE  = /^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$|^bc1[0-9a-z]{6,87}$/;

// Chain name aliases — all lowercase inputs
const ALIASES = {
  // Bitcoin
  btc: 'bitcoin', bitcoin: 'bitcoin',
  // Ethereum L1
  eth: 'ethereum', ether: 'ethereum', ethereum: 'ethereum',
  // BSC / BNB Chain
  bnb: 'bsc', bsc: 'bsc', 'binance smart chain': 'bsc',
  // TON
  ton: 'ton', toncoin: 'ton',
  // Solana
  sol: 'solana', solana: 'solana',
  // Polygon / POL
  matic: 'polygon', polygon: 'polygon', pol: 'polygon',
  // Arbitrum
  arb: 'arbitrum', arbitrum: 'arbitrum', 'arbitrum one': 'arbitrum',
  // Optimism
  op: 'optimism', optimism: 'optimism',
  // Base
  base: 'base',
  // Avalanche
  avax: 'avalanche', avalanche: 'avalanche', 'avalanche c-chain': 'avalanche',
  // Fantom
  ftm: 'fantom', fantom: 'fantom',
  // Near
  near: 'near',
  // Sui
  sui: 'sui',
  // Aptos
  apt: 'aptos', aptos: 'aptos',
  // Algorand
  algo: 'algorand', algorand: 'algorand',
  // Cosmos / IBC
  atom: 'cosmos', cosmos: 'cosmos',
  // Cardano
  ada: 'cardano', cardano: 'cardano',
  // Polkadot
  dot: 'polkadot', polkadot: 'polkadot',
  // XRP
  xrp: 'xrp', ripple: 'xrp',
  // Tron
  trx: 'tron', tron: 'tron',
};

// EVM-compatible chains — same address format, different chain context
const EVM_CHAINS = new Set([
  'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche',
  'fantom', 'gnosis', 'cronos', 'zksync', 'linea', 'scroll',
]);

function detectChain(address) {
  if (!address || typeof address !== 'string') {
    return { chain: 'unknown', confidence: 0, address_normalized: address };
  }
  const norm  = address.trim();
  const lower = norm.toLowerCase();

  // Direct alias hit (e.g. "sol", "eth", "btc")
  if (ALIASES[lower]) {
    return { chain: ALIASES[lower], confidence: 1.0, address_normalized: lower };
  }

  // EVM address (all EVM-compatible chains share the 0x format)
  if (EVM_RE.test(norm)) {
    return { chain: 'ethereum', confidence: 0.9, address_normalized: norm.toLowerCase() };
  }

  // TON Jetton / wallet (EQ... / UQ...)
  if (TON_RE.test(norm)) {
    return { chain: 'ton', confidence: 0.95, address_normalized: norm };
  }

  // Bitcoin (P2PKH, P2SH, bech32 v0/v1)
  if (BTC_RE.test(norm)) {
    return { chain: 'bitcoin', confidence: 0.95, address_normalized: norm };
  }

  // Solana / base58 SPL mint
  if (BS58_RE.test(norm)) {
    return { chain: 'solana', confidence: 0.85, address_normalized: norm };
  }

  return { chain: 'unknown', confidence: 0, address_normalized: norm };
}

// Returns true if chain is EVM-compatible
function isEvmChain(chain) {
  return EVM_CHAINS.has(chain);
}

module.exports = { detectChain, isEvmChain };
