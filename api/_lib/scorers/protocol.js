const { getTrustLevel } = require('../trust');

function scoreProtocol(knownToken, onchainData = {}) {
  const base = knownToken?.baseline_score ?? 88;
  const score = Math.min(99, Math.max(80, base));
  return {
    score,
    trust_level: getTrustLevel(score),
    categories: {
      supply_control: { earned: 40, max: 40 },
      liquidity:      { earned: 25, max: 25 },
      distribution:   { earned: 15, max: 20 },
      legitimacy:     { earned: 10, max: 15 },
    },
    signals: [
      { id: 'known_protocol', category: 'legitimacy', earned: 5, max: 5, ok: true,  label: 'Verified protocol token', detail: `${knownToken?.name} is a known protocol-level token` },
      { id: 'supply_fixed',   category: 'supply_control', earned: 40, max: 40, ok: true, label: 'Supply control verified', detail: 'Protocol token with verified supply management' },
      { id: 'liquidity_deep', category: 'liquidity',  earned: 25, max: 25, ok: true, label: 'Deep protocol liquidity',  detail: 'Protocol token with established liquidity' },
    ],
    flags: [],
    source: 'registry',
  };
}

module.exports = { scoreProtocol };
