import type { IncomingMessage, ServerResponse } from "node:http";
import { DevnetStatusReader } from "../../server/services/devnet-status.js";
import { UnsignedTransactionBuilder } from "../../server/services/unsigned-tx.js";
import { createUnsignedTransactionHandler, type ApiRequest, type ApiResponse } from "../../server/services/vercel-api.js";

const status = new DevnetStatusReader();
const builder = new UnsignedTransactionBuilder();
const handler = createUnsignedTransactionHandler({ readStatus: () => status.read(), builder });

export default function unsignedTransaction(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
