/**
 * Reads Devnet markets and, only when explicitly asked, signs create/fund/open
 * with the protocol admin key. Never creates a keypair and never touches mainnet.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DES_MOINES_SEED_LIQUIDITY_BASE } from "../../shared/des-moines-seed-plan.js";
import { DevnetStatusReader } from "./devnet-status.js";
import { assertDevnetKeeperTarget, cityHashBytes, evidenceHashes, keeperPlan, priceKeeperSteps, TEST_SKYT_MINT, type PricedLadderStep } from "./window-keeper.js";

const PROGRAM_ID = new PublicKey("5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx");
const CREATE = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
const FUND = Buffer.from([36, 57, 233, 176, 181, 20, 87, 159]);
const OPEN = Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]);

export async function runWindowKeeper(options: { sign: boolean; nowSeconds?: number } = { sign: false }) {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const mint = process.env.SKYT_MINT ?? TEST_SKYT_MINT;
  assertDevnetKeeperTarget(rpcUrl, mint);
  const reader = new DevnetStatusReader(new Connection(rpcUrl, "finalized"));
  const status = await reader.read();
  if (status.network.toLowerCase() !== "devnet") throw new Error("Window keeper refuses a non-Devnet status network.");
  const steps = keeperPlan(status.ladderMarkets.map((market) => ({
    marketId: market.marketId,
    address: market.address,
    state: market.state,
    salesCloseAt: market.salesCloseAt,
    observationStart: market.observationStart,
    observationEnd: market.observationEnd,
    vaultBalanceBase: market.vaultBalance,
  })), options.nowSeconds);
  if (!options.sign) {
    return { signed: false, network: "devnet", admin: status.protocol.admin, steps, priced: null as PricedLadderStep[] | null };
  }
  if (process.env.KEEPER_SIGN !== "yes") throw new Error("Refusing to sign until KEEPER_SIGN=yes.");
  const admin = loadKeeperKeypair();
  if (!status.protocol.admin || admin.publicKey.toBase58() !== status.protocol.admin) {
    throw new Error("Keeper signer must be the current Devnet protocol admin. A new key cannot create markets.");
  }
  const priced = await priceKeeperSteps(steps);
  const signatures = await sendPricedSteps(new Connection(rpcUrl, "finalized"), admin, status.protocol.address, status.protocol.nextMarketId, priced);
  return { signed: true, network: "devnet", admin: admin.publicKey.toBase58(), steps, priced: publicPriced(priced), signatures };
}

function publicPriced(steps: PricedLadderStep[]) {
  return steps.map((step) => ({
    action: step.action,
    tenor: step.window.tenor,
    observationStart: new Date(step.window.observationStart * 1_000).toISOString(),
    observationEnd: new Date(step.window.observationEnd * 1_000).toISOString(),
    thresholdMm: step.thresholdMm,
    probabilityBps: step.probabilityBps,
    premiumRateBps: step.premiumRateBps,
    forecastIncluded: step.forecastIncluded,
    stationId: step.stationId,
    skipReason: step.skipReason,
  }));
}

async function sendPricedSteps(connection: Connection, admin: Keypair, protocolAddress: string, nextMarketId: string | null, steps: PricedLadderStep[]) {
  const protocol = new PublicKey(protocolAddress);
  const mint = new PublicKey(TEST_SKYT_MINT);
  let marketId = BigInt(nextMarketId ?? "0");
  const signatures: Array<{ action: string; signature: string }> = [];
  const hashes = evidenceHashes();
  for (const step of steps) {
    if (step.skipReason || step.thresholdMm == null || step.probabilityBps == null || !step.inputsHash) continue;
    const id = step.action === "create-fund-open" ? marketId : BigInt(step.marketId);
    const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64(id)], PROGRAM_ID);
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID);
    const [liquidity] = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), admin.publicKey.toBuffer()], PROGRAM_ID);
    const adminAta = getAssociatedTokenAddressSync(mint, admin.publicKey);
    const ixs: TransactionInstruction[] = [];
    if (step.action === "create-fund-open") {
      ixs.push(createIx(admin.publicKey, protocol, market, vault, mint, hashes, step));
    }
    if (step.action === "create-fund-open" || step.action === "fund-open") {
      ixs.push(fundIx(admin.publicKey, protocol, market, vault, adminAta, liquidity, mint));
    }
    ixs.push(openIx(admin.publicKey, protocol, market));
    for (const ix of ixs) {
      const tx = new Transaction().add(ix);
      const signature = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: "finalized" });
      signatures.push({ action: step.action, signature });
    }
    if (step.action === "create-fund-open") marketId += 1n;
  }
  return signatures;
}

function createIx(admin: PublicKey, protocol: PublicKey, market: PublicKey, vault: PublicKey, mint: PublicKey, hashes: ReturnType<typeof evidenceHashes>, step: PricedLadderStep) {
  const data = Buffer.concat([
    CREATE,
    cityHashBytes("des-moines"),
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
