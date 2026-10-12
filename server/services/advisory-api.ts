import type { ApiRequest, ApiResponse } from "./vercel-api.js";
import type { DevnetStatus } from "./devnet-status.js";
import { offlineAdvisoryAnswer } from "./advisory-offline.js";
import { withRecommendation } from "./advisory-recommendation.js";
import { advisoryRequestSchema, assessProtectionRequest, type ExtractedProtectionIntent } from "./advisory.js";

export function createAdvisoryHandler(dependencies: {
  extract: (message: string, context?: Partial<ExtractedProtectionIntent>) => Promise<ExtractedProtectionIntent>;
  readStatus: () => Promise<DevnetStatus>;
}) {
  return async function advisoryHandler(req: Pick<ApiRequest, "method" | "body">, res: ApiResponse) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method && req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST." });
    }
    const parsed = advisoryRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_ADVISORY_REQUEST", message: "Enter a short description of your weather risk." });
    try {
      const intent = await dependencies.extract(parsed.data.message, parsed.data.context);
      // A research-only match or a clarification may still be explained when RPC is down.
      // The assessment never marks a contract quote-ready without finalized status.
      const status = await dependencies.readStatus().catch(() => null);
      return res.status(200).json(withRecommendation(assessProtectionRequest(parsed.data.message, intent, status, parsed.data.context), status));
    } catch {
      // Missing key, provider error or timeout: answer from the labelled offline guide
      // instead of surfacing a raw configuration or outage error.
      const status = await Promise.resolve().then(() => dependencies.readStatus()).catch(() => null);
      return res.status(200).json(withRecommendation(offlineAdvisoryAnswer(parsed.data.message), status));
    }
  };
}
