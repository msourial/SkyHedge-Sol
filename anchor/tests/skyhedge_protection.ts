import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
import { SkyhedgeProtection } from "../target/types/skyhedge_protection";

const SKYT_DECIMALS = 6;
const UNIT = 1_000_000; // 1 SKYT in base units
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowSeconds = () => Math.floor(Date.now() / 1000);
const randomHash = () => Array.from(Keypair.generate().publicKey.toBytes());
const errorText = (error: unknown) => {
  const anyError = error as { logs?: unknown; error?: unknown };
  return JSON.stringify(anyError?.logs ?? "") + JSON.stringify(anyError?.error ?? "") + JSON.stringify(error) + String(error);
};

describe("skyhedge_protection localnet lifecycle (real token CPIs)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SkyhedgeProtection as Program<SkyhedgeProtection>;
  const connection = provider.connection;

  const admin = (provider.wallet as anchor.Wallet).payer;
  const settlementAuthority = Keypair.generate();
  const lp = Keypair.generate();
  const buyer = Keypair.generate();
  const buyer2 = Keypair.generate();

  let mint: PublicKey;
  let lpAta: PublicKey;
  let buyerAta: PublicKey;
  let buyer2Ata: PublicKey;

  let protocolPda: PublicKey;
  let feeVaultPda: PublicKey;
  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  let lpPositionPda: PublicKey;
  let positionPda: PublicKey;
  let observationPda: PublicKey;

  const FUND = 5_000 * UNIT;
  const WITHDRAW = 1_000 * UNIT;
  const COVERAGE = 100 * UNIT;
  // quote_probability 2000 bps -> rate = ceil(2000*1.15)+100 = 2400 bps -> premium 24 SKYT, fee 1 SKYT
  const PREMIUM = 24 * UNIT;
  const FEE = 1 * UNIT;

  let salesCloseAt: number;
  let observationStart: number;
  let observationEnd: number;

  before(async () => {
    for (const wallet of [lp, buyer, buyer2, settlementAuthority]) {
      const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    }
    mint = await createMint(connection, admin, admin.publicKey, null, SKYT_DECIMALS);
    lpAta = (await getOrCreateAssociatedTokenAccount(connection, lp, mint, lp.publicKey)).address;
    buyerAta = (await getOrCreateAssociatedTokenAccount(connection, buyer, mint, buyer.publicKey)).address;
    buyer2Ata = (await getOrCreateAssociatedTokenAccount(connection, buyer2, mint, buyer2.publicKey)).address;
    await mintTo(connection, admin, mint, lpAta, admin, 10_000 * UNIT);
    await mintTo(connection, admin, mint, buyerAta, admin, 1_000 * UNIT);
    await mintTo(connection, admin, mint, buyer2Ata, admin, 1_000 * UNIT);

    [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], program.programId);
    [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocolPda.toBuffer()], program.programId);
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), protocolPda.toBuffer(), new BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketPda.toBuffer()], program.programId);
    [lpPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity"), marketPda.toBuffer(), lp.publicKey.toBuffer()],
      program.programId
    );
    [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    [observationPda] = PublicKey.findProgramAddressSync([Buffer.from("settlement"), marketPda.toBuffer()], program.programId);
  });

  it("initializes the protocol with a dedicated settlement authority", async () => {
    await program.methods
      .initializeProtocol(settlementAuthority.publicKey)
      .accounts({ admin: admin.publicKey, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([admin])
      .rpc();
    const protocol = await program.account.protocolConfig.fetch(protocolPda);
    expect(protocol.admin.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(protocol.settlementAuthority.toBase58()).to.eq(settlementAuthority.publicKey.toBase58());
    expect(protocol.nextMarketId.toNumber()).to.eq(0);
  });

  it("creates market 0 with immutable rainfall parameters", async () => {
    const t = nowSeconds();
    salesCloseAt = t + 6;
    observationStart = t + 6;
    observationEnd = t + 14;
    await program.methods
      .createMarket({
        cityHash: randomHash(),
        stationIdHash: randomHash(),
        providerHash: randomHash(),
        methodologyHash: randomHash(),
        quoteInputsHash: randomHash(),
        operator: { greaterThanOrEqual: {} },
        thresholdMmX100: new BN(5_000), // 50.00 mm
        salesCloseAt: new BN(salesCloseAt),
        observationStart: new BN(observationStart),
        observationEnd: new BN(observationEnd),
        quoteProbabilityBps: 2_000,
        maxLiquidity: new BN(10_000 * UNIT),
        maxExposure: new BN(8_000 * UNIT),
        perWalletMax: new BN(500 * UNIT),
      })
      .accounts({ admin: admin.publicKey, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([admin])
      .rpc();
    const market = await program.account.market.fetch(marketPda);
    expect(market.premiumRateBps).to.eq(2_400);
    expect(market.status).to.deep.eq({ draft: {} });
    expect(market.dataDeadline.toNumber()).to.eq(observationEnd + 7 * 24 * 60 * 60);
  });

  it("LP funds 5,000 SKYT then withdraws 1,000 pre-lock (token CPIs)", async () => {
    await program.methods
      .fundPool(new BN(FUND))
      .accounts({ provider: lp.publicKey, market: marketPda, providerTokenAccount: lpAta, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([lp])
      .rpc();
    let vault = await getAccount(connection, vaultPda);
    expect(Number(vault.amount)).to.eq(FUND);

    await program.methods
      .withdrawLiquidity(new BN(WITHDRAW))
      .accounts({ provider: lp.publicKey, market: marketPda, providerTokenAccount: lpAta, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([lp])
      .rpc();
    vault = await getAccount(connection, vaultPda);
    expect(Number(vault.amount)).to.eq(FUND - WITHDRAW);
    const lpPos = await program.account.liquidityPosition.fetch(lpPositionPda);
    expect(lpPos.shares.toNumber()).to.eq(FUND - WITHDRAW);
  });

  it("opens the market and sells 100 SKYT coverage with correct premium/fee", async () => {
    await program.methods.openMarket().accounts({ admin: admin.publicKey, market: marketPda }).signers([admin]).rpc();

    const before = Number((await getAccount(connection, buyerAta)).amount);
    await program.methods
      .openPosition(new BN(COVERAGE))
      .accounts({ owner: buyer.publicKey, market: marketPda, ownerTokenAccount: buyerAta, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([buyer])
      .rpc();
    const after = Number((await getAccount(connection, buyerAta)).amount);
    expect(before - after).to.eq(PREMIUM);

    const market = await program.account.market.fetch(marketPda);
    expect(market.reservedExposure.toNumber()).to.eq(COVERAGE);
    expect(market.premiumBalance.toNumber()).to.eq(PREMIUM);
    expect(market.accruedProtocolFees.toNumber()).to.eq(FEE);

    const position = await program.account.protectionPosition.fetch(positionPda);
    expect(position.protectedAmount.toNumber()).to.eq(COVERAGE);
    expect(position.potentialPayout.toNumber()).to.eq(COVERAGE);
  });

  it("rejects coverage above the per-wallet cap", async () => {
    try {
      await program.methods
        .openPosition(new BN(600 * UNIT))
        .accounts({ owner: buyer2.publicKey, market: marketPda, ownerTokenAccount: buyer2Ata, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([buyer2])
        .rpc();
      expect.fail("expected WalletCoverageCapExceeded");
    } catch (error) {
      expect(errorText(error)).to.match(/Wallet coverage cap exceeded|6014/);
    }
  });

  it("locks after sales close and begins settlement after the observation window", async () => {
    const chainNow = async () => (await connection.getBlockTime(await connection.getSlot("confirmed"))) ?? nowSeconds();
    while ((await chainNow()) <= salesCloseAt) await sleep(1_000);
    await program.methods.lockMarket().accounts({ market: marketPda }).rpc();
    let market = await program.account.market.fetch(marketPda);
    expect(market.status).to.deep.eq({ locked: {} });

    while ((await chainNow()) <= observationEnd) await sleep(1_000);
    await program.methods.beginSettlement().accounts({ market: marketPda }).rpc();
    market = await program.account.market.fetch(marketPda);
    expect(market.status).to.deep.eq({ awaitingSettlement: {} });
  });

  it("rejects an observation from a non-settlement signer", async () => {
    try {
      await program.methods
        .submitWeatherObservation({ cumulativeRainfallMmX100: new BN(1), observedAt: new BN(observationStart + 1), sourceHash: randomHash() })
        .accounts({ authority: buyer.publicKey, market: marketPda })
        .signers([buyer])
        .rpc();
      expect.fail("expected UnauthorizedAuthority");
    } catch (error) {
      expect(errorText(error)).to.match(/Unauthorised settlement authority|6016/);
    }
  });

  it("settles TRIGGERED from the settlement authority observation", async () => {
    await program.methods
      .submitWeatherObservation({
        cumulativeRainfallMmX100: new BN(6_000), // 60.00 mm >= 50.00 mm threshold
        observedAt: new BN(observationStart + 2),
        sourceHash: randomHash(),
      })
      .accounts({ authority: settlementAuthority.publicKey, market: marketPda })
      .signers([settlementAuthority])
      .rpc();
    const observation = await program.account.settlementObservation.fetch(observationPda);
    expect(observation.cumulativeRainfallMmX100.toNumber()).to.eq(6_000);

    await program.methods.settleMarket().accounts({ market: marketPda }).rpc();
    const market = await program.account.market.fetch(marketPda);
    expect(market.status).to.deep.eq({ settled: {} });
    expect(market.result).to.deep.eq({ triggered: {} });
    expect(market.payoutLiability.toNumber()).to.eq(COVERAGE);
  });

  it("pays the winner exactly once (fixed payout, token CPI)", async () => {
    const before = Number((await getAccount(connection, buyerAta)).amount);
    await program.methods
      .claimPayout()
      .accounts({ owner: buyer.publicKey, market: marketPda, position: positionPda, ownerTokenAccount: buyerAta, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([buyer])
      .rpc();
    const after = Number((await getAccount(connection, buyerAta)).amount);
    expect(after - before).to.eq(COVERAGE);

    try {
      await program.methods
        .claimPayout()
        .accounts({ owner: buyer.publicKey, market: marketPda, position: positionPda, ownerTokenAccount: buyerAta, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([buyer])
        .rpc();
      expect.fail("expected AlreadyClaimed");
    } catch (error) {
      expect(errorText(error)).to.contain("AlreadyClaimed");
    }

    const vault = await getAccount(connection, vaultPda);
    expect(Number(vault.amount)).to.eq(FUND - WITHDRAW + PREMIUM - COVERAGE);
  });
});
