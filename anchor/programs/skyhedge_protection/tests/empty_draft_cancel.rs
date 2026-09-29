use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use skyhedge_protection::{accounts, instruction, ComparisonOperator, CreateMarketArgs};
use solana_program_test::{processor, ProgramTest};
use solana_sdk::{
    instruction::Instruction,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_token::state::Mint;

const PROGRAM_ID: Pubkey = skyhedge_protection::ID;
const TOKEN_ID: Pubkey = spl_token::ID;

#[tokio::test]
async fn admin_can_cancel_only_an_empty_draft_and_create_the_next_market_id() {
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
    let rent = context.banks_client.get_rent().await.unwrap();
    let mint = Keypair::new();
    let settlement_authority = Keypair::new();

    send(
        &mut context,
        vec![
            system_instruction::create_account(
                &admin,
                &mint.pubkey(),
                rent.minimum_balance(Mint::LEN),
                Mint::LEN as u64,
                &TOKEN_ID,
            ),
            spl_token::instruction::initialize_mint2(
                &TOKEN_ID,
                &mint.pubkey(),
                &admin,
                None,
                6,
            )
            .unwrap(),
        ],
        &[&mint],
    )
    .await;

    let (protocol, _) = Pubkey::find_program_address(&[b"protocol"], &PROGRAM_ID);
    let (fee_vault, _) =
        Pubkey::find_program_address(&[b"fee-vault", protocol.as_ref()], &PROGRAM_ID);
    let initialize = Instruction {
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
    send(&mut context, vec![initialize], &[]).await;

    let (market, _) = Pubkey::find_program_address(
        &[b"market", protocol.as_ref(), &0u64.to_le_bytes()],
        &PROGRAM_ID,
    );
    let (vault, _) = Pubkey::find_program_address(&[b"vault", market.as_ref()], &PROGRAM_ID);
    let now = context.banks_client.get_sysvar::<solana_sdk::sysvar::clock::Clock>().await.unwrap().unix_timestamp;
    let create = Instruction {
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
        data: instruction::CreateMarket {
            args: CreateMarketArgs {
                city_hash: [1; 32],
                station_id_hash: [2; 32],
                provider_hash: [3; 32],
                methodology_hash: [4; 32],
                quote_inputs_hash: [5; 32],
                operator: ComparisonOperator::GreaterThanOrEqual,
                threshold_mm_x100: 5_000,
                sales_close_at: now + 100,
                observation_start: now + 101,
                observation_end: now + 102,
                quote_probability_bps: 2_000,
                max_liquidity: 2_000_000_000,
                max_exposure: 1_000_000_000,
                per_wallet_max: 500_000_000,
            },
        }
        .data(),
    };
    send(&mut context, vec![create], &[]).await;

    let cancel_data = instruction::CancelEmptyDraftMarket {}.data();
    assert_eq!(
        &cancel_data[..8],
        &[11, 214, 167, 114, 95, 104, 107, 238],
        "committed IDL must use the Anchor cancellation discriminator",
    );
    let unauthorized_admin = Keypair::new();
    let unauthorized_cancel = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::CancelEmptyDraftMarket {
            admin: unauthorized_admin.pubkey(),
            protocol,
            market,
            vault,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
        data: cancel_data.clone(),
    };
    let unauthorized_tx = Transaction::new_signed_with_payer(
        &[unauthorized_cancel],
        Some(&context.payer.pubkey()),
        &[&context.payer, &unauthorized_admin],
        context.last_blockhash,
    );
    assert!(context.banks_client.process_transaction(unauthorized_tx).await.is_err());

    let cancel = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::CancelEmptyDraftMarket {
            admin,
            protocol,
            market,
            vault,
            collateral_mint: mint.pubkey(),
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
        data: cancel_data,
    };
    send(&mut context, vec![cancel], &[]).await;

    let market_account = context.banks_client.get_account(market).await.unwrap().unwrap();
    assert_eq!(market_account.data[381], 7, "status should be Cancelled");

    let protocol_account = context.banks_client.get_account(protocol).await.unwrap().unwrap();
    let mut protocol_data: &[u8] = &protocol_account.data;
    let protocol_state = skyhedge_protection::ProtocolConfig::try_deserialize(&mut protocol_data).unwrap();
    assert_eq!(protocol_state.next_market_id, 1, "cancellation never reuses the old PDA");
}

async fn send(
    context: &mut solana_program_test::ProgramTestContext,
    instructions: Vec<Instruction>,
    signers: &[&Keypair],
) {
    let mut transaction = Transaction::new_with_payer(&instructions, Some(&context.payer.pubkey()));
    let mut all_signers = vec![&context.payer];
    all_signers.extend_from_slice(signers);
    transaction.sign(&all_signers, context.last_blockhash);
    context.banks_client.process_transaction(transaction).await.unwrap();
}
