# HumbleTrust — Roadmap & Phases

> Anti-rug token launchpad for Solana. Trust enforced by code, not promises.

**Program ID (devnet):** `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi`
**Fee wallet:** `FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM` (Jupiter mainnet)
**Stack:** Anchor 0.32 / Solana 3.x / React 18 + Vite / TS

---

## ✅ Phase 1 — Environment
- WSL Ubuntu, Rust 1.95, Solana 3.1.15, Anchor 0.32.1, Node 20, Yarn 1.22 — DONE

## ✅ Phase 2 — Core contract
- 10 instructions (create_token_with_lock, vesting, voting, freeze, airdrop, verify_creator)
- 4 PDAs (token_metadata, locked_vault, creator_vault, circulation_vault, rewards_vault)
- TrustScore engine (calculate_initial + recalculate)
- Vesting 30/60/90 enforced
- Tiered fees ($5 Standard / $25 Premium) in lamports
- Anti-bot delay 0–600s
- Deployed on devnet, upgradeable

## 🚧 Phase 3 — Frontend + UX (current)
- ✅ React+Vite scaffold with brand theme
- ✅ Wallet adapter (Phantom + Solflare)
- ✅ Logo upload + Hex frames everywhere
- ✅ Launch form with live TrustScore ring
- ✅ Discover page with hex grid
- ✅ Wired to deployed contract via Anchor client
- 📋 **Phase 3.5 (TODO):** Real Premium perks (custom vesting, featured listing, score boost, airdrop priority)
- 📋 **Phase 3.6 (TODO):** Jupiter swap integration in Trade tab + TrustScore badges on all tokens

## 📋 Phase 4 — Initial Liquidity (URGENT)
**Goal:** Created tokens automatically appear on DEXes (Raydium → Jupiter → DexScreener → Birdeye)

### What we add to contract:
- New instruction `add_initial_liquidity(sol_amount, token_amount, lock_days)`
- Raydium AMM v4 CPI integration
- LP tokens auto-locked in `lp_lock_vault` PDA
- Lock duration enforced on-chain
- New struct `LpLock { mint, unlock_time, lp_amount, claimed_fees }`
- New instruction `claim_lp_fees` (monthly distribution)

### Flow:
1. Creator creates token (Phase 2 flow, no change)
2. Creator calls `add_initial_liquidity` with X SOL + Y tokens from creator_vault
3. Contract creates Raydium pool via CPI (token / SOL pair)
4. LP tokens sent to `lp_lock_vault` PDA (creator CANNOT withdraw)
5. Pool indexed by Jupiter in 5–15 min, by DexScreener in ~1h
6. Trading happens on Raydium, LP fees accrue in PDA
7. After 30 days, creator can `claim_lp_fees` (split below)

### Economic model (revised):
- LP fees from Raydium = 0.25% per trade (industry standard)
- Distribution from accumulated fees:
  - **50%** creator (Standard) / **60%** creator (Premium)
  - **30%** treasury (FEE_WALLET)
  - **20%** DAO / airdrop pool
- **No additional fee on top** — we share Raydium's existing fee

## 📋 Phase 4.5 — Creator Reputation
- New PDA `creator_reputation` per wallet
- Tracks: total_launches, avg_trust_score, total_locked_value, complaints_count, successful_unlocks
- Bonus: each successful launch (no complaints, completed vesting) → +5 to next launch's initial TrustScore
- Penalty: complaints or freeze → score reset
- Displayed on creator profile page (DISCOVER)

## 📋 Phase 4.6 — Launch Certificate NFT (Soulbound)
- Non-transferable NFT minted to creator at launch
- Metadata includes: lock %, lock days, vesting schedule, initial TrustScore, timestamp, Program ID
- Functions as proof-of-launch (verifiable on-chain)
- Shows in Phantom as "Humble.Trust Launch Certificate #N"
- Implementation: Token-2022 with NonTransferable extension

## 📋 Phase 5 — Mainnet readiness
- Wash trading detection (off-chain via metrics_authority)
- Pyth Oracle for dynamic USD pricing
- Multisig upgrade authority (squads.so)
- Audit (CertiK / Halborn / OtterSec)
- Fresh mainnet deploy (new Program ID)
- Marketing campaign + X presence

## 📋 Phase 6 — Advanced features
- Time-bound tax breaks (higher launch fee + 0% trade fees first 30 days)
- Vault analytics dashboard for creators
- Mobile PWA
- API for 3rd-party integrations

---

## 🆚 vs Competitors (as of May 2026)

| | Pump.fun | Believe | Moonshot | **HumbleTrust** |
|---|---|---|---|---|
| Fee | $0.02 | ~$5 | ~$1 | $5–25 |
| Anti-rug on-chain | ❌ | ❌ | ⚠️ Manual | ✅ Enforced |
| TrustScore | ❌ | ❌ | ❌ | ✅ 0–100 dynamic |
| LP lock | Burn after graduation | Burn | Manual | ✅ PDA lock + claim |
| Vesting | ❌ | ❌ | Optional | ✅ 30/60/90 enforced |
| Anti-bot delay | ❌ | ❌ | ❌ | ✅ 0–600s |
| Voting/freeze | ❌ | ❌ | ❌ | ✅ Community + auto |
| Creator earns | ❌ | Trading fee | ❌ | ✅ LP fee share |
| Reputation tracking | ❌ | ❌ | ❌ | ✅ (Phase 4.5) |

## 🎯 Tagline
"Pump.fun is fast and cheap, but every other token is a rug.
HumbleTrust costs more — but every token is structurally protected. And you can see exactly how much by looking at its TrustScore."
