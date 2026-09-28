import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader } from "../server/services/devnet-status";
import { NoaaRainfallProvider } from "../server/services/noaa";
import { RainfallQuoteEngine } from "../server/services/quote-engine";
import { createQuoteHandler, type ApiRequest, type ApiResponse } from "../server/services/vercel-api";

const status = new DevnetStatusReader();
const engine = new RainfallQuoteEngine(new NoaaRainfallProvider());
const handler = createQuoteHandler({ readStatus: () => status.read(), quote: (request) => engine.quote(request) });

export default function quotes(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
