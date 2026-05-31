"use strict";

async function _fetch(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

async function fetchGoPlusToken(mint) {
  const json = await _fetch(
    `https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${mint}`
  );
  if (!json?.result) return null;
  const data = json.result[mint] || json.result[mint.toLowerCase()];
  if (!data) return null;

  return {
    is_honeypot:             data.is_honeypot === '1',
    transfer_pausable:       data.transfer_pausable === '1',
    can_take_back_ownership: data.can_take_back_ownership === '1',
    is_blacklisted:          data.is_blacklisted === '1',
    is_mintable:             data.is_mintable === '1',
    owner_percent:           parseFloat(data.owner_percent  || '0'),
    creator_percent:         parseFloat(data.creator_percent || '0'),
    is_open_source:          data.is_open_source === '1',
    source: 'goplus',
  };
}

module.exports = { fetchGoPlusToken };
