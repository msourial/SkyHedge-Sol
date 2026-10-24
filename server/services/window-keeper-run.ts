/**
 * Devnet ladder planner. Always a dry run.
 * The admin key is never read, written, or sent to Vercel.
 * Missing rungs are signed only through scripts/sign-ladder-phantom.ts.
 */
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DES_MOINES_SEED_LIQUIDITY_BASE } from "../../shared/des-moines-seed-plan.js";
import { expiryLabel, LIVE_CITY_SLUGS, type LiveCitySlug } from "../../shared/window-ladder.js";
import { PERILS } from "../../shared/perils.js";
import { priceFromHitCount, type ExistingRung } from "../../shared/rung-plan.js";
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa.js";
import { DevnetStatusReader, type LadderMarketSnapshot } from "./devnet-status.js";
import { buildDemoPlan, DEMO_NOW_SECONDS, loadAnalogueSeries, type DemoPlan } from "./demo-keeper-plan.js";
import { assertDevnetKeeperTarget, cityHashBytes, encodeStrike, evidenceHashes, TEST_SKYT_MINT, type PricedLadderStep } from "./window-keeper.js";

const PROGRAM_ID = new PublicKey("5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx");
const CREATE = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
const FUND = Buffer.from([36, 57, 233, 176, 181, 20, 87, 159]);
const OPEN = Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]);

export async function runWindowKeeper(options: { sign?: boolean; nowSeconds?: number; city?: LiveCitySlug } = {}) {
  if (options.sign) {
    throw new Error("The keeper stays a dry run. Sign missing rungs in Phantom with scripts/sign-ladder-phantom.ts.");
  }
  const { status } = await readLadder(options.city);
  const plan = cataloguePlan(status.ladderMarkets, options.nowSeconds ?? DEMO_NOW_SECONDS, options.city);
  return {
    signed: false,
    mode: "dry-run",
    network: "devnet",
    admin: status.protocol.admin,
    city: options.city ?? "all",
    steps: plan.steps,
    creates: plan.creates.length,
    approvals: plan.approvals,
    fundSkyt: plan.fundSkyt,
    skipped: plan.skipped,
    priced: null as PricedLadderStep[] | null,
  };
}

export type PhantomLadderStep = {
  step: string;
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  dataBase64: string;
};

/** Prices missing rungs and returns unsigned instructions. No key material. */
export async function phantomLadderPayload(city?: LiveCitySlug) {
  const { rpcUrl, status } = await readLadder(city);
  const adminAddress = status.protocol.admin;
  if (!adminAddress || !status.protocol.address) throw new Error("Devnet protocol admin is missing.");
  const plan = cataloguePlan(status.ladderMarkets, DEMO_NOW_SECONDS, city);
  const priced = plan.steps.flatMap((step) => {
    const row = pricedFromPlan(step);
    return row ? [row] : [];
  });
  const admin = new PublicKey(adminAddress);
  const protocol = new PublicKey(status.protocol.address);
  const mint = new PublicKey(TEST_SKYT_MINT);
  let marketId = BigInt(status.protocol.nextMarketId ?? "0");
  const prepared: PhantomLadderStep[] = [];
  const summary: Array<Record<string, unknown>> = [];
  const skipped: string[] = [
    ...plan.skipped.map((line) => `${line.city} ${line.peril} ${line.windowStart}: ${line.reason}`),
  ];
  for (const step of priced) {
    const trigger = step.triggerValue ?? step.thresholdMm;
    const label = `${step.city ?? "city"} · ${step.peril ?? "rain"} · ${step.window.tenor} · ${expiryLabel(step.window)}`;
    if (step.skipReason || trigger == null || step.probabilityBps == null || !step.inputsHash) {
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
      triggerValue: step.triggerValue ?? step.thresholdMm,
      unit: step.unit ?? "mm",
      peril: step.peril ?? "rain",
      scaledX100: step.scaledX100 ?? null,
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

function cataloguePlan(markets: readonly LadderMarketSnapshot[], nowSeconds: number, city?: LiveCitySlug): DemoPlan {
  return buildDemoPlan(loadAnalogueSeries(), existingRungsFromLadder(markets), nowSeconds, city);
}

export function existingRungsFromLadder(markets: readonly LadderMarketSnapshot[]): ExistingRung[] {
  return markets.flatMap((market) => {
    if (market.observationStart == null || market.observationEnd == null || market.thresholdMmX100 == null || market.operator == null) return [];
    const scaledX100 = Number(market.thresholdMmX100);
    if (!Number.isSafeInteger(scaledX100)) return [];
    return [{
      city: market.city,
      peril: market.peril,
      observationStart: market.observationStart,
      observationEnd: market.observationEnd,
      scaledX100,
      operator: market.operator,
      state: market.state,
      address: market.address,
      marketId: market.marketId,
      vaultBalanceBase: market.vaultBalance,
    }];
  });
}

function pricedFromPlan(step: DemoPlan["steps"][number]): PricedLadderStep | null {
  if (step.action === "keep") return null;
  const price = priceFromHitCount(step.hits, null, step.triggerValue);
  if (!price) return null;
  const station = NOAA_STATIONS[step.city];
  const observationStart = new Date(step.window.observationStart * 1_000).toISOString().slice(0, 10);
  const observationEnd = new Date(step.window.observationEnd * 1_000).toISOString().slice(0, 10);
  const inputsHash = canonicalSourceHash({
    schema: "skyhedge-noaa-quote-inputs-v1",
    city: step.city,
    peril: step.peril,
    stationId: station.stationId,
    observationStart,
    observationEndExclusive: observationEnd,
    triggerValue: step.triggerValue,
    scaledX100: step.scaledX100,
    operator: "gte",
    hits: step.hits,
    forecastCumulative: null,
    pricing: price,
  });
  const shared = {
    window: step.window,
    city: step.city,
    thresholdMm: Number.isInteger(step.triggerValue) ? step.triggerValue : null,
    scaledX100: step.scaledX100,
    triggerValue: step.triggerValue,
    peril: step.peril,
    unit: PERILS[step.peril].unit,
    probabilityBps: price.probabilityBps,
    premiumRateBps: price.premiumRateBps,
    forecastIncluded: false,
    inputsHash,
    stationId: station.stationId,
    skipReason: null,
  };
  if (step.action === "create-fund-open") return { action: "create-fund-open", ...shared };
  if (!step.existing?.marketId || !step.existing.address) return null;
  return { action: step.action, marketId: step.existing.marketId, address: step.existing.address, ...shared };
}

async function readLadder(city?: LiveCitySlug) {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const mint = process.env.SKYT_MINT ?? TEST_SKYT_MINT;
  assertDevnetKeeperTarget(rpcUrl, mint);
  const status = await new DevnetStatusReader(new Connection(rpcUrl, "finalized")).read();
  if (status.network.toLowerCase() !== "devnet") throw new Error("Window keeper refuses a non-Devnet status network.");
  void city;
  return { rpcUrl, status };
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
  const scaled = encodeStrike(step);
  if (scaled <= 0n) throw new Error("Refusing a non-positive strike.");
  const hashes = evidenceHashes(step.stationId, step.peril ?? "rain");
  const data = Buffer.concat([
    CREATE,
    cityHashBytes(step.city, step.peril ?? "rain"),
    Buffer.from(hashes.stationIdHash, "hex"),
    Buffer.from(hashes.providerHash, "hex"),
    Buffer.from(hashes.methodologyHash, "hex"),
    Buffer.from(step.inputsHash!, "hex"),
    Buffer.from([1]),
    i64(scaled),
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
