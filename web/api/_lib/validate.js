// Shared validation helpers for API routes

// Solana public key: base58, 32-44 chars
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isValidWallet = (w) => typeof w === 'string' && SOLANA_ADDR_RE.test(w);

const ALLOWED_ORIGINS = [
  'https://humbletrust.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const setCors = (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
};

module.exports = { isValidWallet, setCors, ALLOWED_ORIGINS };
