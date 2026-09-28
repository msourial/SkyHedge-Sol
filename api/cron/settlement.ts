import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SettlementRunner } from "../../server/services/settlement";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type SettlementRunResult = Awaited<ReturnType<SettlementRunner["runOnce"]>>;
type CronConfig = { cronSecret?: string; signerConfigured: boolean; noaaConfigured: boolean };
type CronHandlerOptions = {
  config?: CronConfig;
  runOnce?: () => Promise<SettlementRunResult>;
};

/** Vercel Cron entry point; secrets are only read server-side and never returned. */
export function createSettlementCronHandler(options: CronHandlerOptions = {}) {
  const readConfig = () => options.config ?? {
    cronSecret: process.env.CRON_SECRET,
    signerConfigured: Boolean(process.env.SETTLEMENT_AUTHORITY_KEYPAIR),
    noaaConfigured: Boolean(process.env.NOAA_TOKEN),
  };
  const runOnce = options.runOnce ?? (() => new SettlementRunner().runOnce());

  return async function settlementCronHandler(req: IncomingMessage, res: JsonResponse) {
    if (req.method && req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const config = readConfig();
    if (!config.cronSecret || config.cronSecret.length < 16) {
      return res.status(503).json({ error: "SETTLEMENT_CRON_UNCONFIGURED" });
    }
    if (!hasValidBearer(req.headers.authorization, config.cronSecret)) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    if (!config.signerConfigured || !config.noaaConfigured) {
      return res.status(503).json({ error: "SETTLEMENT_WORKER_UNCONFIGURED" });
    }

    try {
      const result = await runOnce();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("[settlement-cron] run failed", error instanceof Error ? error.name : "UnknownError");
      return res.status(500).json({ error: "SETTLEMENT_RUN_FAILED", message: "Settlement check failed; the next scheduled run will retry." });
    }
  };
}

function hasValidBearer(header: string | undefined, secret: string): boolean {
  const provided = Buffer.from(header ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export default createSettlementCronHandler();
