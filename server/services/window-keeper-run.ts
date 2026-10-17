/**
 * Devnet ladder planner. Always a dry run.
 * The admin key is never read, written, or sent to Vercel.
 * Missing rungs are signed only through scripts/sign-ladder-phantom.ts.
 */
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DES_MOINES_SEED_LIQUIDITY_BASE } from "../../shared/des-moines-seed-plan.js";
import { expiryLabel, LIVE_CITY_SLUGS, type LiveCitySlug } from "../../shared/window-ladder.js";
import { DevnetStatusReader } from "./devnet-status.js";
import { assertDevnetKeeperTarget, cityHashBytes, evidenceHashes, keeperPlan, priceKeeperSteps, TEST_SKYT_MINT, type PricedLadderStep } from "./window-keeper.js";

const PROGRAM_ID = new PublicKey("5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx");
const CREATE = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
const FUND = Buffer.from([36, 57, 233, 176, 181, 20, 87, 159]);
const OPEN = Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]);

export async function runWindowKeeper(options: { sign?: boolean; nowSeconds?: number; city?: LiveCitySlug } = {}) {
  if (options.sign) {
    throw new Error("The keeper stays a dry run. Sign missing rungs in Phantom with scripts/sign-ladder-phantom.ts.");
  }
  const { status, steps } = await readLadder(options.nowSeconds, options.city);
  return { signed: false, mode: "dry-run", network: "devnet", admin: status.protocol.admin, city: options.city ?? "all", steps, priced: null as PricedLadderStep[] | null };
}

export type PhantomLadderStep = {
  step: string;
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  dataBase64: string;
};

/** Prices missing rungs and returns unsigned instructions. No key material. */
export async function phantomLadderPayload(city?: LiveCitySlug) {
  const { rpcUrl, status, steps } = await readLadder(undefined, city);
  const adminAddress = status.protocol.admin;
  if (!adminAddress || !status.protocol.address) throw new Error("Devnet protocol admin is missing.");
  const priced = await priceKeeperSteps(steps);
  const admin = new PublicKey(adminAddress);
  const protocol = new PublicKey(status.protocol.address);
  const mint = new PublicKey(TEST_SKYT_MINT);
  let marketId = BigInt(status.protocol.nextMarketId ?? "0");
  const prepared: PhantomLadderStep[] = [];
  const summary: Array<Record<string, unknown>> = [];
  const skipped: string[] = [];
  for (const step of priced) {
    const label = `${step.city ?? "city"} · ${step.window.tenor} · ${expiryLabel(step.window)}`;
    if (step.skipReason || step.thresholdMm == null || step.probabilityBps == null || !step.inputsHash) {
      skipped.push(`${label}: ${step.skipReason ?? "missing price"}`);
      continue;
    }
    const id = step.action === "create-fund-open" ? marketId : BigInt(step.marketId);
    const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64(id)], PROGRAM_ID);
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID);
    const [liquidity] = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), admin.toBuffer()], PROGRAM_ID);
    const adminAta = getAssociatedTokenAddressSync(mint, admin);
    const ixs: Array<{ name: string; ix: TransactionInstruction }> = [];
    if (step.action === "create-fund-open") ixs.push({ name: "create", ix: createIx(admin, protocol, market, vault, mint, step) });
    if (step.action !== "open") ixs.push({ name: "fund", ix: fundIx(admin, protocol, market, vault, adminAta, liquidity, mint) });
    ixs.push({ name: "open", ix: openIx(admin, protocol, market) });
    for (const item of ixs) prepared.push({ step: `${item.name} · ${label}`, ...serialize(item.ix) });
    summary.push({
      label,
      city: step.city,
      stationId: step.stationId,
      action: step.action,
      marketId: id.toString(),
      thresholdMm: step.thresholdMm,
      probabilityBps: step.probabilityBps,
      premiumRateBps: step.premiumRateBps,
      forecastIncluded: step.forecastIncluded,
      observationStart: new Date(step.window.observationStart * 1_000).toISOString(),
      observationEnd: new Date(step.window.observationEnd * 1_000).toISOString(),
    });
    if (step.action === "create-fund-open") marketId += 1n;
  }
  return { rpc: rpcUrl, expectedAdmin: adminAddress, steps: prepared, summary, skipped };
}

async function readLadder(nowSeconds?: number, city?: LiveCitySlug) {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const mint = process.env.SKYT_MINT ?? TEST_SKYT_MINT;
  assertDevnetKeeperTarget(rpcUrl, mint);
  const status = await new DevnetStatusReader(new Connection(rpcUrl, "finalized")).read();
  if (status.network.toLowerCase() !== "devnet") throw new Error("Window keeper refuses a non-Devnet status network.");
  const steps = keeperPlan(status.ladderMarkets.map((market) => ({
    city: market.city,
    marketId: market.marketId,
    address: market.address,
    state: market.state,
    salesCloseAt: market.salesCloseAt,
    observationStart: market.observationStart,
    observationEnd: market.observationEnd,
    vaultBalanceBase: market.vaultBalance,
  })), nowSeconds, city ? [city] : undefined);
  return { rpcUrl, status, steps };
}

export function parseKeeperCity(argv: readonly string[]): LiveCitySlug | undefined {
  const index = argv.indexOf("--city");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || !(LIVE_CITY_SLUGS as readonly string[]).includes(value)) {
    throw new Error(`--city must be one of: ${LIVE_CITY_SLUGS.join(", ")}`);
  }
  return value as LiveCitySlug;
}

function serialize(ix: TransactionInstruction): Omit<PhantomLadderStep, "step"> {
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((key) => ({ pubkey: key.pubkey.toBase58(), isSigner: key.isSigner, isWritable: key.isWritable })),
    dataBase64: Buffer.from(ix.data).toString("base64"),
  };
}

function createIx(admin: PublicKey, protocol: PublicKey, market: PublicKey, vault: PublicKey, mint: PublicKey, step: PricedLadderStep) {
  if (!step.city) throw new Error("Refusing to build a market with no city.");
  const hashes = evidenceHashes(step.stationId);
  const data = Buffer.concat([
    CREATE,
    cityHashBytes(step.city),
    Buffer.from(hashes.stationIdHash, "hex"),
    Buffer.from(hashes.providerHash, "hex"),
    Buffer.from(hashes.methodologyHash, "hex"),
    Buffer.from(step.inputsHash!, "hex"),
    Buffer.from([1]),
    i64(BigInt(step.thresholdMm!) * 100n),
    i64(BigInt(step.window.salesCloseAt)),
    i64(BigInt(step.window.observationStart)),
    i64(BigInt(step.window.observationEnd)),
    u16(step.probabilityBps!),
    u64(10_000_000_000n),
    u64(8_000_000_000n),
    u64(500_000_000n),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function fundIx(admin: PublicKey, protocol: PublicKey, market: PublicKey, vault: PublicKey, adminAta: PublicKey, liquidity: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: adminAta, isSigner: false, isWritable: true },
      { pubkey: liquidity, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([FUND, u64(DES_MOINES_SEED_LIQUIDITY_BASE)]),
  });
}

function openIx(admin: PublicKey, protocol: PublicKey, market: PublicKey) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
    ],
    data: OPEN,
  });
}

function u64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(value);
  return out;
}
function i64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigInt64LE(value);
  return out;
}
function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}
