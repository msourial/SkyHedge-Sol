import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader } from "../server/services/devnet-status.js";
import { CachedNoaaRainfallProvider } from "../server/services/noaa-cache.js";
import { RainfallQuoteEngine } from "../server/services/quote-engine.js";
import { createQuoteHandler, type ApiRequest, type ApiResponse } from "../server/services/vercel-api.js";

const status = new DevnetStatusReader();
const engine = new RainfallQuoteEngine(new CachedNoaaRainfallProvider());
const handler = createQuoteHandler({ readStatus: () => status.read(), quote: (request) => engine.quote(request) });

export default function quotes(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
