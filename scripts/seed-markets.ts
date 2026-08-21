import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Program, Wallet } from "@coral-xyz/anchor";
import { RPC_URL, ROOT, UNIT, loadDeployer, loadProgram, protocolPda, marketPda, bn, hashBufferAsArray, nowSeconds, log } from "./lib/chain";

const MARKET_SPEC: Record<string, { thresholdMm: number; salesCloseHours: number; observationDays: number; quoteProbabilityBps: number }> = {
  "new-york": { thresholdMm: 25, salesCloseHours: 24, observationDays: 7, quoteProbabilityBps: 2_000 },
  miami: { thresholdMm: 50, salesCloseHours: 24, observationDays: 7, quoteProbabilityBps: 2_000 },
  chicago: { thresholdMm: 25, salesCloseHours: 24, observationDays: 7, quoteProbabilityBps: 2_000 },
};

const LP_FUND_PER_MARKET = 2_000 * UNIT;

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadDeployer();
  const program = await loadProgram(connection, admin);

  const mintEnv = process.env.SKYT_MINT;
  if (!mintEnv) throw new Error("SKYT_MINT env var is required (run scripts/create-skyt-mint.ts first)");
  const collateralMint = new PublicKey(mintEnv);

  const [protocolAddress] = protocolPda();
  const protocol = await program.account.protocolConfig.fetch(protocolAddress);
  log("protocol", { address: protocolAddress.toBase58(), nextMarketId: protocol.nextMarketId.toString() });

  const methodology = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/methodology-v1.json"), "utf8"));
  const providerHash = hashBufferAsArray(JSON.stringify(methodology));
  const methodologyHash = hashBufferAsArray(methodology.version);

  const adminAta = await getOrCreateAssociatedTokenAccount(connection, admin, collateralMint, admin.publicKey);
  const adminBalance = Number((await connection.getTokenAccountBalance(adminAta.address)).value.amount);
  log("admin SKYT balance", adminBalance);
  if (adminBalance < LP_FUND_PER_MARKET) throw new Error(`Admin needs >= ${LP_FUND_PER_MARKET} SKYT to fund pools; run npm run skyt:faucet first`);

  const now = nowSeconds();
  for (const [city, spec] of Object.entries(MARKET_SPEC)) {
    const protocol = await program.account.protocolConfig.fetch(protocolAddress);
    const [marketAddress] = marketPda(protocolAddress, protocol.nextMarketId.toNumber());
    const existing = await connection.getAccountInfo(marketAddress);
    if (existing) { log(`market ${city} already exists`, marketAddress.toBase58()); continue; }

    const salesCloseAt = now + spec.salesCloseHours * 3600;
    const observationStart = salesCloseAt;
    const observationEnd = observationStart + spec.observationDays * 24 * 3600;

    log(`seeding ${city}`, { thresholdMm: spec.thresholdMm, salesCloseAt, observationStart, observationEnd, quoteProbabilityBps: spec.quoteProbabilityBps });

    await program.methods
      .createMarket({
        cityHash: hashBufferAsArray(city),
        stationIdHash: hashBufferAsArray(methodology.cities[city].noaaStation),
        providerHash,
        methodologyHash,
        quoteInputsHash: hashBufferAsArray(`${methodology.version}:${city}:${spec.thresholdMm}:${spec.quoteProbabilityBps}`),
        operator: { greaterThanOrEqual: {} },
        thresholdMmX100: bn(spec.thresholdMm * 100),
        salesCloseAt: bn(salesCloseAt),
        observationStart: bn(observationStart),
        observationEnd: bn(observationEnd),
        quoteProbabilityBps: spec.quoteProbabilityBps,
        maxLiquidity: bn(10_000 * UNIT),
        maxExposure: bn(8_000 * UNIT),
        perWalletMax: bn(500 * UNIT),
      })
      .accounts({ admin: admin.publicKey, collateralMint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([admin])
      .rpc();
    log(`created market ${city}`, marketAddress.toBase58());

    await program.methods
      .fundPool(bn(LP_FUND_PER_MARKET))
      .accounts({
        provider: admin.publicKey,
        market: marketAddress,
        providerTokenAccount: adminAta.address,
        collateralMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
    log(`funded pool ${city}`, `${LP_FUND_PER_MARKET} SKYT`);

    await program.methods.openMarket().accounts({ admin: admin.publicKey, market: marketAddress }).signers([admin]).rpc();
    log(`opened market ${city}`, marketAddress.toBase58());

    const market = await program.account.market.fetch(marketAddress);
    log(`market ${city} state`, {
      address: marketAddress.toBase58(),
      id: market.id.toString(),
      status: JSON.stringify(market.status),
      premiumRateBps: market.premiumRateBps,
      totalShares: market.totalShares.toString(),
      salesCloseAt: market.salesCloseAt.toNumber(),
      observationStart: market.observationStart.toNumber(),
      observationEnd: market.observationEnd.toNumber(),
    });
  }
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });