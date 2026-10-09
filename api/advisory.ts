import type { IncomingMessage, ServerResponse } from "node:http";
import { createAdvisoryHandler } from "../server/services/advisory-api.js";
import { extractProtectionIntent } from "../server/services/advisory.js";
import { DevnetStatusReader } from "../server/services/devnet-status.js";
import type { ApiRequest, ApiResponse } from "../server/services/vercel-api.js";

const status = new DevnetStatusReader();
const handler = createAdvisoryHandler({ extract: extractProtectionIntent, readStatus: () => status.read() });

export default function advisory(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handler(req as ApiRequest, res as ApiResponse);
}
