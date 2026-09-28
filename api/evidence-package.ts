import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { finalizedEvidenceWindow, getDesMoinesEvidencePackage, type DesMoinesEvidencePackage, type EvidenceWindow } from "../server/services/des-moines-evidence";

type JsonResponse = ServerResponse & { status: (code: number) => JsonResponse; json: (body: unknown) => void };
type EvidenceLoader = (range: EvidenceWindow) => Promise<DesMoinesEvidencePackage>;
const dateWindow = z.object({ start: z.string().date(), end: z.string().date() }).refine(({ start, end }) => start < end);

/** Use the same NOAA validator, completed-window policy, and hashes as local Builder mode. */
export function createEvidencePackageHandler(loadEvidence: EvidenceLoader = getDesMoinesEvidencePackage) {
  return async function evidencePackageHandler(req: IncomingMessage, res: JsonResponse) {
    if (req.method && req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const url = new URL(req.url ?? "/", "http://localhost");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (Boolean(start) !== Boolean(end)) return res.status(400).json({ error: "VALID_DATE_WINDOW_REQUIRED" });

    const range = finalizedEvidenceWindow();
    if (start && end) {
      const parsed = dateWindow.safeParse({ start, end });
      if (!parsed.success || parsed.data.start !== range.start || parsed.data.end !== range.end) {
        return res.status(400).json({ error: "VALID_DATE_WINDOW_REQUIRED", message: "Only the server-selected, completed NOAA evidence window is permitted." });
      }
    }

    try {
      return res.status(200).json(await loadEvidence(range));
    } catch {
      return res.status(503).json({ error: "DATA_UNAVAILABLE", message: "NOAA final evidence is unavailable for this window." });
    }
  };
}

export default createEvidencePackageHandler();
