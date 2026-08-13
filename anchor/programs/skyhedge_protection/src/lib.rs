use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("HY3EyQW3qvZfqWPHn5nwUfY5FwHTFxTzVgjntG8ERCEK");

pub const BPS_DENOMINATOR: u128 = 10_000;
pub const PROTOCOL_FEE_BPS: u16 = 100;
pub const RISK_LOADING_BPS: u16 = 1_500;
pub const MIN_PROBABILITY_BPS: u16 = 100;
pub const MAX_PROBABILITY_BPS: u16 = 9_000;
pub const DATA_GRACE_SECONDS: i64 = 7 * 24 * 60 * 60;
pub const CLAIM_WINDOW_SECONDS: i64 = 30 * 24 * 60 * 60;

#[program]
pub mod skyhedge_protection {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, settlement_authority: Pubkey) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol;
        protocol.admin = ctx.accounts.admin.key();
        protocol.pending_admin = Pubkey::default();
        protocol.settlement_authority = settlement_authority;
        protocol.pending_settlement_authority = Pubkey::default();
        protocol.collateral_mint = ctx.accounts.collateral_mint.key();
        protocol.token_program = ctx.accounts.token_program.key();
        protocol.next_market_id = 0;
        protocol.paused = false;
        protocol.bump = ctx.bumps.protocol;
        Ok(())
    }

    pub fn propose_admin(ctx: Context<AdminOnly>, pending_admin: Pubkey) -> Result<()> {
        require!(pending_admin != Pubkey::default(), ErrorCode::InvalidAuthority);
        ctx.accounts.protocol.pending_admin = pending_admin;
        emit!(AuthorityProposed { role: AuthorityRole::Admin, authority: pending_admin });
        Ok(())
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        require_keys_eq!(ctx.accounts.accepting_admin.key(), ctx.accounts.protocol.pending_admin, ErrorCode::UnauthorizedAuthority);
        let protocol = &mut ctx.accounts.protocol;
        protocol.admin = protocol.pending_admin;
        protocol.pending_admin = Pubkey::default();
        emit!(AuthorityAccepted { role: AuthorityRole::Admin, authority: protocol.admin });
        Ok(())
    }

    pub fn propose_settlement_authority(ctx: Context<AdminOnly>, pending_authority: Pubkey) -> Result<()> {
        require!(pending_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
        ctx.accounts.protocol.pending_settlement_authority = pending_authority;
        emit!(AuthorityProposed { role: AuthorityRole::Settlement, authority: pending_authority });
        Ok(())
    }

    pub fn accept_settlement_authority(ctx: Context<AcceptSettlementAuthority>) -> Result<()> {
        require_keys_eq!(ctx.accounts.accepting_authority.key(), ctx.accounts.protocol.pending_settlement_authority, ErrorCode::UnauthorizedAuthority);
        let protocol = &mut ctx.accounts.protocol;
        protocol.settlement_authority = protocol.pending_settlement_authority;
        protocol.pending_settlement_authority = Pubkey::default();
        emit!(AuthorityAccepted { role: AuthorityRole::Settlement, authority: protocol.settlement_authority });
        Ok(())
    }

    pub fn set_pause(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.protocol.paused = paused;
        emit!(PauseChanged { paused });
        Ok(())
    }

    pub fn create_market(ctx: Context<CreateMarket>, args: CreateMarketArgs) -> Result<()> {
        require!(!ctx.accounts.protocol.paused, ErrorCode::Paused);
        args.validate()?;
        let protocol = &mut ctx.accounts.protocol;
        let market = &mut ctx.accounts.market;
        market.id = protocol.next_market_id;
        protocol.next_market_id = protocol.next_market_id.checked_add(1).ok_or(ErrorCode::MathOverflow)?;
        market.protocol = protocol.key();
        market.creator = ctx.accounts.admin.key();
        market.city_hash = args.city_hash;
        market.station_id_hash = args.station_id_hash;
        market.provider_hash = args.provider_hash;
        market.methodology_hash = args.methodology_hash;
        market.quote_inputs_hash = args.quote_inputs_hash;
        market.operator = args.operator;
        market.threshold_mm_x100 = args.threshold_mm_x100;
        market.sales_close_at = args.sales_close_at;
        market.observation_start = args.observation_start;
        market.observation_end = args.observation_end;
        market.data_deadline = args.observation_end.checked_add(DATA_GRACE_SECONDS).ok_or(ErrorCode::MathOverflow)?;
        market.claim_deadline = market.data_deadline.checked_add(CLAIM_WINDOW_SECONDS).ok_or(ErrorCode::MathOverflow)?;
        market.quote_probability_bps = args.quote_probability_bps;
        market.premium_rate_bps = premium_rate_bps(args.quote_probability_bps)?;
        market.max_liquidity = args.max_liquidity;
        market.max_exposure = args.max_exposure;
        market.per_wallet_max = args.per_wallet_max;
        market.total_shares = 0;
        market.remaining_shares = 0;
        market.reserved_exposure = 0;
        market.premium_balance = 0;
        market.accrued_protocol_fees = 0;
        market.payout_liability = 0;
        market.refund_liability = 0;
        market.remaining_redemption_assets = 0;
        market.status = MarketStatus::Draft;
        market.result = SettlementResult::Unset;
        market.bump = ctx.bumps.market;
        emit!(MarketCreated { market: market.key(), id: market.id, premium_rate_bps: market.premium_rate_bps });
        Ok(())
    }

    pub fn open_market(ctx: Context<OpenMarket>) -> Result<()> {
        require!(!ctx.accounts.protocol.paused, ErrorCode::Paused);
        require!(ctx.accounts.market.status == MarketStatus::Draft, ErrorCode::InvalidMarketStatus);
        require!(ctx.accounts.market.total_shares > 0, ErrorCode::InsufficientLiquidity);
        ctx.accounts.market.status = MarketStatus::Open;
        Ok(())
    }

    pub fn fund_pool(ctx: Context<UpdateLiquidity>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(!ctx.accounts.protocol.paused, ErrorCode::Paused);
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(matches!(market.status, MarketStatus::Draft | MarketStatus::Open), ErrorCode::InvalidMarketStatus);
        require!(now < market.sales_close_at, ErrorCode::LiquidityWindowClosed);
        let next_shares = market.total_shares.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;
        require!(next_shares <= market.max_liquidity, ErrorCode::LiquidityCapExceeded);
        transfer_from_user(&ctx.accounts.token_program, &ctx.accounts.provider_token_account, &ctx.accounts.vault, &ctx.accounts.provider, &ctx.accounts.collateral_mint, amount)?;
        market.total_shares = next_shares;
        market.remaining_shares = next_shares;
        let lp = &mut ctx.accounts.liquidity_position;
        if lp.provider == Pubkey::default() {
            lp.market = market.key();
            lp.provider = ctx.accounts.provider.key();
        }
        lp.shares = lp.shares.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;
        emit!(LiquidityFunded { market: market.key(), provider: lp.provider, amount });
        Ok(())
    }

    pub fn withdraw_liquidity(ctx: Context<UpdateLiquidity>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(!ctx.accounts.protocol.paused, ErrorCode::Paused);
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(matches!(market.status, MarketStatus::Draft | MarketStatus::Open), ErrorCode::InvalidMarketStatus);
        require!(now < market.sales_close_at, ErrorCode::LiquidityWindowClosed);
        require!(ctx.accounts.liquidity_position.shares >= amount, ErrorCode::InsufficientShares);
        let post_withdrawal = ctx.accounts.vault.amount.checked_sub(amount).ok_or(ErrorCode::InsufficientLiquidity)?;
        require!(post_withdrawal >= market.reserved_exposure, ErrorCode::InsufficientLiquidity);
        market.total_shares = market.total_shares.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        market.remaining_shares = market.total_shares;
        ctx.accounts.liquidity_position.shares = ctx.accounts.liquidity_position.shares.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        transfer_from_market(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.provider_token_account, market, &ctx.accounts.collateral_mint, amount)?;
        emit!(LiquidityWithdrawn { market: market.key(), provider: ctx.accounts.provider.key(), amount });
        Ok(())
    }

    pub fn open_position(ctx: Context<OpenPosition>, protected_amount: u64) -> Result<()> {
        require!(protected_amount > 0, ErrorCode::InvalidAmount);
        require!(!ctx.accounts.protocol.paused, ErrorCode::Paused);
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, ErrorCode::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp < market.sales_close_at, ErrorCode::PositionWindowClosed);
        require!(protected_amount <= market.per_wallet_max, ErrorCode::WalletCoverageCapExceeded);
        let premium = ceil_bps(protected_amount, market.premium_rate_bps)?;
        let protocol_fee = ceil_bps(protected_amount, PROTOCOL_FEE_BPS)?;
        require!(premium >= protocol_fee, ErrorCode::InvalidPremium);
        let reserved = market.reserved_exposure.checked_add(protected_amount).ok_or(ErrorCode::MathOverflow)?;
        require!(reserved <= market.max_exposure, ErrorCode::InsufficientLiquidity);
        let post_premium_vault = ctx.accounts.vault.amount.checked_add(premium).ok_or(ErrorCode::MathOverflow)?;
        require!(post_premium_vault >= reserved, ErrorCode::InsufficientLiquidity);
        transfer_from_user(&ctx.accounts.token_program, &ctx.accounts.owner_token_account, &ctx.accounts.vault, &ctx.accounts.owner, &ctx.accounts.collateral_mint, premium)?;
        market.reserved_exposure = reserved;
        market.premium_balance = market.premium_balance.checked_add(premium).ok_or(ErrorCode::MathOverflow)?;
        market.accrued_protocol_fees = market.accrued_protocol_fees.checked_add(protocol_fee).ok_or(ErrorCode::MathOverflow)?;
        let position = &mut ctx.accounts.position;
        position.market = market.key();
        position.owner = ctx.accounts.owner.key();
        position.protected_amount = protected_amount;
        position.premium_paid = premium;
        position.potential_payout = protected_amount;
        position.opened_at = Clock::get()?.unix_timestamp;
        position.payout_claimed = false;
        position.refund_claimed = false;
        emit!(PositionOpened { market: market.key(), owner: position.owner, premium, potential_payout: protected_amount });
        Ok(())
    }

    pub fn lock_market(ctx: Context<AdvanceMarket>) -> Result<()> {
        require!(ctx.accounts.market.status == MarketStatus::Open, ErrorCode::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp >= ctx.accounts.market.sales_close_at, ErrorCode::PositionWindowOpen);
        ctx.accounts.market.status = MarketStatus::Locked;
        emit!(MarketLocked { market: ctx.accounts.market.key() });
        Ok(())
    }

    pub fn begin_settlement(ctx: Context<AdvanceMarket>) -> Result<()> {
        require!(ctx.accounts.market.status == MarketStatus::Locked, ErrorCode::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp >= ctx.accounts.market.observation_end, ErrorCode::ObservationNotFinished);
        ctx.accounts.market.status = MarketStatus::AwaitingSettlement;
        Ok(())
    }

    pub fn submit_weather_observation(ctx: Context<SubmitObservation>, args: SubmitObservationArgs) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::AwaitingSettlement, ErrorCode::InvalidMarketStatus);
        require_keys_eq!(ctx.accounts.authority.key(), ctx.accounts.protocol.settlement_authority, ErrorCode::UnauthorizedAuthority);
        require!(args.observed_at >= market.observation_start && args.observed_at <= market.observation_end, ErrorCode::InvalidObservationTime);
        require!(Clock::get()?.unix_timestamp <= market.data_deadline, ErrorCode::StaleObservation);
        let observation = &mut ctx.accounts.observation;
        observation.market = market.key();
        observation.authority = ctx.accounts.authority.key();
        observation.cumulative_rainfall_mm_x100 = args.cumulative_rainfall_mm_x100;
        observation.observed_at = args.observed_at;
        observation.source_hash = args.source_hash;
        observation.bump = ctx.bumps.observation;
        emit!(ObservationSubmitted { market: market.key(), value: args.cumulative_rainfall_mm_x100, source_hash: args.source_hash });
        Ok(())
    }

    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::AwaitingSettlement, ErrorCode::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp <= market.data_deadline, ErrorCode::StaleObservation);
        let triggered = market.operator.matches(ctx.accounts.observation.cumulative_rainfall_mm_x100, market.threshold_mm_x100);
        market.result = if triggered { SettlementResult::Triggered } else { SettlementResult::NotTriggered };
        market.payout_liability = if triggered { market.reserved_exposure } else { 0 };
        if !triggered { market.reserved_exposure = 0; }
        market.status = MarketStatus::Settled;
        emit!(MarketSettled { market: market.key(), result: market.result });
        Ok(())
    }

    pub fn mark_data_unavailable(ctx: Context<MarkDataUnavailable>, source_hash: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.market.status == MarketStatus::AwaitingSettlement, ErrorCode::InvalidMarketStatus);
        require_keys_eq!(ctx.accounts.authority.key(), ctx.accounts.protocol.settlement_authority, ErrorCode::UnauthorizedAuthority);
        require!(Clock::get()?.unix_timestamp > ctx.accounts.market.data_deadline, ErrorCode::DataDeadlineNotReached);
        let market = &mut ctx.accounts.market;
        market.result = SettlementResult::DataUnavailable;
        market.refund_liability = market.premium_balance;
        market.reserved_exposure = 0;
        market.status = MarketStatus::DataUnavailable;
        emit!(DataUnavailable { market: market.key(), source_hash });
        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPosition>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Settled && market.result == SettlementResult::Triggered, ErrorCode::NotClaimable);
        require!(Clock::get()?.unix_timestamp <= market.claim_deadline, ErrorCode::ClaimWindowClosed);
        require!(!ctx.accounts.position.payout_claimed, ErrorCode::AlreadyClaimed);
        let amount = ctx.accounts.position.potential_payout;
        ctx.accounts.position.payout_claimed = true;
        market.payout_liability = market.payout_liability.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        market.reserved_exposure = market.reserved_exposure.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        transfer_from_market(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.owner_token_account, market, &ctx.accounts.collateral_mint, amount)?;
        emit!(PayoutClaimed { market: market.key(), owner: ctx.accounts.owner.key(), amount });
        Ok(())
    }

    pub fn claim_premium_refund(ctx: Context<ClaimPosition>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::DataUnavailable, ErrorCode::NotRefundable);
        require!(Clock::get()?.unix_timestamp <= market.claim_deadline, ErrorCode::ClaimWindowClosed);
        require!(!ctx.accounts.position.refund_claimed, ErrorCode::AlreadyRefunded);
        let amount = ctx.accounts.position.premium_paid;
        ctx.accounts.position.refund_claimed = true;
        market.refund_liability = market.refund_liability.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        transfer_from_market(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.owner_token_account, market, &ctx.accounts.collateral_mint, amount)?;
        emit!(PremiumRefunded { market: market.key(), owner: ctx.accounts.owner.key(), amount });
        Ok(())
    }

    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        require!(matches!(ctx.accounts.market.status, MarketStatus::Settled | MarketStatus::DataUnavailable), ErrorCode::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp > ctx.accounts.market.claim_deadline, ErrorCode::ClaimWindowOpen);
        let market = &mut ctx.accounts.market;
        let fee = market.accrued_protocol_fees;
        if fee > 0 {
            transfer_from_market(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.fee_vault, market, &ctx.accounts.collateral_mint, fee)?;
        }
        market.accrued_protocol_fees = 0;
        market.payout_liability = 0;
        market.refund_liability = 0;
        market.remaining_redemption_assets = ctx.accounts.vault.amount.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;
        market.remaining_shares = market.total_shares;
        market.status = MarketStatus::Closed;
        emit!(MarketClosed { market: market.key(), redemption_assets: market.remaining_redemption_assets, fee });
        Ok(())
    }

    pub fn redeem_closed_liquidity(ctx: Context<RedeemClosedLiquidity>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Closed, ErrorCode::InvalidMarketStatus);
        let shares = ctx.accounts.liquidity_position.shares;
        require!(shares > 0 && !ctx.accounts.liquidity_position.redeemed, ErrorCode::AlreadyRedeemed);
        let amount = if shares == market.remaining_shares { market.remaining_redemption_assets } else {
            ((market.remaining_redemption_assets as u128)
                .checked_mul(shares as u128).ok_or(ErrorCode::MathOverflow)?
                / market.remaining_shares as u128)
                .try_into().map_err(|_| error!(ErrorCode::MathOverflow))?
        };
        ctx.accounts.liquidity_position.redeemed = true;
        market.remaining_shares = market.remaining_shares.checked_sub(shares).ok_or(ErrorCode::MathOverflow)?;
        market.remaining_redemption_assets = market.remaining_redemption_assets.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
        if amount > 0 { transfer_from_market(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.provider_token_account, market, &ctx.accounts.collateral_mint, amount)?; }
        emit!(LiquidityRedeemed { market: market.key(), provider: ctx.accounts.provider.key(), shares, amount });
        Ok(())
    }

    pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>, amount: u64) -> Result<()> {
        require!(amount > 0 && ctx.accounts.fee_vault.amount >= amount, ErrorCode::InvalidAmount);
        let protocol_bump = [ctx.accounts.protocol.bump];
        let signer: &[&[u8]] = &[b"protocol", &protocol_bump];
        let cpi_accounts = TransferChecked { from: ctx.accounts.fee_vault.to_account_info(), mint: ctx.accounts.collateral_mint.to_account_info(), to: ctx.accounts.admin_token_account.to_account_info(), authority: ctx.accounts.protocol.to_account_info() };
        token_interface::transfer_checked(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, &[signer]), amount, ctx.accounts.collateral_mint.decimals)
    }
}

fn transfer_from_user<'info>(token_program: &Interface<'info, TokenInterface>, from: &InterfaceAccount<'info, TokenAccount>, to: &InterfaceAccount<'info, TokenAccount>, authority: &Signer<'info>, mint: &InterfaceAccount<'info, Mint>, amount: u64) -> Result<()> {
    let cpi_accounts = TransferChecked { from: from.to_account_info(), mint: mint.to_account_info(), to: to.to_account_info(), authority: authority.to_account_info() };
    token_interface::transfer_checked(CpiContext::new(token_program.to_account_info(), cpi_accounts), amount, mint.decimals)
}

fn transfer_from_market<'info>(token_program: &Interface<'info, TokenInterface>, from: &InterfaceAccount<'info, TokenAccount>, to: &InterfaceAccount<'info, TokenAccount>, market: &Account<'info, Market>, mint: &InterfaceAccount<'info, Mint>, amount: u64) -> Result<()> {
    let protocol = market.protocol;
    let id = market.id.to_le_bytes();
    let bump = [market.bump];
    let signer: &[&[u8]] = &[b"market", protocol.as_ref(), &id, &bump];
    let cpi_accounts = TransferChecked { from: from.to_account_info(), mint: mint.to_account_info(), to: to.to_account_info(), authority: market.to_account_info() };
    token_interface::transfer_checked(CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, &[signer]), amount, mint.decimals)
}

fn ceil_bps(amount: u64, bps: u16) -> Result<u64> { (((amount as u128).checked_mul(bps as u128).ok_or(ErrorCode::MathOverflow)? + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR).try_into().map_err(|_| error!(ErrorCode::MathOverflow)) }
fn premium_rate_bps(probability_bps: u16) -> Result<u16> {
    require!(probability_bps >= MIN_PROBABILITY_BPS && probability_bps <= MAX_PROBABILITY_BPS, ErrorCode::InvalidProbability);
    let loaded = ((probability_bps as u128) * (BPS_DENOMINATOR + RISK_LOADING_BPS as u128) + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
    let rate = loaded.checked_add(PROTOCOL_FEE_BPS as u128).ok_or(ErrorCode::MathOverflow)?;
    rate.try_into().map_err(|_| error!(ErrorCode::MathOverflow))
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> { #[account(mut)] pub admin: Signer<'info>, #[account(init, payer = admin, space = 8 + ProtocolConfig::INIT_SPACE, seeds = [b"protocol"], bump)] pub protocol: Account<'info, ProtocolConfig>, #[account(init, payer = admin, seeds = [b"fee-vault", protocol.key().as_ref()], bump, token::mint = collateral_mint, token::authority = protocol, token::token_program = token_program)] pub fee_vault: InterfaceAccount<'info, TokenAccount>, pub collateral_mint: InterfaceAccount<'info, Mint>, pub token_program: Interface<'info, TokenInterface>, pub system_program: Program<'info, System> }
#[derive(Accounts)] pub struct AdminOnly<'info> { #[account(mut, seeds = [b"protocol"], bump = protocol.bump, has_one = admin)] pub protocol: Account<'info, ProtocolConfig>, pub admin: Signer<'info> }
#[derive(Accounts)] pub struct AcceptAdmin<'info> { #[account(mut, seeds = [b"protocol"], bump = protocol.bump)] pub protocol: Account<'info, ProtocolConfig>, pub accepting_admin: Signer<'info> }
#[derive(Accounts)] pub struct AcceptSettlementAuthority<'info> { #[account(mut, seeds = [b"protocol"], bump = protocol.bump)] pub protocol: Account<'info, ProtocolConfig>, pub accepting_authority: Signer<'info> }
#[derive(Accounts)] pub struct CreateMarket<'info> { #[account(mut)] pub admin: Signer<'info>, #[account(mut, seeds = [b"protocol"], bump = protocol.bump, has_one = admin)] pub protocol: Account<'info, ProtocolConfig>, #[account(init, payer = admin, space = 8 + Market::INIT_SPACE, seeds = [b"market", protocol.key().as_ref(), &protocol.next_market_id.to_le_bytes()], bump)] pub market: Account<'info, Market>, #[account(init, payer = admin, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market, token::token_program = token_program)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface>, pub system_program: Program<'info, System> }
#[derive(Accounts)] pub struct OpenMarket<'info> { #[account(mut)] pub admin: Signer<'info>, #[account(seeds = [b"protocol"], bump = protocol.bump, has_one = admin)] pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market> }
#[derive(Accounts)] pub struct UpdateLiquidity<'info> { #[account(mut)] pub provider: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market>, #[account(mut, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, token::mint = collateral_mint, token::authority = provider)] pub provider_token_account: InterfaceAccount<'info, TokenAccount>, #[account(init_if_needed, payer = provider, space = 8 + LiquidityPosition::INIT_SPACE, seeds = [b"liquidity", market.key().as_ref(), provider.key().as_ref()], bump)] pub liquidity_position: Account<'info, LiquidityPosition>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface>, pub system_program: Program<'info, System> }
#[derive(Accounts)] pub struct OpenPosition<'info> { #[account(mut)] pub owner: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market>, #[account(mut, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, token::mint = collateral_mint, token::authority = owner)] pub owner_token_account: InterfaceAccount<'info, TokenAccount>, #[account(init, payer = owner, space = 8 + ProtectionPosition::INIT_SPACE, seeds = [b"position", market.key().as_ref(), owner.key().as_ref()], bump)] pub position: Account<'info, ProtectionPosition>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface>, pub system_program: Program<'info, System> }
#[derive(Accounts)] pub struct AdvanceMarket<'info> { #[account(mut)] pub market: Account<'info, Market> }
#[derive(Accounts)] pub struct SubmitObservation<'info> { #[account(mut)] pub authority: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(has_one = protocol)] pub market: Account<'info, Market>, #[account(init, payer = authority, space = 8 + SettlementObservation::INIT_SPACE, seeds = [b"settlement", market.key().as_ref()], bump)] pub observation: Account<'info, SettlementObservation>, pub system_program: Program<'info, System> }
#[derive(Accounts)] pub struct SettleMarket<'info> { #[account(mut)] pub market: Account<'info, Market>, #[account(seeds = [b"settlement", market.key().as_ref()], bump = observation.bump, has_one = market)] pub observation: Account<'info, SettlementObservation> }
#[derive(Accounts)] pub struct MarkDataUnavailable<'info> { pub authority: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market> }
#[derive(Accounts)] pub struct ClaimPosition<'info> { pub owner: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market>, #[account(mut, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, has_one = market, has_one = owner)] pub position: Account<'info, ProtectionPosition>, #[account(mut, token::mint = collateral_mint, token::authority = owner)] pub owner_token_account: InterfaceAccount<'info, TokenAccount>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface> }
#[derive(Accounts)] pub struct CloseMarket<'info> { pub admin: Signer<'info>, #[account(seeds = [b"protocol"], bump = protocol.bump, has_one = admin)] pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market>, #[account(mut, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, seeds = [b"fee-vault", protocol.key().as_ref()], bump, token::mint = collateral_mint, token::authority = protocol)] pub fee_vault: InterfaceAccount<'info, TokenAccount>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface> }
#[derive(Accounts)] pub struct RedeemClosedLiquidity<'info> { pub provider: Signer<'info>, pub protocol: Account<'info, ProtocolConfig>, #[account(mut, has_one = protocol)] pub market: Account<'info, Market>, #[account(mut, seeds = [b"vault", market.key().as_ref()], bump, token::mint = collateral_mint, token::authority = market)] pub vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, has_one = market, has_one = provider)] pub liquidity_position: Account<'info, LiquidityPosition>, #[account(mut, token::mint = collateral_mint, token::authority = provider)] pub provider_token_account: InterfaceAccount<'info, TokenAccount>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface> }
#[derive(Accounts)] pub struct WithdrawProtocolFees<'info> { pub admin: Signer<'info>, #[account(seeds = [b"protocol"], bump = protocol.bump, has_one = admin)] pub protocol: Account<'info, ProtocolConfig>, #[account(mut, seeds = [b"fee-vault", protocol.key().as_ref()], bump, token::mint = collateral_mint, token::authority = protocol)] pub fee_vault: InterfaceAccount<'info, TokenAccount>, #[account(mut, token::mint = collateral_mint, token::authority = admin)] pub admin_token_account: InterfaceAccount<'info, TokenAccount>, #[account(address = protocol.collateral_mint)] pub collateral_mint: InterfaceAccount<'info, Mint>, #[account(address = protocol.token_program)] pub token_program: Interface<'info, TokenInterface> }

#[account] #[derive(InitSpace)] pub struct ProtocolConfig { pub admin: Pubkey, pub pending_admin: Pubkey, pub settlement_authority: Pubkey, pub pending_settlement_authority: Pubkey, pub collateral_mint: Pubkey, pub token_program: Pubkey, pub next_market_id: u64, pub paused: bool, pub bump: u8 }
#[account] #[derive(InitSpace)] pub struct Market { pub id: u64, pub protocol: Pubkey, pub creator: Pubkey, pub city_hash: [u8; 32], pub station_id_hash: [u8; 32], pub provider_hash: [u8; 32], pub methodology_hash: [u8; 32], pub quote_inputs_hash: [u8; 32], pub operator: ComparisonOperator, pub threshold_mm_x100: i64, pub sales_close_at: i64, pub observation_start: i64, pub observation_end: i64, pub data_deadline: i64, pub claim_deadline: i64, pub quote_probability_bps: u16, pub premium_rate_bps: u16, pub max_liquidity: u64, pub max_exposure: u64, pub per_wallet_max: u64, pub total_shares: u64, pub remaining_shares: u64, pub reserved_exposure: u64, pub premium_balance: u64, pub accrued_protocol_fees: u64, pub payout_liability: u64, pub refund_liability: u64, pub remaining_redemption_assets: u64, pub status: MarketStatus, pub result: SettlementResult, pub bump: u8 }
#[account] #[derive(InitSpace)] pub struct LiquidityPosition { pub market: Pubkey, pub provider: Pubkey, pub shares: u64, pub redeemed: bool }
#[account] #[derive(InitSpace)] pub struct ProtectionPosition { pub market: Pubkey, pub owner: Pubkey, pub protected_amount: u64, pub premium_paid: u64, pub potential_payout: u64, pub opened_at: i64, pub payout_claimed: bool, pub refund_claimed: bool }
#[account] #[derive(InitSpace)] pub struct SettlementObservation { pub market: Pubkey, pub authority: Pubkey, pub cumulative_rainfall_mm_x100: i64, pub observed_at: i64, pub source_hash: [u8; 32], pub bump: u8 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)] pub enum ComparisonOperator { GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual }
impl ComparisonOperator { fn matches(self, actual: i64, threshold: i64) -> bool { match self { Self::GreaterThan => actual > threshold, Self::GreaterThanOrEqual => actual >= threshold, Self::LessThan => actual < threshold, Self::LessThanOrEqual => actual <= threshold } } }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)] pub enum MarketStatus { Draft, Open, Locked, AwaitingSettlement, Settled, DataUnavailable, Closed }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)] pub enum SettlementResult { Unset, Triggered, NotTriggered, DataUnavailable }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)] pub enum AuthorityRole { Admin, Settlement }
#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct CreateMarketArgs { pub city_hash: [u8; 32], pub station_id_hash: [u8; 32], pub provider_hash: [u8; 32], pub methodology_hash: [u8; 32], pub quote_inputs_hash: [u8; 32], pub operator: ComparisonOperator, pub threshold_mm_x100: i64, pub sales_close_at: i64, pub observation_start: i64, pub observation_end: i64, pub quote_probability_bps: u16, pub max_liquidity: u64, pub max_exposure: u64, pub per_wallet_max: u64 }
impl CreateMarketArgs { fn validate(&self) -> Result<()> { require!(self.threshold_mm_x100 > 0 && self.max_liquidity > 0 && self.max_exposure > 0 && self.per_wallet_max > 0, ErrorCode::InvalidMarket); require!(self.max_exposure <= self.max_liquidity && self.per_wallet_max <= self.max_exposure, ErrorCode::InvalidMarket); require!(self.sales_close_at <= self.observation_start && self.observation_start < self.observation_end, ErrorCode::InvalidObservationWindow); premium_rate_bps(self.quote_probability_bps)?; Ok(()) } }
#[derive(AnchorSerialize, AnchorDeserialize, Clone)] pub struct SubmitObservationArgs { pub cumulative_rainfall_mm_x100: i64, pub observed_at: i64, pub source_hash: [u8; 32] }

#[event] pub struct MarketCreated { pub market: Pubkey, pub id: u64, pub premium_rate_bps: u16 }
#[event] pub struct AuthorityProposed { pub role: AuthorityRole, pub authority: Pubkey }
#[event] pub struct AuthorityAccepted { pub role: AuthorityRole, pub authority: Pubkey }
#[event] pub struct PauseChanged { pub paused: bool }
#[event] pub struct LiquidityFunded { pub market: Pubkey, pub provider: Pubkey, pub amount: u64 }
#[event] pub struct LiquidityWithdrawn { pub market: Pubkey, pub provider: Pubkey, pub amount: u64 }
#[event] pub struct PositionOpened { pub market: Pubkey, pub owner: Pubkey, pub premium: u64, pub potential_payout: u64 }
#[event] pub struct MarketLocked { pub market: Pubkey }
#[event] pub struct ObservationSubmitted { pub market: Pubkey, pub value: i64, pub source_hash: [u8; 32] }
#[event] pub struct MarketSettled { pub market: Pubkey, pub result: SettlementResult }
#[event] pub struct DataUnavailable { pub market: Pubkey, pub source_hash: [u8; 32] }
#[event] pub struct PayoutClaimed { pub market: Pubkey, pub owner: Pubkey, pub amount: u64 }
#[event] pub struct PremiumRefunded { pub market: Pubkey, pub owner: Pubkey, pub amount: u64 }
#[event] pub struct MarketClosed { pub market: Pubkey, pub redemption_assets: u64, pub fee: u64 }
#[event] pub struct LiquidityRedeemed { pub market: Pubkey, pub provider: Pubkey, pub shares: u64, pub amount: u64 }

#[error_code] pub enum ErrorCode { #[msg("Protocol is paused")] Paused, #[msg("Invalid market parameters")] InvalidMarket, #[msg("Invalid authority")] InvalidAuthority, #[msg("Invalid probability")] InvalidProbability, #[msg("Invalid premium")] InvalidPremium, #[msg("Invalid observation window")] InvalidObservationWindow, #[msg("Invalid amount")] InvalidAmount, #[msg("Invalid market status")] InvalidMarketStatus, #[msg("Insufficient liquidity")] InsufficientLiquidity, #[msg("Liquidity cap exceeded")] LiquidityCapExceeded, #[msg("Insufficient LP shares")] InsufficientShares, #[msg("Liquidity funding window closed")] LiquidityWindowClosed, #[msg("Position opening window closed")] PositionWindowClosed, #[msg("Position opening window is still open")] PositionWindowOpen, #[msg("Wallet coverage cap exceeded")] WalletCoverageCapExceeded, #[msg("Observation period not finished")] ObservationNotFinished, #[msg("Unauthorised settlement authority")] UnauthorizedAuthority, #[msg("Invalid observation time")] InvalidObservationTime, #[msg("Settlement observation is stale")] StaleObservation, #[msg("Data deadline has not been reached")] DataDeadlineNotReached, #[msg("Claim window has closed")] ClaimWindowClosed, #[msg("Claim window is still open")] ClaimWindowOpen, #[msg("Position is not claimable")] NotClaimable, #[msg("Position is not refundable")] NotRefundable, #[msg("Payout already claimed")] AlreadyClaimed, #[msg("Refund already claimed")] AlreadyRefunded, #[msg("Liquidity already redeemed")] AlreadyRedeemed, #[msg("Arithmetic overflow")] MathOverflow }

#[cfg(test)] mod tests { use super::*; #[test] fn pricing_is_deterministic() { assert_eq!(premium_rate_bps(1_000).unwrap(), 1_250); assert_eq!(ceil_bps(500_000_000, 1_250).unwrap(), 62_500_000); } #[test] fn probability_bounds_are_enforced() { assert!(premium_rate_bps(99).is_err()); assert!(premium_rate_bps(9_001).is_err()); } #[test] fn rainfall_comparison_is_deterministic() { assert!(ComparisonOperator::GreaterThanOrEqual.matches(2_500, 2_500)); assert!(!ComparisonOperator::LessThan.matches(2_500, 2_500)); } }
