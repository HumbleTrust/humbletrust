# HumbleTrust - Trust & Safety Layer + Protected Launchpad for Solana

HumbleTrust is not just a token launchpad. It is a Solana Trust & Safety layer with a protected launchpad as the first enforced product surface.

The current devnet build includes a v2 launch flow with PDA-based token distribution, initial SOL bonding-curve liquidity, creator vesting, burn options, metadata creation, live TrustScore calculation, Vercel API indexing, real OHLCV chart plumbing, and an integrated devnet trade screen.

**Production frontend:** https://humbletrust.vercel.app
**GitHub:** https://github.com/HumbleTrust/humbletrust
**Current status date:** May 19, 2026
**Network status:** DEVNET active, MAINNET preparation

See the explicit split in [`DEVNET_MAINNET_READINESS.md`](./DEVNET_MAINNET_READINESS.md).

## Program IDs

| Version | Network | Program ID | Status |
| --- | --- | --- | --- |
| v1 legacy | devnet | `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi` | Stable legacy program for earlier tokens |
| v2 | devnet | `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr` | Active devnet program for the current frontend |

## What Is Live Now

### v2 token creation

- Fixed total supply: `1,000,000,000` tokens with 9 decimals.
- PDA-based distribution across five buckets:
  - Locked Vault `L`: 30-80%
  - Creator Vault `C`: 0-5%
  - Curve Liquidity Vault `Q`: 25-50%
  - Circulation Vault `R`: 15-40%
  - Airdrop Vault `A`: 0-5%
- Supply validation: `L + C + Q + R + A = 100`.
- Combined liquidity validation: `Q + R >= 50`, with `>= 55` recommended for stronger TrustScore.
- Initial SOL is deposited into `curve_treasury_sol` PDA.
- Curve liquidity tokens are deposited into `curve_pool_vault` PDA.
- Creator never receives LP tokens during the v2 launch flow.
- Burn option applies to the Locked Vault: 25% or 50%.
- Metaplex Token Metadata is created during launch for new mints.
- Mint authority is revoked after launch.

### Bonding curve trading

- Buy and sell instructions are live on devnet.
- Constant product curve math uses u128 intermediates.
- 1% curve fee:
  - 0.5% platform fee
  - 0.5% creator fee
- Anti-bot launch delay is enforced.
- Slippage protection is exposed in the transaction flow.

### Launch Certificate NFT

- v2 creators can receive a Token-2022 NonTransferable Launch Certificate NFT after launch.
- The NFT mint is linked to an on-chain `launch_certificate` PDA.
- Certificate data includes creator, token mint, certificate mint, lock %, lock days, TrustScore, burn option, timestamp, and serial number.
- `global_state_v2` is initialized on devnet for certificate issuance.

### Frontend

- Launch page supports the v2 fields:
  - Initial Liquidity SOL
  - Curve Liquidity %
  - Creator %
  - Airdrop %
  - Burn option
  - anti-bot delay
  - TrustScore breakdown
- Trade page includes:
  - devnet mini swap
  - buy and sell modes
  - token picker from connected wallet balances
  - MAX button for sell amount
  - 0.5% / 1% / 3% / custom slippage guard
  - Solscan links
  - TradingView Lightweight Charts connected to `/api/tokens/:mint/trades`
- Launch Certificate NFT minting after v2 launch
- Discover page reads indexed launches from `/api/tokens` instead of browser localStorage.
- Token Detail page shows indexed TrustScore breakdown, OHLCV chart, recent trades, migration status, and certificate link.
- About/Home pages now describe HumbleTrust as trust and safety infrastructure, not only a launchpad.

### API / Trust Layer Surface

The root `/api` package is the first deployed Trust Layer surface:

- writes `tokens`, `trades`, `ohlcv`, and `wallets` to Postgres/Supabase;
- serves `GET /api/tokens`, `GET /api/tokens/:mint`, and `GET/POST /api/tokens/:mint/trades`;
- stores badge metadata and token registration records through Vercel serverless functions.

## TrustScore v2

TrustScore is calculated from the v2 supply model and normalized from a raw maximum of 110 points to 100.

| Component | Rule |
| --- | --- |
| Lock Score `S_L` | `<30 = 0`, `30-39 = 10`, `40-60 = 20`, `61-80 = 15` |
| Creator Score `S_C` | `max(0, 20 - 4C)` |
| Curve Liquidity Score `S_Q` | `clamp(1.5 * (Q - 20), 0, 25)` |
| Circulation Score `S_R` | `clamp(1.2 * (R - 10), 0, 20)` |
| Airdrop Score `S_A` | `max(0, 15 - 3A)` |
| Burn Bonus `S_B` | `0% = 0`, `25% = 5`, `50% = 10` |

```text
TS_raw = S_L + S_C + S_Q + S_R + S_A + S_B
TrustScore = min(100, round(TS_raw / 110 * 100))
```

TrustScore levels:

- `0-39`: WEAK
- `40-69`: OK
- `70-84`: STRONG
- `85-100`: ELITE

## In Progress

These items are not complete yet and should not be presented as production-ready.

| Area | Current state | Next step |
| --- | --- | --- |
| Raydium CPMM migration | Real CPMM CPI builders and account validation are added | Verify end-to-end devnet pool create/deposit/migration transaction |
| Launch Certificate NFT | Token-2022 NonTransferable mint + certificate PDA is live after v2 launch | Add richer artwork/collection metadata and profile display |
| Creator reputation | API groundwork can store launch/trade history | Build creator profile UI and abuse-resistant graph signals |
| Discover indexing | API `/api/tokens` is wired to frontend | Deploy Supabase tables and backfill historical devnet launches |
| Chart data | API OHLCV route + Lightweight Charts are wired | Add Raydium vault-delta parser precision and top traders/holders |
| Mainnet readiness | Devnet alpha only | Add full tests, audit prep, multisig authority, monitoring, and production RPC plan |

## Recommended Work Order

1. Chain-indexed Discover/token registry from program accounts and events.
2. Event-backed Trade chart and transaction feed.
3. Real Raydium CPMM migration CPI spike, including devnet reliability testing.
4. Creator reputation/profile page.
5. Full Anchor test suite for v2 launch, buy, sell, burn, fees, metadata, certificate NFT, and migration state.
6. Security audit and mainnet readiness.

## Local Development

### Frontend

```bash
cd web
npm install
npm run dev
npm run build
```

Set `VITE_API_BASE_URL` only when using an external API host. Leave it empty on Vercel to use the repository `/api` functions:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

### API

```bash
cd api
```

The API routes are Vercel serverless functions and are deployed from the root `api/` directory.

### Anchor program

```bash
anchor build
anchor test
```

### Devnet verification

```bash
solana program show FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --url devnet
anchor idl fetch FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --provider.cluster devnet
```

## Repository Structure

```text
humbletrust/
  Anchor.toml
  Cargo.toml
  PHASES.md
  SECURITY.md
  web/
    src/
      pages/
      lib/
  api/
  programs/
    humbletrust/
    humbletrust-v2/
  scripts/
  supabase/
  tests/
```

## Important Devnet Notes

- Devnet SOL has no real value.
- Old mints created before the metadata fix may not show name/symbol if mint authority was already revoked.
- New launches should create Metaplex metadata during the v2 launch flow.
- v2 creators can mint a devnet Launch Certificate NFT after launch.
- The current frontend is connected to the v2 devnet program.
- Raydium migration is not production-complete until the real CPI pool creation path is implemented and tested.
