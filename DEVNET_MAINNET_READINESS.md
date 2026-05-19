# HumbleTrust Readiness Audit - DEVNET vs MAINNET

Status date: May 19, 2026

HumbleTrust is positioned as a **Trust & Safety layer + protected launchpad for Solana**. The launchpad is the first enforced workflow; the long-term layer is built from on-chain launch records, PDA custody, TrustScore, certificates, creator reputation, indexed events, and wallet/risk intelligence.

## 1. DEVNET

### Current DEVNET Status

DEVNET is the current active product stage. It is suitable for public demos, builder feedback, grant conversations, and controlled testing with devnet assets only.

| Area | Status | Notes |
| --- | --- | --- |
| v2 program | Active on devnet | Program ID `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr` |
| v1 program | Legacy devnet | Program ID `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi` |
| Protected launchpad | DEVNET ready | Fixed 1B supply, five vaults, initial SOL treasury, burn, metadata, mint authority revoke |
| TrustScore primitive | DEVNET ready | Allocation-based TrustScore stored on-chain |
| Bonding curve | DEVNET ready | Buy/sell, 1% fee, anti-bot delay, PDA reserves |
| Frontend | DEVNET ready | Launch, trade, token picker, MAX sell, slippage guard, backend Discover, Token Detail, real chart component |
| Launch certificate | DEVNET ready | Token-2022 NonTransferable certificate linked to launch PDA |
| Raydium migration | CPMM CPI code added, devnet transaction verification pending | Uses official Raydium CPMM IDs and manual CPI builders. Must pass real pool create/deposit tests before investor demo claims |
| Discover/indexing | Backend added | `/backend` indexes Anchor events into Postgres and exposes `/tokens` |
| Chart data | Backend added | OHLCV aggregation + WebSocket `/chart/:mint`; frontend uses Lightweight Charts |

### DEVNET Gaps To Close

1. Run a real devnet Raydium CPMM create/deposit transaction through `create_instant_raydium_pool_v2`.
2. Run a real devnet migration transaction after treasury threshold using the same CPI account set.
3. Add full v2 tests for buy, sell, fees, anti-bot, slippage, certificate, reputation, and migration guard.
4. Deploy `/backend` with Supabase/Postgres and set `VITE_API_BASE_URL` on Vercel.
5. Improve token metadata reliability and certificate metadata display.
6. Add creator profile UI from indexed wallet reputation.

### DEVNET Risk Level

Medium. Acceptable for demo/testnet if clearly labeled. Not acceptable for real funds.

## 2. MAINNET

### MAINNET Current Status

MAINNET is **not live**. It is preparation only.

| Requirement | Status | Mainnet blocker |
| --- | --- | --- |
| Program audit | Missing | Required before real assets |
| Full test suite | Incomplete | Current coverage is too thin for mainnet |
| Upgrade authority | Dev wallet | Must move to Squads/multisig |
| Indexer/API | Missing | Required for trust layer, Discover, analytics, wallet reputation |
| Raydium migration | Not complete | Need real CPMM CPI pool creation, LP lock, leftover burn |
| Production RPC | Missing | Need paid RPC, rate limits, monitoring |
| Security ops | Missing | Need incident response, release checklist, alerting |
| Dependency hygiene | Incomplete | npm audit issues must be triaged |
| Wallet reputation | Conceptual/partial | Need indexed wallet history and abuse-resistant scoring |

### MAINNET Release Criteria

Mainnet can be considered only after:

1. Raydium CPMM CPI migration works on devnet from PDA reserves.
2. LP tokens never touch creator wallet and are locked/burned according to launch settings.
3. Full Anchor tests pass for all major paths and failure paths.
4. Frontend slippage controls and transaction simulations are active.
5. Discover reads indexed chain state, not browser cache.
6. TrustScore has separate launch score, creator score, and market-health score.
7. Upgrade authority is held by multisig.
8. Third-party Solana audit is complete.
9. Production RPC/indexer monitoring is online.
10. Public docs clearly distinguish devnet, mainnet prep, and future roadmap.

### MAINNET Risk Level

High until the blockers above are closed.

## Updated Brutal Audit After Split

### DEVNET Score

**7/10** as a devnet MVP codebase after backend + real chart wiring.

Strengths:

- Real devnet v2 program.
- Real protected launch flow.
- Real PDA custody primitives.
- Real curve buy/sell.
- Real launch certificate primitive.
- Frontend is demoable.

Weaknesses:

- Backend must be deployed and kept online.
- Raydium CPI code still needs real devnet pool/account verification.
- TrustScore is still mostly launch-parameter based.
- Tests are incomplete.

### MAINNET Score

**3/10**.

Strengths:

- Clear architecture direction.
- On-chain primitives are already started.
- Good positioning if framed as layer + launchpad.

Weaknesses:

- Indexer/API exists, but production deployment/monitoring is not proven.
- No audit.
- Raydium CPI requires external audit and devnet soak testing.
- Upgrade authority/ops not production ready.
- Wallet reputation and anti-scam intelligence still need real data.

## Final Positioning

The correct positioning is:

> HumbleTrust is a Solana Trust & Safety layer with a protected launchpad as its first product surface.

What is real today:

- launch enforcement;
- PDA custody;
- TrustScore primitive;
- bonding-curve trading;
- certificate primitive.

What becomes the full layer:

- indexed launch registry;
- creator profiles;
- wallet reputation;
- scam/risk reports;
- event-backed market health;
- public TrustScore API;
- Raydium CPMM migration with locked LP custody.

Reference: Raydium documents CPMM as the newer constant product AMM with an Anchor-compatible IDL, while legacy AMM v4/OpenBook does not ship with an official IDL: https://docs.raydium.io/raydium/build/resources/idls
