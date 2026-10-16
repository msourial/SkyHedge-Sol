import type { IncomingMessage, ServerResponse } from "node:http";
import { createDb } from "../../server/db.js";
import { createWaitlistExportHandler } from "../../server/services/waitlist.js";
import type { ApiResponse } from "../../server/services/vercel-api.js";

const handler = createWaitlistExportHandler({
  getDb: () => createDb(),
});

export default async function waitlistExport(req: IncomingMessage, res: ServerResponse) {
  return handler(req, res as ApiResponse);
}
