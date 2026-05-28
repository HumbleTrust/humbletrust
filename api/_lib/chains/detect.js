// Detect blockchain from address format
const BS58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE  = /^0x[0-9a-fA-F]{40}$/;
const TON_RE  = /^(EQ|UQ)[0-9A-Za-z_-]{46}$/;
const BTC_RE  = /^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$|^bc1[0-9a-z]{6,87}$/;

const ALIASES = {
  btc: 'bitcoin', bitcoin: 'bitcoin',
  eth: 'ethereum', ether: 'ethereum',
  bnb: 'bsc', bsc: 'bsc',
  ton: 'ton', toncoin: 'ton',
  sol: 'solana', solana: 'solana',
  matic: 'polygon', polygon: 'polygon',
  arb: 'arbitrum', arbitrum: 'arbitrum',
  base: 'base',
};

function detectChain(address) {
  if (!address || typeof address !== 'string') return { chain: 'unknown', confidence: 0, address_normalized: address };
  const norm = address.trim();
  const lower = norm.toLowerCase();
  if (ALIASES[lower]) return { chain: ALIASES[lower], confidence: 1.0, address_normalized: lower };
  if (EVM_RE.test(norm))  return { chain: 'ethereum', confidence: 0.9, address_normalized: norm.toLowerCase() };
  if (TON_RE.test(norm))  return { chain: 'ton',      confidence: 0.95, address_normalized: norm };
  if (BTC_RE.test(norm))  return { chain: 'bitcoin',  confidence: 0.95, address_normalized: norm };
  if (BS58_RE.test(norm)) return { chain: 'solana',   confidence: 0.85, address_normalized: norm };
  return { chain: 'unknown', confidence: 0, address_normalized: norm };
}

module.exports = { detectChain };
