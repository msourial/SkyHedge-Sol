use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use skyhedge_protection::{
    accounts, instruction, ComparisonOperator, CreateMarketArgs, SubmitObservationArgs,
};
use solana_program_test::ProgramTest;
use solana_sdk::{
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

struct Fixture {
    context: solana_program_test::ProgramTestContext,
    buyer: Keypair,
    buyer_tokens: Keypair,
    settlement_authority: Keypair,
    stranger: Keypair,
    mint: Keypair,
    protocol: Pubkey,
    market: Pubkey,
    vault: Pubkey,
    position: Pubkey,
    observation_start: i64,
    observation_end: i64,
    data_deadline: i64,
}

#[tokio::test]
async fn stranger_cannot_mark_data_unavailable_before_deadline() {
    let mut f = setup_awaiting_settlement().await;
    let stranger_mark = mark_unavailable_ix(&f, f.stranger.pubkey());
    assert!(send_result(&mut f.context, vec![stranger_mark], &[&f.stranger])
        .await
        .is_err());
    let market = read_market(&mut f.context, f.market).await;
    assert!(matches!(
        market.status,
        skyhedge_protection::MarketStatus::AwaitingSettlement
    ));
}

#[tokio::test]
async fn stranger_can_mark_data_unavailable_after_deadline_and_buyer_refunds() {
    let mut f = setup_awaiting_settlement().await;
    set_clock(&mut f.context, f.data_deadline + 1).await;

    let stranger_mark = mark_unavailable_ix(&f, f.stranger.pubkey());
    send(&mut f.context, vec![stranger_mark], &[&f.stranger]).await;

    let market = read_market(&mut f.context, f.market).await;
    assert!(matches!(
        market.status,
        skyhedge_protection::MarketStatus::DataUnavailable
    ));
    assert_eq!(market.refund_liability, PREMIUM);

    let buyer_before = token_amount(&mut f.context, f.buyer_tokens.pubkey()).await;
    let vault_before = token_amount(&mut f.context, f.vault).await;
    let claim = claim_refund_ix(&f);
    send(&mut f.context, vec![claim], &[&f.buyer]).await;
    assert_eq!(
        token_amount(&mut f.context, f.buyer_tokens.pubkey()).await,
        buyer_before + PREMIUM
    );
    assert_eq!(
        token_amount(&mut f.context, f.vault).await,
        vault_before - PREMIUM
    );
}

#[tokio::test]
async fn stranger_can_settle_only_with_an_observation() {
    let mut f = setup_awaiting_settlement().await;
    let observation =
        Pubkey::find_program_address(&[b"settlement", f.market.as_ref()], &PROGRAM_ID).0;

    let settle_without_observation = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::SettleMarket {
            settler: f.stranger.pubkey(),
            protocol: f.protocol,
            market: f.market,
            observation,
        }
        .to_account_metas(None),
        data: instruction::SettleMarket {}.data(),
    };
    assert!(
        send_result(
            &mut f.context,
            vec![settle_without_observation],
            &[&f.stranger]
        )
        .await
        .is_err()
    );

    let submit = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::SubmitObservation {
            authority: f.settlement_authority.pubkey(),
            protocol: f.protocol,
            market: f.market,
            observation,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::SubmitWeatherObservation {
            args: SubmitObservationArgs {
                station_id_hash: [2; 32],
                methodology_hash: [4; 32],
                observation_window_start: f.observation_start,
                observation_window_end: f.observation_end,
                cumulative_rainfall_mm_x100: 6_000,
                observed_at: f.observation_end,
                source_hash: [7; 32],
            },
        }
        .data(),
    };
    send(
        &mut f.context,
        vec![submit],
        &[&f.settlement_authority],
    )
    .await;

    let settle = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::SettleMarket {
            settler: f.stranger.pubkey(),
            protocol: f.protocol,
            market: f.market,
            observation,
        }
        .to_account_metas(None),
        data: instruction::SettleMarket {}.data(),
    };
    send(&mut f.context, vec![settle], &[&f.stranger]).await;

    let market = read_market(&mut f.context, f.market).await;
    assert!(matches!(
        market.status,
        skyhedge_protection::MarketStatus::Settled
    ));
    assert!(matches!(
        market.result,
        skyhedge_protection::SettlementResult::Triggered
    ));
}

async fn setup_awaiting_settlement() -> Fixture {
    let sbf_out_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy");
    std::env::set_var("BPF_OUT_DIR", sbf_out_dir);
    let mut test = ProgramTest::default();
    test.prefer_bpf(true);
    test.add_program("skyhedge_protection", PROGRAM_ID, None);
    test.prefer_bpf(false);
    test.add_program(
        "spl_token",
        TOKEN_ID,
        solana_program_test::processor!(spl_token::processor::Processor::process),
    );
    let mut context = test.start_with_context().await;
    let admin = context.payer.pubkey();
    let buyer = Keypair::new();
    let settlement_authority = Keypair::new();
    let stranger = Keypair::new();
    let lp = Keypair::new();
    let mint = Keypair::new();
    let buyer_tokens = Keypair::new();
    let lp_tokens = Keypair::new();

    let rent = context.banks_client.get_rent().await.unwrap();
    let mut setup = vec![
        system_instruction::transfer(&admin, &buyer.pubkey(), 10_000_000),
        system_instruction::transfer(&admin, &lp.pubkey(), 10_000_000),
        system_instruction::transfer(&admin, &settlement_authority.pubkey(), 10_000_000),
        system_instruction::transfer(&admin, &stranger.pubkey(), 10_000_000),
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
    send(
        &mut context,
        vec![Instruction {
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
        }],
        &[],
    )
    .await;

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
    send(
        &mut context,
        vec![Instruction {
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
        }],
        &[],
    )
    .await;

    let (lp_position, _) = Pubkey::find_program_address(
        &[b"liquidity", market.as_ref(), lp.pubkey().as_ref()],
        &PROGRAM_ID,
    );
    send(
        &mut context,
        vec![Instruction {
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
        }],
        &[&lp],
    )
    .await;
    send(
        &mut context,
        vec![Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::OpenMarket {
                admin,
                protocol,
                market,
            }
            .to_account_metas(None),
            data: instruction::OpenMarket {}.data(),
        }],
        &[],
    )
    .await;
    send(
        &mut context,
        vec![Instruction {
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
        }],
        &[&buyer],
    )
    .await;

    set_clock(&mut context, sales_close_at + 1).await;
    send(
        &mut context,
        vec![Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::AdvanceMarket { market }.to_account_metas(None),
            data: instruction::LockMarket {}.data(),
        }],
        &[],
    )
    .await;
    set_clock(&mut context, observation_end + 1).await;
    send(
        &mut context,
        vec![Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::AdvanceMarket { market }.to_account_metas(None),
            data: instruction::BeginSettlement {}.data(),
        }],
        &[],
    )
    .await;

    let data_deadline = read_market(&mut context, market).await.data_deadline;
    Fixture {
        context,
        buyer,
        buyer_tokens,
        settlement_authority,
        stranger,
        mint,
        protocol,
        market,
        vault,
        position,
        observation_start,
        observation_end,
        data_deadline,
    }
}

fn mark_unavailable_ix(f: &Fixture, authority: Pubkey) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::MarkDataUnavailable {
            authority,
            protocol: f.protocol,
            market: f.market,
            observation: None,
        }
        .to_account_metas(None),
        data: instruction::MarkDataUnavailable {
            source_hash: [6; 32],
        }
        .data(),
    }
}

fn claim_refund_ix(f: &Fixture) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::ClaimPosition {
            owner: f.buyer.pubkey(),
            protocol: f.protocol,
            market: f.market,
            vault: f.vault,
            position: f.position,
            owner_token_account: f.buyer_tokens.pubkey(),
            collateral_mint: f.mint.pubkey(),
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
        data: instruction::ClaimPremiumRefund {}.data(),
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
