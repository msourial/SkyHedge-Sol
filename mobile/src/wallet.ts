import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { DEVNET_RPC_URLS, devnetConnection, getLatestBlockhashContextAnyRpc } from "./chain";

import { APP_IDENTITY } from "./wallet-identity";
import { describeChainError, TransactionFailedError } from "./buy-phase";
import { authorizeForSigning, DEVNET_CHAIN } from "./wallet-auth";
import { buildSignAndSendParams } from "./wallet-send";

export type AuthorizedWallet = { address: string; authToken: string };

export async function authorizeDevnetWallet(): Promise<AuthorizedWallet> {
  return transact(async (wallet) => {
    const result = await wallet.authorize({
      chain: DEVNET_CHAIN,
      identity: APP_IDENTITY,
    });
    const account = result.accounts[0];
    if (!account) throw new Error("The wallet did not return an account.");
    const publicKeyBytes = "publicKey" in account
      ? account.publicKey
      : Buffer.from(account.address, "base64");
    return { address: new PublicKey(publicKeyBytes).toBase58(), authToken: result.auth_token };
  });
}

/** Let MWA sign and broadcast only after the customer explicitly confirms in their wallet. */
export async function signAndConfirmDevnetTransaction(input: {
  transactionBase64: string;
  wallet: AuthorizedWallet;
  rpcUrl: string;
  onPhase?: (phase: "waiting" | "sending" | "confirming") => void;
}): Promise<string> {
  const transaction = VersionedTransaction.deserialize(Buffer.from(input.transactionBase64, "base64"));
  const { slot, url } = await getLatestBlockhashContextAnyRpc(Array.from(new Set([input.rpcUrl, ...DEVNET_RPC_URLS])));
  const connection = devnetConnection(url, "confirmed");
  const params = buildSignAndSendParams([transaction], slot);
  input.onPhase?.("waiting");
  const signatures = await transact(async (mobileWallet) => {
    const authorization = await authorizeForSigning(mobileWallet, input.wallet.authToken);
    const account = authorization.accounts[0];
    if (!account) throw new Error("The wallet session no longer has an approved account. Reconnect and try again.");
    const accountBytes = "publicKey" in account ? account.publicKey : Buffer.from(account.address, "base64");
    const address = new PublicKey(accountBytes).toBase58();
    if (address !== input.wallet.address) throw new Error("The active wallet changed. Reconnect before approving this transaction.");
    return mobileWallet.signAndSendTransactions(params);
  });
  const signature = signatures[0];
  if (!signature) throw new Error("The wallet did not return a transaction signature.");
  input.onPhase?.("sending");
  let confirmation: Awaited<ReturnType<typeof connection.confirmTransaction>>;
  input.onPhase?.("confirming");
  try {
    confirmation = await connection.confirmTransaction(signature, "finalized");
  } catch (reason) {
    // Sent but not yet confirmed (timeout or a busy RPC). Keep the signature so the app can check the chain.
    throw new TransactionFailedError(reason instanceof Error ? reason.message : "Solana did not confirm the transaction in time.", signature);
  }
  if (confirmation.value.err) throw new TransactionFailedError(describeChainError(confirmation.value.err), signature);
  return signature;
}
