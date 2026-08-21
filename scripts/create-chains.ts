import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { RPC_URL, ROOT, UNIT, loadDeployer, loadProgram, protocolPda, marketPda, bn, hashBufferAsArray, nowSeconds, log } from "./lib/chain";
import { CITY_INDEX, upcomingWeeklyWindows } from "../shared/cities";
import { priceChainOption, strikeSetFor, type ChainSide } from "../server/services/chain-pricing";

const LP_FUND_PER_MARKET = 500 * UNIT;

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadDeployer();
  const program = await loadProgram(connection, admin);

  const mintEnv = process.env.SKYT_MINT;
  if (!mintEnv) throw new Error("SKYT_MINT env var is required (run scripts/create-skyt-mint.ts first)");
  const collateralMint = new PublicKey(mintEnv);

  const accountOf = program.account as unknown as Record<string, { fetch: (address: PublicKey) => Promise<{ nextMarketId: { toNumber(): number } }> }>;
  const protocolOf = (address: PublicKey) => accountOf.protocolConfig.fetch(address);

  const [protocolAddress] = protocolPda();
  const protocol = await protocolOf(protocolAddress);
  log("protocol", { address: protocolAddress.toBase58(), nextMarketId: protocol.nextMarketId.toString() });

  const methodology = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/methodology-v1.json"), "utf8"));
  const providerHash = hashBufferAsArray(JSON.stringify(methodology));
  const methodologyHash = hashBufferAsArray(methodology.version);

  const adminAta = await getOrCreateAssociatedTokenAccount(connection, admin, collateralMint, admin.publicKey);
  const adminBalance = Number((await connection.getTokenAccountBalance(adminAta.address)).value.amount);
  log("admin SKYT balance", adminBalance);

  const now = nowSeconds();
  const created: string[] = [];
  let skipped = 0;

  for (const city of CITY_INDEX) {
    const window = upcomingWeeklyWindows(new Date(), 4)[1];
    const salesCloseAt = Math.floor(window.start.getTime() / 1000);
    const observationStart = salesCloseAt;
    const observationEnd = observationStart + 7 * 24 * 3600;
    const strikesForWindow = strikeSetFor(
      await priceChainOption(city, { start: window.start, end: window.end }, 5, "call").then((p) => p.normalMm),
    );

    for (const strikeMm of strikesForWindow) {
      for (const side of ["call", "put"] as ChainSide[]) {
        const price = await priceChainOption(city, { start: window.start, end: window.end }, strikeMm, side);
        const protocol = await protocolOf(protocolAddress);
        const [marketAddress] = marketPda(protocolAddress, protocol.nextMarketId.toNumber());
        if (await connection.getAccountInfo(marketAddress)) { skipped++; continue; }

        const operator = side === "call" ? { greaterThanOrEqual: {} } : { lessThanOrEqual: {} };
        await program.methods
          .createMarket({
            cityHash: hashBufferAsArray(city.slug),
            stationIdHash: hashBufferAsArray(city.noaaStationId),
            providerHash,
            methodologyHash,
            quoteInputsHash: hashBufferAsArray(`${price.modelVersion}:${city.slug}:${strikeMm}:${side}:${price.probabilityBps}:${price.probabilitySource}`),
            operator,
            thresholdMmX100: bn(strikeMm * 100),
            salesCloseAt: bn(salesCloseAt),
            observationStart: bn(observationStart),
            observationEnd: bn(observationEnd),
            quoteProbabilityBps: price.probabilityBps,
            maxLiquidity: bn(10_000 * UNIT),
            maxExposure: bn(8_000 * UNIT),
            perWalletMax: bn(500 * UNIT),
          })
          .accounts({ admin: admin.publicKey, collateralMint, tokenProgram: TOKEN_PROGRAM_ID })
          .signers([admin])
          .rpc();

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

        await program.methods.openMarket().accounts({ admin: admin.publicKey, market: marketAddress }).signers([admin]).rpc();
        created.push(marketAddress.toBase58());
        log("created", { desc: `${city.slug} ${side} @ ${strikeMm}mm prob=${(price.probabilityBps / 100).toFixed(1)}% src=${price.probabilitySource} premium=${price.premiumRateBps / 100}%`, market: marketAddress.toBase58() });
      }
    }
  }

  log("done", { created: created.length, skipped, totalPoolSkit: (created.length * LP_FUND_PER_MARKET) / UNIT });
  if (adminBalance < created.length * LP_FUND_PER_MARKET) {
    log("warning", `admin needs >= ${(created.length * LP_FUND_PER_MARKET) / UNIT} SKYT; run: npm run skyt:faucet -- ${admin.publicKey.toBase58()} 70000`);
  }
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });