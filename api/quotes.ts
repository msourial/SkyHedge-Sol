import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader } from "../server/services/devnet-status.js";
import { CachedNoaaRainfallProvider } from "../server/services/noaa-cache.js";
import { RainfallQuoteEngine } from "../server/services/quote-engine.js";
import { createQuoteHandler, type ApiRequest, type ApiResponse } from "../server/services/vercel-api.js";
import { marketsForWindowQuote, readCatalogueWindowQuote } from "../server/services/window-quote-read.js";
import { isPerilId } from "../shared/perils.js";

const status = new DevnetStatusReader();
const engine = new RainfallQuoteEngine(new CachedNoaaRainfallProvider());
const handler = createQuoteHandler({
  readStatus: () => status.read(),
  quote: (request) => engine.quote(request),
  readWindowQuote: async (query) => {
    if (!isPerilId(query.peril)) throw Object.assign(new Error("Unknown peril."), { code: "DATA_UNAVAILABLE" });
    const markets = await marketsForWindowQuote(() => status.read(), query.cityId, query.peril, query.windowStart, query.windowEnd);
    return readCatalogueWindowQuote({ ...query, markets });
  },
});

export default function quotes(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
