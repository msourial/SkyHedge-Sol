import { APP_IDENTITY } from "./wallet-identity.ts";

/** MWA 2.0 chain id. Phantom rejects the legacy sol_mwa_reauthorize for unverified dApps, so we only use authorize(). */
export const DEVNET_CHAIN = "solana:devnet" as const;

type AuthorizeParams = { identity: typeof APP_IDENTITY; chain: typeof DEVNET_CHAIN; auth_token?: string };
export type AuthorizingWallet<R> = { authorize(params: AuthorizeParams): Promise<R> };

/**
 * Authorize inside the signing session with one fresh authorize() and no cached token.
 * Phantom negotiates the legacy MWA protocol, where authorize-with-token is sent as
 * sol_mwa_reauthorize. Phantom declines that for unverified dApps ("Declining sol_mwa_reauthorize:
 * dApp identity is not verified") and then never answers a second request in the same session
 * ("Timed out waiting for response with id=2"). A single fresh request shows Phantom's own approval.
 */
export async function authorizeForSigning<R>(wallet: AuthorizingWallet<R>, _cachedAuthToken?: string): Promise<R> {
  return wallet.authorize({ identity: APP_IDENTITY, chain: DEVNET_CHAIN });
}
