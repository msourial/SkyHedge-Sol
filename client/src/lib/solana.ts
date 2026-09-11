import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = import.meta.env.VITE_SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";

export const connection = new Connection(RPC_URL, "confirmed");

export function isPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function shortAddress(value: string, pad = 4): string {
  return `${value.slice(0, pad)}…${value.slice(-pad)}`;
}

/**
 * Sign a base64-serialized VersionedTransaction with the connected wallet and
 * broadcast it at confirmed commitment. Returns the signature.
 */
export async function signAndSend(base64: string, wallet: WalletContextState): Promise<string> {
  if (!wallet.signTransaction || !wallet.publicKey) throw new Error("Wallet cannot sign transactions.");
  const transaction = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
  const signed = await wallet.signTransaction(transaction);
  const signature = await connection.sendTransaction(signed, { maxRetries: 2 });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export function skyt(base: string | number | bigint): string {
  const value = typeof base === "bigint" ? base : BigInt(String(base));
  return (Number(value) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
