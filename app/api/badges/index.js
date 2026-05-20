const { getClient } = require('../_lib/db');

// GET /api/badges?wallet=<address>  — get badge for wallet
// GET /api/badges                   — list recent badges
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const db = getClient();
  const { wallet } = req.query;

  try {
    if (wallet) {
      const { data, error } = await db
        .from('badges')
        .select('wallet,zodiac,element,aura_color,edition,status,minted_at,cooldown_until')
        .eq('wallet', wallet)
        .maybeSingle();
      if (error) throw error;
      return res.json({ badge: data });
    }

    // List all active badges (leaderboard / directory)
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { data, error } = await db
      .from('badges')
      .select('wallet,zodiac,element,aura_color,edition,status,minted_at')
      .eq('status', 'active')
      .order('edition', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return res.json({ badges: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
