import type { ApiRequest, ApiResponse } from "./vercel-api.js";
import type { DevnetStatus } from "./devnet-status.js";
import { AdvisoryUnavailableError, advisoryRequestSchema, assessProtectionRequest, type ExtractedProtectionIntent } from "./advisory.js";

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
      return res.status(200).json(assessProtectionRequest(parsed.data.message, intent, status, parsed.data.context));
    } catch (error) {
      if (error instanceof AdvisoryUnavailableError) return res.status(503).json({ error: "ADVISORY_UNAVAILABLE", message: error.message });
      return res.status(503).json({ error: "ADVISORY_UNAVAILABLE", message: "The guide could not verify current contract state. No quote or transaction has been prepared." });
    }
  };
}
