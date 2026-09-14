import { Connection, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = import.meta.env.VITE_SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
export const PROTOCOL_ADMIN = import.meta.env.VITE_PROTOCOL_ADMIN ?? "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
export const SETTLEMENT_AUTHORITY = import.meta.env.VITE_SETTLEMENT_AUTHORITY ?? "AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh";
export const SKYT_MINT = import.meta.env.VITE_SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";

export const connection = new Connection(RPC_URL, "confirmed");

export type FinalizedWalletState = {
  sol: number;
  skytBaseUnits: string;
  skytDecimals: number;
  slot: number;
};

/** Reads only the connected address from Devnet at finalized commitment. */
export async function finalizedWalletState(owner: PublicKey): Promise<FinalizedWalletState> {
  const [lamports, tokenAccounts, slot] = await Promise.all([
    connection.getBalance(owner, "finalized"),
    connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(SKYT_MINT) }, "finalized"),
    connection.getSlot("finalized"),
  ]);
  const token = tokenAccounts.value.reduce(
    (total, account) => total + BigInt(account.account.data.parsed.info.tokenAmount.amount),
    0n,
  );
  const decimals = tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.decimals ?? 6;
  return { sol: lamports / LAMPORTS_PER_SOL, skytBaseUnits: token.toString(), skytDecimals: decimals, slot };
}

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
