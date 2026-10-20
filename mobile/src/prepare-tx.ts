import { ApiError } from "./api.ts";

type Prepared = { action: string; market: string; wallet: string; base64: string; network: string };

/**
 * open_position is built on the phone first (its own Devnet RPC, confirmed blockhash, endpoint failover),
 * because the shared server IP is rate-limited (HTTP 429) by public Devnet RPCs. The server route is the fallback.
 * Claims always use the server, which checks claim readiness.
 */
export async function prepareUnsignedTransaction<T extends Prepared>(input: {
  action: string; market: string; wallet: string; amount: string;
  onDevice: (args: { market: string; wallet: string; amount: string }) => Promise<Prepared>;
  server: () => Promise<T>;
}): Promise<Prepared> {
  if (input.action !== "open_position") return input.server();
  let deviceError: unknown;
  try {
    return await input.onDevice({ market: input.market, wallet: input.wallet, amount: input.amount });
  } catch (error) {
    deviceError = error;
  }
  try {
    return await input.server();
  } catch (error) {
    const device = deviceError instanceof Error ? deviceError.message : String(deviceError);
    const server = error instanceof ApiError ? `${error.message}${error.detail ? ` (${error.detail})` : ""}` : error instanceof Error ? error.message : String(error);
    const message = error instanceof Error && error.message ? error.message : "The protection could not be prepared.";
    throw new ApiError(message, `Phone Devnet RPC: ${device}\nSkyHedge server: ${server}`);
  }
}
