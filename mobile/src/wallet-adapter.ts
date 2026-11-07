import type { AuthorizedWallet, signAndConfirmDevnetTransaction } from "./wallet";

export type SignInput = Parameters<typeof signAndConfirmDevnetTransaction>[0];
export type SocialProvider = "google" | "apple";
export interface WalletAdapter {
  address: string | null;
  connect(provider?: SocialProvider): Promise<AuthorizedWallet>;
  disconnect(): Promise<void>;
  signAndSendTransaction(input: SignInput): Promise<string>;
}

/** Embedded wins only while connected; MWA remains the fallback. */
export function selectWalletAdapter(enabled: boolean, mwa: WalletAdapter, embedded: WalletAdapter | null): WalletAdapter {
  return enabled && embedded?.address ? embedded : mwa;
}
