import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
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
  quoteInputsHash: string;
};

export type DesMoinesSeedTransactions = {
  market: PublicKey;
  vault: PublicKey;
  liquidityPosition: PublicKey;
  transactions: [Transaction, Transaction, Transaction];
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
export async function desMoinesSeedTransactions(admin: PublicKey, evidence: DesMoinesEvidencePackage): Promise<DesMoinesSeedTransactions> {
  if (!evidence.validated || !evidence.stationId.trim()) throw new Error("Des Moines market seeding requires a validated NOAA station package.");
  hashBytes(evidence.stationIdHash, "stationIdHash");
  const cityHash = await sha256Hex("des-moines");
  const protocol = protocolPda();
  const protocolInfo = await connection.getAccountInfo(protocol, "finalized");
  if (!protocolInfo) throw new Error("Initialize the protocol and wait for finalized confirmation first.");
  // Anchor account data: discriminator (8) + six Pubkeys, then next_market_id.
  if (protocolInfo.data.length < 208) throw new Error("The finalized protocol account has an invalid layout.");
  const nextMarketId = protocolInfo.data.readBigUInt64LE(200);
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64(nextMarketId)], program);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], program);
  const [liquidityPosition] = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), admin.toBuffer()], program);
  const adminAta = getAssociatedTokenAddressSync(mint, admin);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const salesCloseAt = now + 86_400n;
  const observationStart = salesCloseAt;
  const observationEnd = observationStart + 7n * 86_400n;
  const createData = Buffer.concat([
    createMarketDiscriminator,
    cityHash,
    hashBytes(evidence.stationIdHash, "stationIdHash"),
    hashBytes(evidence.providerHash, "providerHash"),
    hashBytes(evidence.methodologyHash, "methodologyHash"),
    hashBytes(evidence.quoteInputsHash, "quoteInputsHash"),
    Buffer.from([1]), // ComparisonOperator::GreaterThanOrEqual
    i64(5_000n), // 50 mm, canonical on-chain unit is hundredths of a millimetre
    i64(salesCloseAt),
    i64(observationStart),
    i64(observationEnd),
    u16(2_000),
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
  ], data: Buffer.concat([fundPoolDiscriminator, u64(2_000_000_000n)]) });
  const open = new TransactionInstruction({ programId: program, keys: [
    { pubkey: admin, isSigner: true, isWritable: true }, { pubkey: protocol, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
  ], data: openMarketDiscriminator });
  return { market, vault, liquidityPosition, transactions: [new Transaction().add(create), new Transaction().add(fund), new Transaction().add(open)] };
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
  onStep?: (step: "create" | "fund" | "open", signature: string) => void,
) {
  const signatures: string[] = [];
  for (const [index, transaction] of seed.transactions.entries()) {
    const signature = await approveAndConfirm(transaction, wallet);
    signatures.push(signature);
    onStep?.((["create", "fund", "open"] as const)[index], signature);
  }
  return signatures as [string, string, string];
}
