export type StoredWalletSession = { address: string; authToken: string };

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Restore a Devnet wallet only from a stored address plus Phantom auth token. */
export function parseStoredWalletSession(raw: string | null): StoredWalletSession | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const address = "address" in value && typeof value.address === "string" ? value.address : "";
  const authToken = "authToken" in value && typeof value.authToken === "string" ? value.authToken : "";
  if (!ADDRESS.test(address) || authToken.length < 8 || authToken.length > 2048) return null;
  return { address, authToken };
}

export function serializeWalletSession(session: StoredWalletSession): string {
  return JSON.stringify({ address: session.address, authToken: session.authToken });
}
