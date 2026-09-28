import type { IncomingMessage, ServerResponse } from "node:http";
import { UnsignedTransactionBuilder } from "../../../../../server/services/unsigned-tx";
import { createClaimReadinessHandler, type ApiRequest, type ApiResponse } from "../../../../../server/services/vercel-api";

const builder = new UnsignedTransactionBuilder();
const handler = createClaimReadinessHandler({ read: (market, wallet) => builder.readClaimReadiness(market, wallet) });

export default function claimReadiness(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
