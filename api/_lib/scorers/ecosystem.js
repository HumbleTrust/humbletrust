const { getTrustLevel } = require('../trust');

function scoreEcosystem(knownToken, onchainData = {}) {
  let score = knownToken?.baseline_score ?? 65;
  const adjustments = [];
  const flags = [];

  // Bonus: mint authority revoked
  if (onchainData.mintAuthRevoked === true) {
    score = Math.min(score + 5, 90);
    adjustments.push({ reason: 'mint_auth_revoked', delta: +5 });
  }
  // Bonus: freeze authority revoked
  if (onchainData.freezeAuthRevoked === true) {
    score = Math.min(score + 3, 90);
    adjustments.push({ reason: 'freeze_auth_revoked', delta: +3 });
  }
  // Penalty: active mint authority (not penalized as hard as for meme tokens)
  if (onchainData.mintAuthRevoked === false) {
    score = Math.max(score - 5, 55);
    adjustments.push({ reason: 'mint_auth_active', delta: -5 });
    flags.push({ type: 'mint_authority_active', severity: 'medium', msg: 'Mint authority is active — additional tokens could be created' });
  }

  score = Math.min(99, Math.max(55, Math.round(score)));

  return {
    score,
    trust_level: getTrustLevel(score),
    categories: {
      supply_control: { earned: onchainData.mintAuthRevoked ? 38 : 30, max: 40 },
      liquidity:      { earned: 18, max: 25 },
      distribution:   { earned: 12, max: 20 },
      legitimacy:     { earned: 10, max: 15 },
    },
    signals: [
      { id: 'known_ecosystem', category: 'legitimacy', earned: 5, max: 5, ok: true, label: `Established ecosystem token: ${knownToken?.name}`, detail: 'Listed in HumbleTrust verified token registry' },
      ...(adjustments.map(a => ({ id: a.reason, category: 'supply_control', earned: a.delta > 0 ? a.delta : 0, max: 5, ok: a.delta > 0, label: a.reason.replace(/_/g, ' '), detail: '' }))),
    ],
    flags,
    source: 'registry+onchain',
  };
}

module.exports = { scoreEcosystem };
