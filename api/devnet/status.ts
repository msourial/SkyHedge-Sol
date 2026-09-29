import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader, publicDevnetStatus, type DevnetStatus } from "../../server/services/devnet-status.js";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type StatusLoader = () => Promise<DevnetStatus>;
const reader = new DevnetStatusReader();

/** Keep Vercel and the local API on the same finalized-RPC status implementation. */
export function createDevnetStatusHandler(loadStatus: StatusLoader = () => reader.read()) {
  return async function devnetStatusHandler(_req: IncomingMessage, res: JsonResponse) {
    try {
      const status = publicDevnetStatus(await loadStatus());
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      return res.status(200).json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Devnet status unavailable";
      return res.status(503).json({ error: "DEVNET_STATUS_UNAVAILABLE", message });
    }
  };
}

export default createDevnetStatusHandler();
