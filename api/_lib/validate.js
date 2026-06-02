// Shared validation helpers for API routes

// Fallback regex when @solana/web3.js is unavailable
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Lazy-loaded web3 to avoid module-load failure if package is missing
let _web3;
const _getWeb3 = () => {
  if (!_web3) _web3 = require("@solana/web3.js");
  return _web3;
};

const isValidWallet = (w) => {
  if (typeof w !== 'string' || w.length < 32 || w.length > 44) return false;
  try {
    const { PublicKey } = _getWeb3();
    new PublicKey(w);
    return true;
  } catch {
    // web3.js unavailable or invalid key — fall back to regex
    return SOLANA_ADDR_RE.test(w);
  }
};

const IS_DEV = process.env.NODE_ENV !== 'production';

const ALLOWED_ORIGINS = [
  'https://humbletrust.vercel.app',
  ...(IS_DEV ? ['http://localhost:5173', 'http://localhost:3000'] : []),
];

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any Vercel preview deploy for this project
  if (/^https:\/\/humbletrust(-[a-z0-9]+)*\.vercel\.app$/.test(origin)) return true;
  return false;
};

const setCors = (req, res) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
};

module.exports = { isValidWallet, setCors, ALLOWED_ORIGINS };
