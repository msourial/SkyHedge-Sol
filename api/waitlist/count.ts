import type { IncomingMessage, ServerResponse } from "node:http";
import { createDb } from "../../server/db.js";
import { createWaitlistCountHandler } from "../../server/services/waitlist.js";
import type { ApiResponse } from "../../server/services/vercel-api.js";

const handler = createWaitlistCountHandler({
  getDb: () => createDb(),
});

export default async function waitlistCount(req: IncomingMessage, res: ServerResponse) {
  return handler(req, res as ApiResponse);
}
