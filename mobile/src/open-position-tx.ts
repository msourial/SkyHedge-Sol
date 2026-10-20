import { Buffer } from "buffer";
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { SKYT_MINT, devnetConnection, tryDevnetUrls } from "./chain.ts";
import { SKYHEDGE_PROGRAM_ID } from "./positions.ts";

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
/** Anchor discriminator for open_position, from shared/idl/skyhedge_protection.json. */
export const OPEN_POSITION_DISCRIMINATOR = Uint8Array.from([135, 128, 47, 77, 15, 152, 240, 49]);

export type OpenPositionKeys = {
  owner: PublicKey; protocol: PublicKey; market: PublicKey; vault: PublicKey;
  ownerTokenAccount: PublicKey; position: PublicKey; collateralMint: PublicKey;
};

/** Same PDAs the program and the server builder use. */
export function openPositionKeys(marketAddress: string, walletAddress: string, mintAddress: string = SKYT_MINT, programId: PublicKey = SKYHEDGE_PROGRAM_ID): OpenPositionKeys {
  const market = new PublicKey(marketAddress);
  const owner = new PublicKey(walletAddress);
  const collateralMint = new PublicKey(mintAddress);
  const [protocol] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), owner.toBuffer()], programId);
  const [ownerTokenAccount] = PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), collateralMint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
  return { owner, protocol, market, vault, ownerTokenAccount, position, collateralMint };
}

export function openPositionInstruction(keys: OpenPositionKeys, protectedAmountBase: string, programId: PublicKey = SKYHEDGE_PROGRAM_ID): TransactionInstruction {
  if (!/^\d+$/.test(protectedAmountBase) || BigInt(protectedAmountBase) <= 0n) throw new Error("Enter a valid SKYT amount before approving.");
  const data = Buffer.alloc(16);
  Buffer.from(OPEN_POSITION_DISCRIMINATOR).copy(data, 0);
  data.writeBigUInt64LE(BigInt(protectedAmountBase), 8);
  return new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: keys.owner, isSigner: true, isWritable: true },
      { pubkey: keys.protocol, isSigner: false, isWritable: false },
      { pubkey: keys.market, isSigner: false, isWritable: true },
      { pubkey: keys.vault, isSigner: false, isWritable: true },
      { pubkey: keys.ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: keys.position, isSigner: false, isWritable: true },
      { pubkey: keys.collateralMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

/** Unsigned legacy-message VersionedTransaction, base64, same accounts and data as the server builder (key order may differ). */
export function serializeOpenPosition(marketAddress: string, walletAddress: string, protectedAmountBase: string, recentBlockhash: string): string {
  const keys = openPositionKeys(marketAddress, walletAddress);
  const message = new TransactionMessage({ payerKey: keys.owner, recentBlockhash, instructions: [openPositionInstruction(keys, protectedAmountBase)] }).compileToLegacyMessage();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

/**
 * Build open_position on the phone from its own Devnet RPC (confirmed blockhash, endpoint failover).
 * This avoids the shared server IP that public Devnet RPCs rate-limit (HTTP 429).
 */
export async function buildOpenPositionOnDevice(input: { market: string; wallet: string; amount: string; getBlockhash?: () => Promise<string> }): Promise<{ action: "open_position"; market: string; wallet: string; base64: string; network: "devnet" }> {
  const getBlockhash = input.getBlockhash ?? (() => tryDevnetUrls(async (url) => (await devnetConnection(url, "confirmed").getLatestBlockhash("confirmed")).blockhash, { attempts: 2, timeoutMs: 6_000 }));
  const blockhash = await getBlockhash();
  return { action: "open_position", market: input.market, wallet: input.wallet, base64: serializeOpenPosition(input.market, input.wallet, input.amount, blockhash), network: "devnet" };
}
