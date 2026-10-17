import * as SecureStore from "expo-secure-store";
import { parseStoredWalletSession, serializeWalletSession, type StoredWalletSession } from "./wallet-session";

const KEY = "skyhedge.devnet.wallet";

/**
 * Phantom rejects legacy sol_mwa_reauthorize for an unverified dApp.
 * MWA 2.0 authorize({ auth_token }) is the supported reuse path, so the token is stored
 * and passed back on the next signature. Launch does not open Phantom by itself.
 */
export async function loadWalletSession(): Promise<StoredWalletSession | null> {
  try {
    return parseStoredWalletSession(await SecureStore.getItemAsync(KEY));
  } catch {
    return null;
  }
}

export async function saveWalletSession(session: StoredWalletSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, serializeWalletSession(session));
}

export async function clearWalletSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // already absent
  }
}
