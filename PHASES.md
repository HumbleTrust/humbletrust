# HumbleTrust - Project Phases

HumbleTrust is a Trust & Safety layer + protected launchpad for Solana. The launchpad is the first enforced use case; the wider layer is built from on-chain launch records, PDA custody, TrustScore, creator accountability, indexed events, wallet reputation, and future DEX migration.

**Frontend:** https://humbletrust.vercel.app
**v1 legacy program:** `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi`
**v2 active devnet program:** `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr`
**Last synced:** May 19, 2026

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| v1 legacy program | Complete | Kept for earlier devnet tokens and compatibility |
| v2 token creation | Complete on devnet | Fixed 1B supply, five vaults, initial SOL, metadata, burn, TrustScore |
| v2 bonding curve | Complete on devnet | Buy/sell, anti-bot delay, 1% fee, constant product math |
| v2 frontend launch | Complete on production Vercel | Launch form uses v2 fields and shows TrustScore breakdown |
| v2 frontend trade | Complete on production Vercel | Buy/sell, wallet token picker, MAX button, chart preview |
| Raydium CPMM migration | In progress | Threshold/state/reward hook exists; real CPMM CPI pool creation still pending |
| Creator reputation | In progress | PDA groundwork exists; profile/history integration pending |
| Launch certificate NFT | Complete on devnet | Token-2022 NonTransferable certificate mint + certificate PDA |
| Discover indexing | In progress | Current frontend uses browser cache; chain indexing is next |
| Mainnet readiness | Planned | Requires tests, audit, multisig, RPC/monitoring plan |

## Phase 1 - Environment

**Status:** Complete

- WSL Ubuntu development environment.
- Rust/Solana/Anchor toolchain.
- Node/Vite frontend environment.
- GitHub and Vercel deployment flow.

## Phase 2 - v1 Core Contract

**Status:** Complete / legacy

- Original Anchor program deployed on devnet.
- Locking, creator vault, circulation vault, rewards vault.
- TrustScore and token safety mechanics.
- Kept as a stable legacy program for older test tokens.

## Phase 3 - Frontend Foundation

**Status:** Complete

- React + Vite + TypeScript frontend.
- Phantom/Solflare wallet adapter.
- Launch, Discover, Trade, About navigation.
- Solscan devnet links.
- Production deploy on Vercel.

## Phase 4 - v2 Trust & Safety Launch System

**Status:** Mostly complete on devnet

Implemented:

- New v2 program ID.
- `create_token_with_lock_v2`.
- Fixed supply: 1B tokens, 9 decimals.
- PDA supply architecture:
  - `locked_vault`
  - `creator_vault`
  - `curve_pool_vault`
  - `curve_treasury_sol`
  - `circulation_vault`
  - `airdrop_vault`
  - `lp_lock_vault`
- Initial SOL goes to the bonding-curve treasury PDA.
- Curve Liquidity % goes to the curve token pool PDA.
- Creator allocation limited to 0-5%.
- Airdrop allocation limited to 0-5%.
- Curve liquidity limited to 25-50%.
- Circulation limited to 15-40%.
- `Q + R >= 50` enforced.
- Supply sum equals 100%.
- Burn option on Locked Vault: 25% or 50%.
- v2 TrustScore formula normalized to 0-100.
- Metaplex metadata creation for new mints.
- Mint authority revoked after launch.

Remaining:

- More end-to-end Anchor tests around every validation branch.
- Better transaction/event indexing for frontend state.

## Phase 4b - Bonding Curve Trading

**Status:** Complete on devnet

Implemented:

- `buy_v2`.
- `sell_v2`.
- Constant product curve math.
- u128 intermediate calculations.
- 1% total fee:
  - 0.5% platform
  - 0.5% creator
- Anti-bot delay.
- `is_migrated` guard blocks curve trading after migration state.
- Frontend Mini Swap supports buy and sell.
- Wallet token picker and MAX sell balance are live.

Remaining:

- Event-backed candles and real trade history.
- Better slippage UX.
- More devnet edge-case testing for very small and very large amounts.

## Phase 4c - Raydium CPMM Migration

**Status:** In progress

Implemented:

- Migration threshold constant: 50 SOL.
- `migrate_to_raydium_v2` threshold check.
- Migration trigger wallet tracking.
- 0.1 SOL reward hook for the trigger wallet.
- `is_migrated` state flag.
- LP lock destination field.

Not implemented yet:

- Real Raydium CPMM CPI pool creation.
- Real LP token mint/receipt into `lp_lock_vault`.
- Burn of leftover curve tokens after actual DEX pool creation.
- Jupiter/DexScreener indexing verification.

Next decision:

- Continue Raydium CPMM CPI route. Raydium CPMM has an Anchor-compatible IDL; AMM v4/OpenBook should be avoided unless CPMM devnet support blocks the integration.

## Phase 4.5 - Creator Reputation

**Status:** In progress

Planned/partial:

- Creator reputation PDA per wallet.
- Track launches, complaints, score history, successful unlocks.
- Creator profile page.
- Clean-launch bonus for future launches.

Next:

- Connect profile UI to real program accounts.
- Decide exact score effects before mainnet.

## Phase 4.6 - Launch Certificate NFT

**Status:** Complete on devnet

Implemented:

- Token-2022 NonTransferable certificate mint.
- Minted to creator after successful v2 launch.
- Certificate PDA seeded by token mint.
- Certificate record stores creator, token mint, certificate mint, lock %, lock days, initial TrustScore, tier, airdrop %, burn option, timestamp, and serial number.
- `global_state_v2` initialized on devnet for certificate serial numbers.

Remaining:

- Rich artwork/collection metadata.
- Better display in Discover/creator profiles.
- Tests for duplicate certificate prevention and PDA data integrity.

## Phase 5 - Mainnet Readiness

**Status:** Planned

Required before mainnet:

- Full v2 test suite.
- Program audit.
- Squads multisig for upgrade authority.
- API/indexer for Discover and analytics.
- Production RPC provider and monitoring.
- Incident response process.
- Clear mainnet launch checklist.

## Phase 6 - Ecosystem

**Status:** Future

Ideas:

- Public TrustScore API.
- Creator dashboards.
- Holder analytics.
- Mobile PWA.
- Governance and reporting workflows.
- Partner integrations.

## Immediate Next Work

1. Replace localStorage Discover with chain-indexed program account discovery.
2. Replace chart preview with real event-backed candles and transaction history.
3. Implement and test real Raydium CPMM migration CPI or choose an alternative DEX path only if CPMM devnet support blocks the integration.
4. Finish creator reputation UI.
5. Add certificate NFT display in Discover/profile.
6. Add complete v2 Anchor tests.
