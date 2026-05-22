# HUMBLE.TRUST v2 Final Summary

Date: 2026-05-18
Repository: https://github.com/HumbleTrust/humbletrust
Merged PR: https://github.com/HumbleTrust/humbletrust/pull/1
Merge commit: b5083bbe4e33c02d191a9ec12423171be37c67d4
Vercel: deployment passed

## Status

HumbleTrust v2 has been merged into `main`.

The old v1 program remains in the repository and is not replaced. The v2 program was added as a separate Anchor program with its own Program ID:

```text
FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr
```

## What Was Added

### 1. New Anchor Program

Added:

```text
programs/humbletrust-v2/
```

The v2 program includes a new launch model based on:

```text
L + C + Q + R + A = 100%
```

Where:

```text
L = Locked Vault
C = Creator Vault
Q = Curve Liquidity Vault
R = Circulation Vault
A = Airdrop Vault
```

### 2. New PDA Architecture

The v2 launch creates these PDA accounts:

```text
token_metadata_v2
locked_vault_v2
creator_vault_v2
curve_pool_vault_v2
curve_treasury_sol_v2
circulation_vault_v2
airdrop_vault_v2
lp_lock_vault_v2
```

### 3. New Supply Rules

Implemented validation for:

```text
Locked Vault: 30-80%
Creator Vault: 0-5%
Curve Liquidity Vault: 25-50%
Circulation Vault: 15-40%
Airdrop Vault: 0-5%
Q + R >= 50%
Recommended Q + R >= 55%
Supply sum = 100%
```

Total supply is fixed:

```text
1,000,000,000 tokens
9 decimals
```

### 4. Initial SOL Liquidity

Implemented:

```text
initial_sol_lamports -> curve_treasury_sol_v2 PDA
```

This SOL is not sent to the creator and is not used as Raydium LP at launch. It is reserved for bonding curve trading.

Minimum initial liquidity:

```text
0.5 SOL
```

### 5. Burn Option

Implemented burn from Locked Vault:

```text
0%
25%
50%
```

Burn affects locked supply and TrustScore, but does not affect Q/R liquidity validation.

### 6. TrustScore v2

Implemented the new normalized TrustScore formula:

```text
Lock Score
Creator Score
Curve Liquidity Score
Circulation Score
Airdrop Score
Burn Bonus
```

Levels:

```text
0-39   WEAK
40-69  OK
70-84  STRONG
85-100 ELITE
```

The frontend now shows the TrustScore breakdown.

### 7. v1 Lifecycle Features Ported To v2

Added v2 equivalents for major v1 lifecycle behavior:

```text
unlock_locked_tokens_v2
use_vesting_tranche_v2
add_to_circulation_v2
submit_vote_v2
record_trade_v2
update_metrics_v2
execute_airdrop_epoch_v2
verify_creator_v2
set_metrics_authority_v2
init_creator_reputation_v2
record_reputation_event_v2
lock_lp_tokens_v2
claim_lp_fees_v2
init_global_state_v2
update_fee_parameters_v2
set_upgrade_authority_v2
toggle_launches_pause_v2
mint_launch_certificate_v2
```

Creator vesting in v2:

```text
Day 30: 33%
Day 60: 33%
Day 90: 34%
```

### 8. Bonding Curve

Added constant-product bonding curve instructions:

```text
price_v2
buy_v2
sell_v2
```

Implemented:

```text
SOL in -> curve_treasury_sol_v2
Tokens out -> buyer token account
Tokens in -> curve_pool_vault_v2
SOL out -> seller wallet
```

Fees:

```text
1% total
0.5% platform fee
0.5% creator fee
```

Creator self-buy is allowed and tracked:

```text
creator_curve_buys
```

### 9. Migration Hook

Added:

```text
migrate_to_raydium_v2
```

Implemented:

```text
Migration threshold: 50 SOL
Trigger: anyone
Trigger reward: 0.1 SOL
Migration state recorded in metadata
LP state recorded in lp_lock_vault_v2
```

Important: the Raydium CPI itself is not final production CPI yet. The migration instruction is a state/threshold hook. A full Raydium/OpenBook CPI adapter still needs exact Raydium account mapping before mainnet.

### 10. Frontend v2

Updated frontend files:

```text
app/src/lib/constants.ts
app/src/lib/idl_v2.json
app/src/lib/program.ts
app/src/pages/Launch.tsx
app/src/pages/Trade.tsx
app/src/WalletProvider.tsx
```

Launch page now supports:

```text
Initial Liquidity (SOL)
Curve Liquidity %
Creator allocation 0-5%
Airdrop allocation 0-5%
Circulation auto-calculation
Q + R validation
Q + R recommended warning
TrustScore breakdown
Fixed 1B supply
v2 Program ID
```

Trade page now supports:

```text
Buy on HumbleTrust bonding curve
Sell on HumbleTrust bonding curve
Creator fee wallet input
Token mint input
Auto ATA creation for buys
```

### 11. Tests And Validation

Validated locally:

```text
CARGO_INCREMENTAL=0 cargo check
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
npm install
npm run build
```

Build result:

```text
Vite build succeeded
Vercel deployment passed
```

### 12. Notes Before Mainnet

Before mainnet, still needed:

```text
Run full Anchor build/test in WSL
Deploy v2 program to devnet with the v2 keypair
Generate official Anchor IDL from anchor build
Replace temporary/manual frontend v2 IDL if needed
Finish real Raydium/OpenBook CPI adapter
Test buy/sell with real devnet wallets and ATAs
Test migration threshold behavior
Audit the v2 program
Decide whether to keep v1 Legacy mode visible in frontend
```

### 13. Do Not Run Blindly

Do not run:

```text
npm audit fix --force
```

It can break Solana wallet dependencies.

The warnings from `npm install` are peer dependency warnings from wallet dependency trees. The production build still passed.
