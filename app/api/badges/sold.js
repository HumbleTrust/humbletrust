const { getClient } = require('../_lib/db');
const { isValidWallet, setCors } = require('../_lib/validate');
const crypto = require('crypto');

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      // Still run comparison to prevent length-based timing leaks
      crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// POST /api/badges/sold — internal webhook when NFT transfer detected
module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-internal-secret'];
  if (!timingSafeEqual(secret, process.env.INTERNAL_SECRET)) {
    console.warn('[api/badges/sold] unauthorized attempt ip=%s', req.headers['x-forwarded-for'] ?? 'unknown');
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();

  try {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await db
      .from('badges')
      .update({
        status: 'sold',
        sold_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString(),
      })
      .eq('wallet', wallet)
      .eq('status', 'active');

    if (error) throw error;

    console.info('[api/badges/sold] badge marked sold wallet=%s', wallet.slice(0, 8) + '…');
    return res.json({ ok: true, sold_at: now.toISOString(), cooldown_until: cooldownUntil.toISOString() });
  } catch (e) {
    console.error('[api/badges/sold]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
