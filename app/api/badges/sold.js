const { getClient } = require('../_lib/db');

// POST /api/badges/sold
// Called when NFT transfer detected (webhook from chain listener or manual)
// Body: { wallet, tx_signature }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Internal endpoint — verify secret header
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  const db = getClient();

  try {
    const now = new Date().toISOString();

    const { error } = await db
      .from('badges')
      .update({
        status: 'sold',
        sold_at: now,
      })
      .eq('wallet', wallet)
      .eq('status', 'active');

    if (error) throw error;

    return res.json({
      ok: true,
      sold_at: now,
      cooldown_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
