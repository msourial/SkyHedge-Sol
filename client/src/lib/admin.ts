import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { connection, PROGRAM_ID, PROTOCOL_ADMIN, SETTLEMENT_AUTHORITY, SKYT_MINT } from "./solana";

const program = new PublicKey(PROGRAM_ID);
const mint = new PublicKey(SKYT_MINT);
const protocolSeed = Buffer.from("protocol");
const feeVaultSeed = Buffer.from("fee-vault");
const initializeDiscriminator = Buffer.from([188, 233, 252, 106, 134, 146, 202, 91]);
export const SKYT_ISSUANCE = 50_000_000_000n;

export function protocolPda() { return PublicKey.findProgramAddressSync([protocolSeed], program)[0]; }
export function feeVaultPda() { return PublicKey.findProgramAddressSync([feeVaultSeed, protocolPda().toBuffer()], program)[0]; }
export function isProtocolAdmin(key?: PublicKey | null) { return key?.toBase58() === PROTOCOL_ADMIN; }
export function explorerTx(signature: string) { return `https://explorer.solana.com/tx/${signature}?cluster=devnet`; }

export async function protocolExists() { return Boolean(await connection.getAccountInfo(protocolPda(), "finalized")); }

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
  const signature = await wallet.sendTransaction(transaction, connection, { preflightCommitment: "confirmed", maxRetries: 3 });
  const result = await connection.confirmTransaction(signature, "finalized");
  if (result.value.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(result.value.err)}`);
  return signature;
}
