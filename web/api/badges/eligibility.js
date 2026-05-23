const { getClient } = require('../_lib/db');
const { isValidWallet, setCors } = require('../_lib/validate');

// GET /api/badges/eligibility?wallet=<address>
module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();

  try {
    // Run both queries in parallel — eliminates N+1
    const [{ data: badge }, { data: premiumToken }] = await Promise.all([
      db.from('badges').select('*').eq('wallet', wallet).maybeSingle(),
      db.from('tokens').select('mint').eq('creator', wallet).eq('tier', 'premium').limit(1).maybeSingle(),
    ]);

    const isPremium = !!premiumToken;

    // Never had a badge
    if (!badge) {
      if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge: null });
      return res.json({ can_mint: true, reason: null, badge: null });
    }

    // Currently holds badge
    if (badge.status === 'active') {
      return res.json({ can_mint: false, reason: 'already_owns', badge });
    }

    // Sold badge — check cooldown
    if (badge.status === 'sold' || badge.status === 'cooldown') {
      const now = new Date();
      const cooldownUntil = new Date(badge.cooldown_until);

      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil - now) / (1000 * 60 * 60 * 24));
        return res.json({
          can_mint: false,
          reason: 'cooldown',
          cooldown_until: badge.cooldown_until,
          days_left: daysLeft,
          badge,
        });
      }

      // Cooldown expired — re-use the parallel-fetched premium result
      if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge });
      return res.json({ can_mint: true, reason: 'cooldown_expired', badge });
    }

    // Any other status
    if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge });
    return res.json({ can_mint: true, reason: null, badge });

  } catch (e) {
    console.error('[api/badges/eligibility]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
