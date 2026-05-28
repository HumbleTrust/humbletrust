const { getTrustLevel } = require('../trust');
const knownTokens = require('../knownTokens.json');

function scoreBitcoin(chain, mint) {
  const registry = knownTokens[chain] || {};
  const isNative = ['native', 'btc', 'bitcoin', 'ton', 'toncoin'].includes((mint || '').toLowerCase());
  const entry = isNative ? registry['native'] : null;

  if (entry) {
    return {
      score: entry.baseline_score,
      trust_level: getTrustLevel(entry.baseline_score),
      categories: null,
      signals: [{ id: 'native_l1', category: 'legitimacy', earned: 5, max: 5, ok: true, label: `${entry.name} — Layer 1 native asset`, detail: 'Native L1 coin with maximum chain security' }],
      flags: [],
      source: 'registry',
    };
  }

  // BRC-20, ordinals, etc.
  return {
    score: 40,
    trust_level: getTrustLevel(40),
    categories: null,
    signals: [{ id: 'unknown_btc_asset', category: 'legitimacy', earned: 0, max: 5, ok: null, label: 'Unknown Bitcoin asset (BRC-20/Ordinals)', detail: 'Could not verify this Bitcoin asset in registry' }],
    flags: [{ type: 'unverified_btc_asset', severity: 'medium', msg: 'Bitcoin address not in verified registry — may be BRC-20, ordinal, or unknown asset' }],
    source: 'registry',
  };
}

module.exports = { scoreBitcoin };
