const { getTrustLevel } = require('../trust');

function scoreEvm(chain, mint, knownToken) {
  if (knownToken) {
    const base = knownToken.baseline_score ?? 70;
    const score = Math.min(99, Math.max(50, base));
    return {
      score,
      trust_level: getTrustLevel(score),
      categories: null,
      signals: [
        { id: 'known_evm', category: 'legitimacy', earned: 5, max: 5, ok: true, label: `${knownToken.name} (${chain.toUpperCase()})`, detail: 'Verified in HumbleTrust multi-chain registry' },
      ],
      flags: [],
      source: 'registry',
      note: `${chain.toUpperCase()} token — on-chain analysis not yet available for EVM chains`,
    };
  }

  // Unknown EVM token — conservative score
  const score = 35;
  return {
    score,
    trust_level: getTrustLevel(score),
    categories: null,
    signals: [
      { id: 'unverified_evm', category: 'legitimacy', earned: 0, max: 5, ok: false, label: `Unverified ${chain.toUpperCase()} token`, detail: 'Token not found in HumbleTrust registry. Manual verification required.' },
    ],
    flags: [
      { type: 'unverified_contract', severity: 'high', msg: `EVM token not in verified registry — smart contract risk unknown` },
    ],
    source: 'registry',
    note: `${chain.toUpperCase()} on-chain analysis not yet supported. Score based on registry lookup only.`,
  };
}

module.exports = { scoreEvm };
