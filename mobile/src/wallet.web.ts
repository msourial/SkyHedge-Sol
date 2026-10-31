import { Buffer } from "buffer";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { DEVNET_RPC_URLS, devnetConnection, getLatestBlockhashContextAnyRpc } from "./chain";
import { describeChainError, TransactionFailedError } from "./buy-phase";

export type AuthorizedWallet = { address: string; authToken: string };
export type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey: PublicKey | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
};

export function phantomProvider(): PhantomProvider {
  const browser = window as Window & { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const provider = browser.phantom?.solana ?? browser.solana;
  if (!provider?.isPhantom) throw new Error("Install the Phantom browser extension, then reload this page. In Phantom, enable Testnet Mode and choose Solana Devnet.");
  return provider;
}

export async function authorizeDevnetWallet(): Promise<AuthorizedWallet> {
  const result = await phantomProvider().connect();
  return { address: result.publicKey.toBase58(), authToken: "phantom-browser" };
}

// Sign only in Phantom, then broadcast ourselves to the explicitly Devnet RPC.
// This avoids relying on the extension's currently selected broadcast network.
export async function signAndConfirmDevnetTransaction(input: {
  transactionBase64: string;
  wallet: AuthorizedWallet;
  rpcUrl: string;
  onSignature?: (signature: string) => void;
  onPhase?: (phase: "waiting" | "sending" | "confirming") => void;
}): Promise<string> {
  const provider = phantomProvider();
  if (provider.publicKey?.toBase58() !== input.wallet.address) throw new Error("The active Phantom account changed. Reconnect before approving this transaction.");
  const transaction = VersionedTransaction.deserialize(Buffer.from(input.transactionBase64, "base64"));
  if (transaction.message.staticAccountKeys[0]?.toBase58() !== input.wallet.address) throw new Error("The transaction payer does not match your connected Phantom account.");
  const { slot, url } = await getLatestBlockhashContextAnyRpc(DEVNET_RPC_URLS);
  const connection = devnetConnection(url, "confirmed");
  const expectedMessage = Buffer.from(transaction.message.serialize());
  input.onPhase?.("waiting");
  const signed = await provider.signTransaction(transaction);
  if (provider.publicKey?.toBase58() !== input.wallet.address) throw new Error("The active Phantom account changed. Reconnect before sending.");
  if (!Buffer.from(signed.message.serialize()).equals(expectedMessage)) throw new Error("Phantom returned a different transaction. Nothing was sent.");
  input.onPhase?.("sending");
  const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", minContextSlot: slot, maxRetries: 3 });
  input.onSignature?.(signature);
  input.onPhase?.("confirming");
  try {
    const confirmation = await connection.confirmTransaction(signature, "finalized");
    if (confirmation.value.err) throw new TransactionFailedError(describeChainError(confirmation.value.err), signature, true);
  } catch (error) {
    if (error instanceof TransactionFailedError) throw error;
    throw new TransactionFailedError("Devnet confirmation is pending. Check the transaction before trying again.", signature);
  }
  return signature;
}
