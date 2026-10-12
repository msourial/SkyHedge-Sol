import { APP_IDENTITY } from "./wallet-identity.ts";

/** MWA 2.0 chain id. Phantom rejects the legacy sol_mwa_reauthorize for unverified dApps, so we only use authorize(). */
export const DEVNET_CHAIN = "solana:devnet" as const;

type AuthorizeParams = { identity: typeof APP_IDENTITY; chain: typeof DEVNET_CHAIN; auth_token?: string };
export type AuthorizingWallet<R> = { authorize(params: AuthorizeParams): Promise<R> };

/**
 * Re-establish authorization inside a signing session. Tries the cached token via authorize()
 * (MWA 2.0 replacement for reauthorize); if the wallet rejects a stale/unknown token, falls back
 * to a fresh authorize so the user sees the wallet's approval screen instead of a silent failure.
 */
export async function authorizeForSigning<R>(wallet: AuthorizingWallet<R>, authToken?: string): Promise<R> {
  if (authToken) {
    try {
      return await wallet.authorize({ identity: APP_IDENTITY, chain: DEVNET_CHAIN, auth_token: authToken });
    } catch {
      // stale token (e.g. after reinstall) — fall through to a fresh authorization
    }
  }
  return wallet.authorize({ identity: APP_IDENTITY, chain: DEVNET_CHAIN });
}
