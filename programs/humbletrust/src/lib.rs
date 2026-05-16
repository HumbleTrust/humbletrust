#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{MintTo as InterfaceMintTo, mint_to as interface_mint_to};

declare_id!("Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi");

const FEE_WALLET: Pubkey = pubkey!("FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM");
const LAUNCH_FEE_STANDARD: u64 = 56_818_181;
const LAUNCH_FEE_PREMIUM: u64 = 281_818_181;
const SECONDS_PER_DAY: i64 = 86_400;
const SECONDS_PER_MONTH: i64 = 2_592_000;

// Phase 4: LP fee distribution bps
// Standard: 40% creator / 35% treasury / 25% rewards
// Premium:  60% creator / 30% treasury / 10% rewards
const LP_FEE_CREATOR_STANDARD_BPS: u64  = 4_000;
const LP_FEE_CREATOR_PREMIUM_BPS: u64   = 6_000;
const LP_FEE_TREASURY_STANDARD_BPS: u64 = 3_500;
const LP_FEE_TREASURY_PREMIUM_BPS: u64  = 3_000;
const LP_CLAIM_COOLDOWN: i64           = SECONDS_PER_MONTH;

#[program]
pub mod humbletrust {
    use super::*;

    pub fn create_token_with_lock(
        ctx: Context<CreateTokenWithLock>,
        name: String,
        symbol: String,
        total_supply: u64,
        lock_percent: u8,
        lock_days: u16,
        burn_option: u8,
        creator_allocation_percent: u8,
        airdrop_percent: u8,
        metrics_authority: Pubkey,
        tier: u8,
        anti_bot_seconds: u16,
    ) -> Result<()> {
        require!(!name.is_empty(), HumbleError::NameTooShort);
        require!(name.len() <= 16, HumbleError::NameTooLong);
        require!(!symbol.is_empty(), HumbleError::SymbolTooShort);
        require!(symbol.len() <= 5, HumbleError::SymbolTooLong);
        require!(total_supply > 0, HumbleError::InvalidSupply);
        require!(
            (30..=80).contains(&lock_percent),
            HumbleError::InvalidLockPercent
        );
        require!(
            (30..=360).contains(&lock_days),
            HumbleError::InvalidLockDays
        );
        require!(
            burn_option == 25 || burn_option == 50,
            HumbleError::InvalidBurnOption
        );
        require!(
            creator_allocation_percent <= 10,
            HumbleError::CreatorAllocationTooHigh
        );
        require!(
            matches!(airdrop_percent, 0 | 2 | 5 | 8),
            HumbleError::InvalidAirdropPercent
        );
        require!(tier <= 1, HumbleError::InvalidTier);
        require!(anti_bot_seconds <= 600, HumbleError::InvalidAntiBotSeconds);
        require_keys_eq!(
            ctx.accounts.fee_wallet.key(),
            FEE_WALLET,
            HumbleError::InvalidFeeWallet
        );

        let locked_amount = percent_of(total_supply, lock_percent as u64)?;
        let creator_allocation = percent_of(total_supply, creator_allocation_percent as u64)?;
        let circulation_amount = total_supply
            .checked_sub(locked_amount)
            .and_then(|v| v.checked_sub(creator_allocation))
            .ok_or(error!(HumbleError::MathOverflow))?;

        let circulation_percent = circulation_amount
            .checked_mul(100)
            .and_then(|v| v.checked_div(total_supply))
            .ok_or(error!(HumbleError::MathOverflow))?;
        require!(
            circulation_percent >= 55,
            HumbleError::InsufficientCirculation
        );

        let launch_fee_lamports: u64 = if tier == 0 { LAUNCH_FEE_STANDARD } else { LAUNCH_FEE_PREMIUM };
        let fee_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.creator.key(),
            &ctx.accounts.fee_wallet.key(),
            launch_fee_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &fee_ix,
            &[
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.fee_wallet.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        {
            let meta = &mut ctx.accounts.token_metadata;
            meta.creator = ctx.accounts.creator.key();
            meta.mint = mint_key;
            meta.metrics_authority = metrics_authority;
            meta.name = name.clone();
            meta.symbol = symbol.clone();
            meta.total_supply = total_supply;
            meta.locked_amount = locked_amount;
            meta.creator_allocation = creator_allocation;
            meta.creator_allocation_percent = creator_allocation_percent;
            meta.creator_max_balance = percent_of(total_supply, 10)?;
            meta.circulation_amount = circulation_amount;
            meta.unlock_time = now + (lock_days as i64 * SECONDS_PER_DAY);
            meta.created_at = now;
            meta.lock_percent = lock_percent;
            meta.lock_days = lock_days;
            meta.burn_option = burn_option;
            meta.airdrop_percent = airdrop_percent;
            meta.is_locked = true;
            meta.trading_volume = 0;
            meta.verified_volume = 0;
            meta.holder_count = 0;
            let initial_score = calculate_initial_trust_score(
                lock_percent,
                lock_days,
                burn_option,
                airdrop_percent,
            );
            meta.trust_score = initial_score;
            meta.min_score_this_month = initial_score;
            meta.total_burned = 0;
            meta.is_verified = false;
            meta.last_airdrop_time = 0;
            meta.total_airdrops_executed = 0;
            meta.vesting_t1_done = false;
            meta.vesting_t2_done = false;
            meta.vesting_t3_done = false;
            meta.vesting_t1_action = 0;
            meta.vesting_t2_action = 0;
            meta.vesting_t3_action = 0;
            meta.positive_votes = 0;
            meta.negative_votes = 0;
            meta.complaints_count = 0;
            meta.is_flagged = false;
            meta.is_frozen = false;
            meta.no_activity_flag = false;
            meta.rewards_multiplier_bps = rewards_multiplier_bps(initial_score);
            meta.trading_unlock_time = now + (anti_bot_seconds as i64);
            meta.is_premium = tier == 1;
            meta.anti_bot_seconds = anti_bot_seconds;
            meta.bump = ctx.bumps.token_metadata;
            meta.locked_vault_bump = ctx.bumps.locked_vault;
            meta.creator_vault_bump = ctx.bumps.creator_vault;
            meta.circulation_vault_bump = ctx.bumps.circulation_vault;
            meta.rewards_vault_bump = ctx.bumps.rewards_vault;
        }

        let bump = ctx.accounts.token_metadata.bump;
        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.locked_vault.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            locked_amount,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.creator_vault.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            creator_allocation,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.circulation_vault.to_account_info(),
                    authority: token_metadata_ai.clone(),
                },
                signer,
            ),
            circulation_amount,
        )?;

        let trust_score = ctx.accounts.token_metadata.trust_score;

        emit!(TokenCreated {
            mint: mint_key,
            creator: ctx.accounts.creator.key(),
            total_supply,
            locked_amount,
            creator_allocation,
            circulation_amount,
            trust_score,
            timestamp: now,
        });

        Ok(())
    }

    pub fn unlock_locked_tokens(ctx: Context<UnlockLockedTokens>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (creator_key, is_locked, unlock_time, locked_amount, burn_option, bump) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.creator,
                meta.is_locked,
                meta.unlock_time,
                meta.locked_amount,
                meta.burn_option,
                meta.bump,
            )
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleError::Unauthorized
        );
        require!(is_locked, HumbleError::AlreadyUnlocked);
        require!(now >= unlock_time, HumbleError::TokensStillLocked);

        let burn_amount = percent_of(locked_amount, burn_option as u64)?;
        let release_amount = locked_amount
            .checked_sub(burn_amount)
            .ok_or(error!(HumbleError::MathOverflow))?;

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        if burn_amount > 0 {
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
                burn_amount,
            )?;
        }

        if release_amount > 0 {
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
        meta.total_burned = meta
            .total_burned
            .checked_add(burn_amount)
            .ok_or(error!(HumbleError::MathOverflow))?;
        meta.circulation_amount = meta
            .circulation_amount
            .checked_add(release_amount)
            .ok_or(error!(HumbleError::MathOverflow))?;
        meta.locked_amount = 0;
        meta.is_locked = false;
        meta.trust_score = recalculate_trust_score(meta, now);
        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        emit!(LockedTokensUnlocked {
            mint: meta.mint,
            burned_amount: burn_amount,
            released_amount: release_amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn use_vesting_tranche(
        ctx: Context<UseVestingTranche>,
        tranche: u8,
        action: u8,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (
            creator_key,
            is_frozen,
            created_at,
            creator_allocation,
            bump,
            t1_done,
            t2_done,
            t3_done,
            t1_action,
            t2_action,
            t3_action,
        ) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.creator,
                meta.is_frozen,
                meta.created_at,
                meta.creator_allocation,
                meta.bump,
                meta.vesting_t1_done,
                meta.vesting_t2_done,
                meta.vesting_t3_done,
                meta.vesting_t1_action,
                meta.vesting_t2_action,
                meta.vesting_t3_action,
            )
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleError::Unauthorized
        );
        require!(!is_frozen, HumbleError::TokenFrozen);
        require!(matches!(action, 1 | 2 | 3), HumbleError::InvalidAction);

        let days_elapsed = ((now - created_at) / SECONDS_PER_DAY).max(0) as u16;
        let (required_day, percent, done) = match tranche {
            1 => (30u16, 2u64, t1_done),
            2 => (60u16, 3u64, t2_done),
            3 => (90u16, 5u64, t3_done),
            _ => return err!(HumbleError::InvalidTranche),
        };

        require!(!done, HumbleError::VestingTrancheDone);
        require!(days_elapsed >= required_day, HumbleError::VestingNotReady);

        let tranche_amount = percent_of(creator_allocation, percent)?;
        require!(
            ctx.accounts.creator_vault.amount >= tranche_amount,
            HumbleError::InsufficientVaultBalance
        );

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        match action {
            1 => {
                let total_fee = percent_of(tranche_amount, 5)?;
                let fee_each = total_fee / 2;
                let creator_receives = tranche_amount
                    .checked_sub(fee_each.checked_mul(2).ok_or(error!(HumbleError::MathOverflow))?)
                    .ok_or(error!(HumbleError::MathOverflow))?;

                require_keys_eq!(
                    ctx.accounts.creator_receive_account.owner,
                    creator_key,
                    HumbleError::InvalidCreatorReceiveAccount
                );
                require_keys_eq!(
                    ctx.accounts.creator_receive_account.mint,
                    mint_key,
                    HumbleError::InvalidMintForTokenAccount
                );
                require_keys_eq!(
                    ctx.accounts.fee_token_account.owner,
                    FEE_WALLET,
                    HumbleError::InvalidFeeWallet
                );
                require_keys_eq!(
                    ctx.accounts.fee_token_account.mint,
                    mint_key,
                    HumbleError::InvalidMintForTokenAccount
                );

                if creator_receives > 0 {
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
                        creator_receives,
                    )?;
                }

                if fee_each > 0 {
                    token::transfer(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts.creator_vault.to_account_info(),
                                to: ctx.accounts.fee_token_account.to_account_info(),
                                authority: token_metadata_ai.clone(),
                            },
                            signer,
                        ),
                        fee_each,
                    )?;

                    token::transfer(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts.creator_vault.to_account_info(),
                                to: ctx.accounts.rewards_vault.to_account_info(),
                                authority: token_metadata_ai.clone(),
                            },
                            signer,
                        ),
                        fee_each,
                    )?;
                }
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
            _ => return err!(HumbleError::InvalidAction),
        }

        let meta = &mut ctx.accounts.token_metadata;

        if action == 2 {
            meta.total_burned = meta
                .total_burned
                .checked_add(tranche_amount)
                .ok_or(error!(HumbleError::MathOverflow))?;
        }

        if action == 3 {
            meta.circulation_amount = meta
                .circulation_amount
                .checked_add(tranche_amount)
                .ok_or(error!(HumbleError::MathOverflow))?;
        }

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
            _ => {}
        }

        let final_t1_done = if tranche == 1 { true } else { t1_done };
        let final_t2_done = if tranche == 2 { true } else { t2_done };
        let final_t3_done = if tranche == 3 { true } else { t3_done };
        let final_t1_action = if tranche == 1 { action } else { t1_action };
        let final_t2_action = if tranche == 2 { action } else { t2_action };
        let final_t3_action = if tranche == 3 { action } else { t3_action };

        // Recalculate from scratch so score stays consistent with all other instructions.
        // Direct +10 additions were removed — they conflicted with recalculate_trust_score
        // which rebuilds the score on every vote/trade call and would silently discard them.
        meta.trust_score = recalculate_trust_score(meta, now);
        if final_t1_done
            && final_t2_done
            && final_t3_done
            && final_t1_action != 1
            && final_t2_action != 1
            && final_t3_action != 1
        {
            meta.rewards_multiplier_bps = 30_000;
        } else {
            meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
        }

        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        emit!(VestingTrancheUsed {
            mint: meta.mint,
            tranche,
            action,
            amount: tranche_amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn add_to_circulation(ctx: Context<AddToCirculation>, amount: u64) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (creator_key, bump) = {
            let meta = &ctx.accounts.token_metadata;
            (meta.creator, meta.bump)
        };

        require_keys_eq!(
            ctx.accounts.creator.key(),
            creator_key,
            HumbleError::Unauthorized
        );
        require!(amount > 0, HumbleError::InvalidSupply);
        require!(
            ctx.accounts.creator_vault.amount >= amount,
            HumbleError::InsufficientVaultBalance
        );
        // creator_max_balance (10% of supply) is enforced at creation time via
        // creator_allocation_percent <= 10 require!. No additional check needed here
        // because add_to_circulation only moves tokens OUT of the vault.

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata", mint_key.as_ref(), &bump_seed];
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

        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        meta.circulation_amount = meta
            .circulation_amount
            .checked_add(amount)
            .ok_or(error!(HumbleError::MathOverflow))?;

        emit!(CirculationAdded {
            mint: meta.mint,
            amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn submit_vote(
        ctx: Context<SubmitVote>,
        is_positive: bool,
        complaint_category: u8,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;
        let vote = &mut ctx.accounts.vote_record;

        let min_threshold = (meta.total_supply / 100_000).max(1);
        require!(
            ctx.accounts.voter_token_account.amount >= min_threshold,
            HumbleError::InsufficientBalanceToVote
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

        meta.trust_score = recalculate_trust_score(meta, now);
        meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        if meta.complaints_count >= 20 && meta.trust_score < 30 {
            meta.is_frozen = true;
            emit!(TokenFrozen {
                mint: meta.mint,
                complaints_count: meta.complaints_count,
                trust_score: meta.trust_score,
                timestamp: now,
            });
        }

        emit!(VoteSubmitted {
            mint: meta.mint,
            voter: ctx.accounts.voter.key(),
            is_positive,
            complaint_category,
            timestamp: now,
        });

        Ok(())
    }

    // Only metrics_authority can record trades — prevents anyone from calling this
    // to inflate verified_volume and boost TrustScore.
    pub fn record_trade(
        ctx: Context<RecordTrade>,
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
            HumbleError::Unauthorized
        );
        require!(now >= meta.trading_unlock_time, HumbleError::TradingNotStarted);
        require!(amount > 0, HumbleError::InvalidTradeAmount);
        require!(buy_time > 0, HumbleError::InvalidTradeTime);
        require!(now >= buy_time, HumbleError::InvalidTradeTime);
        require!(buyer != seller, HumbleError::SelfTrade);

        trade.buyer = buyer;
        trade.seller = seller;
        trade.mint = meta.mint;
        trade.amount = amount;
        trade.buy_time = buy_time;
        trade.sell_time = now;
        trade.is_valid_volume = now - buy_time >= SECONDS_PER_DAY;
        trade.suspected_wash = suspected_wash;
        trade.bump = ctx.bumps.trade_record;

        meta.trading_volume = meta
            .trading_volume
            .checked_add(amount)
            .ok_or(error!(HumbleError::MathOverflow))?;

        if trade.is_valid_volume && !trade.suspected_wash {
            meta.verified_volume = meta
                .verified_volume
                .checked_add(amount)
                .ok_or(error!(HumbleError::MathOverflow))?;
        }

        meta.trust_score = recalculate_trust_score(meta, now);
        meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        Ok(())
    }

    pub fn update_metrics(
        ctx: Context<UpdateMetrics>,
        new_verified_volume: u64,
        new_holder_count: u32,
        is_verified: bool,
        no_activity_flag: bool,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;

        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            meta.metrics_authority,
            HumbleError::Unauthorized
        );

        let old_score = meta.trust_score;
        meta.verified_volume = new_verified_volume;
        meta.holder_count = new_holder_count;
        meta.is_verified = is_verified;
        meta.no_activity_flag = no_activity_flag;
        meta.trust_score = recalculate_trust_score(meta, now);
        meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        emit!(TrustScoreUpdated {
            mint: meta.mint,
            old_score,
            new_score: meta.trust_score,
            timestamp: now,
        });

        Ok(())
    }

    pub fn execute_airdrop_epoch(ctx: Context<ExecuteAirdropEpoch>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.mint.key();
        let token_metadata_ai = ctx.accounts.token_metadata.to_account_info();

        let (metrics_authority, airdrop_percent, min_score_this_month, last_airdrop_time, locked_amount, bump) = {
            let meta = &ctx.accounts.token_metadata;
            (
                meta.metrics_authority,
                meta.airdrop_percent,
                meta.min_score_this_month,
                meta.last_airdrop_time,
                meta.locked_amount,
                meta.bump,
            )
        };

        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            metrics_authority,
            HumbleError::Unauthorized
        );
        require!(airdrop_percent > 0, HumbleError::AirdropDisabled);
        require!(min_score_this_month >= 56, HumbleError::AirdropNotEligible);
        require!(
            last_airdrop_time == 0 || now - last_airdrop_time >= SECONDS_PER_MONTH,
            HumbleError::AirdropTooEarly
        );

        let pool_amount = percent_of(locked_amount, airdrop_percent as u64)?;
        require!(
            ctx.accounts.locked_vault.amount >= pool_amount,
            HumbleError::InsufficientVaultBalance
        );

        let bump_seed = [bump];
        let signer_seeds: &[&[u8]] = &[b"token_metadata", mint_key.as_ref(), &bump_seed];
        let signer = &[signer_seeds];

        if pool_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.locked_vault.to_account_info(),
                        to: ctx.accounts.rewards_vault.to_account_info(),
                        authority: token_metadata_ai.clone(),
                    },
                    signer,
                ),
                pool_amount,
            )?;
        }

        let meta = &mut ctx.accounts.token_metadata;
        meta.locked_amount = meta
            .locked_amount
            .checked_sub(pool_amount)
            .ok_or(error!(HumbleError::MathOverflow))?;
        meta.last_airdrop_time = now;
        meta.total_airdrops_executed = meta.total_airdrops_executed.saturating_add(1);
        meta.min_score_this_month = meta.trust_score;

        emit!(AirdropEpochExecuted {
            mint: meta.mint,
            pool_amount,
            epoch_number: meta.total_airdrops_executed,
            timestamp: now,
        });

        Ok(())
    }

    pub fn verify_creator(ctx: Context<VerifyCreator>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &mut ctx.accounts.token_metadata;

        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            meta.metrics_authority,
            HumbleError::Unauthorized
        );

        let old_score = meta.trust_score;
        meta.is_verified = true;
        meta.trust_score = recalculate_trust_score(meta, now);
        meta.rewards_multiplier_bps = rewards_multiplier_bps(meta.trust_score);
        meta.min_score_this_month = meta.min_score_this_month.min(meta.trust_score);

        emit!(CreatorVerified {
            mint: meta.mint,
            old_score,
            new_score: meta.trust_score,
            timestamp: now,
        });

        Ok(())
    }

    pub fn set_metrics_authority(
        ctx: Context<SetMetricsAuthority>,
        new_metrics_authority: Pubkey,
    ) -> Result<()> {
        let meta = &mut ctx.accounts.token_metadata;
        require_keys_eq!(
            ctx.accounts.creator.key(),
            meta.creator,
            HumbleError::Unauthorized
        );
        meta.metrics_authority = new_metrics_authority;
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4.5 — Creator Reputation
    // ─────────────────────────────────────────────────────────────────────────

    pub fn init_creator_reputation(ctx: Context<InitCreatorReputation>) -> Result<()> {
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

    // Called by metrics_authority after verifiable on-chain events.
    // event_type: 1 = successful_unlock, 2 = new_launch, 3 = complaint, 4 = freeze
    pub fn record_reputation_event(
        ctx: Context<RecordReputationEvent>,
        event_type: u8,
    ) -> Result<()> {
        let (authority_key, creator_key, token_trust_score) = {
            let meta = &ctx.accounts.token_metadata;
            (meta.metrics_authority, meta.creator, meta.trust_score)
        };

        require_keys_eq!(
            ctx.accounts.metrics_authority.key(),
            authority_key,
            HumbleError::Unauthorized
        );
        require!(matches!(event_type, 1..=4), HumbleError::InvalidAction);

        let rep = &mut ctx.accounts.creator_reputation;
        require_keys_eq!(rep.creator, creator_key, HumbleError::Unauthorized);

        match event_type {
            1 => {
                rep.successful_unlocks = rep.successful_unlocks.saturating_add(1);
                if rep.successful_unlocks >= 3 && rep.complaints_total == 0 {
                    rep.score_bonus = 5;
                }
            }
            2 => {
                rep.total_launches = rep.total_launches.saturating_add(1);
                // Trust score is read directly from on-chain token_metadata — no untrusted param.
                rep.trust_score_sum = rep.trust_score_sum.saturating_add(token_trust_score as u32);
            }
            3 => {
                rep.complaints_total = rep.complaints_total.saturating_add(1);
                if rep.complaints_total >= 5 {
                    rep.score_bonus = 0;
                }
            }
            4 => {
                rep.score_bonus = 0;
                rep.successful_unlocks = 0;
            }
            _ => {}
        }

        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4 — LP Token Lock
    // ─────────────────────────────────────────────────────────────────────────

    // Creator provides LP tokens (obtained from Raydium/Orca after adding liquidity)
    // and locks them here. The protocol enforces the lock; fee distribution happens
    // via claim_lp_fees after each cooldown period.
    pub fn lock_lp_tokens(
        ctx: Context<LockLpTokens>,
        lp_amount: u64,
        lock_days: u16,
    ) -> Result<()> {
        require!(lp_amount > 0, HumbleError::InvalidTradeAmount);
        require!(lock_days >= 30, HumbleError::InvalidLockDays);
        require!(
            ctx.accounts.creator_lp_account.amount >= lp_amount,
            HumbleError::InsufficientVaultBalance
        );

        let meta = &ctx.accounts.token_metadata;
        require_keys_eq!(meta.creator, ctx.accounts.creator.key(), HumbleError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        let mint_key = ctx.accounts.token_mint.key();

        // Transfer LP tokens from creator to lp_vault PDA
        let cpi_accounts = Transfer {
            from: ctx.accounts.creator_lp_account.to_account_info(),
            to: ctx.accounts.lp_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            lp_amount,
        )?;

        let lp_lock = &mut ctx.accounts.lp_lock;
        lp_lock.token_mint = mint_key;
        lp_lock.lp_mint = ctx.accounts.lp_mint.key();
        lp_lock.creator = ctx.accounts.creator.key();
        lp_lock.is_premium = meta.is_premium;
        lp_lock.lp_amount = lp_amount;
        lp_lock.lock_days = lock_days;
        lp_lock.unlock_time = now + (lock_days as i64 * SECONDS_PER_DAY);
        lp_lock.locked_at = now;
        lp_lock.last_claim_time = 0;
        lp_lock.total_fees_claimed_lamports = 0;
        lp_lock.bump = ctx.bumps.lp_lock;
        lp_lock.lp_vault_bump = ctx.bumps.lp_vault;
        lp_lock.lp_fee_pool_bump = ctx.bumps.lp_fee_pool;

        let fee_pool = &mut ctx.accounts.lp_fee_pool;
        fee_pool.token_mint = mint_key;
        fee_pool.bump = ctx.bumps.lp_fee_pool;

        emit!(LpLocked {
            token_mint: mint_key,
            lp_mint: lp_lock.lp_mint,
            creator: lp_lock.creator,
            lp_amount,
            lock_days,
            unlock_time: lp_lock.unlock_time,
            timestamp: now,
        });

        Ok(())
    }

    // Distributes accumulated SOL LP fees according to the economic model.
    // Requires Raydium CPI to harvest fees from the AMM pool — implemented in Phase 4 v2.
    // Until then, the creator can send SOL directly to fund the distribution.
    pub fn claim_lp_fees(ctx: Context<ClaimLpFees>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let lp_lock = &mut ctx.accounts.lp_lock;

        require_keys_eq!(lp_lock.creator, ctx.accounts.creator.key(), HumbleError::Unauthorized);
        require!(
            lp_lock.last_claim_time == 0 || now - lp_lock.last_claim_time >= LP_CLAIM_COOLDOWN,
            HumbleError::AirdropTooEarly
        );

        // Fee pool = lamports held by lp_fee_pool account (funded by Raydium harvest CPI or manual)
        let pool_lamports = ctx.accounts.lp_fee_pool.to_account_info().lamports();
        require!(pool_lamports > 0, HumbleError::InsufficientVaultBalance);

        let (creator_bps, treasury_bps) = if lp_lock.is_premium {
            (LP_FEE_CREATOR_PREMIUM_BPS, LP_FEE_TREASURY_PREMIUM_BPS)
        } else {
            (LP_FEE_CREATOR_STANDARD_BPS, LP_FEE_TREASURY_STANDARD_BPS)
        };

        let creator_share = pool_lamports
            .checked_mul(creator_bps).and_then(|v| v.checked_div(10_000))
            .ok_or(error!(HumbleError::MathOverflow))?;
        let treasury_share = pool_lamports
            .checked_mul(treasury_bps).and_then(|v| v.checked_div(10_000))
            .ok_or(error!(HumbleError::MathOverflow))?;
        let rewards_share = pool_lamports
            .checked_sub(creator_share).and_then(|v| v.checked_sub(treasury_share))
            .ok_or(error!(HumbleError::MathOverflow))?;

        **ctx.accounts.lp_fee_pool.to_account_info().try_borrow_mut_lamports()? -= pool_lamports;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += creator_share;
        **ctx.accounts.fee_wallet.try_borrow_mut_lamports()? += treasury_share;
        **ctx.accounts.rewards_sol_wallet.try_borrow_mut_lamports()? += rewards_share;

        lp_lock.total_fees_claimed_lamports = lp_lock
            .total_fees_claimed_lamports
            .checked_add(pool_lamports)
            .ok_or(error!(HumbleError::MathOverflow))?;
        lp_lock.last_claim_time = now;

        emit!(LpFeesClaimed {
            token_mint: lp_lock.token_mint,
            creator_share,
            treasury_share,
            rewards_share,
            timestamp: now,
        });

        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4.6 — Launch Certificate (Soulbound, stored as PDA)
    // Token-2022 NonTransferable NFT mint is handled client-side and linked here.
    // ─────────────────────────────────────────────────────────────────────────

    pub fn mint_launch_certificate(ctx: Context<MintLaunchCertificate>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let meta = &ctx.accounts.token_metadata;

        require_keys_eq!(meta.creator, ctx.accounts.creator.key(), HumbleError::Unauthorized);

        let global = &mut ctx.accounts.global_state;
        global.certificate_counter = global.certificate_counter.saturating_add(1);
        let serial = global.certificate_counter;

        let cert = &mut ctx.accounts.launch_certificate;
        cert.creator = ctx.accounts.creator.key();
        cert.token_mint = ctx.accounts.mint.key();
        cert.certificate_nft_mint = ctx.accounts.certificate_nft_mint.key();
        cert.lock_percent = meta.lock_percent;
        cert.lock_days = meta.lock_days;
        cert.initial_trust_score = meta.trust_score;
        cert.is_premium = meta.is_premium;
        cert.airdrop_percent = meta.airdrop_percent;
        cert.burn_option = meta.burn_option;
        cert.issued_at = now;
        cert.serial_number = serial;
        cert.bump = ctx.bumps.launch_certificate;

        // Mint 1 Token-2022 NonTransferable NFT to creator.
        // The certificate_nft_mint must be a pre-initialized Token-2022 mint
        // with the NonTransferable extension enabled (set up client-side before this call).
        let bump = ctx.bumps.launch_certificate;
        let token_mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[b"launch_cert", token_mint_key.as_ref(), &[bump]];
        let signer = &[seeds];

        interface_mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_2022_program.to_account_info(),
                InterfaceMintTo {
                    mint: ctx.accounts.certificate_nft_mint.to_account_info(),
                    to: ctx.accounts.creator_nft_account.to_account_info(),
                    authority: ctx.accounts.launch_certificate.to_account_info(),
                },
                signer,
            ),
            1,
        )?;

        emit!(LaunchCertificateIssued {
            serial_number: serial,
            token_mint: cert.token_mint,
            creator: cert.creator,
            certificate_nft_mint: cert.certificate_nft_mint,
            initial_trust_score: cert.initial_trust_score,
            timestamp: now,
        });

        Ok(())
    }

    // One-time global state initialization (called by deployer)
    pub fn init_global_state(ctx: Context<InitGlobalState>) -> Result<()> {
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

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 5 — Mainnet governance & safety
    // ─────────────────────────────────────────────────────────────────────────

    // Adjust launch fees without redeployment (e.g. when SOL price changes).
    // standard_fee < premium_fee always enforced.
    pub fn update_fee_parameters(
        ctx: Context<Phase5Authority>,
        standard_fee_lamports: u64,
        premium_fee_lamports: u64,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(ctx.accounts.authority.key(), global.authority, HumbleError::Unauthorized);
        require!(standard_fee_lamports > 0, HumbleError::InvalidSupply);
        require!(premium_fee_lamports > standard_fee_lamports, HumbleError::InvalidSupply);
        global.standard_fee_lamports = standard_fee_lamports;
        global.premium_fee_lamports = premium_fee_lamports;
        emit!(FeeParametersUpdated {
            standard_fee_lamports,
            premium_fee_lamports,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // Point upgrade_authority to a Squads multisig before mainnet launch.
    // After calling this, the multisig controls program upgrade authority.
    pub fn set_upgrade_authority(
        ctx: Context<Phase5Authority>,
        new_upgrade_authority: Pubkey,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(ctx.accounts.authority.key(), global.authority, HumbleError::Unauthorized);
        global.upgrade_authority = new_upgrade_authority;
        Ok(())
    }

    // Emergency pause: flip is_launches_paused. Prevents new token launches.
    // Used if a critical vulnerability is discovered before audit completes.
    pub fn toggle_launches_pause(ctx: Context<Phase5Authority>) -> Result<()> {
        let global = &mut ctx.accounts.global_state;
        require_keys_eq!(ctx.accounts.authority.key(), global.authority, HumbleError::Unauthorized);
        global.is_launches_paused = !global.is_launches_paused;
        emit!(LaunchesPauseToggled {
            is_paused: global.is_launches_paused,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTokenWithLock<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: проверяется вручную
    #[account(mut)]
    pub fee_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + TokenMetadata::INIT_SPACE,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

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
        seeds = [b"locked_vault", mint.key().as_ref()],
        bump
    )]
    pub locked_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"creator_vault", mint.key().as_ref()],
        bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"circulation_vault", mint.key().as_ref()],
        bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = token_metadata,
        seeds = [b"rewards_vault", mint.key().as_ref()],
        bump
    )]
    pub rewards_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnlockLockedTokens<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"locked_vault", mint.key().as_ref()],
        bump = token_metadata.locked_vault_bump
    )]
    pub locked_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UseVestingTranche<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_vault", mint.key().as_ref()],
        bump = token_metadata.creator_vault_bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"rewards_vault", mint.key().as_ref()],
        bump = token_metadata.rewards_vault_bump
    )]
    pub rewards_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_receive_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddToCirculation<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_vault", mint.key().as_ref()],
        bump = token_metadata.creator_vault_bump
    )]
    pub creator_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"circulation_vault", mint.key().as_ref()],
        bump = token_metadata.circulation_vault_bump
    )]
    pub circulation_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        constraint = voter_token_account.owner == voter.key() @ HumbleError::InvalidTokenAccountOwner,
        constraint = voter_token_account.mint == mint.key() @ HumbleError::InvalidMintForTokenAccount
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", mint.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(buyer: Pubkey, seller: Pubkey, amount: u64, buy_time: i64, suspected_wash: bool)]
pub struct RecordTrade<'info> {
    // Only the designated metrics_authority may record trades.
    // Prevents arbitrary callers from inflating trading_volume / verified_volume.
    #[account(mut)]
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = metrics_authority,
        space = 8 + TradeRecord::INIT_SPACE,
        seeds = [b"trade", mint.key().as_ref(), buyer.as_ref(), &buy_time.to_le_bytes()],
        bump
    )]
    pub trade_record: Account<'info, TradeRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMetrics<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct ExecuteAirdropEpoch<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"locked_vault", mint.key().as_ref()],
        bump = token_metadata.locked_vault_bump
    )]
    pub locked_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"rewards_vault", mint.key().as_ref()],
        bump = token_metadata.rewards_vault_bump
    )]
    pub rewards_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct VerifyCreator<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct SetMetricsAuthority<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub mint: Account<'info, Mint>,
}

// ─── Phase 4.5 ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitCreatorReputation<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + CreatorReputation::INIT_SPACE,
        seeds = [b"creator_reputation", creator.key().as_ref()],
        bump
    )]
    pub creator_reputation: Account<'info, CreatorReputation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordReputationEvent<'info> {
    pub metrics_authority: Signer<'info>,

    #[account(
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"creator_reputation", token_metadata.creator.as_ref()],
        bump = creator_reputation.bump
    )]
    pub creator_reputation: Account<'info, CreatorReputation>,
}

// ─── Phase 4 ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct LockLpTokens<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"token_metadata", token_mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    pub token_mint: Account<'info, Mint>,

    pub lp_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = creator_lp_account.owner == creator.key() @ HumbleError::InvalidTokenAccountOwner,
        constraint = creator_lp_account.mint == lp_mint.key() @ HumbleError::InvalidMintForTokenAccount
    )]
    pub creator_lp_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpLock::INIT_SPACE,
        seeds = [b"lp_lock", token_mint.key().as_ref()],
        bump
    )]
    pub lp_lock: Account<'info, LpLock>,

    #[account(
        init,
        payer = creator,
        token::mint = lp_mint,
        token::authority = lp_lock,
        seeds = [b"lp_vault", token_mint.key().as_ref()],
        bump
    )]
    pub lp_vault: Account<'info, TokenAccount>,

    // Fee pool: program-owned PDA that accumulates SOL from Raydium harvest CPIs.
    // Initialized here so claim_lp_fees can manipulate its lamports.
    #[account(
        init,
        payer = creator,
        space = 8 + LpFeePool::INIT_SPACE,
        seeds = [b"lp_fee_pool", token_mint.key().as_ref()],
        bump
    )]
    pub lp_fee_pool: Account<'info, LpFeePool>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimLpFees<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lp_lock", lp_lock.token_mint.as_ref()],
        bump = lp_lock.bump
    )]
    pub lp_lock: Account<'info, LpLock>,

    #[account(
        mut,
        seeds = [b"lp_fee_pool", lp_lock.token_mint.as_ref()],
        bump = lp_lock.lp_fee_pool_bump
    )]
    pub lp_fee_pool: Account<'info, LpFeePool>,

    /// CHECK: verified as FEE_WALLET constant
    #[account(mut, constraint = fee_wallet.key() == FEE_WALLET @ HumbleError::InvalidFeeWallet)]
    pub fee_wallet: UncheckedAccount<'info>,

    /// CHECK: DAO/rewards wallet, any pubkey accepted
    #[account(mut)]
    pub rewards_sol_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ─── Phase 5 ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Phase5Authority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
}

// ─── Phase 4.6 ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitGlobalState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintLaunchCertificate<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    // mint must be declared before token_metadata so its key can be used in seeds
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"token_metadata", mint.key().as_ref()],
        bump = token_metadata.bump
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = creator,
        space = 8 + LaunchCertificate::INIT_SPACE,
        seeds = [b"launch_cert", mint.key().as_ref()],
        bump
    )]
    pub launch_certificate: Account<'info, LaunchCertificate>,

    // Pre-initialized Token-2022 NonTransferable mint; authority = launch_certificate PDA
    /// CHECK: pre-initialized Token-2022 mint with NonTransferable extension, validated by CPI
    #[account(mut)]
    pub certificate_nft_mint: UncheckedAccount<'info>,

    // Creator's ATA for the certificate NFT (Token-2022)
    /// CHECK: creator's token-2022 ATA, validated by CPI
    #[account(mut)]
    pub creator_nft_account: UncheckedAccount<'info>,

    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenMetadata {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub metrics_authority: Pubkey,
    #[max_len(16)]
    pub name: String,
    #[max_len(5)]
    pub symbol: String,
    pub total_supply: u64,
    pub locked_amount: u64,
    pub creator_allocation: u64,
    pub creator_allocation_percent: u8,   // stored explicitly for display / vesting math
    pub creator_max_balance: u64,
    pub circulation_amount: u64,
    pub unlock_time: i64,
    pub created_at: i64,
    pub lock_percent: u8,
    pub lock_days: u16,                   // stored explicitly; avoids deriving from unlock_time
    pub burn_option: u8,
    pub airdrop_percent: u8,
    pub is_locked: bool,
    pub trading_volume: u64,
    pub verified_volume: u64,
    pub holder_count: u32,
    pub trust_score: u8,
    pub min_score_this_month: u8,
    pub total_burned: u64,
    pub is_verified: bool,
    pub last_airdrop_time: i64,
    pub total_airdrops_executed: u32,
    pub vesting_t1_done: bool,
    pub vesting_t2_done: bool,
    pub vesting_t3_done: bool,
    pub vesting_t1_action: u8,
    pub vesting_t2_action: u8,
    pub vesting_t3_action: u8,
    pub positive_votes: u32,
    pub negative_votes: u32,
    pub complaints_count: u32,
    pub is_flagged: bool,
    pub is_frozen: bool,
    pub no_activity_flag: bool,
    pub rewards_multiplier_bps: u16,
    pub trading_unlock_time: i64,
    pub is_premium: bool,
    pub anti_bot_seconds: u16,
    pub bump: u8,
    pub locked_vault_bump: u8,
    pub creator_vault_bump: u8,
    pub circulation_vault_bump: u8,
    pub rewards_vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TradeRecord {
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
pub struct VoteRecord {
    pub voter: Pubkey,
    pub mint: Pubkey,
    pub is_positive: bool,
    pub complaint_category: u8,
    pub timestamp: i64,
    pub bump: u8,
}

// ─── Phase 4.5 ─────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct CreatorReputation {
    pub creator: Pubkey,
    pub total_launches: u32,
    pub trust_score_sum: u32,
    pub successful_unlocks: u32,
    pub complaints_total: u32,
    pub score_bonus: u8,    // +5 applied to the next token's initial TrustScore
    pub bump: u8,
}

// ─── Phase 4 ───────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct LpLock {
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
pub struct LpFeePool {
    pub token_mint: Pubkey,
    pub bump: u8,
}

// ─── Phase 4.6 ─────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub certificate_counter: u32,
    pub authority: Pubkey,
    // Phase 5: fees kept in state so authority can adjust without redeployment
    pub standard_fee_lamports: u64,
    pub premium_fee_lamports: u64,
    // Phase 5: intended multisig (Squads v4 or similar) for upgrade authority hand-off
    pub upgrade_authority: Pubkey,
    // Phase 5: emergency pause — blocks new token launches
    pub is_launches_paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchCertificate {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub certificate_nft_mint: Pubkey,   // Token-2022 NonTransferable mint
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

// ───────────────────────────────────────────────────────────────────────────

#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub total_supply: u64,
    pub locked_amount: u64,
    pub creator_allocation: u64,
    pub circulation_amount: u64,
    pub trust_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct LockedTokensUnlocked {
    pub mint: Pubkey,
    pub burned_amount: u64,
    pub released_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VestingTrancheUsed {
    pub mint: Pubkey,
    pub tranche: u8,
    pub action: u8,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CirculationAdded {
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VoteSubmitted {
    pub mint: Pubkey,
    pub voter: Pubkey,
    pub is_positive: bool,
    pub complaint_category: u8,
    pub timestamp: i64,
}

#[event]
pub struct TokenFrozen {
    pub mint: Pubkey,
    pub complaints_count: u32,
    pub trust_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct TrustScoreUpdated {
    pub mint: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct AirdropEpochExecuted {
    pub mint: Pubkey,
    pub pool_amount: u64,
    pub epoch_number: u32,
    pub timestamp: i64,
}

#[event]
pub struct CreatorVerified {
    pub mint: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct LpLocked {
    pub token_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub creator: Pubkey,
    pub lp_amount: u64,
    pub lock_days: u16,
    pub unlock_time: i64,
    pub timestamp: i64,
}

#[event]
pub struct LpFeesClaimed {
    pub token_mint: Pubkey,
    pub creator_share: u64,
    pub treasury_share: u64,
    pub rewards_share: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeParametersUpdated {
    pub standard_fee_lamports: u64,
    pub premium_fee_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct LaunchesPauseToggled {
    pub is_paused: bool,
    pub timestamp: i64,
}

#[event]
pub struct LaunchCertificateIssued {
    pub serial_number: u32,
    pub token_mint: Pubkey,
    pub creator: Pubkey,
    pub certificate_nft_mint: Pubkey,
    pub initial_trust_score: u8,
    pub timestamp: i64,
}

#[error_code]
pub enum HumbleError {
    #[msg("Token name is too short")]
    NameTooShort,
    #[msg("Token name max 16 characters")]
    NameTooLong,
    #[msg("Ticker symbol is too short")]
    SymbolTooShort,
    #[msg("Ticker symbol max 5 characters")]
    SymbolTooLong,
    #[msg("Invalid supply")]
    InvalidSupply,
    #[msg("Lock must be between 30% and 80%")]
    InvalidLockPercent,
    #[msg("Lock duration must be between 30 and 360 days")]
    InvalidLockDays,
    #[msg("Burn option must be 25 or 50")]
    InvalidBurnOption,
    #[msg("Creator allocation max is 10%")]
    CreatorAllocationTooHigh,
    #[msg("Circulation must be at least 55%")]
    InsufficientCirculation,
    #[msg("Airdrop percent must be 0, 2, 5 or 8")]
    InvalidAirdropPercent,
    #[msg("Invalid fee wallet")]
    InvalidFeeWallet,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Tokens are still locked")]
    TokensStillLocked,
    #[msg("Locked tokens already unlocked")]
    AlreadyUnlocked,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Vesting tranche is not ready yet")]
    VestingNotReady,
    #[msg("This vesting tranche was already used")]
    VestingTrancheDone,
    #[msg("Invalid tranche number")]
    InvalidTranche,
    #[msg("Invalid action")]
    InvalidAction,
    #[msg("Token is frozen")]
    TokenFrozen,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Invalid creator receiving token account")]
    InvalidCreatorReceiveAccount,
    #[msg("Invalid mint for token account")]
    InvalidMintForTokenAccount,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Insufficient balance to vote")]
    InsufficientBalanceToVote,
    #[msg("Airdrop disabled")]
    AirdropDisabled,
    #[msg("Airdrop not eligible this month")]
    AirdropNotEligible,
    #[msg("Airdrop too early")]
    AirdropTooEarly,
    #[msg("Invalid tier (must be 0 or 1)")]
    InvalidTier,
    #[msg("Anti-bot seconds max 600")]
    InvalidAntiBotSeconds,
    #[msg("Trading not started yet (anti-bot delay)")]
    TradingNotStarted,
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    #[msg("Invalid trade time")]
    InvalidTradeTime,
    #[msg("Buyer and seller cannot be the same address")]
    SelfTrade,
    #[msg("LP lock already exists for this token")]
    LpAlreadyLocked,
    #[msg("Global state already initialized")]
    AlreadyInitialized,
    #[msg("Certificate already issued for this token")]
    CertificateAlreadyIssued,
    #[msg("New token launches are temporarily paused")]
    LaunchesPaused,
    #[msg("Premium fee must be greater than standard fee")]
    InvalidFeeParameters,
}

fn percent_of(amount: u64, percent: u64) -> Result<u64> {
    amount
        .checked_mul(percent)
        .and_then(|v| v.checked_div(100))
        .ok_or(error!(HumbleError::MathOverflow))
}

fn calculate_initial_trust_score(
    lock_percent: u8,
    lock_days: u16,
    burn_option: u8,
    airdrop_percent: u8,
) -> u8 {
    let mut score: u16 = 0;

    score += match lock_days {
        360.. => 25,
        270..=359 => 20,
        180..=269 => 16,
        90..=179 => 12,
        60..=89 => 8,
        _ => 4,
    };

    score += match lock_percent {
        60..=u8::MAX => 18,
        50..=59 => 15,
        40..=49 => 11,
        _ => 6,
    };

    score += if burn_option == 50 { 12 } else { 6 };

    score += match airdrop_percent {
        8 => 10,
        5 => 6,
        2 => 3,
        _ => 0,
    };

    score.min(100) as u8
}

fn rewards_multiplier_bps(score: u8) -> u16 {
    match score {
        81..=100 => 20_000,
        66..=80 => 15_000,
        51..=65 => 10_000,
        _ => 10_000,
    }
}

fn recalculate_trust_score(meta: &TokenMetadata, now: i64) -> u8 {
    let mut score: i16 = 0;

    let days_remaining = ((meta.unlock_time - now) / SECONDS_PER_DAY).max(0) as u16;
    score += match days_remaining {
        360.. => 25,
        270..=359 => 20,
        180..=269 => 16,
        90..=179 => 12,
        60..=89 => 8,
        1..=59 => 4,
        _ => 0,
    };

    score += match meta.lock_percent {
        60..=u8::MAX => 18,
        50..=59 => 15,
        40..=49 => 11,
        _ => 6,
    };

    score += if meta.burn_option == 50 { 12 } else { 6 };

    if !meta.is_locked && meta.total_burned > 0 {
        score += 8;
    }

    score += match meta.airdrop_percent {
        8 => 10,
        5 => 6,
        2 => 3,
        _ => 0,
    };

    let age_days = ((now - meta.created_at) / SECONDS_PER_DAY).max(0) as u16;
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

    score.clamp(0, 100) as u8
}
