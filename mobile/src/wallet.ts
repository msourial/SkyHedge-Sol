import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

const APP_IDENTITY = {
  name: "SkyHedge",
  uri: "https://github.com/msourial/SkyHedge-Sol",
  icon: "favicon.ico",
};

export async function authorizeDevnetWallet(): Promise<string> {
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
    return new PublicKey(publicKeyBytes).toBase58();
  });
}
