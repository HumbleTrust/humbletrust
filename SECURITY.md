# Security Policy

HumbleTrust is a Trust & Safety layer + protected launchpad for Solana and is currently running on **devnet only**. This document covers responsible disclosure, current security status, and known limitations.

## Reporting A Vulnerability

If you find a security issue:

- Email: humble.trust@outlook.com
- GitHub Security Advisories: https://github.com/HumbleTrust/humbletrust/security/advisories/new
- Preferred languages: English, Russian

Please do not open a public issue for security problems. Send details privately first. We aim to acknowledge within 48 hours and to either ship a patch or publicly document the issue within 14 days.

## Scope

In scope:

- v1 legacy devnet program: `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi`
- v2 active devnet program: `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr`
- Frontend application: https://humbletrust.vercel.app
- Repository code under `programs/`, `app/`, `migrations/`, and `tests/`

Out of scope:

- Third-party dependency vulnerabilities.
- Devnet RPC outages or Solana devnet instability.
- Social engineering against project members.
- Physical access to contributor machines.
- Loss of devnet assets, because devnet assets have no real value.

## Current Network

`devnet only`.

Mainnet deployment is blocked until the v2 test suite, audit, multisig authority migration, production indexing, and DEX migration path are complete.

## Known Limitations

| Area | Current state | Mainnet requirement |
| --- | --- | --- |
| Raydium CPMM migration | Threshold/state/reward hook exists, but real Raydium CPMM CPI pool creation is not complete | Implement and audit real pool creation from PDA reserves, LP custody, leftover burn, and fallback behavior |
| Discover indexing | Current frontend can show locally launched tokens from browser storage | Replace with chain-indexed program accounts/events |
| Chart data | Trade chart is a curve/reserve preview, not a full market data indexer | Add real events, candles, transaction feed, holders, and top traders |
| Launch certificate NFT | Token-2022 NonTransferable certificate mint + certificate PDA is live on devnet | Add tests, richer metadata, and audit review |
| Creator reputation | Program groundwork exists but profile/history UX is incomplete | Finish score rules, profile UI, and abuse checks |
| Devnet alpha | No formal third-party audit yet | Complete audit before mainnet |
| Upgrade authority | Devnet wallet controlled during development | Transfer to Squads multisig before mainnet |

## Security Controls In Place

| Control | How |
| --- | --- |
| PDA-based custody | Token and SOL vaults are program-derived accounts, not creator-owned wallets |
| v2 five-vault model | Locked, creator, curve liquidity, circulation, and airdrop supply are separated |
| Curve treasury PDA | Initial SOL goes to `curve_treasury_sol`, not to creator and not directly to Raydium |
| LP destination | v2 migration state routes LP to `lp_lock_vault`; creator should never receive LP |
| Supply validation | Backend and frontend validate supply sum, allocation ranges, and `Q + R >= 50` |
| Creator allocation cap | Creator allocation is capped at 5% |
| Airdrop allocation cap | Airdrop allocation is capped at 5% |
| Burn option | Burn applies only to Locked Vault and does not break curve/circulation liquidity |
| TrustScore transparency | v2 TrustScore is calculated from visible allocation inputs and burn choice |
| Anti-bot delay | Curve trading can be delayed for 0-600 seconds after launch |
| Overflow-aware math | Curve math uses u128 intermediates for sensitive calculations |
| Metadata creation | New v2 launches create Metaplex Token Metadata during launch |
| Mint authority | v2 launch revokes mint authority after minting the fixed supply |
| Launch certificate | v2 creators can mint a Token-2022 NonTransferable certificate linked to the launch PDA |

## v2 TrustScore Formula

The v2 initial score is normalized from raw points out of 110:

```text
S_L = lock score
S_C = max(0, 20 - 4C)
S_Q = clamp(1.5 * (Q - 20), 0, 25)
S_R = clamp(1.2 * (R - 10), 0, 20)
S_A = max(0, 15 - 3A)
S_B = burn bonus

TS_raw = S_L + S_C + S_Q + S_R + S_A + S_B
TrustScore = min(100, round(TS_raw / 110 * 100))
```

Levels:

- `0-39`: WEAK
- `40-69`: OK
- `70-84`: STRONG
- `85-100`: ELITE

## Audit Status

No formal third-party audit has been completed yet. Mainnet launch requires review by a qualified Solana security auditor and a signed release checklist.

## How To Verify Programs

```bash
# v1 legacy
solana program dump Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi /tmp/humbletrust-v1.so --url devnet
anchor idl fetch Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi --provider.cluster devnet

# v2 active
solana program dump FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr /tmp/humbletrust-v2.so --url devnet
anchor idl fetch FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --provider.cluster devnet
```

## Disclaimer

This is alpha software on a test network. Do not use real assets. Production launch will be announced only after tests, audit, multisig migration, indexing, and the DEX migration path are complete.
