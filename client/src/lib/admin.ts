import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { isValidImmutableMarketPricingTerms } from "../../../shared/market-pricing";
import { assertFreshMarketCounterMatches, assertFreshSeedAllowed, DES_MOINES_SEED_LIQUIDITY_BASE, marketStateFromAccountData, marketStateFromStatusJson, planDesMoinesSeed, seedTermsMatch, type SeedStep } from "../../../shared/des-moines-seed-plan";
import { connection, PROGRAM_ID, PROTOCOL_ADMIN, SETTLEMENT_AUTHORITY, SKYT_MINT } from "./solana";

const program = new PublicKey(PROGRAM_ID);
const mint = new PublicKey(SKYT_MINT);
const protocolSeed = Buffer.from("protocol");
const feeVaultSeed = Buffer.from("fee-vault");
const initializeDiscriminator = Buffer.from([188, 233, 252, 106, 134, 146, 202, 91]);
const createMarketDiscriminator = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
const fundPoolDiscriminator = Buffer.from([36, 57, 233, 176, 181, 20, 87, 159]);
const openMarketDiscriminator = Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]);
export const SKYT_ISSUANCE = 50_000_000_000n;

export function protocolPda() { return PublicKey.findProgramAddressSync([protocolSeed], program)[0]; }
export function feeVaultPda() { return PublicKey.findProgramAddressSync([feeVaultSeed, protocolPda().toBuffer()], program)[0]; }
export function isProtocolAdmin(key?: PublicKey | null) { return key?.toBase58() === PROTOCOL_ADMIN; }
export function explorerTx(signature: string) { return `https://explorer.solana.com/tx/${signature}?cluster=devnet`; }

export async function protocolExists() { return Boolean(await connection.getAccountInfo(protocolPda(), "finalized")); }

export type DesMoinesEvidencePackage = {
  /** Only a server-validated NOAA package may be used to build these instructions. */
  validated: true;
  stationId: string;
  stationIdHash: string;
  providerHash: string;
  methodologyHash: string;
  seedSchedule: { salesCloseAt: number; observationStart: number; observationEnd: number };
  quoteTerms: null | { probabilityBps: number; premiumRateBps: number; inputsHash: string };
};

export type DesMoinesSeedTransactions = {
  market: PublicKey;
  vault: PublicKey;
  liquidityPosition: PublicKey;
  transactions: Array<{ step: SeedStep; transaction: Transaction }>;
  alreadyOpen: boolean;
};

export type FinalizedDesMoinesMarket = {
  status: "ready" | "pending" | "unavailable" | "error";
  address: string | null;
  marketId: string | null;
  vault: string | null;
  vaultBalance: string | null;
  onchainStatus: string | null;
  salesCloseAt: number | null;
  observationStart: number | null;
  observationEnd: number | null;
  quoteProbabilityBps: number | null;
  premiumRateBps: number | null;
  quoteInputsHash: string | null;
  evidenceStatus: "researching_evidence" | "validated";
};

function hashBytes(value: string, name: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be a 32-byte hexadecimal hash from the validated NOAA package.`);
  return Buffer.from(value, "hex");
}

function i64(value: bigint): Buffer { const out = Buffer.alloc(8); out.writeBigInt64LE(value); return out; }
function u16(value: number): Buffer { const out = Buffer.alloc(2); out.writeUInt16LE(value); return out; }
function u64(value: bigint): Buffer { const out = Buffer.alloc(8); out.writeBigUInt64LE(value); return out; }

/**
 * Builds the three admin-approved instructions for the first agricultural market.
 * This deliberately requires a complete, server-validated NOAA evidence package;
 * coordinates or a station name alone can never unlock market creation.
 */
export async function desMoinesSeedTransactions(
  admin: PublicKey,
  evidence: DesMoinesEvidencePackage,
  finalizedMarket: FinalizedDesMoinesMarket,
  finalizedProtocol: { status: string; initialized: boolean; nextMarketId: string | null },
): Promise<DesMoinesSeedTransactions> {
  if (!isProtocolAdmin(admin)) throw new Error("Only the configured protocol admin can seed Des Moines.");
  if (!evidence.validated || !evidence.stationId.trim()) throw new Error("Des Moines market seeding requires a validated NOAA station package.");
  hashBytes(evidence.stationIdHash, "stationIdHash");
  const cityHash = await sha256Hex("des-moines");
  const protocol = protocolPda();
  const protocolInfo = await connection.getAccountInfo(protocol, "finalized");
  if (!protocolInfo) throw new Error("Initialize the protocol and wait for finalized confirmation first.");
  // Anchor account data: discriminator (8) + six Pubkeys, then next_market_id.
  if (protocolInfo.data.length < 208) throw new Error("The finalized protocol account has an invalid layout.");
  const nextMarketId = protocolInfo.data.readBigUInt64LE(200);
  const hasExisting = finalizedMarket.status === "ready" && Boolean(finalizedMarket.address && finalizedMarket.marketId);
  if (finalizedProtocol.status !== "ready" || !finalizedProtocol.initialized) {
    throw new Error("The finalized protocol status is not ready; no market-seed transaction was prepared.");
  }
  assertFreshSeedAllowed({
    marketFound: hasExisting,
    marketReadStatus: finalizedMarket.status,
    protocolStatus: finalizedProtocol.status,
    protocolInitialized: finalizedProtocol.initialized,
  });
  const apiMarketState = hasExisting ? marketStateFromStatusJson(finalizedMarket.onchainStatus) : "missing";
  const marketState = apiMarketState ?? "unknown";
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const expiredDraft = marketState === "draft" && finalizedMarket.salesCloseAt !== null && finalizedMarket.salesCloseAt <= nowSeconds;
  const terminal = marketState === "settled" || marketState === "data_unavailable" || marketState === "closed";
  const useExisting = hasExisting && !expiredDraft && !terminal;
  if (!useExisting) assertFreshMarketCounterMatches(finalizedProtocol.nextMarketId, nextMarketId);
  const marketId = useExisting ? BigInt(finalizedMarket.marketId!) : nextMarketId;
  if (useExisting && marketId >= nextMarketId) throw new Error("Finalized market status is inconsistent with the protocol market counter.");
  const [market, marketBump] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64(marketId)], program);
  if (useExisting && market.toBase58() !== finalizedMarket.address) throw new Error("The finalized Des Moines market PDA does not match its protocol market ID.");
  const marketInfo = await connection.getAccountInfo(market, "finalized");
  if (useExisting && (!marketInfo || !marketInfo.owner.equals(program))) throw new Error("The reported Des Moines market is not present in finalized Devnet RPC.");
  if (!useExisting && marketInfo) throw new Error(`Market ID ${marketId.toString()} already exists on finalized Devnet. Refresh Builder status before preparing another seed.`);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], program);
  if (useExisting && finalizedMarket.vault !== vault.toBase58()) throw new Error("The finalized Des Moines market vault PDA does not match its market.");
  const liquidityPosition = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), admin.toBuffer()], program)[0];
  const resumeDraft = useExisting && marketState === "draft" && finalizedMarket.salesCloseAt !== null && finalizedMarket.salesCloseAt > nowSeconds;
  const useCommittedTerms = resumeDraft || (useExisting && marketState === "open");
  let terms = evidence.quoteTerms;
  let schedule = evidence.seedSchedule;
  if (useCommittedTerms) {
    if (finalizedMarket.evidenceStatus !== "validated"
      || finalizedMarket.salesCloseAt === null
      || finalizedMarket.observationStart === null
      || finalizedMarket.observationEnd === null
      || finalizedMarket.quoteProbabilityBps === null
      || finalizedMarket.premiumRateBps === null
      || !finalizedMarket.quoteInputsHash) {
      throw new Error("The finalized Draft is missing verified immutable NOAA terms; no follow-up transaction was prepared.");
    }
    const committedTerms = {
      probabilityBps: finalizedMarket.quoteProbabilityBps,
      premiumRateBps: finalizedMarket.premiumRateBps,
      inputsHash: finalizedMarket.quoteInputsHash,
    };
    if (resumeDraft && (!evidence.quoteTerms || !seedTermsMatch({
      state: "draft",
      salesCloseAt: finalizedMarket.salesCloseAt,
      observationStart: finalizedMarket.observationStart,
      observationEnd: finalizedMarket.observationEnd,
      quoteProbabilityBps: finalizedMarket.quoteProbabilityBps,
      premiumRateBps: finalizedMarket.premiumRateBps,
      quoteInputsHash: finalizedMarket.quoteInputsHash,
      totalShares: null,
    }, {
      ...evidence.seedSchedule,
      ...evidence.quoteTerms,
    }))) {
      throw new Error("This Draft's immutable observation window or quote hash does not match the current NOAA pricing package. No funding or opening transaction was prepared; wait for its sales deadline, then request a fresh seed package.");
    }
    terms = resumeDraft ? evidence.quoteTerms! : committedTerms;
    schedule = {
      salesCloseAt: finalizedMarket.salesCloseAt,
      observationStart: finalizedMarket.observationStart,
      observationEnd: finalizedMarket.observationEnd,
    };
  } else {
    if (!isValidImmutableMarketPricingTerms(terms)) {
      throw new Error("NOAA station evidence is validated, but no complete actuarial pricing package is available for the immutable market dates. No market transaction was prepared.");
    }
    const day = 86_400;
    if (!schedule || ![schedule.salesCloseAt, schedule.observationStart, schedule.observationEnd].every(Number.isSafeInteger)
      || schedule.salesCloseAt <= 0
      || schedule.observationStart !== Math.ceil(schedule.salesCloseAt / day) * day
      || schedule.observationEnd - schedule.observationStart !== 5 * day) {
      throw new Error("NOAA pricing dates are missing or do not match the five-full-day Devnet test schedule. No market transaction was prepared.");
    }
    if (nowSeconds >= schedule.salesCloseAt) {
      throw new Error("This NOAA pricing package has expired. Refresh the exact-window quote before preparing any wallet transaction.");
    }
  }
  if (useExisting) {
    const data = marketInfo!.data;
    if (data.length < 325) throw new Error("The finalized Des Moines market account has an invalid layout.");
    const expectedDiscriminator = await sha256Hex("account:Market");
    const chainMarketState = marketStateFromAccountData(data);
    if (!chainMarketState || chainMarketState !== marketState || data[383] !== marketBump) {
      throw new Error("The finalized market lifecycle state or PDA bump does not match the market record. Refresh status before preparing a follow-up transaction.");
    }
    const fieldsMatch = data.length >= 293
      && data.subarray(0, 8).equals(expectedDiscriminator.subarray(0, 8))
      && data.readBigUInt64LE(8) === marketId
      && data.subarray(16, 48).equals(protocol.toBuffer())
      && data.subarray(80, 112).equals(cityHash)
      && data.subarray(112, 144).equals(hashBytes(evidence.stationIdHash, "stationIdHash"))
      && data.subarray(144, 176).equals(hashBytes(evidence.providerHash, "providerHash"))
      && data.subarray(176, 208).equals(hashBytes(evidence.methodologyHash, "methodologyHash"))
      && data.subarray(208, 240).equals(hashBytes(terms!.inputsHash, "quoteInputsHash"))
      && data.readBigInt64LE(249) === BigInt(schedule!.salesCloseAt)
      && data.readBigInt64LE(257) === BigInt(schedule!.observationStart)
      && data.readBigInt64LE(265) === BigInt(schedule!.observationEnd)
      && data.readUInt16LE(289) === terms!.probabilityBps
      && data.readUInt16LE(291) === terms!.premiumRateBps;
    if (!fieldsMatch || finalizedMarket.evidenceStatus !== "validated") {
      throw new Error("The finalized market account does not match the validated NOAA station, immutable schedule, and exact quote hash. No follow-up transaction was prepared.");
    }
  }
  const vaultAccount = useExisting ? await getAccount(connection, vault, "finalized", TOKEN_PROGRAM_ID) : null;
  if (vaultAccount && (!vaultAccount.mint.equals(mint) || !vaultAccount.owner.equals(market))) {
    throw new Error("The finalized market vault is not controlled by this market or does not contain SKYT.");
  }
  const vaultBalance = vaultAccount?.amount.toString() ?? "0";
  const totalShares = useExisting ? marketInfo!.data.readBigUInt64LE(317).toString() : "0";
  if (BigInt(vaultBalance) < BigInt(totalShares)) throw new Error("The finalized market vault is below its recorded LP shares; no funding or opening transaction was prepared.");
  if (useExisting && marketState === "open") return { market, vault, liquidityPosition, transactions: [], alreadyOpen: true };
  const seedPlan = planDesMoinesSeed({
    state: useExisting ? marketState : "missing",
    salesCloseAt: useExisting ? finalizedMarket.salesCloseAt : null,
    observationStart: useExisting ? finalizedMarket.observationStart : null,
    observationEnd: useExisting ? finalizedMarket.observationEnd : null,
    quoteProbabilityBps: useExisting ? finalizedMarket.quoteProbabilityBps : null,
    premiumRateBps: useExisting ? finalizedMarket.premiumRateBps : null,
    quoteInputsHash: useExisting ? finalizedMarket.quoteInputsHash : null,
    totalShares,
  }, {
    salesCloseAt: schedule!.salesCloseAt,
    observationStart: schedule!.observationStart,
    observationEnd: schedule!.observationEnd,
    probabilityBps: terms!.probabilityBps,
    premiumRateBps: terms!.premiumRateBps,
    inputsHash: terms!.inputsHash,
  }, nowSeconds);
  if (seedPlan.alreadyOpen) return { market, vault, liquidityPosition, transactions: [], alreadyOpen: true };
  const adminAta = getAssociatedTokenAddressSync(mint, admin);
  const salesCloseAt = BigInt(schedule!.salesCloseAt);
  const observationStart = BigInt(schedule!.observationStart);
  const observationEnd = BigInt(schedule!.observationEnd);
  const createData = Buffer.concat([
    createMarketDiscriminator,
    cityHash,
    hashBytes(evidence.stationIdHash, "stationIdHash"),
    hashBytes(evidence.providerHash, "providerHash"),
    hashBytes(evidence.methodologyHash, "methodologyHash"),
    hashBytes(terms!.inputsHash, "quoteInputsHash"),
    Buffer.from([1]), // ComparisonOperator::GreaterThanOrEqual
    i64(5_000n), // 50 mm, canonical on-chain unit is hundredths of a millimetre
    i64(salesCloseAt),
    i64(observationStart),
    i64(observationEnd),
    u16(terms!.probabilityBps),
    u64(10_000_000_000n),
    u64(8_000_000_000n),
    u64(500_000_000n),
  ]);
  const create = new TransactionInstruction({ programId: program, keys: [
    { pubkey: admin, isSigner: true, isWritable: true }, { pubkey: protocol, isSigner: false, isWritable: true },
    { pubkey: market, isSigner: false, isWritable: true }, { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data: createData });
  const fund = new TransactionInstruction({ programId: program, keys: [
    { pubkey: admin, isSigner: true, isWritable: true }, { pubkey: protocol, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true }, { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: adminAta, isSigner: false, isWritable: true }, { pubkey: liquidityPosition, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data: Buffer.concat([fundPoolDiscriminator, u64(seedPlan.additionalFundingBase)]) });
  const open = new TransactionInstruction({ programId: program, keys: [
    { pubkey: admin, isSigner: true, isWritable: true }, { pubkey: protocol, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
  ], data: openMarketDiscriminator });
  const transactions = seedPlan.steps.map((step) => ({
    step,
    transaction: new Transaction().add(step === "create" ? create : step === "fund" ? fund : open),
  }));
  return { market, vault, liquidityPosition, transactions, alreadyOpen: false };
}

async function sha256Hex(value: string): Promise<Buffer> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(new Uint8Array(digest));
}

export function initializeProtocolTransaction(admin: PublicKey) {
  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocolPda(), isSigner: false, isWritable: true },
      { pubkey: feeVaultPda(), isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([initializeDiscriminator, new PublicKey(SETTLEMENT_AUTHORITY).toBuffer()]),
  });
  return new Transaction().add(instruction);
}

export function issueSkytTransaction(admin: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, admin);
  return new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(admin, ata, admin, mint),
    createMintToInstruction(mint, ata, admin, SKYT_ISSUANCE),
  );
}

export async function approveAndConfirm(transaction: Transaction, wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Connect a wallet that supports Devnet transactions.");
  const latest = await connection.getLatestBlockhash("finalized");
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  const signature = await wallet.sendTransaction(transaction, connection, { preflightCommitment: "confirmed", maxRetries: 3 });
  const result = await connection.confirmTransaction(signature, "finalized");
  if (result.value.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(result.value.err)}`);
  return signature;
}

/** Sends each seed step only after the preceding step is finalized. */
export async function approveAndConfirmDesMoinesSeed(
  seed: DesMoinesSeedTransactions,
  wallet: WalletContextState,
  onStep?: (step: SeedStep, signature: string) => void,
) {
  const signatures: string[] = [];
  for (const { step, transaction } of seed.transactions) {
    const signature = await approveAndConfirm(transaction, wallet);
    signatures.push(signature);
    onStep?.(step, signature);
  }
  return signatures;
}
