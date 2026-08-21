import "dotenv/config";
import { execFileSync, execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { eq, sql } from "drizzle-orm";
import { RPC_URL, ROOT, UNIT, loadDeployer, loadProgram, protocolPda, marketPda, bn, nowSeconds, log, PROGRAM_KEYPAIR_PATH } from "./lib/chain";
import { AnchorIndexer } from "../server/services/solana-indexer";
import { createDb } from "../server/db";
import { protectionPositions, markets as marketsTable } from "../shared/schema";

const LOCAL_RPC = "http://127.0.0.1:8899";
const VALIDATOR_LEDGER = path.join(ROOT, ".localnet-ledger");
const POSITION_SKYT = 500;      // perWalletMax
const FUND_EXTRA_SKYT = 3_000;  // extra pool beyond seed's 2,000/market

function sh(command: string, env: Record<string, string> = {}): string {
  log("$", command);
  return execSync(command, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: { ...process.env as Record<string, string>, ...env } });
}

function shFile(bin: string, args: string[], env: Record<string, string> = {}): string {
  log("$", `${bin} ${args.join(" ")}`);
  return execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: { ...process.env as Record<string, string>, ...env } });
}

async function purgeDb(): Promise<void> {
  try {
    const db = createDb();
    await db.execute(sql`TRUNCATE chain_events, markets, liquidity_positions, protection_positions, settlement_observations, indexed_slots;`);
    log("db", "purged (fresh ledger = fresh index)");
  } catch (error) {
    log("db", `purge skipped (${(error as Error).message}) — stale rows may remain`);
  }
}

async function ensureValidator(): Promise<void> {
  try {
    execSync(`solana cluster-version --url ${LOCAL_RPC}`, { stdio: "ignore" });
    log("validator", "already running");
    return;
  } catch {
    log("validator", "not running — starting solana-test-validator");
  }
  fs.mkdirSync(VALIDATOR_LEDGER, { recursive: true });
  const child = spawn("solana-test-validator", ["--ledger", VALIDATOR_LEDGER, "--reset", "--quiet"], { stdio: "ignore", detached: true });
  child.unref();
  const connection = new Connection(LOCAL_RPC, "confirmed");
  for (let i = 0; i < 60; i++) {
    try {
      await connection.getSlot();
      log("validator", "ready");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  throw new Error("solana-test-validator did not become ready in 60s");
}

async function ensureDeployed(): Promise<void> {
  const program = new PublicKey(process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr");
  const connection = new Connection(LOCAL_RPC, "confirmed");
  if (await connection.getAccountInfo(program)) {
    log("program", "already deployed to localnet");
    return;
  }
  if (!fs.existsSync(PROGRAM_KEYPAIR_PATH)) {
    log("build", "compiling program (first run ~1-3 min)");
    sh("npm run solana:build");
  } else {
    log("build", "program .so present — skipping build");
  }
  const programId = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(PROGRAM_KEYPAIR_PATH, "utf8")) as number[])).publicKey.toBase58();
  const tempKeypair = "/tmp/skyhedge-program-keypair.json";
  fs.copyFileSync(PROGRAM_KEYPAIR_PATH, tempKeypair);
  shFile("solana", ["program", "deploy", PROGRAM_KEYPAIR_PATH.replace("-keypair.json", ".so"), "--url", LOCAL_RPC, "--program-id", tempKeypair]);
  log("program", `deployed ${program.toBase58()}`);
}

async function main(): Promise<void> {
  const env: Record<string, string> = { SOLANA_RPC_URL: LOCAL_RPC };
  let chainCreated = 0;
  await ensureValidator();
  await purgeDb();
  await ensureDeployed();

  const connection = new Connection(LOCAL_RPC, "confirmed");
  const admin = loadDeployer();
  const program = await loadProgram(connection, admin);
  const [protocolAddress] = protocolPda();
  const protocolAccount = await connection.getAccountInfo(protocolAddress);
  const accounts = program.account as unknown as Record<string, { fetch: (a: PublicKey) => Promise<Record<string, unknown>> }>;

  if (protocolAccount) {
    log("step", "protocol already initialized — reusing on-chain mint");
    const protocol = (await accounts["protocolConfig"].fetch(protocolAddress)) as unknown as { collateralMint: PublicKey; nextMarketId: { toNumber: () => number } };
    env.SKYT_MINT = protocol.collateralMint.toBase58();
    log("SKYT_MINT", env.SKYT_MINT);
  } else {
    log("step", "1/7 create SKYT mint");
    const mintOutput = sh("npm run skyt:mint", env);
    const mintMatch = mintOutput.match(/SKYT mint created:\s*(\w+)/) ?? mintOutput.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (!mintMatch) throw new Error("could not parse SKYT mint from create-skyt-mint output");
    env.SKYT_MINT = mintMatch[1];
    log("SKYT_MINT", env.SKYT_MINT);

    log("step", "2/7 initialize protocol (admin + settlement authority)");
    sh("npm run skyt:init", env);

    log("step", "3/7 faucet SKYT to admin wallet");
    sh(`npm run skyt:faucet -- ${admin.publicKey.toBase58()} 70000`, env);

    log("step", "4/7 seed + fund + open city markets");
    sh("npm run skyt:seed", env);

    log("step", "4b/7 create weekly options chains for all index cities");
    const chainOutput = sh("npm run skyt:chains", env);
    chainCreated = Number(chainOutput.match(/"created":\s*(\d+)/)?.[1] ?? 0);
    log("chains created", chainCreated);
  }

  const protocol = (await accounts["protocolConfig"].fetch(protocolAddress)) as unknown as { nextMarketId: { toNumber: () => number } };
  const [marketAddress] = marketPda(protocolAddress, protocol.nextMarketId.toNumber() - 1);
  log("step", `5/7 fund extra ${FUND_EXTRA_SKYT} SKYT into market ${marketAddress.toBase58()}`);

  const mint = new PublicKey(env.SKYT_MINT);
  const adminAta = (await getOrCreateAssociatedTokenAccount(connection, admin, mint, admin.publicKey)).address;
  const market = (await accounts["market"].fetch(marketAddress)) as unknown as { status: unknown; premiumRateBps: number; totalShares: { toString: () => string }; protectedAmount: { toString: () => string } };
  log("market state", { city: "last-seeded", status: JSON.stringify(market.status), premiumRateBps: market.premiumRateBps, totalShares: market.totalShares.toString() });

  const TARGET_POOL_SKYT = 5_000 * UNIT;
  if (BigInt(market.totalShares.toString()) >= BigInt(TARGET_POOL_SKYT)) {
    log("fund", `pool already >= ${TARGET_POOL_SKYT / UNIT} SKYT — skipping`);
  } else {
    await program.methods
      .fundPool(bn(FUND_EXTRA_SKYT * UNIT))
      .accounts({ provider: admin.publicKey, market: marketAddress, providerTokenAccount: adminAta, collateralMint: mint, tokenProgram: await import("@solana/spl-token").then((m) => m.TOKEN_PROGRAM_ID) })
      .signers([admin])
      .rpc();
    log("funded", `${FUND_EXTRA_SKYT} SKYT extra`);
  }

  const positionAddress = PublicKey.findProgramAddressSync([Buffer.from("position"), marketAddress.toBuffer(), admin.publicKey.toBuffer()], new PublicKey(env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr"))[0];
  if (await connection.getAccountInfo(positionAddress)) {
    log("position", "already open — skipping");
  } else {
    log("step", "6/7 open a protection position");
    await program.methods
      .openPosition(bn(POSITION_SKYT * UNIT))
      .accounts({ owner: admin.publicKey, market: marketAddress, ownerTokenAccount: adminAta, collateralMint: mint, tokenProgram: await import("@solana/spl-token").then((m) => m.TOKEN_PROGRAM_ID) })
      .signers([admin])
      .rpc();
    log("position", `${POSITION_SKYT} SKYT protected @ ${market.premiumRateBps / 100}%`);
  }

  log("step", "6b/7 wait for the position tx to finalize (indexer reads finalized only)");
  for (let i = 0; i < 60; i++) {
    if (await connection.getAccountInfo(positionAddress, "finalized")) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const finalized = await connection.getAccountInfo(positionAddress, "finalized");
  if (!finalized) log("warning", "position not finalized within 60s — portfolio row may lag behind");

  log("step", "7/7 indexer reconcile → portfolio in DB");
  const indexer = new AnchorIndexer(createDb());
  const db = createDb();
  const expectedMarkets = 3 + (chainCreated > 0 ? chainCreated : 0);
  log("indexer", `expecting ${expectedMarkets} markets (3 legacy seed + ${chainCreated} chain) in the index`);

  let result = await indexer.reconcile();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(marketsTable);
    if (row.n >= expectedMarkets) break;
    log("indexer", `markets ${row.n}/${expectedMarkets} — waiting for finalization, retrying…`);
    await new Promise((r) => setTimeout(r, 10_000));
    result = await indexer.reconcile();
  }
  log("indexer", { toSlot: result.toSlot.toString(), events: result.events, accounts: result.accounts });

  let [positionRow] = await db.select().from(protectionPositions).where(eq(protectionPositions.owner, admin.publicKey.toBase58())).limit(1);
  if (!positionRow) {
    log("indexer", "position row missing after stable reconcile — reconciling once more");
    await indexer.reconcile();
    [positionRow] = await db.select().from(protectionPositions).where(eq(protectionPositions.owner, admin.publicKey.toBase58())).limit(1);
  }
  const marketRows = await db.select().from(marketsTable).limit(3);
  log("portfolio", positionRow
    ? { owner: positionRow.owner, market: positionRow.marketAddress, protectedAmount: positionRow.protectedAmount.toString(), premiumPaid: positionRow.premiumPaid.toString(), state: positionRow.state }
    : "position not indexed yet — wait 30s and re-run");
  log("indexed markets", marketRows.length);
  log("done", `start the server (npm run dev) with SOLANA_RPC_URL=${LOCAL_RPC} to see the demo in the UI`);
}

void main().catch((error) => { console.error(`DEMO FAILED: ${error.message}`); process.exitCode = 1; });