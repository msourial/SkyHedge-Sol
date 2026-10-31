import { phantomProvider, type AuthorizedWallet } from "./wallet.web";

// Restore only a still-approved provider session, never a cached address alone.
export async function loadWalletSession(): Promise<AuthorizedWallet | null> {
  try {
    const result = await phantomProvider().connect({ onlyIfTrusted: true });
    return { address: result.publicKey.toBase58(), authToken: "phantom-browser" };
  } catch { return null; }
}
export async function saveWalletSession(_session: AuthorizedWallet): Promise<void> {}
export async function clearWalletSession(): Promise<void> {
  try { await phantomProvider().disconnect(); } catch { /* No extension or session. */ }
}
