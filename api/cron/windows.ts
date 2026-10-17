import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runWindowKeeper } from "../../server/services/window-keeper-run.js";
import { ensureAllWindowEvidence } from "../../server/services/window-evidence.js";

type JsonResponse = ServerResponse & { status: (code: number) => JsonResponse; json: (body: unknown) => void };

/** Plans the Devnet ladder. Never signs and never reads an admin key. */
export function createWindowCronHandler(options: { run?: typeof runWindowKeeper; warm?: typeof ensureAllWindowEvidence; cronSecret?: string } = {}) {
  return async function windowCronHandler(req: IncomingMessage, res: JsonResponse) {
    if (req.method && req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const secret = options.cronSecret ?? process.env.CRON_SECRET;
    if (!secret || secret.length < 16) return res.status(503).json({ error: "WINDOW_CRON_UNCONFIGURED" });
    if (!hasValidBearer(req.headers.authorization, secret)) return res.status(401).json({ error: "UNAUTHORIZED" });
    try {
      const result = await (options.run ?? runWindowKeeper)({ sign: false });
      let evidence: { built: number; unavailable: Array<{ city: string; observationStart: number; observationEnd: number; reason: string }> } | { error: string };
      try {
        const warmed = await (options.warm ?? ensureAllWindowEvidence)();
        evidence = { built: warmed.built.length, unavailable: warmed.unavailable };
      } catch (error) {
        evidence = { error: error instanceof Error ? error.message : "NOAA analogue packages were not built." };
      }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, result, evidence });
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
