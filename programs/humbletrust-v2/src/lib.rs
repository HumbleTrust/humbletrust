#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Burn, Mint, MintTo, SetAuthority, Token, TokenAccount};

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

#[program]
pub mod humbletrust_v2 {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn create_token_with_lock_v2(
        ctx: Context<CreateTokenWithLockV2>,
        name: String,
        symbol: String,
        lock_days: u16,
        burn_option: u8,
        lock_percent: u8,
        creator_percent: u8,
        curve_liquidity_percent: u8,
        circulation_percent: u8,
        airdrop_percent: u8,
        initial_sol_lamports: u64,
        anti_bot_seconds: u16,
    ) -> Result<()> {
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
            anti_bot_seconds,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();
        let score = calculate_trust_score_v2(
            lock_percent,
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
            meta.migration_threshold_lamports = MIGRATION_THRESHOLD_SOL_LAMPORTS;
            meta.migration_reward_lamports = MIGRATION_REWARD_LAMPORTS;
            meta.platform_fee_bps = PLATFORM_FEE_BPS;
            meta.creator_fee_bps = CREATOR_FEE_BPS;
            meta.unlock_time = now + (lock_days as i64 * SECONDS_PER_DAY);
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
            meta.is_migrated = false;
            meta.creator_curve_buys = 0;
            meta.anti_bot_seconds = anti_bot_seconds;
            meta.trading_unlock_time = now + anti_bot_seconds as i64;
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
}

#[derive(Accounts)]
pub struct CreateTokenWithLockV2<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + TokenMetadataV2::INIT_SPACE,
        seeds = [b"token_metadata_v2", mint.key().as_ref()],
        bump
    )]
    pub token_metadata: Account<'info, TokenMetadataV2>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = token_metadata
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"locked_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub locked_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"creator_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"curve_pool_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub curve_pool_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"circulation_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"airdrop_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub airdrop_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + CurveTreasurySol::INIT_SPACE,
        seeds = [b"curve_treasury_sol_v2", mint.key().as_ref()],
        bump
    )]
    pub curve_treasury_sol: Account<'info, CurveTreasurySol>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpLockVault::INIT_SPACE,
        seeds = [b"lp_lock_vault_v2", mint.key().as_ref()],
        bump
    )]
    pub lp_lock_vault: Account<'info, LpLockVault>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenMetadataV2 {
    pub creator: Pubkey,
    pub mint: Pubkey,
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
    pub is_migrated: bool,
    pub creator_curve_buys: u64,
    pub anti_bot_seconds: u16,
    pub trading_unlock_time: i64,
    pub bump: u8,
    pub locked_vault_bump: u8,
    pub creator_vault_bump: u8,
    pub curve_pool_vault_bump: u8,
    pub circulation_vault_bump: u8,
    pub airdrop_vault_bump: u8,
    pub curve_treasury_sol_bump: u8,
    pub lp_lock_vault_bump: u8,
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
    #[msg("Anti-bot seconds max 600")]
    InvalidAntiBotSeconds,
    #[msg("Math overflow")]
    MathOverflow,
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
    anti_bot_seconds: u16,
) -> Result<()> {
    require!(!name.is_empty(), HumbleV2Error::NameTooShort);
    require!(name.len() <= 16, HumbleV2Error::NameTooLong);
    require!(!symbol.is_empty(), HumbleV2Error::SymbolTooShort);
    require!(symbol.len() <= 5, HumbleV2Error::SymbolTooLong);
    require!(
        (30..=360).contains(&lock_days),
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
    require!(
        anti_bot_seconds <= 600,
        HumbleV2Error::InvalidAntiBotSeconds
    );

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

fn percent_of(amount: u64, percent: u64) -> Result<u64> {
    amount
        .checked_mul(percent)
        .and_then(|v| v.checked_div(100))
        .ok_or(error!(HumbleV2Error::MathOverflow))
}

fn calculate_trust_score_v2(
    lock_percent: u8,
    creator_percent: u8,
    curve_liquidity_percent: u8,
    circulation_percent: u8,
    airdrop_percent: u8,
    burn_option: u8,
) -> TrustScoreV2 {
    let lock_tenths = match lock_percent {
        0..=29 => 0,
        30..=39 => 100,
        40..=60 => 200,
        61..=80 => 150,
        _ => 0,
    };
    let creator_tenths = 10 * 20u16.saturating_sub(4 * creator_percent as u16);
    let curve_liquidity_tenths =
        (15 * curve_liquidity_percent.saturating_sub(20) as u16).clamp(0, 250);
    let circulation_tenths = (12 * circulation_percent.saturating_sub(10) as u16).clamp(0, 200);
    let airdrop_tenths = 10 * 15u16.saturating_sub(3 * airdrop_percent as u16);
    let burn_tenths = match burn_option {
        25 => 50,
        50 => 100,
        _ => 0,
    };

    let raw_tenths = lock_tenths
        + creator_tenths
        + curve_liquidity_tenths
        + circulation_tenths
        + airdrop_tenths
        + burn_tenths;
    let normalized = ((raw_tenths as u32 * 100) + 550) / 1_100;

    TrustScoreV2 {
        trust_score: normalized.min(100) as u8,
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
