# Security Policy

HumbleTrust is in active development on Solana **devnet**. This document covers responsible disclosure, current security status, and known limitations.

## Reporting a vulnerability

If you find a security issue:

- **Email** — humble.trust@outlook.com
- **GitHub Security Advisories** — https://github.com/HumbleTrust/humbletrust/security/advisories/new
- **Preferred languages** — English, Russian

Please **do not** open a public issue for security problems. Send details privately first. We aim to acknowledge within 48 hours and to either ship a patch or publicly document the issue within 14 days.

## Scope

In scope:

- The on-chain Anchor program — Program ID `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi` (devnet)
- The frontend application at https://humbletrust.vercel.app
- Any code in this repository under `programs/`, `app/`, or `migrations/`

Out of scope:

- Third-party dependencies (report to their maintainers)
- Devnet RPC infrastructure
- Social engineering against project members
- Anything requiring physical access to a contributor's machine

## Current network

`devnet only`. Mainnet deployment is gated behind the items listed in "Known limitations" below.

## Known limitations (devnet alpha)

These are deliberate gaps documented before mainnet. None of them put real funds at risk because the program is not yet on mainnet. They are listed here for full transparency.

| # | Area | Current state | Mainnet plan |
|---|---|---|---|
| **L1** | `metrics_authority` | The frontend currently sets `metrics_authority` to the creator's wallet. A creator can therefore call `verify_creator`, `update_metrics`, and `execute_airdrop_epoch` on their own token. | Backend-controlled metrics_authority. The frontend will write `HUMBLETRUST_METRICS_AUTHORITY` (a multisig-controlled wallet) before mainnet. Constant already wired into `app/src/lib/constants.ts`. |
| **L2** | `add_to_circulation` vesting cap | Now respects the 30/60/90 schedule: at most 2% / 5% / 10% of `creator_allocation` may flow into `circulation_vault` over time. Previously this was unbounded. | Already patched. Will be retained on mainnet. |
| **L3** | `set_metrics_authority` rotation | Gated to `HUMBLETRUST_ADMIN`, not the creator. On devnet this constant is the same wallet as the upgrade authority (`7iMHH7F7SqAtuRo1sC72KKgWf2vZbfsRYHrpdmS3PSW8`). | Will point to a Squads multisig before mainnet via `set_upgrade_authority`. |
| **L4** | `record_trade` data quality | The instruction is gated to `metrics_authority` and no longer writes `verified_volume` directly. TrustScore boost from volume is only granted through `update_metrics` after off-chain verification. | Replace with on-chain Raydium pool state reader (Phase 4 follow-up). |
| **L5** | `is_frozen` enforcement | Honored in `record_trade`, `update_metrics`, `verify_creator`, `execute_airdrop_epoch`, `use_vesting_tranche`, and `add_to_circulation`. `submit_vote` intentionally stays open so the community can vote frozen tokens back to active. | No change planned. |
| **L6** | Mint authority | New instruction `revoke_mint_authority` lets the creator permanently lock token supply. Tokens that don't call it remain dilutable through a contract upgrade. | UI prompt after launch will encourage creators to revoke. Mainnet will additionally migrate `upgrade_authority` to a Squads multisig (`set_upgrade_authority`), so even un-revoked mints can't be silently inflated. |
| **L7** | Sybil voting | The voting threshold is `total_supply / 100_000`. On very large supplies this stays cheap. | Considering a per-wallet stake-time check before mainnet. |

The contract source already reflects L2 through L6. The frontend reflects L1.

## Audit status

No formal third-party audit yet. The contract is being prepared for review by CertiK / Halborn / OtterSec ahead of mainnet — see [PHASES.md](./PHASES.md) → Phase 5.

## Security controls in place

| Control | How |
|---|---|
| `security.txt` embedded in program | Visible on Solscan; this file is the policy it points to |
| PDAs with strict seed derivation | All vaults (`locked_vault`, `creator_vault`, `circulation_vault`, `rewards_vault`, `lp_lock_vault`) are program-derived; no signer can spend them outside instruction logic |
| Overflow-safe arithmetic | Cargo `release` profile sets `overflow-checks = true`; all amount math uses `checked_add` / `checked_sub` / `checked_mul` |
| Authority separation | Mint authority → token_metadata PDA. Upgrade authority → wallet (will become Squads multisig). Metrics authority → backend (will become multisig). |
| Anti-rug structural design | Liquidity goes into `lp_lock_vault` PDA via `lock_lp_tokens`; creator cannot withdraw before `unlock_time` |
| Reproducible builds | Anchor 0.32.1, Rust toolchain pinned in `rust-toolchain.toml`, `Cargo.lock` committed |

## How to verify the program yourself

```bash
# fetch the deployed program
solana program dump Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi /tmp/h.so --url devnet

# read embedded security.txt
strings /tmp/h.so | grep -i "humble.trust@outlook.com"
strings /tmp/h.so | grep -i "security.txt"

# inspect IDL
anchor idl fetch Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi --provider.cluster devnet
```

## Disclaimer

This is alpha software running on a test network. **Do not deposit real assets.** SOL spent on devnet has no value. Production launch will be announced separately when audits, multisig migration, and the items in "Known limitations" are complete.
