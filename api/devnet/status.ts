import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader, publicDevnetStatus, type DevnetStatus } from "../../server/services/devnet-status.js";
import { applyCorsHeaders } from "../../server/services/cors.js";
import { createWindowEvidenceHandler } from "../../server/services/window-evidence-http.js";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type StatusLoader = () => Promise<DevnetStatus>;
const reader = new DevnetStatusReader();

/** Keep Vercel and the local API on the same finalized-RPC status implementation. */
export function createDevnetStatusHandler(loadStatus: StatusLoader = () => reader.read()) {
  return async function devnetStatusHandler(req: IncomingMessage, res: JsonResponse) {
    applyCorsHeaders(req, res);
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.searchParams.get("resource") === "window-evidence") return createWindowEvidenceHandler()(req, res);
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
