import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const APP_IDENTITY = {
  name: "SkyHedge",
  uri: "https://github.com/msourial/SkyHedge-Sol",
  icon: "favicon.ico",
};

export type AuthorizedWallet = { address: string; authToken: string };

export async function authorizeDevnetWallet(): Promise<AuthorizedWallet> {
  return transact(async (wallet) => {
    const result = await wallet.authorize({
      cluster: "devnet",
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
}): Promise<string> {
  const transaction = VersionedTransaction.deserialize(Buffer.from(input.transactionBase64, "base64"));
  const signatures = await transact(async (mobileWallet) => {
    const authorization = await mobileWallet.reauthorize({ auth_token: input.wallet.authToken, identity: APP_IDENTITY });
    const account = authorization.accounts[0];
    if (!account) throw new Error("The wallet session no longer has an approved account. Reconnect and try again.");
    const accountBytes = "publicKey" in account ? account.publicKey : Buffer.from(account.address, "base64");
    const address = new PublicKey(accountBytes).toBase58();
    if (address !== input.wallet.address) throw new Error("The active wallet changed. Reconnect before approving this transaction.");
    return mobileWallet.signAndSendTransactions({ transactions: [transaction], commitment: "finalized" });
  });
  const signature = signatures[0];
  if (!signature) throw new Error("The wallet did not return a transaction signature.");
  const connection = new Connection(input.rpcUrl, "finalized");
  const confirmation = await connection.confirmTransaction(signature, "finalized");
  if (confirmation.value.err) throw new Error("The transaction was submitted but failed during finalized confirmation.");
  return signature;
}
