import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runWindowKeeper } from "../../server/services/window-keeper-run.js";

type JsonResponse = ServerResponse & { status: (code: number) => JsonResponse; json: (body: unknown) => void };

/** Plans the Devnet ladder. Signs only when KEEPER_SIGN=yes. */
export function createWindowCronHandler(options: { run?: typeof runWindowKeeper; cronSecret?: string; sign?: boolean } = {}) {
  return async function windowCronHandler(req: IncomingMessage, res: JsonResponse) {
    if (req.method && req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const secret = options.cronSecret ?? process.env.CRON_SECRET;
    if (!secret || secret.length < 16) return res.status(503).json({ error: "WINDOW_CRON_UNCONFIGURED" });
    if (!hasValidBearer(req.headers.authorization, secret)) return res.status(401).json({ error: "UNAUTHORIZED" });
    const sign = options.sign ?? process.env.KEEPER_SIGN === "yes";
    try {
      const result = await (options.run ?? runWindowKeeper)({ sign });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("[window-cron] run failed", error instanceof Error ? error.name : "UnknownError");
      return res.status(500).json({ error: "WINDOW_RUN_FAILED", message: "Ladder check failed; the next scheduled run will retry." });
    }
  };
}

function hasValidBearer(header: string | undefined, secret: string): boolean {
  const provided = Buffer.from(header ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export default createWindowCronHandler();
