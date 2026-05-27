# Security Policy — HumbleTrust Protocol

HumbleTrust is a Trust & Safety layer for Solana. This document covers responsible disclosure, current security status, on-chain controls, and known limitations.

**Current network:** Devnet only  
**Contact:** humble.trust@outlook.com  
**X (Twitter):** https://x.com/HumbleTrust2026

---

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security problems.

| Channel | Address |
|---------|---------|
| Email (preferred) | humble.trust@outlook.com |
| GitHub Security Advisory | https://github.com/HumbleTrust/humbletrust/security/advisories/new |

We aim to acknowledge within **48 hours** and to ship a patch or publish a transparent post-mortem within **14 days**.  
Preferred languages: English, Russian.

---

## Scope

**In scope:**

- V1 legacy devnet program: `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi`
- V2 active devnet program: `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr`
- Frontend application: https://humbletrust.vercel.app
- All code under `programs/`, `web/`, `api/`, `supabase/migrations/`, `tests/`

**Out of scope:**

- Third-party dependency vulnerabilities (Anchor, Solana SDK, etc.)
- Devnet RPC outages or Solana devnet instability
- Social engineering against project members
- Physical access to contributor machines
- Loss of devnet assets (devnet has no real value)

---

## Current Network Status

`devnet only` — No real assets are at risk.

Mainnet deployment is blocked until:

- [ ] Full Anchor test suite (launch, buy, sell, migration, certificates)
- [ ] Third-party security audit by a qualified Solana auditor
- [ ] Multisig upgrade authority via Squads
- [ ] Production RPC with failover
- [ ] Signed mainnet readiness checklist

---

## Security Controls In Place

| Control | Implementation |
|---------|---------------|
| **PDA-based custody** | All SOL and token vaults are program-derived accounts — no creator-owned wallets hold protocol funds |
| **Five-vault model** | Locked, Creator, Curve Liquidity, Circulation, and Airdrop supply are separated into distinct PDAs |
| **Curve treasury PDA** | Initial SOL goes to `curve_treasury_sol` PDA — never directly to creator |
| **Mint authority revoked** | V2 launch revokes mint authority after minting the fixed supply — no inflation possible |
| **LP policy enforcement** | LP tokens go to `lp_lock_vault` PDA (locked) or are burned via `token::burn` CPI — creator cannot receive LP |
| **No "To Creator" LP option** | The option to send LP to creator was intentionally removed from UI and deprecated in contract flow to prevent manipulation |
| **Supply validation** | Sum must equal 100%; individual allocation ranges enforced on-chain |
| **Creator allocation cap** | Capped at 5% on-chain |
| **Airdrop allocation cap** | Capped at 5% on-chain |
| **Burn option** | Applies only to Locked Vault — doesn't affect curve or circulation liquidity |
| **TrustScore transparency** | Calculated from visible on-chain allocation inputs only — no off-chain oracle |
| **Anti-bot delay** | Curve trading delayed 0–600 seconds after launch |
| **Overflow-safe math** | Curve math uses `u128` intermediates; quadratic uses scaled integer square root to avoid overflow |
| **Slippage protection** | Buyer/seller sets max slippage; instruction reverts if exceeded |
| **Launch Certificate NFT** | Token-2022 NonTransferable soulbound certificate linked to `launch_certificate` PDA |

---

## LP Policy Security Model

Two LP policies are supported on-chain. A third ("To Creator") was removed:

| Policy | On-chain behavior |
|--------|------------------|
| **Lock** (policy=0) | LP tokens transferred to `lp_lock_vault` PDA via `token::transfer`. Vault has no withdrawal instruction in V2. |
| **Burn** (policy=1) | LP tokens destroyed via `token::burn` CPI. Irreversible. |
| ~~To Creator~~ (policy=2) | Deprecated. UI removed. Not recommended for any launch — enables liquidity manipulation. |

---

## TrustScore Formula

TrustScore is computed entirely from on-chain allocation parameters:

```
Components (max points):
  Lock duration:   30d=4 · 90d=12 · 180d=18 · 270d=22 · 360d=25   (max 25)
  Lock percent:    ≥30%=4 · ≥40%=10 · ≥50%=14 · ≥60%=17 · ≥70%=20 (max 20)
  Creator alloc:   0%=15 · ≤3%=12 · ≤5%=9 · ≤8%=6 · ≤10%=3        (max 15)
  Curve liquidity: ≥20%=3 · ≥30%=6 · ≥40%=8 · ≥50%=10             (max 10)
  Airdrop:         ≥1%=5 · ≥5%=8 · ≥10%=10                        (max 10)
  Burn option:     25%=6 · 50%=12                                   (max 12)
  Circulation:     15–40%=8 · 10–14%/41–60%=4 · >60%=2             (max  8)

TrustScore = min(100, sum of all components)
```

Levels:
- `0–39`: **WEAK**
- `40–69`: **OK**
- `70–84`: **STRONG**
- `85–100`: **ELITE**

---

## Known Limitations (Devnet Alpha)

| Area | Current State | Mainnet Requirement |
|------|--------------|---------------------|
| Raydium CPMM migration | Account validation + CPI scaffolding implemented | Verify end-to-end pool create/deposit/migration; audit |
| Discover indexing | API + frontend wired | Add chain-indexed event backfill |
| Chart data | OHLCV from trade index | Raydium vault-delta precision + holders |
| Launch certificate | Token-2022 soulbound NFT live | Richer metadata + collection + audit review |
| Creator reputation | API groundwork | Profile UI + abuse-resistant graph signals |
| Upgrade authority | Devnet wallet during development | Transfer to Squads multisig before mainnet |
| Formal audit | None yet | Required before mainnet |

---

## How To Verify Programs

```bash
# V2 active program
solana program show FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --url devnet
anchor idl fetch FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --provider.cluster devnet

# V1 legacy program
solana program show Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi --url devnet
anchor idl fetch Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi --provider.cluster devnet

# GlobalStateV2 PDA
solana account 4AzHwSAGtsTWv1cv3ya1g5MKLGDKRcixrbC3hq3hjroj --url devnet
```

---

## Disclaimer

This is alpha software on Solana devnet. Devnet tokens have no real value. This is not financial advice. No formal audit has been completed. Do not use real assets.

*HumbleTrust Protocol · humble.trust@outlook.com · https://x.com/HumbleTrust2026*
