import type { IncomingMessage, ServerResponse } from "node:http";
import { createDb } from "../../server/db.js";
import {
  createWaitlistCountHandler,
  createWaitlistExportHandler,
  createWaitlistHandler,
} from "../../server/services/waitlist.js";
import type { ApiRequest, ApiResponse } from "../../server/services/vercel-api.js";

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, windowMs = 60_000, max = 12): boolean {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

const subscribe = createWaitlistHandler({
  getDb: () => createDb(),
  rateLimit: (key) => rateLimit(key),
});
const exportHandler = createWaitlistExportHandler({ getDb: () => createDb() });
const countHandler = createWaitlistCountHandler({ getDb: () => createDb() });

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

function waitlistAction(req: IncomingMessage): "subscribe" | "export" | "count" {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const action = url.searchParams.get("action");
    if (action === "export" || action === "count") return action;
    const path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/export")) return "export";
    if (path.endsWith("/count")) return "count";
  } catch {
    /* fall through */
  }
  return "subscribe";
}

export default async function waitlist(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const action = waitlistAction(req);
  if (action === "export") return exportHandler(req, res as ApiResponse);
  if (action === "count") return countHandler(req, res as ApiResponse);

  const body = await readJsonBody(req);
  const apiReq = req as ApiRequest & { ip?: string };
  apiReq.body = body;
  const forwarded =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : undefined;
  apiReq.ip = forwarded || req.socket?.remoteAddress || "unknown";
  return subscribe(apiReq, res as ApiResponse);
}
