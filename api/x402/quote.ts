import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader } from "../../server/services/devnet-status.js";
import { CachedNoaaRainfallProvider } from "../../server/services/noaa-cache.js";
import { RainfallQuoteEngine } from "../../server/services/quote-engine.js";
import { createHttpQuoteFacilitator } from "../../server/services/x402-facilitator.js";
import { createX402QuoteHandler, readX402QuoteConfig, type X402QuoteConfig } from "../../server/services/x402-quote.js";
import type { ApiRequest, ApiResponse } from "../../server/services/vercel-api.js";

const status = new DevnetStatusReader();
const engine = new RainfallQuoteEngine(new CachedNoaaRainfallProvider());
const config = readX402QuoteConfig();
const handler = createX402QuoteHandler({
  readStatus: () => status.read(),
  quote: (request) => engine.quote(request),
  facilitator: createHttpQuoteFacilitator(config.ok ? config.value.facilitatorUrl : undefined),
  config: config.ok ? config.value : null,
});

export default function x402Quote(req: IncomingMessage & { body?: unknown; query?: ApiRequest["query"] }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}

export type { X402QuoteConfig };
