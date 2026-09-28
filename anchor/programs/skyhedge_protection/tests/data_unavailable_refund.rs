use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use skyhedge_protection::{
    accounts, instruction, ComparisonOperator, CreateMarketArgs, SubmitObservationArgs,
};
use solana_program_test::{processor, ProgramTest};
use solana_sdk::{
    account::Account,
    instruction::Instruction,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    sysvar::{clock::Clock, rent::Rent},
    transaction::Transaction,
};
use spl_token::state::{Account as TokenAccount, Mint};

const PROGRAM_ID: Pubkey = skyhedge_protection::ID;
const TOKEN_ID: Pubkey = spl_token::ID;
const UNIT: u64 = 1_000_000;
const COVERAGE: u64 = 100 * UNIT;
const PREMIUM: u64 = 24 * UNIT;

#[tokio::test]
async fn data_unavailable_refund_transfers_premium_once_from_market_vault() {
    run_settlement_lifecycle(SettlementScenario::DataUnavailable).await;
}

#[tokio::test]
async fn triggered_settlement_transfers_fixed_payout_once_from_market_vault() {
    run_settlement_lifecycle(SettlementScenario::Triggered).await;
}

#[tokio::test]
async fn non_triggered_settlement_rejects_payout_and_preserves_market_funds() {
    run_settlement_lifecycle(SettlementScenario::NotTriggered).await;
}

#[derive(Clone, Copy)]
enum SettlementScenario {
    DataUnavailable,
    Triggered,
    NotTriggered,
}

async fn run_settlement_lifecycle(scenario: SettlementScenario) {
    let sbf_out_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy");
    std::env::set_var("BPF_OUT_DIR", sbf_out_dir);
    let mut test = ProgramTest::default();
    test.prefer_bpf(true);
    test.add_program("skyhedge_protection", PROGRAM_ID, None);
    test.prefer_bpf(false);
    test.add_program(
        "spl_token",
        TOKEN_ID,
        processor!(spl_token::processor::Processor::process),
    );
    let mut context = test.start_with_context().await;
    let admin = context.payer.pubkey();
    let buyer = Keypair::new();
    let settlement_authority = Keypair::new();

    let rent = context.banks_client.get_rent().await.unwrap();
    let mint = Keypair::new();
    let buyer_tokens = Keypair::new();
    let lp = Keypair::new();
    let lp_tokens = Keypair::new();
    let mut setup = vec![
        system_instruction::transfer(&admin, &buyer.pubkey(), 10_000_000),
        system_instruction::transfer(&admin, &lp.pubkey(), 10_000_000),
        system_instruction::transfer(&admin, &settlement_authority.pubkey(), 10_000_000),
        system_instruction::create_account(
            &admin,
            &mint.pubkey(),
            rent.minimum_balance(Mint::LEN),
            Mint::LEN as u64,
            &TOKEN_ID,
        ),
        spl_token::instruction::initialize_mint2(&TOKEN_ID, &mint.pubkey(), &admin, None, 6)
            .unwrap(),
    ];
    setup.extend(create_token_account(
        &admin,
        &buyer_tokens.pubkey(),
        &mint.pubkey(),
        &buyer.pubkey(),
        &rent,
    ));
    setup.extend(create_token_account(
        &admin,
        &lp_tokens.pubkey(),
        &mint.pubkey(),
        &lp.pubkey(),
        &rent,
    ));
    setup.push(
        spl_token::instruction::mint_to(
            &TOKEN_ID,
            &mint.pubkey(),
            &buyer_tokens.pubkey(),
            &admin,
            &[],
            1_000 * UNIT,
        )
        .unwrap(),
    );
    setup.push(
        spl_token::instruction::mint_to(
            &TOKEN_ID,
            &mint.pubkey(),
            &lp_tokens.pubkey(),
            &admin,
            &[],
            2_000 * UNIT,
        )
        .unwrap(),
    );
    send(&mut context, setup, &[&mint, &buyer_tokens, &lp_tokens]).await;

    let (protocol, _) = Pubkey::find_program_address(&[b"protocol"], &PROGRAM_ID);
    let (fee_vault, _) =
        Pubkey::find_program_address(&[b"fee-vault", protocol.as_ref()], &PROGRAM_ID);
    let init = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::InitializeProtocol {
            admin,
            protocol,
            fee_vault,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeProtocol {
            settlement_authority: settlement_authority.pubkey(),
        }
        .data(),
    };
    send(&mut context, vec![init], &[]).await;

    let chain_now = context
        .banks_client
        .get_sysvar::<Clock>()
        .await
        .unwrap()
        .unix_timestamp;
    let sales_close_at = chain_now + 100;
    let observation_start = sales_close_at + 1;
    let observation_end = observation_start + 1;
    let (market, _) = Pubkey::find_program_address(
        &[b"market", protocol.as_ref(), &0u64.to_le_bytes()],
        &PROGRAM_ID,
    );
    let (vault, _) = Pubkey::find_program_address(&[b"vault", market.as_ref()], &PROGRAM_ID);
    let (position, _) = Pubkey::find_program_address(
        &[b"position", market.as_ref(), buyer.pubkey().as_ref()],
        &PROGRAM_ID,
    );
    let args = CreateMarketArgs {
        city_hash: [1; 32],
        station_id_hash: [2; 32],
        provider_hash: [3; 32],
        methodology_hash: [4; 32],
        quote_inputs_hash: [5; 32],
        operator: ComparisonOperator::GreaterThanOrEqual,
        threshold_mm_x100: 5_000,
        sales_close_at,
        observation_start,
        observation_end,
        quote_probability_bps: 2_000,
        max_liquidity: 2_000 * UNIT,
        max_exposure: 1_000 * UNIT,
        per_wallet_max: 500 * UNIT,
    };
    let create_market = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::CreateMarket {
            admin,
            protocol,
            market,
            vault,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::CreateMarket { args }.data(),
    };
    send(&mut context, vec![create_market], &[]).await;

    let (lp_position, _) = Pubkey::find_program_address(
        &[b"liquidity", market.as_ref(), lp.pubkey().as_ref()],
        &PROGRAM_ID,
    );
    let fund = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::UpdateLiquidity {
            provider: lp.pubkey(),
            protocol,
            market,
            vault,
            provider_token_account: lp_tokens.pubkey(),
            liquidity_position: lp_position,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::FundPool {
            amount: 2_000 * UNIT,
        }
        .data(),
    };
    send(&mut context, vec![fund], &[&lp]).await;

    let open_market = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::OpenMarket {
            admin,
            protocol,
            market,
        }
        .to_account_metas(None),
        data: instruction::OpenMarket {}.data(),
    };
    send(&mut context, vec![open_market], &[]).await;

    let open_position = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::OpenPosition {
            owner: buyer.pubkey(),
            protocol,
            market,
            vault,
            owner_token_account: buyer_tokens.pubkey(),
            position,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::OpenPosition {
            protected_amount: COVERAGE,
        }
        .data(),
    };
    send(&mut context, vec![open_position], &[&buyer]).await;
    assert_eq!(
        token_amount(&mut context, buyer_tokens.pubkey()).await,
        1_000 * UNIT - PREMIUM
    );
    assert_eq!(
        token_amount(&mut context, vault).await,
        2_000 * UNIT + PREMIUM
    );

    set_clock(&mut context, sales_close_at + 1).await;
    let lock_market = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::AdvanceMarket { market }.to_account_metas(None),
        data: instruction::LockMarket {}.data(),
    };
    send(&mut context, vec![lock_market], &[]).await;
    set_clock(&mut context, observation_end + 1).await;
    let begin_settlement = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::AdvanceMarket { market }.to_account_metas(None),
        data: instruction::BeginSettlement {}.data(),
    };
    send(&mut context, vec![begin_settlement], &[]).await;

    let market_account: Account = context
        .banks_client
        .get_account(market)
        .await
        .unwrap()
        .unwrap();
    let mut market_state =
        skyhedge_protection::Market::try_deserialize(&mut market_account.data.as_slice()).unwrap();
    if matches!(scenario, SettlementScenario::DataUnavailable) {
        set_clock(&mut context, market_state.data_deadline + 1).await;
        let resolution = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::MarkDataUnavailable {
                authority: settlement_authority.pubkey(),
                protocol,
                market,
                observation: None,
            }
            .to_account_metas(None),
            data: instruction::MarkDataUnavailable {
                source_hash: [6; 32],
            }
            .data(),
        };
        send(&mut context, vec![resolution], &[&settlement_authority]).await;
        market_state = read_market(&mut context, market).await;
        assert_eq!(market_state.refund_liability, PREMIUM);
        assert_eq!(market_state.accrued_protocol_fees, 0);

        let buyer_before = token_amount(&mut context, buyer_tokens.pubkey()).await;
        let vault_before = token_amount(&mut context, vault).await;
        let claim = claim_instruction(
            market,
            protocol,
            vault,
            position,
            buyer.pubkey(),
            buyer_tokens.pubkey(),
            mint.pubkey(),
            instruction::ClaimPremiumRefund {}.data(),
        );
        send(&mut context, vec![claim.clone()], &[&buyer]).await;
        assert_eq!(
            token_amount(&mut context, buyer_tokens.pubkey()).await,
            buyer_before + PREMIUM
        );
        assert_eq!(
            token_amount(&mut context, vault).await,
            vault_before - PREMIUM
        );
        assert_eq!(read_market(&mut context, market).await.refund_liability, 0);
        advance_slot(&mut context).await;
        assert!(send_result(&mut context, vec![claim], &[&buyer])
            .await
            .is_err());
        assert_eq!(
            token_amount(&mut context, buyer_tokens.pubkey()).await,
            buyer_before + PREMIUM
        );
        assert_eq!(
            token_amount(&mut context, vault).await,
            vault_before - PREMIUM
        );
    } else {
        let observation =
            Pubkey::find_program_address(&[b"settlement", market.as_ref()], &PROGRAM_ID).0;
        let submit = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::SubmitObservation {
                authority: settlement_authority.pubkey(),
                protocol,
                market,
                observation,
                system_program: solana_sdk::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::SubmitWeatherObservation {
                args: SubmitObservationArgs {
                    station_id_hash: [2; 32],
                    methodology_hash: [4; 32],
                    observation_window_start: observation_start,
                    observation_window_end: observation_end,
                    cumulative_rainfall_mm_x100: if matches!(
                        scenario,
                        SettlementScenario::Triggered
                    ) {
                        6_000
                    } else {
                        4_000
                    },
                    observed_at: observation_end,
                    source_hash: [7; 32],
                },
            }
            .data(),
        };
        let settle = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::SettleMarket {
                protocol,
                settlement_authority: settlement_authority.pubkey(),
                market,
                observation,
            }
            .to_account_metas(None),
            data: instruction::SettleMarket {}.data(),
        };
        send(&mut context, vec![submit, settle], &[&settlement_authority]).await;
        market_state = read_market(&mut context, market).await;
        let buyer_before = token_amount(&mut context, buyer_tokens.pubkey()).await;
        let vault_before = token_amount(&mut context, vault).await;
        let claim = claim_instruction(
            market,
            protocol,
            vault,
            position,
            buyer.pubkey(),
            buyer_tokens.pubkey(),
            mint.pubkey(),
            instruction::ClaimPayout {}.data(),
        );
        if matches!(scenario, SettlementScenario::Triggered) {
            assert!(matches!(
                market_state.result,
                skyhedge_protection::SettlementResult::Triggered
            ));
            assert_eq!(market_state.payout_liability, COVERAGE);
            send(&mut context, vec![claim.clone()], &[&buyer]).await;
            assert_eq!(
                token_amount(&mut context, buyer_tokens.pubkey()).await,
                buyer_before + COVERAGE
            );
            assert_eq!(
                token_amount(&mut context, vault).await,
                vault_before - COVERAGE
            );
            market_state = read_market(&mut context, market).await;
            assert_eq!(market_state.payout_liability, 0);
            assert_eq!(market_state.reserved_exposure, 0);
            advance_slot(&mut context).await;
            assert!(send_result(&mut context, vec![claim], &[&buyer])
                .await
                .is_err());
            assert_eq!(
                token_amount(&mut context, buyer_tokens.pubkey()).await,
                buyer_before + COVERAGE
            );
            assert_eq!(
                token_amount(&mut context, vault).await,
                vault_before - COVERAGE
            );
        } else {
            assert!(matches!(
                market_state.result,
                skyhedge_protection::SettlementResult::NotTriggered
            ));
            assert_eq!(market_state.payout_liability, 0);
            assert_eq!(market_state.reserved_exposure, 0);
            assert!(send_result(&mut context, vec![claim], &[&buyer])
                .await
                .is_err());
            assert_eq!(
                token_amount(&mut context, buyer_tokens.pubkey()).await,
                buyer_before
            );
            assert_eq!(token_amount(&mut context, vault).await, vault_before);
        }
    }
}

async fn read_market(
    context: &mut solana_program_test::ProgramTestContext,
    market: Pubkey,
) -> skyhedge_protection::Market {
    let account = context
        .banks_client
        .get_account(market)
        .await
        .unwrap()
        .unwrap();
    skyhedge_protection::Market::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn claim_instruction(
    market: Pubkey,
    protocol: Pubkey,
    vault: Pubkey,
    position: Pubkey,
    owner: Pubkey,
    owner_token_account: Pubkey,
    mint: Pubkey,
    data: Vec<u8>,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::ClaimPosition {
            owner,
            protocol,
            market,
            vault,
            position,
            owner_token_account,
            collateral_mint: mint,
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
        data,
    }
}

fn create_token_account(
    payer: &Pubkey,
    address: &Pubkey,
    mint: &Pubkey,
    owner: &Pubkey,
    rent: &Rent,
) -> Vec<Instruction> {
    vec![
        system_instruction::create_account(
            payer,
            address,
            rent.minimum_balance(TokenAccount::LEN),
            TokenAccount::LEN as u64,
            &TOKEN_ID,
        ),
        spl_token::instruction::initialize_account3(&TOKEN_ID, address, mint, owner).unwrap(),
    ]
}

async fn set_clock(context: &mut solana_program_test::ProgramTestContext, unix_timestamp: i64) {
    let mut clock = context.banks_client.get_sysvar::<Clock>().await.unwrap();
    clock.unix_timestamp = unix_timestamp;
    context.set_sysvar(&clock);
}

async fn advance_slot(context: &mut solana_program_test::ProgramTestContext) {
    let slot = context.banks_client.get_root_slot().await.unwrap();
    context.warp_to_slot(slot + 1).unwrap();
}

async fn token_amount(
    context: &mut solana_program_test::ProgramTestContext,
    address: Pubkey,
) -> u64 {
    let account = context
        .banks_client
        .get_account(address)
        .await
        .unwrap()
        .unwrap();
    TokenAccount::unpack(&account.data).unwrap().amount
}

async fn send(
    context: &mut solana_program_test::ProgramTestContext,
    instructions: Vec<Instruction>,
    signers: &[&Keypair],
) {
    send_result(context, instructions, signers).await.unwrap();
}

async fn send_result(
    context: &mut solana_program_test::ProgramTestContext,
    instructions: Vec<Instruction>,
    signers: &[&Keypair],
) -> Result<(), solana_program_test::BanksClientError> {
    let blockhash = context.banks_client.get_latest_blockhash().await.unwrap();
    let mut all_signers = vec![&context.payer];
    all_signers.extend_from_slice(signers);
    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&context.payer.pubkey()),
        &all_signers,
        blockhash,
    );
    context.banks_client.process_transaction(tx).await
}
