#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    program_pack::Pack,
    system_instruction,
};
use anchor_lang::system_program;
use anchor_spl::token::{
    self, Burn, InitializeAccount3, Mint, MintTo, SetAuthority, SyncNative, Token, TokenAccount,
    Transfer,
};

declare_id!("FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr");

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "HumbleTrust v2",
    project_url: "https://humbletrust.vercel.app",
    contacts: "email:humble.trust@outlook.com,link:https://github.com/HumbleTrust/humbletrust/security",
    policy: "https://github.com/HumbleTrust/humbletrust/blob/main/SECURITY.md",
    preferred_languages: "en,ru",
    source_code: "https://github.com/HumbleTrust/humbletrust",
    source_revision: env!("CARGO_PKG_VERSION"),
    source_release: env!("CARGO_PKG_VERSION"),
    encryption: "",
    auditors: "None - devnet alpha. See SECURITY.md for known limitations."
}

const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1B tokens, 9 decimals.
const SECONDS_PER_DAY: i64 = 86_400;
const MIN_INITIAL_SOL_LAMPORTS: u64 = 500_000_000;
const MIGRATION_THRESHOLD_SOL_LAMPORTS: u64 = 50_000_000_000;
const MIGRATION_REWARD_LAMPORTS: u64 = 100_000_000;
const PLATFORM_FEE_BPS: u16 = 50;
const CREATOR_FEE_BPS: u16 = 50;
const FEE_DENOMINATOR_BPS: u64 = 10_000;
const SECONDS_PER_MONTH: i64 = 2_592_000;
const FEE_WALLET: Pubkey = pubkey!("FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM");
const HUMBLETRUST_ADMIN: Pubkey = pubkey!("7iMHH7F7SqAtuRo1sC72KKgWf2vZbfsRYHrpdmS3PSW8");
const LAUNCH_FEE_STANDARD: u64 = 56_818_181;
const LAUNCH_FEE_PREMIUM: u64 = 281_818_181;
const LP_FEE_CREATOR_STANDARD_BPS: u64 = 4_000;
const LP_FEE_CREATOR_PREMIUM_BPS: u64 = 6_000;
const LP_FEE_TREASURY_STANDARD_BPS: u64 = 3_500;
const LP_FEE_TREASURY_PREMIUM_BPS: u64 = 3_000;
const METAPLEX_TOKEN_METADATA_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const NATIVE_SOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPF5SJEMi4xg92qGZJzk");
const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey = pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const RAYDIUM_CPMM_INITIALIZE_DISCM: [u8; 8] = [175, 175, 109, 31, 13, 152, 155, 237];
const RAYDIUM_CPMM_DEPOSIT_DISCM: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
const RAYDIUM_CPMM_DEVNET_PROGRAM: Pubkey = pubkey!("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
const RAYDIUM_CPMM_MAINNET_PROGRAM: Pubkey =
    pubkey!("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const RAYDIUM_CPMM_DEVNET_AUTHORITY: Pubkey =
    pubkey!("CXniRufdq5xL8t8jZAPxsPZDpuudwuJSPWnbcD5Y5Nxq");
const RAYDIUM_CPMM_MAINNET_AUTHORITY: Pubkey =
    pubkey!("GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL");
const RAYDIUM_CPMM_DEVNET_CREATE_POOL_FEE: Pubkey =
    pubkey!("3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy");
const RAYDIUM_CPMM_MAINNET_CREATE_POOL_FEE: Pubkey =
    pubkey!("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8");

#[derive(AnchorSerialize)]
struct MetaplexCreator {
    address: Pubkey,
    verified: bool,
    share: u8,
}

#[derive(AnchorSerialize)]
struct MetaplexCollection {
    verified: bool,
    key: Pubkey,
}

#[derive(AnchorSerialize)]
struct MetaplexUses {
    use_method: u8,
    remaining: u64,
    total: u64,
}

#[derive(AnchorSerialize)]
#[allow(dead_code)]
enum MetaplexCollectionDetails {
    V1 { size: u64 },
}

#[derive(AnchorSerialize)]
struct MetaplexDataV2 {
    name: String,
    symbol: String,
    uri: String,
    seller_fee_basis_points: u16,
    creators: Option<Vec<MetaplexCreator>>,
    collection: Option<MetaplexCollection>,
    uses: Option<MetaplexUses>,
}

#[derive(AnchorSerialize)]
struct CreateMetaplexMetadataArgs {
    data: MetaplexDataV2,
    is_mutable: bool,
    collection_details: Option<MetaplexCollectionDetails>,
}

#[program]
pub mod humbletrust_v2 {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn create_token_with_lock_v2(
        ctx: Context<CreateTokenWithLockV2>,
        name: String,
        symbol: String,
        metadata_uri: String,
        lock_days: u16,
        burn_option: u8,
        lock_percent: u8,
        creator_percent: u8,
        curve_liquidity_percent: u8,
        circulation_percent: u8,
        airdrop_percent: u8,
        initial_sol_lamports: u64,
        metrics_authority: Pubkey,
        tier: u8,
        anti_bot_seconds: u16,
        curve_type: u8,
        lp_policy: u8,
        is_test: bool,
    ) -> Result<()> {
        require!(
            !ctx.accounts.global_state.is_launches_paused,
            HumbleV2Error::LaunchesPaused
        );
        validate_launch_inputs(
            &name,
            &symbol,
            lock_days,
            burn_option,
            lock_percent,
            creator_percent,
            curve_liquidity_percent,
            circulation_percent,
            airdrop_percent,
            initial_sol_lamports,
            tier,
            anti_bot_seconds,
            curve_type,
            lp_policy,
            is_test,
        )?;
        require_keys_eq!(
            ctx.accounts.fee_wallet.key(),
            FEE_WALLET,
            HumbleV2Error::InvalidFeeWallet
        );
        require_keys_eq!(
            ctx.accounts.token_metadata_program.key(),
            METAPLEX_TOKEN_METADATA_ID,
            HumbleV2Error::InvalidMetaplexProgram
        );

        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let (expected_metaplex_metadata, _) = Pubkey::find_program_address(
            &[
                b"metadata",
                METAPLEX_TOKEN_METADATA_ID.as_ref(),
                mint_key.as_ref(),
            ],
            &METAPLEX_TOKEN_METADATA_ID,
        );
        require_keys_eq!(
            ctx.accounts.metaplex_metadata.key(),
            expected_metaplex_metadata,
            HumbleV2Error::InvalidMetaplexMetadata
        );
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();
        let score = calculate_trust_score_v2(
            lock_percent,
            lock_days,
            creator_percent,
            curve_liquidity_percent,
            circulation_percent,
            airdrop_percent,
            burn_option,
        );

        let locked_allocation_amount = percent_of(TOTAL_SUPPLY, lock_percent as u64)?;
        let creator_allocation_amount = percent_of(TOTAL_SUPPLY, creator_percent as u64)?;
        let curve_liquidity_amount = percent_of(TOTAL_SUPPLY, curve_liquidity_percent as u64)?;
        let circulation_amount = percent_of(TOTAL_SUPPLY, circulation_percent as u64)?;
        let airdrop_amount = percent_of(TOTAL_SUPPLY, airdrop_percent as u64)?;
        let planned_burn_amount = percent_of(locked_allocation_amount, burn_option as u64)?;
        let locked_amount_after_burn = locked_allocation_amount
            .checked_sub(planned_burn_amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        {
            let meta = &mut ctx.accounts.token_metadata;
            meta.creator = ctx.accounts.creator.key();
            meta.mint = mint_key;
            meta.metrics_authority = metrics_authority;
            meta.name = name.clone();
            meta.symbol = symbol.clone();
            meta.total_supply = TOTAL_SUPPLY;
            meta.mint_supply_after_burn = TOTAL_SUPPLY
                .checked_sub(planned_burn_amount)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
            meta.lock_percent = lock_percent;
            meta.creator_percent = creator_percent;
            meta.curve_liquidity_percent = curve_liquidity_percent;
            meta.circulation_percent = circulation_percent;
            meta.airdrop_percent = airdrop_percent;
            meta.locked_allocation_amount = locked_allocation_amount;
            meta.locked_amount_after_burn = locked_amount_after_burn;
            meta.creator_allocation_amount = creator_allocation_amount;
            meta.curve_liquidity_amount = curve_liquidity_amount;
            meta.circulation_amount = circulation_amount;
            meta.airdrop_amount = airdrop_amount;
            meta.planned_burn_amount = planned_burn_amount;
            meta.total_burned = planned_burn_amount;
            meta.initial_sol_lamports = initial_sol_lamports;
            meta.is_test = is_test;
            meta.metadata_uri = metadata_uri.clone();
            meta.migration_threshold_lamports = if is_test { 5_000_000_000u64 } else { MIGRATION_THRESHOLD_SOL_LAMPORTS };
            meta.migration_reward_lamports = MIGRATION_REWARD_LAMPORTS;
            meta.platform_fee_bps = PLATFORM_FEE_BPS;
            meta.creator_fee_bps = CREATOR_FEE_BPS;
            meta.unlock_time = now + (lock_days as i64 * seconds_per_day());
            meta.created_at = now;
            meta.lock_days = lock_days;
            meta.burn_option = burn_option;
            meta.trust_score = score.trust_score;
            meta.score_lock_tenths = score.lock_tenths;
            meta.score_creator_tenths = score.creator_tenths;
            meta.score_curve_liquidity_tenths = score.curve_liquidity_tenths;
            meta.score_circulation_tenths = score.circulation_tenths;
            meta.score_airdrop_tenths = score.airdrop_tenths;
            meta.score_burn_tenths = score.burn_tenths;
            meta.raw_score_tenths = score.raw_tenths;
            meta.trust_level = trust_level(score.trust_score);
            meta.min_score_this_month = score.trust_score;
            meta.trading_volume = 0;
            meta.verified_volume = 0;
            meta.holder_count = 0;
            meta.is_verified = false;
            meta.last_airdrop_time = 0;
            meta.total_airdrops_executed = 0;
            meta.vesting_t1_done = false;
            meta.vesting_t2_done = false;
            meta.vesting_t3_done = false;
            meta.vesting_t1_action = 0;
            meta.vesting_t2_action = 0;
            meta.vesting_t3_action = 0;
            meta.creator_vesting_consumed = 0;
            meta.positive_votes = 0;
            meta.negative_votes = 0;
            meta.complaints_count = 0;
            meta.is_flagged = false;
            meta.is_frozen = false;
            meta.no_activity_flag = false;
            meta.rewards_multiplier_bps = rewards_multiplier_bps(score.trust_score);
            meta.is_locked = true;
            meta.is_premium = tier == 1;
            meta.is_migrated = false;
            meta.creator_curve_buys = 0;
            meta.curve_sol_reserve_lamports = initial_sol_lamports;
            meta.curve_token_reserve_amount = curve_liquidity_amount;
            meta.last_curve_price_lamports_per_token = 0;
            meta.raydium_pool = Pubkey::default();
            meta.migration_trigger = Pubkey::default();
            meta.migrated_at = 0;
            meta.anti_bot_seconds = anti_bot_seconds;
            meta.trading_unlock_time = now + anti_bot_seconds as i64;
            meta.curve_type = curve_type;
            meta.lp_policy = lp_policy;
            meta.initial_price_lamports_per_token = curve_price_lamports_per_token(
                initial_sol_lamports,
                curve_liquidity_amount,
                curve_type,
            )?;
            meta.graduation_price_lamports_per_token = graduation_price_lamports_per_token_for_curve(
                initial_sol_lamports,
                curve_liquidity_amount,
                if is_test { 5_000_000_000u64 } else { MIGRATION_THRESHOLD_SOL_LAMPORTS },
                curve_type,
            )?;
            meta.bump = ctx.bumps.token_metadata;
            meta.locked_vault_bump = ctx.bumps.locked_vault;
            meta.creator_vault_bump = ctx.bumps.creator_vault;
            meta.curve_pool_vault_bump = ctx.bumps.curve_pool_vault;
            meta.circulation_vault_bump = ctx.bumps.circulation_vault;
            meta.airdrop_vault_bump = ctx.bumps.airdrop_vault;
            meta.curve_treasury_sol_bump = ctx.bumps.curve_treasury_sol;
            meta.lp_lock_vault_bump = ctx.bumps.lp_lock_vault;
        }

        let bump_seed = [ctx.accounts.token_metadata.bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        mint_to_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.locked_vault,
            &token_metadata_ai,
            signer,
            locked_allocation_amount,
        )?;
        mint_to_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.creator_vault,
            &token_metadata_ai,
            signer,
            creator_allocation_amount,
        )?;
        mint_to_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.curve_pool_vault,
            &token_metadata_ai,
            signer,
            curve_liquidity_amount,
        )?;
        mint_to_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.circulation_vault,
            &token_metadata_ai,
            signer,
            circulation_amount,
        )?;
        mint_to_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.airdrop_vault,
            &token_metadata_ai,
            signer,
            airdrop_amount,
        )?;

        if planned_burn_amount > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: ctx.accounts.locked_vault.to_account_info(),
                        authority: token_metadata_ai.clone(),
                    },
                    signer,
                ),
                planned_burn_amount,
            )?;
        }

        let launch_fee_lamports = if tier == 0 {
            LAUNCH_FEE_STANDARD
        } else {
            LAUNCH_FEE_PREMIUM
        };
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.fee_wallet.to_account_info(),
                },
            ),
            launch_fee_lamports,
        )?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.curve_treasury_sol.to_account_info(),
                },
            ),
            initial_sol_lamports,
        )?;

        let metaplex_metadata_ai = ctx.accounts.metaplex_metadata.to_account_info();
        let mint_ai = ctx.accounts.mint.to_account_info();
        let creator_ai = ctx.accounts.creator.to_account_info();
        let system_program_ai = ctx.accounts.system_program.to_account_info();
        let rent_ai = ctx.accounts.rent.to_account_info();
        let token_metadata_program_ai = ctx.accounts.token_metadata_program.to_account_info();
        let mut metaplex_data = vec![33u8];
        CreateMetaplexMetadataArgs {
            data: MetaplexDataV2 {
                name: name.clone(),
                symbol: symbol.clone(),
                uri: metadata_uri.clone(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            is_mutable: true,
            collection_details: None,
        }
        .serialize(&mut metaplex_data)?;

        let metaplex_ix = Instruction {
            program_id: METAPLEX_TOKEN_METADATA_ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.metaplex_metadata.key(), false),
                AccountMeta::new_readonly(mint_key, false),
                AccountMeta::new_readonly(ctx.accounts.token_metadata.key(), true),
                AccountMeta::new(ctx.accounts.creator.key(), true),
                AccountMeta::new_readonly(ctx.accounts.token_metadata.key(), true),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
            ],
            data: metaplex_data,
        };
        invoke_signed(
            &metaplex_ix,
            &[
                token_metadata_program_ai,
                metaplex_metadata_ai,
                mint_ai,
                token_metadata_ai.clone(),
                creator_ai,
                token_metadata_ai.clone(),
                system_program_ai,
                rent_ai,
            ],
            signer,
        )?;

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                    current_authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
            None,
        )?;

        let treasury = &mut ctx.accounts.curve_treasury_sol;
        treasury.mint = mint_key;
        treasury.creator = ctx.accounts.creator.key();
        treasury.initial_sol_lamports = initial_sol_lamports;
        treasury.current_sol_lamports = initial_sol_lamports;
        treasury.bump = ctx.bumps.curve_treasury_sol;

        let lp_lock_vault = &mut ctx.accounts.lp_lock_vault;
        lp_lock_vault.token_mint = mint_key;
        lp_lock_vault.lp_mint = Pubkey::default();
        lp_lock_vault.lp_amount = 0;
        lp_lock_vault.is_burn_on_migration = true;
        lp_lock_vault.bump = ctx.bumps.lp_lock_vault;

        emit!(TokenCreatedV2 {
            mint: mint_key,
            creator: ctx.accounts.creator.key(),
            curve_type,
            lp_policy,
            total_supply: TOTAL_SUPPLY,
            mint_supply_after_burn: ctx.accounts.token_metadata.mint_supply_after_burn,
            locked_allocation_amount,
            planned_burn_amount,
            curve_liquidity_amount,
            circulation_amount,
            airdrop_amount,
            initial_sol_lamports,
            trust_score: score.trust_score,
            trust_level: trust_level(score.trust_score),
            timestamp: now,
        });

        Ok(())
    }

    pub fn unlock_locked_tokens_v2(ctx: Context<UnlockLockedTokensV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (creator_key, is_locked, unlock_time, release_amount, bump) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.creator,
                meta.is_locked,
                meta.unlock_time,
                meta.locked_amount_after_burn,
                meta.bump,
            )
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleV2Error::Unauthorized
        );
        require!(is_locked, HumbleV2Error::AlreadyUnlocked);
        require!(now >= unlock_time, HumbleV2Error::TokensStillLocked);

        if release_amount > 0 {
            let bump_seed = [bump];
            let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
            let signer = &[signer_seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.locked_vault.to_account_info(),
                        to: ctx.accounts.circulation_vault.to_account_info(),
                        authority: token_metadata_ai.clone(),
                    },
                    signer,
                ),
                release_amount,
            )?;
        }

        let meta = &mut ctx.accounts.token_metadata;
        meta.circulation_amount = meta
            .circulation_amount
            .checked_add(release_amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.locked_amount_after_burn = 0;
        meta.is_locked = false;
        refresh_dynamic_score(meta, now);

        emit!(LockedTokensUnlockedV2 {
            mint: meta.mint,
            burned_amount: meta.planned_burn_amount,
            released_amount: release_amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn use_vesting_tranche_v2(
        ctx: Context<UseVestingTrancheV2>,
        tranche: u8,
        action: u8,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (creator_key, is_frozen, created_at, creator_allocation, bump, done) = {
            let meta = &ctx.accounts.token_metadata;
            let done = match tranche {
                1 => meta.vesting_t1_done,
                2 => meta.vesting_t2_done,
                3 => meta.vesting_t3_done,
                _ => return err!(HumbleV2Error::InvalidTranche),
            };
            (
                meta.creator,
                meta.is_frozen,
                meta.created_at,
                meta.creator_allocation_amount,
                meta.bump,
                done,
            )
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleV2Error::Unauthorized
        );
        require!(!is_frozen, HumbleV2Error::TokenFrozen);
        require!(matches!(action, 1 | 2 | 3), HumbleV2Error::InvalidAction);
        require!(!done, HumbleV2Error::VestingTrancheDone);

        let days_elapsed = ((now - created_at) / seconds_per_day()).max(0) as u16;
        let (required_day, numerator, denominator) = match tranche {
            1 => (30u16, 33u64, 100u64),
            2 => (60u16, 33u64, 100u64),
            3 => (90u16, 34u64, 100u64),
            _ => return err!(HumbleV2Error::InvalidTranche),
        };
        require!(days_elapsed >= required_day, HumbleV2Error::VestingNotReady);

        let tranche_amount = creator_allocation
            .checked_mul(numerator)
            .and_then(|v| v.checked_div(denominator))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            ctx.accounts.creator_vault.amount >= tranche_amount,
            HumbleV2Error::InsufficientVaultBalance
        );

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        match action {
            1 => {
                require_keys_eq!(
                    ctx.accounts.creator_receive_account.owner,
                    creator_key,
                    HumbleV2Error::InvalidCreatorReceiveAccount
                );
                require_keys_eq!(
                    ctx.accounts.creator_receive_account.mint,
                    mint_key,
                    HumbleV2Error::InvalidMintForTokenAccount
                );
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.creator_vault.to_account_info(),
                            to: ctx.accounts.creator_receive_account.to_account_info(),
                            authority: token_metadata_ai.clone(),
                        },
                        signer,
                    ),
                    tranche_amount,
                )?;
            }
            2 => {
                token::burn(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Burn {
                            mint: ctx.accounts.mint.to_account_info(),
                            from: ctx.accounts.creator_vault.to_account_info(),
                            authority: token_metadata_ai.clone(),
                        },
                        signer,
                    ),
                    tranche_amount,
                )?;
            }
            3 => {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.creator_vault.to_account_info(),
                            to: ctx.accounts.circulation_vault.to_account_info(),
                            authority: token_metadata_ai.clone(),
                        },
                        signer,
                    ),
                    tranche_amount,
                )?;
            }
            _ => return err!(HumbleV2Error::InvalidAction),
        }

        let meta = &mut ctx.accounts.token_metadata;
        match tranche {
            1 => {
                meta.vesting_t1_done = true;
                meta.vesting_t1_action = action;
            }
            2 => {
                meta.vesting_t2_done = true;
                meta.vesting_t2_action = action;
            }
            3 => {
                meta.vesting_t3_done = true;
                meta.vesting_t3_action = action;
            }
            _ => return err!(HumbleV2Error::InvalidTranche),
        }
        meta.creator_vesting_consumed = meta
            .creator_vesting_consumed
            .checked_add(tranche_amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        if action == 2 {
            meta.total_burned = meta
                .total_burned
                .checked_add(tranche_amount)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
            meta.mint_supply_after_burn = meta
                .mint_supply_after_burn
                .checked_sub(tranche_amount)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
        } else if action == 3 {
            meta.circulation_amount = meta
                .circulation_amount
                .checked_add(tranche_amount)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
        }
        refresh_dynamic_score(meta, now);

        emit!(VestingTrancheUsedV2 {
            mint: meta.mint,
            tranche,
            action,
            amount: tranche_amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn add_to_circulation_v2(ctx: Context<AddToCirculationV2>, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (creator_key, bump, is_frozen, created_at, creator_allocation, consumed) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.creator,
                meta.bump,
                meta.is_frozen,
                meta.created_at,
                meta.creator_allocation_amount,
                meta.creator_vesting_consumed,
            )
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleV2Error::Unauthorized
        );
        require!(!is_frozen, HumbleV2Error::TokenFrozen);
        require!(amount > 0, HumbleV2Error::InvalidAmount);
        require!(
            ctx.accounts.creator_vault.amount >= amount,
            HumbleV2Error::InsufficientVaultBalance
        );

        let days_elapsed = ((now - created_at) / seconds_per_day()).max(0) as u64;
        let unlocked_pct = if days_elapsed >= 90 {
            100
        } else if days_elapsed >= 60 {
            66
        } else if days_elapsed >= 30 {
            33
        } else {
            0
        };
        let total_unlocked = percent_of(creator_allocation, unlocked_pct)?;
        let new_consumed = consumed
            .checked_add(amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            new_consumed <= total_unlocked,
            HumbleV2Error::VestingExceeded
        );

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_vault.to_account_info(),
                    to: ctx.accounts.circulation_vault.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            amount,
        )?;

        let meta = &mut ctx.accounts.token_metadata;
        meta.creator_vesting_consumed = new_consumed;
        meta.circulation_amount = meta
            .circulation_amount
            .checked_add(amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        refresh_dynamic_score(meta, now);

        emit!(CirculationAddedV2 {
            mint: meta.mint,
            amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn buy_v2(ctx: Context<BuyV2>, sol_in_lamports: u64, min_tokens_out: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        require!(sol_in_lamports > 0, HumbleV2Error::InvalidAmount);
        require!(
            !ctx.accounts.token_metadata.is_migrated,
            HumbleV2Error::AlreadyMigrated
        );
        require!(
            !ctx.accounts.token_metadata.is_frozen,
            HumbleV2Error::TokenFrozen
        );
        require!(
            now >= ctx.accounts.token_metadata.trading_unlock_time,
            HumbleV2Error::TradingNotStarted
        );
        require_keys_eq!(
            ctx.accounts.fee_wallet.key(),
            FEE_WALLET,
            HumbleV2Error::InvalidFeeWallet
        );

        let platform_fee = bps_amount(sol_in_lamports, PLATFORM_FEE_BPS as u64)?;
        let creator_fee = bps_amount(sol_in_lamports, CREATOR_FEE_BPS as u64)?;
        let net_sol = sol_in_lamports
            .checked_sub(platform_fee)
            .and_then(|v| v.checked_sub(creator_fee))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        let token_reserve = ctx.accounts.curve_pool_vault.amount;
        let sol_reserve = ctx.accounts.curve_treasury_sol.current_sol_lamports;
        let tokens_out = if ctx.accounts.token_metadata.curve_type == 1 {
            quadratic_tokens_out(token_reserve, sol_reserve, net_sol)?
        } else {
            constant_product_tokens_out(token_reserve, sol_reserve, net_sol)?
        };

        require!(
            tokens_out >= min_tokens_out,
            HumbleV2Error::SlippageExceeded
        );
        require!(tokens_out > 0, HumbleV2Error::InvalidAmount);
        require!(
            ctx.accounts.curve_pool_vault.amount >= tokens_out,
            HumbleV2Error::InsufficientVaultBalance
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_wallet.to_account_info(),
                },
            ),
            platform_fee,
        )?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator_fee_wallet.to_account_info(),
                },
            ),
            creator_fee,
        )?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.curve_treasury_sol.to_account_info(),
                },
            ),
            net_sol,
        )?;

        let bump_seed = [ctx.accounts.token_metadata.bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.curve_pool_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            tokens_out,
        )?;

        let meta = &mut ctx.accounts.token_metadata;
        let treasury = &mut ctx.accounts.curve_treasury_sol;
        treasury.current_sol_lamports = treasury
            .current_sol_lamports
            .checked_add(net_sol)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.curve_sol_reserve_lamports = treasury.current_sol_lamports;
        meta.curve_token_reserve_amount = token_reserve
            .checked_sub(tokens_out)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.last_curve_price_lamports_per_token = curve_price_lamports_per_token(
            meta.curve_sol_reserve_lamports,
            meta.curve_token_reserve_amount,
            meta.curve_type,
        )?;
        meta.trading_volume = meta
            .trading_volume
            .checked_add(tokens_out)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        if ctx.accounts.buyer.key() == meta.creator {
            meta.creator_curve_buys = meta.creator_curve_buys.saturating_add(1);
        }

        emit!(CurveBuyV2 {
            mint: mint_key,
            buyer: ctx.accounts.buyer.key(),
            sol_in_lamports,
            platform_fee_lamports: platform_fee,
            creator_fee_lamports: creator_fee,
            tokens_out,
            price_lamports_per_token: meta.last_curve_price_lamports_per_token,
            timestamp: now,
        });

        Ok(())
    }

    pub fn sell_v2(ctx: Context<SellV2>, tokens_in: u64, min_sol_out_lamports: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(tokens_in > 0, HumbleV2Error::InvalidAmount);
        require!(
            !ctx.accounts.token_metadata.is_migrated,
            HumbleV2Error::AlreadyMigrated
        );
        require!(
            !ctx.accounts.token_metadata.is_frozen,
            HumbleV2Error::TokenFrozen
        );
        require!(
            now >= ctx.accounts.token_metadata.trading_unlock_time,
            HumbleV2Error::TradingNotStarted
        );
        require_keys_eq!(
            ctx.accounts.fee_wallet.key(),
            FEE_WALLET,
            HumbleV2Error::InvalidFeeWallet
        );

        let token_reserve = ctx.accounts.curve_pool_vault.amount;
        let sol_reserve = ctx.accounts.curve_treasury_sol.current_sol_lamports;
        let gross_sol_out = if ctx.accounts.token_metadata.curve_type == 1 {
            quadratic_sol_out(token_reserve, sol_reserve, tokens_in)?
        } else {
            constant_product_sol_out(token_reserve, sol_reserve, tokens_in)?
        };
        let platform_fee = bps_amount(gross_sol_out, PLATFORM_FEE_BPS as u64)?;
        let creator_fee = bps_amount(gross_sol_out, CREATOR_FEE_BPS as u64)?;
        let seller_receives = gross_sol_out
            .checked_sub(platform_fee)
            .and_then(|v| v.checked_sub(creator_fee))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            seller_receives >= min_sol_out_lamports,
            HumbleV2Error::SlippageExceeded
        );
        require!(
            sol_reserve >= gross_sol_out,
            HumbleV2Error::InsufficientCurveReserve
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.curve_pool_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            tokens_in,
        )?;

        let treasury_ai = ctx.accounts.curve_treasury_sol.to_account_info();
        **treasury_ai.try_borrow_mut_lamports()? = treasury_ai
            .lamports()
            .checked_sub(gross_sol_out)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        **ctx.accounts.seller.try_borrow_mut_lamports()? = ctx
            .accounts
            .seller
            .lamports()
            .checked_add(seller_receives)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        **ctx.accounts.fee_wallet.try_borrow_mut_lamports()? = ctx
            .accounts
            .fee_wallet
            .lamports()
            .checked_add(platform_fee)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        **ctx.accounts.creator_fee_wallet.try_borrow_mut_lamports()? = ctx
            .accounts
            .creator_fee_wallet
            .lamports()
            .checked_add(creator_fee)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        let treasury = &mut ctx.accounts.curve_treasury_sol;
        treasury.current_sol_lamports = treasury
            .current_sol_lamports
            .checked_sub(gross_sol_out)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        let meta = &mut ctx.accounts.token_metadata;
        meta.curve_sol_reserve_lamports = treasury.current_sol_lamports;
        meta.curve_token_reserve_amount = token_reserve
            .checked_add(tokens_in)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.last_curve_price_lamports_per_token = curve_price_lamports_per_token(
            meta.curve_sol_reserve_lamports,
            meta.curve_token_reserve_amount,
            meta.curve_type,
        )?;
        meta.trading_volume = meta
            .trading_volume
            .checked_add(tokens_in)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        emit!(CurveSellV2 {
            mint: meta.mint,
            seller: ctx.accounts.seller.key(),
            tokens_in,
            gross_sol_out_lamports: gross_sol_out,
            platform_fee_lamports: platform_fee,
            creator_fee_lamports: creator_fee,
            seller_receives_lamports: seller_receives,
            price_lamports_per_token: meta.last_curve_price_lamports_per_token,
            timestamp: now,
        });

        Ok(())
    }

    pub fn price_v2(ctx: Context<PriceV2>) -> Result<()> {
        let price = price_lamports_per_token(
            ctx.accounts.curve_treasury_sol.current_sol_lamports,
            ctx.accounts.curve_pool_vault.amount,
        )?;
        emit!(CurvePriceV2 {
            mint: ctx.accounts.mint.key(),
            sol_reserve_lamports: ctx.accounts.curve_treasury_sol.current_sol_lamports,
            token_reserve_amount: ctx.accounts.curve_pool_vault.amount,
            price_lamports_per_token: price,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn create_instant_raydium_pool_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateInstantRaydiumPoolV2<'info>>,
        init_token_amount: u64,
        init_sol_lamports: u64,
        payer_buffer_lamports: u64,
        open_time: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(init_token_amount > 0, HumbleV2Error::InvalidAmount);
        require!(
            init_sol_lamports >= MIN_INITIAL_SOL_LAMPORTS,
            HumbleV2Error::InitialSolTooLow
        );
        require_keys_eq!(
            ctx.accounts.creator.key(),
            ctx.accounts.token_metadata.creator,
            HumbleV2Error::Unauthorized
        );
        require!(
            !ctx.accounts.token_metadata.is_migrated,
            HumbleV2Error::AlreadyMigrated
        );
        require!(
            ctx.accounts.token_metadata.raydium_pool == Pubkey::default(),
            HumbleV2Error::RaydiumPoolAlreadyCreated
        );
        // #1-a: must reach migration threshold before opening a Raydium pool
        require!(
            ctx.accounts.curve_treasury_sol.current_sol_lamports
                >= ctx.accounts.token_metadata.migration_threshold_lamports,
            HumbleV2Error::MigrationThresholdNotMet
        );
        // #1-b: init_sol_lamports must equal all available curve SOL (minus payer buffer)
        //       prevents creator from cherry-picking how much SOL to move
        let available_sol = ctx
            .accounts
            .curve_treasury_sol
            .current_sol_lamports
            .checked_sub(payer_buffer_lamports)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            init_sol_lamports == available_sol,
            HumbleV2Error::InvalidAmount
        );

        validate_raydium_cpmm_common(
            &ctx.accounts.raydium_program,
            &ctx.accounts.raydium_authority,
            &ctx.accounts.raydium_create_pool_fee,
            &ctx.accounts.token_program_2022,
            &ctx.accounts.associated_token_program,
            &ctx.accounts.wsol_mint,
        )?;
        validate_migration_token_accounts(
            ctx.accounts.raydium_migration_authority.key(),
            ctx.accounts.mint.key(),
            &ctx.accounts.migration_token_account,
            &ctx.accounts.migration_wsol_account,
        )?;

        let total_sol_needed = init_sol_lamports
            .checked_add(payer_buffer_lamports)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            ctx.accounts.curve_treasury_sol.current_sol_lamports >= total_sol_needed,
            HumbleV2Error::InsufficientCurveReserve
        );
        require!(
            ctx.accounts.curve_pool_vault.amount >= init_token_amount,
            HumbleV2Error::InsufficientVaultBalance
        );

        move_curve_tokens_to_migration_account(
            &ctx.accounts.token_program,
            &ctx.accounts.token_metadata.to_account_info(),
            &ctx.accounts.curve_pool_vault.to_account_info(),
            &ctx.accounts.migration_token_account.to_account_info(),
            ctx.accounts.mint.key(),
            ctx.accounts.token_metadata.bump,
            init_token_amount,
        )?;
        debit_treasury_to_account(
            &mut ctx.accounts.curve_treasury_sol,
            &ctx.accounts.raydium_migration_authority.to_account_info(),
            payer_buffer_lamports,
        )?;
        debit_treasury_to_account(
            &mut ctx.accounts.curve_treasury_sol,
            &ctx.accounts.migration_wsol_account.to_account_info(),
            init_sol_lamports,
        )?;
        token::sync_native(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SyncNative {
                account: ctx.accounts.migration_wsol_account.to_account_info(),
            },
        ))?;

        let migration_bump = [ctx.bumps.raydium_migration_authority];
        let mint_key = ctx.accounts.mint.key();
        let migration_seeds: &[&[u8]] = &[
            b"raydium_migration_authority_v2",
            mint_key.as_ref(),
            &migration_bump,
        ];
        let signer = &[migration_seeds];
        let lp_before = token_account_amount(&ctx.accounts.raydium_user_lp_token)?;

        invoke_raydium_cpmm_initialize(
            RaydiumCpmmInitializeCpi {
                raydium_program: ctx.accounts.raydium_program.to_account_info(),
                creator: ctx.accounts.raydium_migration_authority.to_account_info(),
                amm_config: ctx.accounts.raydium_amm_config.to_account_info(),
                authority: ctx.accounts.raydium_authority.to_account_info(),
                pool_state: ctx.accounts.raydium_pool_state.to_account_info(),
                token_mint: ctx.accounts.mint.to_account_info(),
                wsol_mint: ctx.accounts.wsol_mint.to_account_info(),
                lp_mint: ctx.accounts.raydium_lp_mint.to_account_info(),
                creator_token: ctx.accounts.migration_token_account.to_account_info(),
                creator_wsol: ctx.accounts.migration_wsol_account.to_account_info(),
                creator_lp_token: ctx.accounts.raydium_user_lp_token.to_account_info(),
                token_0_vault: ctx.accounts.raydium_token_0_vault.to_account_info(),
                token_1_vault: ctx.accounts.raydium_token_1_vault.to_account_info(),
                create_pool_fee: ctx.accounts.raydium_create_pool_fee.to_account_info(),
                observation_state: ctx.accounts.raydium_observation_state.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            init_token_amount,
            init_sol_lamports,
            open_time,
            signer,
        )?;

        let lp_after = token_account_amount(&ctx.accounts.raydium_user_lp_token)?;
        let minted_lp = lp_after
            .checked_sub(lp_before)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(minted_lp > 0, HumbleV2Error::InvalidLpAmount);

        // Apply LP policy before taking the mutable metadata borrow.
        // Capture owned AccountInfos to avoid lifetime conflicts.
        let lp_policy = ctx.accounts.token_metadata.lp_policy;
        let lp_creator_key = ctx.accounts.creator.key();
        let lp_token_program_ai = ctx.accounts.token_program.to_account_info();
        let lp_mint_ai = ctx.accounts.raydium_lp_mint.to_account_info();
        let lp_user_token_ai = ctx.accounts.raydium_user_lp_token.to_account_info();
        let lp_authority_ai = ctx.accounts.raydium_migration_authority.to_account_info();
        let creator_lp_ata_opt = ctx.remaining_accounts.first().cloned();
        match lp_policy {
            1 => {
                // Burn: destroy LP tokens immediately
                token::burn(
                    CpiContext::new_with_signer(
                        lp_token_program_ai,
                        Burn {
                            mint: lp_mint_ai,
                            from: lp_user_token_ai,
                            authority: lp_authority_ai,
                        },
                        signer,
                    ),
                    minted_lp,
                )?;
            }
            2 => {
                // ToCreator: transfer LP to creator's LP token account (remaining_accounts[0])
                require!(creator_lp_ata_opt.is_some(), HumbleV2Error::LpPolicyAccountMissing);
                let creator_lp_ata_ai = creator_lp_ata_opt.unwrap();
                let lp_ta = unpack_spl_token_account(&creator_lp_ata_ai)?;
                require_keys_eq!(lp_ta.owner, lp_creator_key, HumbleV2Error::InvalidTokenAccountOwner);
                token::transfer(
                    CpiContext::new_with_signer(
                        lp_token_program_ai,
                        Transfer {
                            from: lp_user_token_ai,
                            to: creator_lp_ata_ai,
                            authority: lp_authority_ai,
                        },
                        signer,
                    ),
                    minted_lp,
                )?;
            }
            _ => {} // Policy 0 (Lock): LP stays in raydium_user_lp_token for lock_lp_tokens_v2
        }

        let meta = &mut ctx.accounts.token_metadata;
        meta.raydium_pool = ctx.accounts.raydium_pool_state.key();
        // #1-c: mark migrated so this instruction cannot be called a second time
        meta.is_migrated = true;
        meta.migration_trigger = ctx.accounts.creator.key();
        meta.migrated_at = now;
        meta.curve_sol_reserve_lamports = ctx.accounts.curve_treasury_sol.current_sol_lamports;
        meta.curve_token_reserve_amount = ctx
            .accounts
            .curve_pool_vault
            .amount
            .checked_sub(init_token_amount)
            .unwrap_or(ctx.accounts.curve_pool_vault.amount);
        meta.trust_score = meta.trust_score.saturating_add(8).min(100);
        refresh_dynamic_score(meta, now);

        let lp_lock = &mut ctx.accounts.lp_lock_vault;
        lp_lock.token_mint = meta.mint;
        lp_lock.lp_mint = ctx.accounts.raydium_lp_mint.key();
        if lp_policy == 0 {
            lp_lock.lp_amount = lp_lock
                .lp_amount
                .checked_add(minted_lp)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
        }

        emit!(InstantRaydiumPoolCreatedV2 {
            mint: meta.mint,
            creator: ctx.accounts.creator.key(),
            raydium_pool: ctx.accounts.raydium_pool_state.key(),
            lp_mint: ctx.accounts.raydium_lp_mint.key(),
            token_amount: init_token_amount,
            sol_lamports: init_sol_lamports,
            lp_amount: minted_lp,
            timestamp: now,
        });

        Ok(())
    }

    pub fn prepare_raydium_migration_v2(
        ctx: Context<MigrateToRaydiumV2>,
        payer_buffer_lamports: u64,
    ) -> Result<()> {
        let meta = &ctx.accounts.token_metadata;
        require!(!meta.is_migrated, HumbleV2Error::AlreadyMigrated);
        require!(
            ctx.accounts.curve_treasury_sol.current_sol_lamports
                >= meta.migration_threshold_lamports,
            HumbleV2Error::MigrationThresholdNotMet
        );
        validate_migration_token_accounts(
            ctx.accounts.raydium_migration_authority.key(),
            ctx.accounts.mint.key(),
            &ctx.accounts.migration_token_account,
            &ctx.accounts.migration_wsol_account,
        )?;

        let reward_lamports = meta.migration_reward_lamports;
        let total_non_pool_lamports = reward_lamports
            .checked_add(payer_buffer_lamports)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(
            ctx.accounts.curve_treasury_sol.current_sol_lamports > total_non_pool_lamports,
            HumbleV2Error::InsufficientCurveReserve
        );

        let token_amount = ctx.accounts.curve_pool_vault.amount;
        let sol_amount = ctx
            .accounts
            .curve_treasury_sol
            .current_sol_lamports
            .checked_sub(total_non_pool_lamports)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(token_amount > 0, HumbleV2Error::InsufficientVaultBalance);
        require!(sol_amount > 0, HumbleV2Error::InsufficientCurveReserve);

        // Do all CPI work before direct lamport movement. Calling another program after
        // manual lamport edits can trip Solana's instruction balance checks.
        move_curve_tokens_to_migration_account(
            &ctx.accounts.token_program,
            &ctx.accounts.token_metadata.to_account_info(),
            &ctx.accounts.curve_pool_vault.to_account_info(),
            &ctx.accounts.migration_token_account.to_account_info(),
            ctx.accounts.mint.key(),
            ctx.accounts.token_metadata.bump,
            token_amount,
        )?;
        if reward_lamports > 0 {
            debit_treasury_to_account(
                &mut ctx.accounts.curve_treasury_sol,
                &ctx.accounts.triggerer.to_account_info(),
                reward_lamports,
            )?;
        }
        debit_treasury_to_account(
            &mut ctx.accounts.curve_treasury_sol,
            &ctx.accounts.raydium_migration_authority.to_account_info(),
            payer_buffer_lamports,
        )?;
        debit_treasury_to_account(
            &mut ctx.accounts.curve_treasury_sol,
            &ctx.accounts.migration_wsol_account.to_account_info(),
            sol_amount,
        )?;

        let meta = &mut ctx.accounts.token_metadata;
        meta.migration_trigger = ctx.accounts.triggerer.key();
        meta.curve_sol_reserve_lamports = ctx.accounts.curve_treasury_sol.current_sol_lamports;
        meta.curve_token_reserve_amount = 0;
        Ok(())
    }

    pub fn migrate_to_raydium_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, MigrateToRaydiumV2<'info>>,
        raydium_pool: Pubkey,
        lp_amount: u64,
        _payer_buffer_lamports: u64,
        open_time: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &ctx.accounts.token_metadata;
        require!(!meta.is_migrated, HumbleV2Error::AlreadyMigrated);
        require!(lp_amount > 0, HumbleV2Error::InvalidLpAmount);
        validate_raydium_cpmm_common(
            &ctx.accounts.raydium_program,
            &ctx.accounts.raydium_authority,
            &ctx.accounts.raydium_create_pool_fee,
            &ctx.accounts.token_program_2022,
            &ctx.accounts.associated_token_program,
            &ctx.accounts.wsol_mint,
        )?;
        validate_migration_token_accounts(
            ctx.accounts.raydium_migration_authority.key(),
            ctx.accounts.mint.key(),
            &ctx.accounts.migration_token_account,
            &ctx.accounts.migration_wsol_account,
        )?;
        if raydium_pool != Pubkey::default() {
            require_keys_eq!(
                raydium_pool,
                ctx.accounts.raydium_pool_state.key(),
                HumbleV2Error::InvalidRaydiumPool
            );
        }

        let token_amount = token_account_amount(&ctx.accounts.migration_token_account)?;
        let wsol_rent =
            Rent::get()?.minimum_balance(anchor_spl::token::spl_token::state::Account::LEN);
        let prepared_wsol_lamports = ctx
            .accounts
            .migration_wsol_account
            .to_account_info()
            .lamports()
            .checked_sub(wsol_rent)
            .ok_or(error!(HumbleV2Error::MigrationNotPrepared))?;
        require!(token_amount > 0, HumbleV2Error::MigrationNotPrepared);
        require!(
            prepared_wsol_lamports > 0,
            HumbleV2Error::MigrationNotPrepared
        );

        token::sync_native(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SyncNative {
                account: ctx.accounts.migration_wsol_account.to_account_info(),
            },
        ))?;
        let sol_amount = token_account_amount(&ctx.accounts.migration_wsol_account)?;
        require!(sol_amount > 0, HumbleV2Error::MigrationNotPrepared);

        let migration_bump = [ctx.bumps.raydium_migration_authority];
        let mint_key = ctx.accounts.mint.key();
        let migration_seeds: &[&[u8]] = &[
            b"raydium_migration_authority_v2",
            mint_key.as_ref(),
            &migration_bump,
        ];
        let signer = &[migration_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.migration_token_account.to_account_info(),
                    to: ctx.accounts.triggerer_token_account.to_account_info(),
                    authority: ctx.accounts.raydium_migration_authority.to_account_info(),
                },
                signer,
            ),
            token_amount,
        )?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.migration_wsol_account.to_account_info(),
                    to: ctx.accounts.triggerer_wsol_account.to_account_info(),
                    authority: ctx.accounts.raydium_migration_authority.to_account_info(),
                },
                signer,
            ),
            sol_amount,
        )?;

        let payer_refund_lamports = ctx.accounts.raydium_migration_authority.lamports();
        if payer_refund_lamports > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.raydium_migration_authority.to_account_info(),
                        to: ctx.accounts.triggerer.to_account_info(),
                    },
                    signer,
                ),
                payer_refund_lamports,
            )?;
        }

        let lp_before = token_account_amount_if_initialized(&ctx.accounts.raydium_user_lp_token)?;
        let raydium_signer: &[&[&[u8]]] = &[];

        if meta.raydium_pool == Pubkey::default() {
            invoke_raydium_cpmm_initialize(
                RaydiumCpmmInitializeCpi {
                    raydium_program: ctx.accounts.raydium_program.to_account_info(),
                    creator: ctx.accounts.triggerer.to_account_info(),
                    amm_config: ctx.accounts.raydium_amm_config.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.raydium_pool_state.to_account_info(),
                    token_mint: ctx.accounts.mint.to_account_info(),
                    wsol_mint: ctx.accounts.wsol_mint.to_account_info(),
                    lp_mint: ctx.accounts.raydium_lp_mint.to_account_info(),
                    creator_token: ctx.accounts.triggerer_token_account.to_account_info(),
                    creator_wsol: ctx.accounts.triggerer_wsol_account.to_account_info(),
                    creator_lp_token: ctx.accounts.raydium_user_lp_token.to_account_info(),
                    token_0_vault: ctx.accounts.raydium_token_0_vault.to_account_info(),
                    token_1_vault: ctx.accounts.raydium_token_1_vault.to_account_info(),
                    create_pool_fee: ctx.accounts.raydium_create_pool_fee.to_account_info(),
                    observation_state: ctx.accounts.raydium_observation_state.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    associated_token_program: ctx
                        .accounts
                        .associated_token_program
                        .to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                token_amount,
                sol_amount,
                open_time,
                raydium_signer,
            )?;
        } else {
            require_keys_eq!(
                meta.raydium_pool,
                ctx.accounts.raydium_pool_state.key(),
                HumbleV2Error::InvalidRaydiumPool
            );
            invoke_raydium_cpmm_deposit(
                RaydiumCpmmDepositCpi {
                    raydium_program: ctx.accounts.raydium_program.to_account_info(),
                    owner: ctx.accounts.triggerer.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.raydium_pool_state.to_account_info(),
                    owner_lp_token: ctx.accounts.raydium_user_lp_token.to_account_info(),
                    token_account: ctx.accounts.triggerer_token_account.to_account_info(),
                    wsol_account: ctx.accounts.triggerer_wsol_account.to_account_info(),
                    token_0_vault: ctx.accounts.raydium_token_0_vault.to_account_info(),
                    token_1_vault: ctx.accounts.raydium_token_1_vault.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    token_2022_program: ctx.accounts.token_program_2022.to_account_info(),
                    token_mint: ctx.accounts.mint.to_account_info(),
                    wsol_mint: ctx.accounts.wsol_mint.to_account_info(),
                    lp_mint: ctx.accounts.raydium_lp_mint.to_account_info(),
                },
                lp_amount,
                token_amount,
                sol_amount,
                raydium_signer,
            )?;
        }

        let lp_after = token_account_amount(&ctx.accounts.raydium_user_lp_token)?;
        let minted_lp = lp_after
            .checked_sub(lp_before)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        require!(minted_lp > 0, HumbleV2Error::InvalidLpAmount);

        let lp_policy = ctx.accounts.token_metadata.lp_policy;
        let meta_creator = ctx.accounts.token_metadata.creator;
        let lp_token_program_ai = ctx.accounts.token_program.to_account_info();
        let lp_mint_ai = ctx.accounts.raydium_lp_mint.to_account_info();
        let lp_user_token_ai = ctx.accounts.raydium_user_lp_token.to_account_info();
        let lp_authority_ai = ctx.accounts.raydium_migration_authority.to_account_info();
        let creator_lp_ata_opt = ctx.remaining_accounts.first().cloned();
        match lp_policy {
            1 => {
                // Burn: destroy LP tokens immediately
                token::burn(
                    CpiContext::new_with_signer(
                        lp_token_program_ai,
                        Burn {
                            mint: lp_mint_ai,
                            from: lp_user_token_ai,
                            authority: lp_authority_ai,
                        },
                        signer,
                    ),
                    minted_lp,
                )?;
            }
            2 => {
                // ToCreator: transfer LP to creator's LP token account (remaining_accounts[0])
                require!(creator_lp_ata_opt.is_some(), HumbleV2Error::LpPolicyAccountMissing);
                let creator_lp_ata_ai = creator_lp_ata_opt.unwrap();
                let lp_ta = unpack_spl_token_account(&creator_lp_ata_ai)?;
                require_keys_eq!(lp_ta.owner, meta_creator, HumbleV2Error::InvalidTokenAccountOwner);
                token::transfer(
                    CpiContext::new_with_signer(
                        lp_token_program_ai,
                        Transfer {
                            from: lp_user_token_ai,
                            to: creator_lp_ata_ai,
                            authority: lp_authority_ai,
                        },
                        signer,
                    ),
                    minted_lp,
                )?;
            }
            _ => {
                // Policy 0 (Lock): init vault and transfer LP into locked PDA vault
                init_token_vault_if_needed(
                    &ctx.accounts.triggerer.to_account_info(),
                    &ctx.accounts.raydium_lp_vault.to_account_info(),
                    &ctx.accounts.raydium_lp_mint.to_account_info(),
                    &ctx.accounts.raydium_migration_authority.to_account_info(),
                    &ctx.accounts.token_program,
                    &ctx.accounts.system_program,
                    ctx.accounts.mint.key(),
                    ctx.bumps.raydium_lp_vault,
                )?;
                token::transfer(
                    CpiContext::new_with_signer(
                        lp_token_program_ai,
                        Transfer {
                            from: lp_user_token_ai,
                            to: ctx.accounts.raydium_lp_vault.to_account_info(),
                            authority: lp_authority_ai,
                        },
                        signer,
                    ),
                    minted_lp,
                )?;
            }
        }

        let meta = &mut ctx.accounts.token_metadata;
        meta.is_migrated = true;
        meta.raydium_pool = ctx.accounts.raydium_pool_state.key();
        if meta.migration_trigger == Pubkey::default() {
            meta.migration_trigger = ctx.accounts.triggerer.key();
        }
        meta.migrated_at = now;
        meta.curve_sol_reserve_lamports = ctx.accounts.curve_treasury_sol.current_sol_lamports;
        meta.curve_token_reserve_amount = 0;
        meta.trust_score = meta.trust_score.saturating_add(8).min(100);
        refresh_dynamic_score(meta, now);

        let lp_lock = &mut ctx.accounts.lp_lock_vault;
        lp_lock.token_mint = meta.mint;
        lp_lock.lp_mint = ctx.accounts.raydium_lp_mint.key();
        if lp_policy == 0 {
            lp_lock.lp_amount = lp_lock
                .lp_amount
                .checked_add(minted_lp)
                .ok_or(error!(HumbleV2Error::MathOverflow))?;
        }

        emit!(MigratedToRaydiumV2 {
            mint: meta.mint,
            raydium_pool: ctx.accounts.raydium_pool_state.key(),
            triggerer: ctx.accounts.triggerer.key(),
            reward_lamports: 0,
            remaining_curve_tokens: 0,
            remaining_curve_sol_lamports: ctx.accounts.curve_treasury_sol.current_sol_lamports,
            lp_amount: minted_lp,
            timestamp: now,
        });

        Ok(())
    }

    pub fn submit_vote_v2(
        ctx: Context<SubmitVoteV2>,
        is_positive: bool,
        complaint_category: u8,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        let vote = &mut ctx.accounts.vote_record;

        let min_threshold = (meta.mint_supply_after_burn / 100_000).max(1);
        require!(
            ctx.accounts.voter_token_account.amount >= min_threshold,
            HumbleV2Error::InsufficientBalanceToVote
        );

        vote.voter = ctx.accounts.voter.key();
        vote.mint = meta.mint;
        vote.is_positive = is_positive;
        vote.complaint_category = complaint_category;
        vote.timestamp = now;
        vote.bump = ctx.bumps.vote_record;

        if is_positive {
            meta.positive_votes = meta.positive_votes.saturating_add(1);
        } else {
            meta.negative_votes = meta.negative_votes.saturating_add(1);
        }
        if complaint_category > 0 {
            meta.complaints_count = meta.complaints_count.saturating_add(1);
        }
        if meta.complaints_count >= 5 {
            meta.is_flagged = true;
        }

        refresh_dynamic_score(meta, now);
        if meta.complaints_count >= 20 && meta.trust_score < 30 {
            meta.is_frozen = true;
            emit!(TokenFrozenV2 {
                mint: meta.mint,
                complaints_count: meta.complaints_count,
                trust_score: meta.trust_score,
                timestamp: now,
            });
        }

        emit!(VoteSubmittedV2 {
            mint: meta.mint,
            voter: ctx.accounts.voter.key(),
            is_positive,
            complaint_category,
            timestamp: now,
        });

        Ok(())
    }

    pub fn record_trade_v2(
        ctx: Context<RecordTradeV2>,
        buyer: Pubkey,
        seller: Pubkey,
        amount: u64,
        buy_time: i64,
        suspected_wash: bool,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        let trade = &mut ctx.accounts.trade_record;

        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            meta.metrics_authority,
            HumbleV2Error::Unauthorized
        );
        require!(!meta.is_frozen, HumbleV2Error::TokenFrozen);
        require!(
            now >= meta.trading_unlock_time,
            HumbleV2Error::TradingNotStarted
        );
        require!(amount > 0, HumbleV2Error::InvalidAmount);
        require!(buy_time > 0, HumbleV2Error::InvalidTradeTime);
        require!(now >= buy_time, HumbleV2Error::InvalidTradeTime);
        require!(buyer != seller, HumbleV2Error::SelfTrade);

        trade.buyer = buyer;
        trade.seller = seller;
        trade.mint = meta.mint;
        trade.amount = amount;
        trade.buy_time = buy_time;
        trade.sell_time = now;
        trade.is_valid_volume = now - buy_time >= seconds_per_day();
        trade.suspected_wash = suspected_wash;
        trade.bump = ctx.bumps.trade_record;

        meta.trading_volume = meta
            .trading_volume
            .checked_add(amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        refresh_dynamic_score(meta, now);

        Ok(())
    }

    pub fn update_metrics_v2(
        ctx: Context<UpdateMetricsV2>,
        new_verified_volume: u64,
        new_holder_count: u32,
        is_verified: bool,
        no_activity_flag: bool,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        require!(!meta.is_frozen, HumbleV2Error::TokenFrozen);
        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            meta.metrics_authority,
            HumbleV2Error::Unauthorized
        );

        let old_score = meta.trust_score;
        meta.verified_volume = new_verified_volume;
        meta.holder_count = new_holder_count;
        meta.is_verified = is_verified;
        meta.no_activity_flag = no_activity_flag;
        refresh_dynamic_score(meta, now);

        emit!(TrustScoreUpdatedV2 {
            mint: meta.mint,
            old_score,
            new_score: meta.trust_score,
            timestamp: now,
        });

        Ok(())
    }

    pub fn execute_airdrop_epoch_v2(ctx: Context<ExecuteAirdropEpochV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (metrics_authority, min_score_this_month, last_airdrop_time, airdrop_amount, bump) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.metrics_authority,
                meta.min_score_this_month,
                meta.last_airdrop_time,
                meta.airdrop_amount,
                meta.bump,
            )
        };

        require!(
            !ctx.accounts.token_metadata.is_frozen,
            HumbleV2Error::TokenFrozen
        );
        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            metrics_authority,
            HumbleV2Error::Unauthorized
        );
        require!(airdrop_amount > 0, HumbleV2Error::AirdropDisabled);
        require!(
            min_score_this_month >= 56,
            HumbleV2Error::AirdropNotEligible
        );
        require!(
            last_airdrop_time == 0 || now - last_airdrop_time >= seconds_per_month(),
            HumbleV2Error::AirdropTooEarly
        );

        let pool_amount = airdrop_amount
            .checked_div(12)
            .unwrap_or(0)
            .max(1)
            .min(ctx.accounts.airdrop_vault.amount);
        require!(pool_amount > 0, HumbleV2Error::InsufficientVaultBalance);

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.airdrop_vault.to_account_info(),
                    to: ctx.accounts.circulation_vault.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            pool_amount,
        )?;

        let meta = &mut ctx.accounts.token_metadata;
        meta.airdrop_amount = meta
            .airdrop_amount
            .checked_sub(pool_amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.circulation_amount = meta
            .circulation_amount
            .checked_add(pool_amount)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        meta.last_airdrop_time = now;
        meta.total_airdrops_executed = meta.total_airdrops_executed.saturating_add(1);
        meta.min_score_this_month = meta.trust_score;
        refresh_dynamic_score(meta, now);

        emit!(AirdropEpochExecutedV2 {
            mint: meta.mint,
            pool_amount,
            epoch_number: meta.total_airdrops_executed,
            timestamp: now,
        });

        Ok(())
    }

    pub fn verify_creator_v2(ctx: Context<VerifyCreatorV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        require!(!meta.is_frozen, HumbleV2Error::TokenFrozen);
        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            meta.metrics_authority,
            HumbleV2Error::Unauthorized
        );

        let old_score = meta.trust_score;
        meta.is_verified = true;
        refresh_dynamic_score(meta, now);

        emit!(CreatorVerifiedV2 {
            mint: meta.mint,
            old_score,
            new_score: meta.trust_score,
            timestamp: now,
        });

        Ok(())
    }

    pub fn set_metrics_authority_v2(
        ctx: Context<SetMetricsAuthorityV2>,
        new_metrics_authority: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            HUMBLETRUST_ADMIN,
            HumbleV2Error::AdminRequired
        );
        ctx.accounts.token_metadata.metrics_authority = new_metrics_authority;
        Ok(())
    }

    pub fn init_creator_reputation_v2(ctx: Context<InitCreatorReputationV2>) -> Result<()> {
        let rep = &mut ctx.accounts.creator_reputation;
        rep.creator = ctx.accounts.creator.key();
        rep.total_launches = 0;
        rep.trust_score_sum = 0;
        rep.successful_unlocks = 0;
        rep.complaints_total = 0;
        rep.score_bonus = 0;
        rep.bump = ctx.bumps.creator_reputation;
        Ok(())
    }

    pub fn record_reputation_event_v2(
        ctx: Context<RecordReputationEventV2>,
        event_type: u8,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            ctx.accounts.token_metadata.metrics_authority,
            HumbleV2Error::Unauthorized
        );
        require!(matches!(event_type, 1..=4), HumbleV2Error::InvalidAction);

        let rep = &mut ctx.accounts.creator_reputation;
        require_keys_eq!(
            rep.creator,
            ctx.accounts.token_metadata.creator,
            HumbleV2Error::Unauthorized
        );

        match event_type {
            1 => {
                rep.total_launches = rep.total_launches.saturating_add(1);
                rep.trust_score_sum = rep
                    .trust_score_sum
                    .saturating_add(ctx.accounts.token_metadata.trust_score as u32);
            }
            2 => rep.successful_unlocks = rep.successful_unlocks.saturating_add(1),
            3 => rep.complaints_total = rep.complaints_total.saturating_add(1),
            4 => rep.score_bonus = 5,
            _ => return err!(HumbleV2Error::InvalidAction),
        }
        Ok(())
    }

    pub fn lock_lp_tokens_v2(
        ctx: Context<LockLpTokensV2>,
        lp_amount: u64,
        lock_days: u16,
    ) -> Result<()> {
        require!(lp_amount > 0, HumbleV2Error::InvalidAmount);
        let is_test = ctx.accounts.token_metadata.is_test;
        require!(
            if is_test { lock_days >= 1 } else { lock_days >= 30 },
            HumbleV2Error::InvalidLockDays
        );
        require!(
            ctx.accounts.creator_lp_account.amount >= lp_amount,
            HumbleV2Error::InsufficientVaultBalance
        );
        require_keys_eq!(
            ctx.accounts.token_metadata.creator,
            ctx.accounts.creator.key(),
            HumbleV2Error::Unauthorized
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_lp_account.to_account_info(),
                    to: ctx.accounts.lp_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            lp_amount,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let lp_lock = &mut ctx.accounts.lp_lock;
        lp_lock.token_mint = ctx.accounts.token_mint.key();
        lp_lock.lp_mint = ctx.accounts.lp_mint.key();
        lp_lock.creator = ctx.accounts.creator.key();
        lp_lock.is_premium = ctx.accounts.token_metadata.is_premium;
        lp_lock.lp_amount = lp_amount;
        lp_lock.lock_days = lock_days;
        lp_lock.unlock_time = now + (lock_days as i64 * seconds_per_day());
        lp_lock.locked_at = now;
        lp_lock.last_claim_time = 0;
        lp_lock.total_fees_claimed_lamports = 0;
        lp_lock.bump = ctx.bumps.lp_lock;
        lp_lock.lp_vault_bump = ctx.bumps.lp_vault;
        lp_lock.lp_fee_pool_bump = ctx.bumps.lp_fee_pool;

        let lp_bonus: u8 = if lock_days >= 180 {
            10
        } else if lock_days >= 90 {
            5
        } else {
            0
        };
        if lp_bonus > 0 {
            let meta = &mut ctx.accounts.token_metadata;
            meta.trust_score = meta.trust_score.saturating_add(lp_bonus).min(100);
            refresh_dynamic_score(meta, now);
        }

        let pool = &mut ctx.accounts.lp_fee_pool;
        pool.token_mint = ctx.accounts.token_mint.key();
        pool.bump = ctx.bumps.lp_fee_pool;

        emit!(LpLockedV2 {
            token_mint: ctx.accounts.token_mint.key(),
            lp_mint: ctx.accounts.lp_mint.key(),
            creator: ctx.accounts.creator.key(),
            lp_amount,
            lock_days,
            unlock_time: lp_lock.unlock_time,
            timestamp: now,
        });

        Ok(())
    }

    pub fn claim_lp_fees_v2(ctx: Context<ClaimLpFeesV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let lp_lock = &mut ctx.accounts.lp_lock;
        require_keys_eq!(
            lp_lock.creator,
            ctx.accounts.creator.key(),
            HumbleV2Error::Unauthorized
        );
        require!(
            lp_lock.last_claim_time == 0 || now - lp_lock.last_claim_time >= seconds_per_month(),
            HumbleV2Error::AirdropTooEarly
        );

        let pool_lamports = ctx.accounts.lp_fee_pool.to_account_info().lamports();
        let pool_data_len = ctx.accounts.lp_fee_pool.to_account_info().data_len();
        let rent_exempt = Rent::get()?.minimum_balance(pool_data_len);
        let claimable = pool_lamports.saturating_sub(rent_exempt);
        require!(claimable > 0, HumbleV2Error::InsufficientVaultBalance);

        let (creator_bps, treasury_bps) = if lp_lock.is_premium {
            (LP_FEE_CREATOR_PREMIUM_BPS, LP_FEE_TREASURY_PREMIUM_BPS)
        } else {
            (LP_FEE_CREATOR_STANDARD_BPS, LP_FEE_TREASURY_STANDARD_BPS)
        };
        let creator_share = claimable
            .checked_mul(creator_bps)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        let treasury_share = claimable
            .checked_mul(treasury_bps)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        let rewards_share = claimable
            .checked_sub(creator_share)
            .and_then(|v| v.checked_sub(treasury_share))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        **ctx
            .accounts
            .lp_fee_pool
            .to_account_info()
            .try_borrow_mut_lamports()? -= claimable;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += creator_share;
        **ctx.accounts.fee_wallet.try_borrow_mut_lamports()? += treasury_share;
        **ctx.accounts.rewards_sol_wallet.try_borrow_mut_lamports()? += rewards_share;

        lp_lock.last_claim_time = now;
        lp_lock.total_fees_claimed_lamports = lp_lock
            .total_fees_claimed_lamports
            .checked_add(claimable)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;

        emit!(LpFeesClaimedV2 {
            token_mint: lp_lock.token_mint,
            creator_share,
            treasury_share,
            rewards_share,
            timestamp: now,
        });

        Ok(())
    }

    pub fn unlock_lp_tokens_v2(ctx: Context<UnlockLpTokensV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require_keys_eq!(
            ctx.accounts.lp_lock.creator,
            ctx.accounts.creator.key(),
            HumbleV2Error::Unauthorized
        );
        require!(
            now >= ctx.accounts.lp_lock.unlock_time,
            HumbleV2Error::TokensStillLocked
        );
        require!(
            ctx.accounts.lp_lock.lp_amount > 0,
            HumbleV2Error::InsufficientVaultBalance
        );

        let amount = ctx.accounts.lp_lock.lp_amount;
        let token_mint_key = ctx.accounts.lp_lock.token_mint;
        // lp_vault's token authority was set to lp_lock PDA during lock_lp_tokens_v2
        let bump = ctx.accounts.lp_lock.bump;
        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"lp_lock_v2", token_mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.lp_vault.to_account_info(),
                    to: ctx.accounts.creator_lp_account.to_account_info(),
                    authority: ctx.accounts.lp_lock.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.lp_lock.lp_amount = 0;

        Ok(())
    }

    pub fn init_global_state_v2(ctx: Context<InitGlobalStateV2>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            HUMBLETRUST_ADMIN,
            HumbleV2Error::Unauthorized
        );
        let global = &mut ctx.accounts.global_state;
        global.certificate_counter = 0;
        global.authority = ctx.accounts.authority.key();
        global.standard_fee_lamports = LAUNCH_FEE_STANDARD;
        global.premium_fee_lamports = LAUNCH_FEE_PREMIUM;
        global.upgrade_authority = ctx.accounts.authority.key();
        global.is_launches_paused = false;
        global.bump = ctx.bumps.global_state;
        Ok(())
    }

    pub fn update_fee_parameters_v2(
        ctx: Context<Phase5AuthorityV2>,
        standard_fee_lamports: u64,
        premium_fee_lamports: u64,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            global.authority,
            HumbleV2Error::Unauthorized
        );
        require!(standard_fee_lamports > 0, HumbleV2Error::InvalidAmount);
        require!(
            premium_fee_lamports > standard_fee_lamports,
            HumbleV2Error::InvalidFeeParameters
        );
        global.standard_fee_lamports = standard_fee_lamports;
        global.premium_fee_lamports = premium_fee_lamports;
        emit!(FeeParametersUpdatedV2 {
            standard_fee_lamports,
            premium_fee_lamports,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn set_upgrade_authority_v2(
        ctx: Context<Phase5AuthorityV2>,
        new_upgrade_authority: Pubkey,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            global.authority,
            HumbleV2Error::Unauthorized
        );
        global.upgrade_authority = new_upgrade_authority;
        Ok(())
    }

    pub fn toggle_launches_pause_v2(ctx: Context<Phase5AuthorityV2>) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            global.authority,
            HumbleV2Error::Unauthorized
        );
        global.is_launches_paused = !global.is_launches_paused;
        emit!(LaunchesPauseToggledV2 {
            is_paused: global.is_launches_paused,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn mint_launch_certificate_v2(
        ctx: Context<MintLaunchCertificateV2>,
        certificate_nft_mint: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.token_metadata.creator,
            ctx.accounts.creator.key(),
            HumbleV2Error::Unauthorized
        );
        let global = &mut ctx.accounts.global_state;
        global.certificate_counter = global.certificate_counter.saturating_add(1);
        let now = Clock::get()?.unix_timestamp;

        let cert = &mut ctx.accounts.launch_certificate;
        cert.creator = ctx.accounts.creator.key();
        cert.token_mint = ctx.accounts.mint.key();
        cert.certificate_nft_mint = certificate_nft_mint;
        cert.lock_percent = ctx.accounts.token_metadata.lock_percent;
        cert.lock_days = ctx.accounts.token_metadata.lock_days;
        cert.initial_trust_score = ctx.accounts.token_metadata.trust_score;
        cert.is_premium = ctx.accounts.token_metadata.is_premium;
        cert.airdrop_percent = ctx.accounts.token_metadata.airdrop_percent;
        cert.burn_option = ctx.accounts.token_metadata.burn_option;
        cert.issued_at = now;
        cert.serial_number = global.certificate_counter;
        cert.bump = ctx.bumps.launch_certificate;

        emit!(LaunchCertificateIssuedV2 {
            serial_number: cert.serial_number,
            token_mint: cert.token_mint,
            creator: cert.creator,
            certificate_nft_mint,
            initial_trust_score: cert.initial_trust_score,
            timestamp: now,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTokenWithLockV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"global_state_v2"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalStateV2>,

    /// CHECK: verified against FEE_WALLET
    #[account(mut)]
    pub fee_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + TokenMetadataV2::INIT_SPACE,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump
    )]
    pub token_metadata: Box<Account<'info, TokenMetadataV2>>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = token_metadata
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"locked_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub locked_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"creator_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub creator_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub curve_pool_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub circulation_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"airdrop_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub airdrop_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        space = 8 + CurveTreasurySol::INIT_SPACE,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump
    )]
    pub curve_treasury_sol: Box<Account<'info, CurveTreasurySol>>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpLockVault::INIT_SPACE,
        seeds = [b"lp_lock_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub lp_lock_vault: Box<Account<'info, LpLockVault>>,

    /// CHECK: verified as the Metaplex metadata PDA for this mint
    #[account(mut)]
    pub metaplex_metadata: UncheckedAccount<'info>,

    /// CHECK: verified against the canonical Metaplex Token Metadata program id
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnlockLockedTokensV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"locked_vault_v2", mint.key().as_ref()],
        bump = token_metadata.locked_vault_bump
    )]
    pub locked_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UseVestingTrancheV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_vault_v2", mint.key().as_ref()],
        bump = token_metadata.creator_vault_bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_receive_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddToCirculationV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_vault_v2", mint.key().as_ref()],
        bump = token_metadata.creator_vault_bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyV2<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Box<Account<'info, TokenMetadataV2>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump = token_metadata.curve_pool_vault_bump
    )]
    pub curve_pool_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump = token_metadata.curve_treasury_sol_bump
    )]
    pub curve_treasury_sol: Box<Account<'info, CurveTreasurySol>>,

    #[account(
        mut,
        constraint = buyer_token_account.owner == buyer.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = buyer_token_account.mint == mint.key() @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: verified against FEE_WALLET
    #[account(mut)]
    pub fee_wallet: UncheckedAccount<'info>,

    /// CHECK: creator fee wallet is verified against metadata.creator
    #[account(mut, constraint = creator_fee_wallet.key() == token_metadata.creator @ HumbleV2Error::InvalidCreatorFeeWallet)]
    pub creator_fee_wallet: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellV2<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Box<Account<'info, TokenMetadataV2>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump = token_metadata.curve_pool_vault_bump
    )]
    pub curve_pool_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump = token_metadata.curve_treasury_sol_bump
    )]
    pub curve_treasury_sol: Box<Account<'info, CurveTreasurySol>>,

    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = seller_token_account.mint == mint.key() @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: verified against FEE_WALLET
    #[account(mut)]
    pub fee_wallet: UncheckedAccount<'info>,

    /// CHECK: creator fee wallet is verified against metadata.creator
    #[account(mut, constraint = creator_fee_wallet.key() == token_metadata.creator @ HumbleV2Error::InvalidCreatorFeeWallet)]
    pub creator_fee_wallet: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PriceV2<'info> {
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump = token_metadata.curve_pool_vault_bump
    )]
    pub curve_pool_vault: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump = token_metadata.curve_treasury_sol_bump
    )]
    pub curve_treasury_sol: Account<'info, CurveTreasurySol>,

    #[account(
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,
}

#[derive(Accounts)]
pub struct CreateInstantRaydiumPoolV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump = token_metadata.curve_pool_vault_bump
    )]
    pub curve_pool_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump = token_metadata.curve_treasury_sol_bump
    )]
    pub curve_treasury_sol: Account<'info, CurveTreasurySol>,

    #[account(
        mut,
        seeds = [b"lp_lock_vault_v2", mint.key().as_ref()],
        bump = token_metadata.lp_lock_vault_bump
    )]
    pub lp_lock_vault: Box<Account<'info, LpLockVault>>,

    /// CHECK: PDA signer used only as Raydium CPMM creator/LP custodian.
    #[account(
        mut,
        seeds = [b"raydium_migration_authority_v2", mint.key().as_ref()],
        bump
    )]
    pub raydium_migration_authority: UncheckedAccount<'info>,

    /// CHECK: SPL token account owned by raydium_migration_authority, validated manually.
    #[account(mut)]
    pub migration_token_account: UncheckedAccount<'info>,

    /// CHECK: WSOL token account owned by raydium_migration_authority, validated manually.
    #[account(mut)]
    pub migration_wsol_account: UncheckedAccount<'info>,

    /// CHECK: verified against native SOL mint.
    pub wsol_mint: UncheckedAccount<'info>,

    /// CHECK: verified against Raydium CPMM devnet/mainnet config.
    pub raydium_program: UncheckedAccount<'info>,
    /// CHECK: Raydium config account is validated by Raydium CPI.
    pub raydium_amm_config: UncheckedAccount<'info>,
    /// CHECK: verified against Raydium CPMM authority.
    pub raydium_authority: UncheckedAccount<'info>,
    /// CHECK: Raydium pool state, initialized by Raydium CPI.
    #[account(mut)]
    pub raydium_pool_state: UncheckedAccount<'info>,
    /// CHECK: Raydium LP mint, initialized by Raydium CPI.
    #[account(mut)]
    pub raydium_lp_mint: UncheckedAccount<'info>,
    /// CHECK: Raydium creates this ATA for the migration PDA and mints LP here.
    #[account(mut)]
    pub raydium_user_lp_token: UncheckedAccount<'info>,
    /// CHECK: Raydium token 0 vault PDA.
    #[account(mut)]
    pub raydium_token_0_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium token 1 vault PDA.
    #[account(mut)]
    pub raydium_token_1_vault: UncheckedAccount<'info>,
    /// CHECK: verified against Raydium CPMM fee account.
    #[account(mut)]
    pub raydium_create_pool_fee: UncheckedAccount<'info>,
    /// CHECK: Raydium observation account.
    #[account(mut)]
    pub raydium_observation_state: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    /// CHECK: verified against canonical Token-2022 id for Raydium CPMM account set.
    pub token_program_2022: UncheckedAccount<'info>,
    /// CHECK: verified against canonical Associated Token Program id.
    pub associated_token_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MigrateToRaydiumV2<'info> {
    #[account(mut)]
    pub triggerer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Box<Account<'info, TokenMetadataV2>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump = token_metadata.curve_pool_vault_bump
    )]
    pub curve_pool_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump = token_metadata.curve_treasury_sol_bump
    )]
    pub curve_treasury_sol: Box<Account<'info, CurveTreasurySol>>,

    #[account(
        mut,
        seeds = [b"lp_lock_vault_v2", mint.key().as_ref()],
        bump = token_metadata.lp_lock_vault_bump
    )]
    pub lp_lock_vault: Box<Account<'info, LpLockVault>>,

    /// CHECK: PDA signer used only as Raydium CPMM creator/LP custodian.
    #[account(
        mut,
        seeds = [b"raydium_migration_authority_v2", mint.key().as_ref()],
        bump
    )]
    pub raydium_migration_authority: UncheckedAccount<'info>,

    /// CHECK: SPL token account owned by raydium_migration_authority, validated manually.
    #[account(mut)]
    pub migration_token_account: UncheckedAccount<'info>,

    /// CHECK: WSOL token account owned by raydium_migration_authority, validated manually.
    #[account(mut)]
    pub migration_wsol_account: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = triggerer_token_account.owner == triggerer.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = triggerer_token_account.mint == mint.key() @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub triggerer_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = triggerer_wsol_account.owner == triggerer.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = triggerer_wsol_account.mint == NATIVE_SOL_MINT @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub triggerer_wsol_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: verified against native SOL mint.
    pub wsol_mint: UncheckedAccount<'info>,

    /// CHECK: verified against Raydium CPMM devnet/mainnet config.
    pub raydium_program: UncheckedAccount<'info>,
    /// CHECK: Raydium config account is validated by Raydium CPI.
    pub raydium_amm_config: UncheckedAccount<'info>,
    /// CHECK: verified against Raydium CPMM authority.
    pub raydium_authority: UncheckedAccount<'info>,
    /// CHECK: Raydium pool state.
    #[account(mut)]
    pub raydium_pool_state: UncheckedAccount<'info>,
    /// CHECK: Raydium LP mint.
    #[account(mut)]
    pub raydium_lp_mint: UncheckedAccount<'info>,
    /// CHECK: Raydium mints/deposits LP into the migration PDA ATA.
    #[account(mut)]
    pub raydium_user_lp_token: UncheckedAccount<'info>,
    /// CHECK: Program custody vault for Raydium LP tokens, initialized after Raydium creates the LP mint.
    #[account(
        mut,
        seeds = [b"raydium_lp_custody_v2", mint.key().as_ref()],
        bump
    )]
    pub raydium_lp_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium token 0 vault PDA.
    #[account(mut)]
    pub raydium_token_0_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium token 1 vault PDA.
    #[account(mut)]
    pub raydium_token_1_vault: UncheckedAccount<'info>,
    /// CHECK: verified against Raydium CPMM fee account.
    #[account(mut)]
    pub raydium_create_pool_fee: UncheckedAccount<'info>,
    /// CHECK: Raydium observation account.
    #[account(mut)]
    pub raydium_observation_state: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    /// CHECK: verified against canonical Token-2022 id for Raydium CPMM account set.
    pub token_program_2022: UncheckedAccount<'info>,
    /// CHECK: verified against canonical Associated Token Program id.
    pub associated_token_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SubmitVoteV2<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,

    #[account(
        constraint = voter_token_account.owner == voter.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = voter_token_account.mint == mint.key() @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecordV2::INIT_SPACE,
        seeds = [b"vote_v2", mint.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecordV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(buyer: Pubkey, seller: Pubkey, amount: u64, buy_time: i64, suspected_wash: bool)]
pub struct RecordTradeV2<'info> {
    #[account(mut)]
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = metrics_authority,
        space = 8 + TradeRecordV2::INIT_SPACE,
        seeds = [b"trade_v2", mint.key().as_ref(), buyer.as_ref(), &buy_time.to_le_bytes()],
        bump
    )]
    pub trade_record: Account<'info, TradeRecordV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMetricsV2<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct ExecuteAirdropEpochV2<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"airdrop_vault_v2", mint.key().as_ref()],
        bump = token_metadata.airdrop_vault_bump
    )]
    pub airdrop_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct VerifyCreatorV2<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct SetMetricsAuthorityV2<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct InitCreatorReputationV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + CreatorReputationV2::INIT_SPACE,
        seeds = [b"creator_reputation_v2", creator.key().as_ref()],
        bump
    )]
    pub creator_reputation: Account<'info, CreatorReputationV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordReputationEventV2<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_reputation_v2", token_metadata.creator.as_ref()],
        bump = creator_reputation.bump
    )]
    pub creator_reputation: Account<'info, CreatorReputationV2>,
}

#[derive(Accounts)]
pub struct LockLpTokensV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata_v2", token_mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Box<Account<'info, TokenMetadataV2>>,

    pub token_mint: Box<Account<'info, Mint>>,
    pub lp_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = creator_lp_account.owner == creator.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = creator_lp_account.mint == lp_mint.key() @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub creator_lp_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpLockV2::INIT_SPACE,
        seeds = [b"lp_lock_v2", token_mint.key().as_ref()],
        bump
    )]
    pub lp_lock: Box<Account<'info, LpLockV2>>,

    #[account(
        init,
        payer = creator,
        token::mint = lp_mint,
        token::authority = lp_lock,
        seeds = [b"lp_vault_v2", token_mint.key().as_ref()],
        bump
    )]
    pub lp_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpFeePoolV2::INIT_SPACE,
        seeds = [b"lp_fee_pool_v2", token_mint.key().as_ref()],
        bump
    )]
    pub lp_fee_pool: Box<Account<'info, LpFeePoolV2>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimLpFeesV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lp_lock_v2", lp_lock.token_mint.as_ref()],
        bump = lp_lock.bump
    )]
    pub lp_lock: Account<'info, LpLockV2>,

    #[account(
        mut,
        seeds = [b"lp_fee_pool_v2", lp_lock.token_mint.as_ref()],
        bump = lp_lock.lp_fee_pool_bump
    )]
    pub lp_fee_pool: Account<'info, LpFeePoolV2>,

    /// CHECK: verified against FEE_WALLET
    #[account(mut, constraint = fee_wallet.key() == FEE_WALLET @ HumbleV2Error::InvalidFeeWallet)]
    pub fee_wallet: UncheckedAccount<'info>,

    /// CHECK: verified against FEE_WALLET (DAO rewards share)
    #[account(mut, constraint = rewards_sol_wallet.key() == FEE_WALLET @ HumbleV2Error::InvalidFeeWallet)]
    pub rewards_sol_wallet: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UnlockLpTokensV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lp_lock_v2", lp_lock.token_mint.as_ref()],
        bump = lp_lock.bump
    )]
    pub lp_lock: Account<'info, LpLockV2>,

    #[account(
        mut,
        seeds = [b"lp_vault_v2", lp_lock.token_mint.as_ref()],
        bump = lp_lock.lp_vault_bump
    )]
    pub lp_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_lp_account.owner == creator.key() @ HumbleV2Error::InvalidTokenAccountOwner,
        constraint = creator_lp_account.mint == lp_lock.lp_mint @ HumbleV2Error::InvalidMintForTokenAccount
    )]
    pub creator_lp_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitGlobalStateV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GlobalStateV2::INIT_SPACE,
        seeds = [b"global_state_v2"],
        bump
    )]
    pub global_state: Account<'info, GlobalStateV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Phase5AuthorityV2<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state_v2"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalStateV2>,
}

#[derive(Accounts)]
pub struct MintLaunchCertificateV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    #[account(
        mut,
        seeds = [b"global_state_v2"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalStateV2>,

    #[account(
        init,
        payer = creator,
        space = 8 + LaunchCertificateV2::INIT_SPACE,
        seeds = [b"launch_cert_v2", mint.key().as_ref()],
        bump
    )]
    pub launch_certificate: Account<'info, LaunchCertificateV2>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenMetadataV2 {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub metrics_authority: Pubkey,
    #[max_len(16)]
    pub name: String,
    #[max_len(5)]
    pub symbol: String,
    pub total_supply: u64,
    pub mint_supply_after_burn: u64,
    pub lock_percent: u8,
    pub creator_percent: u8,
    pub curve_liquidity_percent: u8,
    pub circulation_percent: u8,
    pub airdrop_percent: u8,
    pub locked_allocation_amount: u64,
    pub locked_amount_after_burn: u64,
    pub creator_allocation_amount: u64,
    pub curve_liquidity_amount: u64,
    pub circulation_amount: u64,
    pub airdrop_amount: u64,
    pub planned_burn_amount: u64,
    pub total_burned: u64,
    pub initial_sol_lamports: u64,
    pub migration_threshold_lamports: u64,
    pub migration_reward_lamports: u64,
    pub platform_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub unlock_time: i64,
    pub created_at: i64,
    pub lock_days: u16,
    pub burn_option: u8,
    pub trust_score: u8,
    pub score_lock_tenths: u16,
    pub score_creator_tenths: u16,
    pub score_curve_liquidity_tenths: u16,
    pub score_circulation_tenths: u16,
    pub score_airdrop_tenths: u16,
    pub score_burn_tenths: u16,
    pub raw_score_tenths: u16,
    pub trust_level: u8,
    pub min_score_this_month: u8,
    pub trading_volume: u64,
    pub verified_volume: u64,
    pub holder_count: u32,
    pub is_verified: bool,
    pub last_airdrop_time: i64,
    pub total_airdrops_executed: u32,
    pub vesting_t1_done: bool,
    pub vesting_t2_done: bool,
    pub vesting_t3_done: bool,
    pub vesting_t1_action: u8,
    pub vesting_t2_action: u8,
    pub vesting_t3_action: u8,
    pub creator_vesting_consumed: u64,
    pub positive_votes: u32,
    pub negative_votes: u32,
    pub complaints_count: u32,
    pub is_flagged: bool,
    pub is_frozen: bool,
    pub no_activity_flag: bool,
    pub rewards_multiplier_bps: u16,
    pub is_locked: bool,
    pub is_premium: bool,
    pub is_migrated: bool,
    pub creator_curve_buys: u64,
    pub curve_sol_reserve_lamports: u64,
    pub curve_token_reserve_amount: u64,
    pub last_curve_price_lamports_per_token: u64,
    pub raydium_pool: Pubkey,
    pub migration_trigger: Pubkey,
    pub migrated_at: i64,
    pub anti_bot_seconds: u16,
    pub trading_unlock_time: i64,
    pub curve_type: u8,
    pub lp_policy: u8,
    pub initial_price_lamports_per_token: u64,
    pub graduation_price_lamports_per_token: u64,
    pub bump: u8,
    pub locked_vault_bump: u8,
    pub creator_vault_bump: u8,
    pub curve_pool_vault_bump: u8,
    pub circulation_vault_bump: u8,
    pub airdrop_vault_bump: u8,
    pub curve_treasury_sol_bump: u8,
    pub lp_lock_vault_bump: u8,
    pub is_test: bool,
    #[max_len(200)]
    pub metadata_uri: String,
}

#[account]
#[derive(InitSpace)]
pub struct CurveTreasurySol {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub initial_sol_lamports: u64,
    pub current_sol_lamports: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpLockVault {
    pub token_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub lp_amount: u64,
    pub is_burn_on_migration: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TradeRecordV2 {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub buy_time: i64,
    pub sell_time: i64,
    pub is_valid_volume: bool,
    pub suspected_wash: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecordV2 {
    pub voter: Pubkey,
    pub mint: Pubkey,
    pub is_positive: bool,
    pub complaint_category: u8,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CreatorReputationV2 {
    pub creator: Pubkey,
    pub total_launches: u32,
    pub trust_score_sum: u32,
    pub successful_unlocks: u32,
    pub complaints_total: u32,
    pub score_bonus: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpLockV2 {
    pub token_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub creator: Pubkey,
    pub is_premium: bool,
    pub lp_amount: u64,
    pub lock_days: u16,
    pub unlock_time: i64,
    pub locked_at: i64,
    pub last_claim_time: i64,
    pub total_fees_claimed_lamports: u64,
    pub bump: u8,
    pub lp_vault_bump: u8,
    pub lp_fee_pool_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpFeePoolV2 {
    pub token_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalStateV2 {
    pub certificate_counter: u32,
    pub authority: Pubkey,
    pub standard_fee_lamports: u64,
    pub premium_fee_lamports: u64,
    pub upgrade_authority: Pubkey,
    pub is_launches_paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchCertificateV2 {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub certificate_nft_mint: Pubkey,
    pub lock_percent: u8,
    pub lock_days: u16,
    pub initial_trust_score: u8,
    pub is_premium: bool,
    pub airdrop_percent: u8,
    pub burn_option: u8,
    pub issued_at: i64,
    pub serial_number: u32,
    pub bump: u8,
}

#[derive(Clone, Copy)]
struct TrustScoreV2 {
    trust_score: u8,
    lock_tenths: u16,
    creator_tenths: u16,
    curve_liquidity_tenths: u16,
    circulation_tenths: u16,
    airdrop_tenths: u16,
    burn_tenths: u16,
    raw_tenths: u16,
}

#[event]
pub struct TokenCreatedV2 {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub curve_type: u8,
    pub lp_policy: u8,
    pub total_supply: u64,
    pub mint_supply_after_burn: u64,
    pub locked_allocation_amount: u64,
    pub planned_burn_amount: u64,
    pub curve_liquidity_amount: u64,
    pub circulation_amount: u64,
    pub airdrop_amount: u64,
    pub initial_sol_lamports: u64,
    pub trust_score: u8,
    pub trust_level: u8,
    pub timestamp: i64,
}

#[event]
pub struct LockedTokensUnlockedV2 {
    pub mint: Pubkey,
    pub burned_amount: u64,
    pub released_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VestingTrancheUsedV2 {
    pub mint: Pubkey,
    pub tranche: u8,
    pub action: u8,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CirculationAddedV2 {
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CurveBuyV2 {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_in_lamports: u64,
    pub platform_fee_lamports: u64,
    pub creator_fee_lamports: u64,
    pub tokens_out: u64,
    pub price_lamports_per_token: u64,
    pub timestamp: i64,
}

#[event]
pub struct CurveSellV2 {
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub tokens_in: u64,
    pub gross_sol_out_lamports: u64,
    pub platform_fee_lamports: u64,
    pub creator_fee_lamports: u64,
    pub seller_receives_lamports: u64,
    pub price_lamports_per_token: u64,
    pub timestamp: i64,
}

#[event]
pub struct CurvePriceV2 {
    pub mint: Pubkey,
    pub sol_reserve_lamports: u64,
    pub token_reserve_amount: u64,
    pub price_lamports_per_token: u64,
    pub timestamp: i64,
}

#[event]
pub struct InstantRaydiumPoolCreatedV2 {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub raydium_pool: Pubkey,
    pub lp_mint: Pubkey,
    pub token_amount: u64,
    pub sol_lamports: u64,
    pub lp_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MigratedToRaydiumV2 {
    pub mint: Pubkey,
    pub raydium_pool: Pubkey,
    pub triggerer: Pubkey,
    pub reward_lamports: u64,
    pub remaining_curve_tokens: u64,
    pub remaining_curve_sol_lamports: u64,
    pub lp_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VoteSubmittedV2 {
    pub mint: Pubkey,
    pub voter: Pubkey,
    pub is_positive: bool,
    pub complaint_category: u8,
    pub timestamp: i64,
}

#[event]
pub struct TokenFrozenV2 {
    pub mint: Pubkey,
    pub complaints_count: u32,
    pub trust_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct TrustScoreUpdatedV2 {
    pub mint: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct AirdropEpochExecutedV2 {
    pub mint: Pubkey,
    pub pool_amount: u64,
    pub epoch_number: u32,
    pub timestamp: i64,
}

#[event]
pub struct CreatorVerifiedV2 {
    pub mint: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct LpLockedV2 {
    pub token_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub creator: Pubkey,
    pub lp_amount: u64,
    pub lock_days: u16,
    pub unlock_time: i64,
    pub timestamp: i64,
}

#[event]
pub struct LpFeesClaimedV2 {
    pub token_mint: Pubkey,
    pub creator_share: u64,
    pub treasury_share: u64,
    pub rewards_share: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeParametersUpdatedV2 {
    pub standard_fee_lamports: u64,
    pub premium_fee_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct LaunchesPauseToggledV2 {
    pub is_paused: bool,
    pub timestamp: i64,
}

#[event]
pub struct LaunchCertificateIssuedV2 {
    pub serial_number: u32,
    pub token_mint: Pubkey,
    pub creator: Pubkey,
    pub certificate_nft_mint: Pubkey,
    pub initial_trust_score: u8,
    pub timestamp: i64,
}

#[error_code]
pub enum HumbleV2Error {
    #[msg("Token name is too short")]
    NameTooShort,
    #[msg("Token name max 16 characters")]
    NameTooLong,
    #[msg("Ticker symbol is too short")]
    SymbolTooShort,
    #[msg("Ticker symbol max 5 characters")]
    SymbolTooLong,
    #[msg("Lock must be between 30% and 80%")]
    InvalidLockPercent,
    #[msg("Lock duration must be between 30 and 360 days")]
    InvalidLockDays,
    #[msg("Burn option must be 0%, 25%, or 50%")]
    InvalidBurnOption,
    #[msg("Creator allocation must be between 0% and 5%")]
    CreatorAllocationTooHigh,
    #[msg("Curve liquidity must be between 25% and 50%")]
    InvalidCurveLiquidityPercent,
    #[msg("Circulation must be between 15% and 40%")]
    InvalidCirculationPercent,
    #[msg("Airdrop allocation must be between 0% and 5%")]
    InvalidAirdropPercent,
    #[msg("Curve liquidity plus circulation must be at least 50%")]
    InsufficientCombinedLiquidity,
    #[msg("Supply distribution must sum to 100%")]
    InvalidSupplyDistribution,
    #[msg("Initial SOL must be at least 0.5 SOL")]
    InitialSolTooLow,
    #[msg("Invalid fee wallet")]
    InvalidFeeWallet,
    #[msg("Invalid creator fee wallet")]
    InvalidCreatorFeeWallet,
    #[msg("Invalid Metaplex metadata account")]
    InvalidMetaplexMetadata,
    #[msg("Invalid Metaplex Token Metadata program")]
    InvalidMetaplexProgram,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Invalid mint for token account")]
    InvalidMintForTokenAccount,
    #[msg("Invalid creator receiving token account")]
    InvalidCreatorReceiveAccount,
    #[msg("Anti-bot seconds max 600")]
    InvalidAntiBotSeconds,
    #[msg("Invalid tier (must be 0 or 1)")]
    InvalidTier,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Tokens are still locked")]
    TokensStillLocked,
    #[msg("Locked tokens already unlocked")]
    AlreadyUnlocked,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Token is frozen")]
    TokenFrozen,
    #[msg("Vesting tranche is not ready yet")]
    VestingNotReady,
    #[msg("This vesting tranche was already used")]
    VestingTrancheDone,
    #[msg("Invalid tranche number")]
    InvalidTranche,
    #[msg("Invalid action")]
    InvalidAction,
    #[msg("Operation exceeds vesting unlocked amount")]
    VestingExceeded,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Trading not started yet (anti-bot delay)")]
    TradingNotStarted,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Insufficient curve reserve")]
    InsufficientCurveReserve,
    #[msg("Token already migrated from bonding curve")]
    AlreadyMigrated,
    #[msg("Migration threshold has not been reached")]
    MigrationThresholdNotMet,
    #[msg("Insufficient balance to vote")]
    InsufficientBalanceToVote,
    #[msg("Invalid trade time")]
    InvalidTradeTime,
    #[msg("Buyer and seller cannot be the same address")]
    SelfTrade,
    #[msg("Airdrop disabled")]
    AirdropDisabled,
    #[msg("Airdrop not eligible this month")]
    AirdropNotEligible,
    #[msg("Airdrop too early")]
    AirdropTooEarly,
    #[msg("Token launches are currently paused by admin")]
    LaunchesPaused,
    #[msg("Operation requires HumbleTrust admin authority")]
    AdminRequired,
    #[msg("Invalid fee parameters")]
    InvalidFeeParameters,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid Raydium pool")]
    InvalidRaydiumPool,
    #[msg("Raydium pool already exists for this token")]
    RaydiumPoolAlreadyCreated,
    #[msg("Invalid Raydium CPMM program")]
    InvalidRaydiumProgram,
    #[msg("Invalid Raydium CPMM authority")]
    InvalidRaydiumAuthority,
    #[msg("Invalid Raydium CPMM create-pool fee account")]
    InvalidRaydiumCreatePoolFee,
    #[msg("Invalid Associated Token Program")]
    InvalidAssociatedTokenProgram,
    #[msg("Invalid Token-2022 Program")]
    InvalidToken2022Program,
    #[msg("Raydium requires token_0_mint < token_1_mint")]
    InvalidRaydiumTokenOrder,
    #[msg("Invalid Raydium LP amount")]
    InvalidLpAmount,
    #[msg("Raydium migration funds must be prepared before opening the pool")]
    MigrationNotPrepared,
    #[msg("Raydium CPI failed")]
    RaydiumCpiFailed,
    #[msg("Curve type must be 0 (CPMM) or 1 (Quadratic)")]
    InvalidCurveType,
    #[msg("LP policy must be 0 (Lock), 1 (Burn), or 2 (ToCreator)")]
    InvalidLpPolicy,
    #[msg("LP policy requires a creator LP token account in remaining_accounts[0]")]
    LpPolicyAccountMissing,
}

#[allow(clippy::too_many_arguments)]
fn validate_launch_inputs(
    name: &str,
    symbol: &str,
    lock_days: u16,
    burn_option: u8,
    lock_percent: u8,
    creator_percent: u8,
    curve_liquidity_percent: u8,
    circulation_percent: u8,
    airdrop_percent: u8,
    initial_sol_lamports: u64,
    tier: u8,
    anti_bot_seconds: u16,
    curve_type: u8,
    lp_policy: u8,
    is_test: bool,
) -> Result<()> {
    require!(!name.is_empty(), HumbleV2Error::NameTooShort);
    require!(name.len() <= 16, HumbleV2Error::NameTooLong);
    require!(!symbol.is_empty(), HumbleV2Error::SymbolTooShort);
    require!(symbol.len() <= 5, HumbleV2Error::SymbolTooLong);
    require!(
        if is_test {
            (1..=360).contains(&lock_days)
        } else {
            (30..=360).contains(&lock_days)
        },
        HumbleV2Error::InvalidLockDays
    );
    require!(
        matches!(burn_option, 0 | 25 | 50),
        HumbleV2Error::InvalidBurnOption
    );
    require!(
        (30..=80).contains(&lock_percent),
        HumbleV2Error::InvalidLockPercent
    );
    require!(
        creator_percent <= 5,
        HumbleV2Error::CreatorAllocationTooHigh
    );
    require!(
        (25..=50).contains(&curve_liquidity_percent),
        HumbleV2Error::InvalidCurveLiquidityPercent
    );
    require!(
        (15..=40).contains(&circulation_percent),
        HumbleV2Error::InvalidCirculationPercent
    );
    require!(airdrop_percent <= 5, HumbleV2Error::InvalidAirdropPercent);
    require!(
        curve_liquidity_percent.saturating_add(circulation_percent) >= 50,
        HumbleV2Error::InsufficientCombinedLiquidity
    );

    let supply_sum = lock_percent
        .checked_add(creator_percent)
        .and_then(|v| v.checked_add(curve_liquidity_percent))
        .and_then(|v| v.checked_add(circulation_percent))
        .and_then(|v| v.checked_add(airdrop_percent))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    require!(supply_sum == 100, HumbleV2Error::InvalidSupplyDistribution);
    require!(
        initial_sol_lamports >= MIN_INITIAL_SOL_LAMPORTS,
        HumbleV2Error::InitialSolTooLow
    );
    require!(tier <= 1, HumbleV2Error::InvalidTier);
    require!(
        anti_bot_seconds <= 600,
        HumbleV2Error::InvalidAntiBotSeconds
    );
    require!(curve_type <= 1, HumbleV2Error::InvalidCurveType);
    require!(lp_policy <= 2, HumbleV2Error::InvalidLpPolicy);

    Ok(())
}

fn mint_to_vault<'info>(
    token_program: &Program<'info, Token>,
    mint: &Account<'info, Mint>,
    vault: &Account<'info, TokenAccount>,
    authority: &AccountInfo<'info>,
    signer: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            MintTo {
                mint: mint.to_account_info(),
                to: vault.to_account_info(),
                authority: authority.clone(),
            },
            signer,
        ),
        amount,
    )
}

// In test-mode each "day unit" = 60 seconds, so lock_days=10 → 10 minutes.
// In test-mode each "month unit" = 300 seconds (5 minutes) for airdrop/LP cooldowns.
// These fns are compiled out of all non-test builds.
fn seconds_per_day() -> i64 {
    if cfg!(feature = "test-mode") {
        60
    } else {
        SECONDS_PER_DAY
    }
}

fn seconds_per_month() -> i64 {
    if cfg!(feature = "test-mode") {
        300
    } else {
        SECONDS_PER_MONTH
    }
}

fn raydium_cpmm_program_id() -> Pubkey {
    if cfg!(feature = "mainnet") {
        RAYDIUM_CPMM_MAINNET_PROGRAM
    } else {
        RAYDIUM_CPMM_DEVNET_PROGRAM
    }
}

fn raydium_cpmm_authority() -> Pubkey {
    if cfg!(feature = "mainnet") {
        RAYDIUM_CPMM_MAINNET_AUTHORITY
    } else {
        RAYDIUM_CPMM_DEVNET_AUTHORITY
    }
}

fn raydium_cpmm_create_pool_fee() -> Pubkey {
    if cfg!(feature = "mainnet") {
        RAYDIUM_CPMM_MAINNET_CREATE_POOL_FEE
    } else {
        RAYDIUM_CPMM_DEVNET_CREATE_POOL_FEE
    }
}

fn validate_raydium_cpmm_common(
    raydium_program: &UncheckedAccount,
    raydium_authority: &UncheckedAccount,
    raydium_create_pool_fee: &UncheckedAccount,
    token_program_2022: &UncheckedAccount,
    associated_token_program: &UncheckedAccount,
    wsol_mint: &UncheckedAccount,
) -> Result<()> {
    require_keys_eq!(
        raydium_program.key(),
        raydium_cpmm_program_id(),
        HumbleV2Error::InvalidRaydiumProgram
    );
    require_keys_eq!(
        raydium_authority.key(),
        raydium_cpmm_authority(),
        HumbleV2Error::InvalidRaydiumAuthority
    );
    require_keys_eq!(
        raydium_create_pool_fee.key(),
        raydium_cpmm_create_pool_fee(),
        HumbleV2Error::InvalidRaydiumCreatePoolFee
    );
    require_keys_eq!(
        token_program_2022.key(),
        TOKEN_2022_PROGRAM_ID,
        HumbleV2Error::InvalidToken2022Program
    );
    require_keys_eq!(
        associated_token_program.key(),
        ASSOCIATED_TOKEN_PROGRAM_ID,
        HumbleV2Error::InvalidAssociatedTokenProgram
    );
    require_keys_eq!(
        wsol_mint.key(),
        NATIVE_SOL_MINT,
        HumbleV2Error::InvalidMintForTokenAccount
    );
    Ok(())
}

fn validate_migration_token_accounts(
    migration_authority: Pubkey,
    mint: Pubkey,
    migration_token_account: &UncheckedAccount,
    migration_wsol_account: &UncheckedAccount,
) -> Result<()> {
    let token_account = unpack_spl_token_account(&migration_token_account.to_account_info())?;
    let wsol_account = unpack_spl_token_account(&migration_wsol_account.to_account_info())?;
    require_keys_eq!(
        token_account.owner,
        migration_authority,
        HumbleV2Error::InvalidTokenAccountOwner
    );
    require_keys_eq!(
        token_account.mint,
        mint,
        HumbleV2Error::InvalidMintForTokenAccount
    );
    require_keys_eq!(
        wsol_account.owner,
        migration_authority,
        HumbleV2Error::InvalidTokenAccountOwner
    );
    require_keys_eq!(
        wsol_account.mint,
        NATIVE_SOL_MINT,
        HumbleV2Error::InvalidMintForTokenAccount
    );
    Ok(())
}

fn move_curve_tokens_to_migration_account<'info>(
    token_program: &Program<'info, Token>,
    token_metadata_ai: &AccountInfo<'info>,
    curve_pool_vault: &AccountInfo<'info>,
    migration_token_account: &AccountInfo<'info>,
    mint_key: Pubkey,
    bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let bump_seed = [bump];
    let signer_seeds: &[&[u8]] = &[b"token_metadata_v2", mint_key.as_ref(), &bump_seed];
    let signer = &[signer_seeds];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: curve_pool_vault.clone(),
                to: migration_token_account.clone(),
                authority: token_metadata_ai.clone(),
            },
            signer,
        ),
        amount,
    )?;
    Ok(())
}

fn debit_treasury_to_account<'info>(
    treasury: &mut Account<'info, CurveTreasurySol>,
    recipient: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    require!(
        treasury.current_sol_lamports >= amount,
        HumbleV2Error::InsufficientCurveReserve
    );
    let treasury_ai = treasury.to_account_info();
    **treasury_ai.try_borrow_mut_lamports()? = treasury_ai
        .lamports()
        .checked_sub(amount)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    treasury.current_sol_lamports = treasury
        .current_sol_lamports
        .checked_sub(amount)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    Ok(())
}

fn token_account_amount(account: &UncheckedAccount) -> Result<u64> {
    Ok(unpack_spl_token_account(&account.to_account_info())?.amount)
}

fn token_account_amount_if_initialized(account: &UncheckedAccount) -> Result<u64> {
    if account.to_account_info().data_is_empty() {
        return Ok(0);
    }
    token_account_amount(account)
}

fn init_token_vault_if_needed<'info>(
    payer: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    system_program: &Program<'info, System>,
    token_mint: Pubkey,
    bump: u8,
) -> Result<()> {
    if !vault.data_is_empty() {
        let token_account = unpack_spl_token_account(vault)?;
        require_keys_eq!(
            token_account.mint,
            *mint.key,
            HumbleV2Error::InvalidMintForTokenAccount
        );
        require_keys_eq!(
            token_account.owner,
            *authority.key,
            HumbleV2Error::InvalidTokenAccountOwner
        );
        return Ok(());
    }

    let rent = Rent::get()?;
    let space = anchor_spl::token::spl_token::state::Account::LEN;
    let lamports = rent.minimum_balance(space);
    let token_program_key = token_program.key();
    let bump_seed = [bump];
    let vault_seeds: &[&[u8]] = &[b"raydium_lp_custody_v2", token_mint.as_ref(), &bump_seed];
    let signer = &[vault_seeds];

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            vault.key,
            lamports,
            space as u64,
            &token_program_key,
        ),
        &[payer.clone(), vault.clone(), system_program.to_account_info()],
        signer,
    )?;

    token::initialize_account3(CpiContext::new(
        token_program.to_account_info(),
        InitializeAccount3 {
            account: vault.clone(),
            mint: mint.clone(),
            authority: authority.clone(),
        },
    ))?;

    Ok(())
}

fn unpack_spl_token_account(
    account_info: &AccountInfo,
) -> Result<anchor_spl::token::spl_token::state::Account> {
    if account_info.data_is_empty() {
        return err!(HumbleV2Error::InvalidTokenAccountOwner);
    }
    // Prevent fake migration accounts: only SPL Token program can own token accounts.
    if account_info.owner != &anchor_spl::token::spl_token::ID {
        return err!(HumbleV2Error::InvalidTokenAccountOwner);
    }
    let data = account_info.try_borrow_data()?;
    if data.len() < anchor_spl::token::spl_token::state::Account::LEN {
        return err!(HumbleV2Error::InvalidTokenAccountOwner);
    }
    let token_account = anchor_spl::token::spl_token::state::Account::unpack(&data)
        .map_err(|_| error!(HumbleV2Error::InvalidTokenAccountOwner))?;
    Ok(token_account)
}

struct RaydiumCpmmInitializeCpi<'info> {
    raydium_program: AccountInfo<'info>,
    creator: AccountInfo<'info>,
    amm_config: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    pool_state: AccountInfo<'info>,
    token_mint: AccountInfo<'info>,
    wsol_mint: AccountInfo<'info>,
    lp_mint: AccountInfo<'info>,
    creator_token: AccountInfo<'info>,
    creator_wsol: AccountInfo<'info>,
    creator_lp_token: AccountInfo<'info>,
    token_0_vault: AccountInfo<'info>,
    token_1_vault: AccountInfo<'info>,
    create_pool_fee: AccountInfo<'info>,
    observation_state: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    associated_token_program: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: AccountInfo<'info>,
}

struct RaydiumCpmmDepositCpi<'info> {
    raydium_program: AccountInfo<'info>,
    owner: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    pool_state: AccountInfo<'info>,
    owner_lp_token: AccountInfo<'info>,
    token_account: AccountInfo<'info>,
    wsol_account: AccountInfo<'info>,
    token_0_vault: AccountInfo<'info>,
    token_1_vault: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    token_2022_program: AccountInfo<'info>,
    token_mint: AccountInfo<'info>,
    wsol_mint: AccountInfo<'info>,
    lp_mint: AccountInfo<'info>,
}

fn append_u64(data: &mut Vec<u8>, value: u64) {
    data.extend_from_slice(&value.to_le_bytes());
}

fn humble_token_is_token_0(mint_key: Pubkey) -> Result<bool> {
    require_keys_neq!(
        mint_key,
        NATIVE_SOL_MINT,
        HumbleV2Error::InvalidRaydiumTokenOrder
    );
    Ok(mint_key < NATIVE_SOL_MINT)
}

fn invoke_raydium_cpmm_initialize<'info>(
    accounts: RaydiumCpmmInitializeCpi<'info>,
    token_amount: u64,
    sol_lamports: u64,
    open_time: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
    let token_is_0 = humble_token_is_token_0(*accounts.token_mint.key)?;
    let (
        token_0_mint,
        token_1_mint,
        creator_token_0,
        creator_token_1,
        amount_0,
        amount_1,
        token_0_program,
        token_1_program,
    ) = if token_is_0 {
        (
            accounts.token_mint.clone(),
            accounts.wsol_mint.clone(),
            accounts.creator_token.clone(),
            accounts.creator_wsol.clone(),
            token_amount,
            sol_lamports,
            accounts.token_program.clone(),
            accounts.token_program.clone(),
        )
    } else {
        (
            accounts.wsol_mint.clone(),
            accounts.token_mint.clone(),
            accounts.creator_wsol.clone(),
            accounts.creator_token.clone(),
            sol_lamports,
            token_amount,
            accounts.token_program.clone(),
            accounts.token_program.clone(),
        )
    };
    let mut data = RAYDIUM_CPMM_INITIALIZE_DISCM.to_vec();
    append_u64(&mut data, amount_0);
    append_u64(&mut data, amount_1);
    append_u64(&mut data, open_time);

    let ix = Instruction {
        program_id: *accounts.raydium_program.key,
        accounts: vec![
            AccountMeta::new(*accounts.creator.key, true),
            AccountMeta::new_readonly(*accounts.amm_config.key, false),
            AccountMeta::new_readonly(*accounts.authority.key, false),
            AccountMeta::new(*accounts.pool_state.key, false),
            AccountMeta::new_readonly(*token_0_mint.key, false),
            AccountMeta::new_readonly(*token_1_mint.key, false),
            AccountMeta::new(*accounts.lp_mint.key, false),
            AccountMeta::new(*creator_token_0.key, false),
            AccountMeta::new(*creator_token_1.key, false),
            AccountMeta::new(*accounts.creator_lp_token.key, false),
            AccountMeta::new(*accounts.token_0_vault.key, false),
            AccountMeta::new(*accounts.token_1_vault.key, false),
            AccountMeta::new(*accounts.create_pool_fee.key, false),
            AccountMeta::new(*accounts.observation_state.key, false),
            AccountMeta::new_readonly(*accounts.token_program.key, false),
            AccountMeta::new_readonly(*token_0_program.key, false),
            AccountMeta::new_readonly(*token_1_program.key, false),
            AccountMeta::new_readonly(*accounts.associated_token_program.key, false),
            AccountMeta::new_readonly(*accounts.system_program.key, false),
            AccountMeta::new_readonly(*accounts.rent.key, false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.creator,
            accounts.amm_config,
            accounts.authority,
            accounts.pool_state,
            token_0_mint,
            token_1_mint,
            accounts.lp_mint,
            creator_token_0,
            creator_token_1,
            accounts.creator_lp_token,
            accounts.token_0_vault,
            accounts.token_1_vault,
            accounts.create_pool_fee,
            accounts.observation_state,
            accounts.token_program,
            token_0_program,
            token_1_program,
            accounts.associated_token_program,
            accounts.system_program,
            accounts.rent,
        ],
        signer,
    )
    .map_err(|_| error!(HumbleV2Error::RaydiumCpiFailed))?;
    Ok(())
}

fn invoke_raydium_cpmm_deposit<'info>(
    accounts: RaydiumCpmmDepositCpi<'info>,
    lp_token_amount: u64,
    maximum_token_amount: u64,
    maximum_sol_lamports: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
    let token_is_0 = humble_token_is_token_0(*accounts.token_mint.key)?;
    let (token_0_account, token_1_account, vault_0_mint, vault_1_mint, max_0, max_1) = if token_is_0
    {
        (
            accounts.token_account.clone(),
            accounts.wsol_account.clone(),
            accounts.token_mint.clone(),
            accounts.wsol_mint.clone(),
            maximum_token_amount,
            maximum_sol_lamports,
        )
    } else {
        (
            accounts.wsol_account.clone(),
            accounts.token_account.clone(),
            accounts.wsol_mint.clone(),
            accounts.token_mint.clone(),
            maximum_sol_lamports,
            maximum_token_amount,
        )
    };
    let mut data = RAYDIUM_CPMM_DEPOSIT_DISCM.to_vec();
    append_u64(&mut data, lp_token_amount);
    append_u64(&mut data, max_0);
    append_u64(&mut data, max_1);

    let ix = Instruction {
        program_id: *accounts.raydium_program.key,
        accounts: vec![
            AccountMeta::new_readonly(*accounts.owner.key, true),
            AccountMeta::new_readonly(*accounts.authority.key, false),
            AccountMeta::new(*accounts.pool_state.key, false),
            AccountMeta::new(*accounts.owner_lp_token.key, false),
            AccountMeta::new(*token_0_account.key, false),
            AccountMeta::new(*token_1_account.key, false),
            AccountMeta::new(*accounts.token_0_vault.key, false),
            AccountMeta::new(*accounts.token_1_vault.key, false),
            AccountMeta::new_readonly(*accounts.token_program.key, false),
            AccountMeta::new_readonly(*accounts.token_2022_program.key, false),
            AccountMeta::new_readonly(*vault_0_mint.key, false),
            AccountMeta::new_readonly(*vault_1_mint.key, false),
            AccountMeta::new(*accounts.lp_mint.key, false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.owner,
            accounts.authority,
            accounts.pool_state,
            accounts.owner_lp_token,
            token_0_account,
            token_1_account,
            accounts.token_0_vault,
            accounts.token_1_vault,
            accounts.token_program,
            accounts.token_2022_program,
            vault_0_mint,
            vault_1_mint,
            accounts.lp_mint,
        ],
        signer,
    )
    .map_err(|_| error!(HumbleV2Error::RaydiumCpiFailed))?;
    Ok(())
}

fn percent_of(amount: u64, percent: u64) -> Result<u64> {
    (amount as u128)
        .checked_mul(percent as u128)
        .and_then(|v| v.checked_div(100))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(error!(HumbleV2Error::MathOverflow))
}

fn bps_amount(amount: u64, bps: u64) -> Result<u64> {
    (amount as u128)
        .checked_mul(bps as u128)
        .and_then(|v| v.checked_div(FEE_DENOMINATOR_BPS as u128))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(error!(HumbleV2Error::MathOverflow))
}

fn constant_product_tokens_out(
    token_reserve: u64,
    sol_reserve: u64,
    net_sol_in: u64,
) -> Result<u64> {
    require!(token_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(sol_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(net_sol_in > 0, HumbleV2Error::InvalidAmount);

    let k = (token_reserve as u128)
        .checked_mul(sol_reserve as u128)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let new_sol_reserve = (sol_reserve as u128)
        .checked_add(net_sol_in as u128)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let new_token_reserve = k
        .checked_div(new_sol_reserve)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let out = (token_reserve as u128)
        .checked_sub(new_token_reserve)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    u64::try_from(out).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

fn constant_product_sol_out(token_reserve: u64, sol_reserve: u64, tokens_in: u64) -> Result<u64> {
    require!(token_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(sol_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(tokens_in > 0, HumbleV2Error::InvalidAmount);

    let k = (token_reserve as u128)
        .checked_mul(sol_reserve as u128)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let new_token_reserve = (token_reserve as u128)
        .checked_add(tokens_in as u128)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let new_sol_reserve = k
        .checked_div(new_token_reserve)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let out = (sol_reserve as u128)
        .checked_sub(new_sol_reserve)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    u64::try_from(out).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

fn price_lamports_per_token(sol_reserve: u64, token_reserve: u64) -> Result<u64> {
    if token_reserve == 0 {
        return Ok(0);
    }
    let price = (sol_reserve as u128)
        .checked_mul(1_000_000_000)
        .and_then(|v| v.checked_div(token_reserve as u128))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    u64::try_from(price).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

fn rewards_multiplier_bps(score: u8) -> u16 {
    match score {
        81..=100 => 20_000,
        51..=80 => 15_000,
        _ => 10_000,
    }
}

fn refresh_dynamic_score(meta: &mut TokenMetadataV2, now: i64) {
    let base = calculate_trust_score_v2(
        meta.lock_percent,
        meta.lock_days,
        meta.creator_percent,
        meta.curve_liquidity_percent,
        meta.circulation_percent,
        meta.airdrop_percent,
        meta.burn_option,
    );
    let mut score = base.trust_score as i16;

    let age_days = ((now - meta.created_at) / seconds_per_day()).max(0) as u16;
    score += match age_days {
        30.. => 8,
        14..=29 => 5,
        7..=13 => 2,
        _ => 0,
    };
    score += match meta.verified_volume {
        v if v >= 10_000_000_000 => 10,
        v if v >= 1_000_000_000 => 6,
        v if v >= 100_000_000 => 3,
        _ => 0,
    };
    if meta.vesting_t1_done && meta.vesting_t1_action != 1 {
        score += 5;
    }
    if meta.vesting_t2_done && meta.vesting_t2_action != 1 {
        score += 5;
    }
    if meta.vesting_t3_done && meta.vesting_t3_action != 1 {
        score += 5;
    }
    if meta.is_verified {
        score += 8;
    }

    let total_votes = meta.positive_votes.saturating_add(meta.negative_votes);
    if total_votes > 0 {
        let pos_pct = meta.positive_votes.saturating_mul(100) / total_votes;
        let neg_pct = meta.negative_votes.saturating_mul(100) / total_votes;
        if pos_pct >= 80 {
            score += 5;
        }
        if neg_pct > 70 {
            score -= 18;
        } else if neg_pct > 50 {
            score -= 8;
        }
    }
    if meta.complaints_count >= 20 && score < 30 {
        score -= 25;
    } else if meta.complaints_count >= 10 && score < 50 {
        score -= 15;
    }
    if meta.no_activity_flag {
        score -= 15;
    }

    meta.trust_score = score.clamp(0, 100) as u8;
    meta.trust_level = trust_level(meta.trust_score);
    meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
    meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);
}

fn calculate_trust_score_v2(
    lock_percent: u8,
    lock_days: u16,
    creator_percent: u8,
    curve_liquidity_percent: u8,
    circulation_percent: u8,
    airdrop_percent: u8,
    burn_option: u8,
) -> TrustScoreV2 {
    // Lock duration: 0–250 tenths (0–25 pts). Longer lock = stronger commitment.
    let lock_days_tenths: u16 = match lock_days {
        0..=29 => 0,
        30..=59 => 40,
        60..=89 => 80,
        90..=179 => 120,
        180..=269 => 180,
        270..=359 => 220,
        360.. => 250,
    };

    // Lock percent: 0–200 tenths (0–20 pts). More supply locked = less dump risk.
    let lock_pct_tenths: u16 = match lock_percent {
        0..=29 => 0,
        30..=39 => 60,
        40..=49 => 100,
        50..=59 => 140,
        60..=69 => 170,
        70.. => 200,
    };

    // Combined into score_lock_tenths (max 450).
    let lock_tenths = lock_days_tenths + lock_pct_tenths;

    // Creator percent: 0–150 tenths (0–15 pts). Lower = less rug risk.
    let creator_tenths: u16 = match creator_percent {
        0 => 150,
        1..=3 => 120,
        4..=5 => 90,
        6..=8 => 60,
        9..=10 => 30,
        _ => 0,
    };

    // Curve liquidity: 0–100 tenths (0–10 pts). More curve liquidity = safer market.
    let curve_liquidity_tenths: u16 = match curve_liquidity_percent {
        0..=19 => 0,
        20..=29 => 30,
        30..=39 => 60,
        40..=49 => 80,
        50.. => 100,
    };

    // Circulation: 0–80 tenths (0–8 pts). Healthy range 15–40% signals good distribution.
    let circulation_tenths: u16 = match circulation_percent {
        0..=9 => 0,
        10..=14 => 40,
        15..=40 => 80,
        41..=60 => 40,
        _ => 20,
    };

    // Airdrop: 0–100 tenths (0–10 pts). Having one signals community intent.
    let airdrop_tenths: u16 = match airdrop_percent {
        0 => 0,
        1..=4 => 50,
        5..=9 => 80,
        10.. => 100,
    };

    // Burn on unlock: 0–120 tenths (0–12 pts). Permanent supply reduction.
    let burn_tenths: u16 = match burn_option {
        25 => 60,
        50 => 120,
        _ => 0,
    };

    // Max raw_tenths = 450 + 150 + 100 + 80 + 100 + 120 = 1000.
    let raw_tenths = lock_tenths
        + creator_tenths
        + curve_liquidity_tenths
        + circulation_tenths
        + airdrop_tenths
        + burn_tenths;

    // Normalize: divide by 10 → 0–100 pts.
    let trust_score = (raw_tenths / 10).min(100) as u8;

    TrustScoreV2 {
        trust_score,
        lock_tenths,
        creator_tenths,
        curve_liquidity_tenths,
        circulation_tenths,
        airdrop_tenths,
        burn_tenths,
        raw_tenths,
    }
}

fn trust_level(score: u8) -> u8 {
    match score {
        0..=39 => 0,
        40..=69 => 1,
        70..=84 => 2,
        _ => 3,
    }
}

// Integer square root via Newton's method (rounds down).
fn isqrt_u128(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) >> 1;
    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }
    x
}

// Quadratic curve invariant: T^2 * S = k.
// Buy: T_new = T * sqrt(S / S_new)
// Uses scaled-ratio approach to avoid overflow for large token reserves.
fn quadratic_tokens_out(token_reserve: u64, sol_reserve: u64, net_sol_in: u64) -> Result<u64> {
    require!(token_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(sol_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(net_sol_in > 0, HumbleV2Error::InvalidAmount);

    // ratio_sq = S * SCALE_SQ / S_new  (represents (S/S_new) * 1e12)
    // sqrt gives sqrt(S/S_new) * 1e6
    // T_new = T * sqrt_ratio / 1e6
    const SCALE_SQ: u128 = 1_000_000_000_000u128; // 1e12
    const SCALE: u128 = 1_000_000u128;             // 1e6 = sqrt(SCALE_SQ)

    let s = sol_reserve as u128;
    let s_new = s
        .checked_add(net_sol_in as u128)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let ratio_sq = s
        .checked_mul(SCALE_SQ)
        .and_then(|v| v.checked_div(s_new))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let sqrt_ratio = isqrt_u128(ratio_sq); // ≈ 1e6 * sqrt(S/S_new)
    let t = token_reserve as u128;
    let t_new = t
        .checked_mul(sqrt_ratio)
        .and_then(|v| v.checked_div(SCALE))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let tokens_out = t
        .checked_sub(t_new)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    u64::try_from(tokens_out).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

// Quadratic curve sell: gross_sol_out = S * Δ * (2T + Δ) / (T + Δ)^2
// Uses scaled-ratio approach to avoid overflow.
fn quadratic_sol_out(token_reserve: u64, sol_reserve: u64, tokens_in: u64) -> Result<u64> {
    require!(token_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(sol_reserve > 0, HumbleV2Error::InsufficientCurveReserve);
    require!(tokens_in > 0, HumbleV2Error::InvalidAmount);

    // gross = S * (delta / t_new) * ((t + t_new) / t_new)
    // where t_new = t + delta, (t + t_new) = 2t + delta
    const SCALE: u128 = 1_000_000_000u128; // 1e9

    let t = token_reserve as u128;
    let delta = tokens_in as u128;
    let s = sol_reserve as u128;
    let t_new = t
        .checked_add(delta)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;

    // r1 = delta * SCALE / t_new
    let r1 = delta
        .checked_mul(SCALE)
        .and_then(|v| v.checked_div(t_new))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;

    // r2 = (t + t_new) * SCALE / t_new  (= (2t + delta) * SCALE / t_new)
    let two_t_plus_delta = t
        .checked_add(t_new)
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    let r2 = two_t_plus_delta
        .checked_mul(SCALE)
        .and_then(|v| v.checked_div(t_new))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;

    let gross_sol_out = s
        .checked_mul(r1)
        .and_then(|v| v.checked_div(SCALE))
        .and_then(|v| v.checked_mul(r2))
        .and_then(|v| v.checked_div(SCALE))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;

    u64::try_from(gross_sol_out).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

// Curve-type-aware spot price (lamports per token, scaled by 1e9 for precision).
// CPMM: S/T * 1e9  |  Quadratic: 2*S/T * 1e9
fn curve_price_lamports_per_token(sol_reserve: u64, token_reserve: u64, curve_type: u8) -> Result<u64> {
    if token_reserve == 0 {
        return Ok(0);
    }
    let multiplier: u128 = if curve_type == 1 { 2 } else { 1 };
    let price = (sol_reserve as u128)
        .checked_mul(multiplier)
        .and_then(|v| v.checked_mul(1_000_000_000))
        .and_then(|v| v.checked_div(token_reserve as u128))
        .ok_or(error!(HumbleV2Error::MathOverflow))?;
    u64::try_from(price).map_err(|_| error!(HumbleV2Error::MathOverflow))
}

// Theoretical graduation price at the migration SOL threshold.
// Stored at launch for frontend preview. Returns u64::MAX on extreme prices (saturating).
fn graduation_price_lamports_per_token_for_curve(
    initial_sol: u64,
    initial_token_reserve: u64,
    migration_threshold: u64,
    curve_type: u8,
) -> Result<u64> {
    if initial_token_reserve == 0 || initial_sol == 0 || migration_threshold == 0 {
        return Ok(0);
    }

    const SCALE_SQ: u128 = 1_000_000_000_000u128; // 1e12
    const SCALE: u128 = 1_000_000u128;             // 1e6

    let s_init = initial_sol as u128;
    let s_grad = migration_threshold as u128;
    let t_init = initial_token_reserve as u128;

    if curve_type == 1 {
        // Quadratic: T_grad = T_init * sqrt(S_init / S_grad)
        // price = 2 * S_grad * 1e9 / T_grad
        let ratio_sq = s_init
            .checked_mul(SCALE_SQ)
            .and_then(|v| v.checked_div(s_grad))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        let sqrt_ratio = isqrt_u128(ratio_sq); // ≈ SCALE * sqrt(S_init/S_grad)
        let t_grad = t_init
            .checked_mul(sqrt_ratio)
            .and_then(|v| v.checked_div(SCALE))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        if t_grad == 0 {
            return Ok(u64::MAX);
        }
        let price = (2u128)
            .checked_mul(s_grad)
            .and_then(|v| v.checked_mul(1_000_000_000))
            .and_then(|v| v.checked_div(t_grad))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        Ok(u64::try_from(price).unwrap_or(u64::MAX))
    } else {
        // CPMM: T_grad = T_init * S_init / S_grad
        // price = S_grad^2 * 1e9 / (T_init * S_init)
        let denom = t_init
            .checked_mul(s_init)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        let numer = s_grad
            .checked_mul(s_grad)
            .and_then(|v| v.checked_mul(1_000_000_000))
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        if denom == 0 {
            return Ok(0);
        }
        let price = numer
            .checked_div(denom)
            .ok_or(error!(HumbleV2Error::MathOverflow))?;
        Ok(u64::try_from(price).unwrap_or(u64::MAX))
    }
}
