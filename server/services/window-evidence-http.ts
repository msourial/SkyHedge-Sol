import type { IncomingMessage, ServerResponse } from "node:http";
import { LIVE_CITY_SLUGS, type LiveCitySlug } from "../../shared/window-ladder.js";
import { applyCorsHeaders } from "./cors.js";
import { ensureCityWindowEvidence } from "./window-evidence.js";

type JsonResponse = ServerResponse & { status: (code: number) => JsonResponse; json: (body: unknown) => void };

/** Build and return validated NOAA analogue packages for one live city's open ladder. */
export function createWindowEvidenceHandler(load = ensureCityWindowEvidence) {
  return async function windowEvidenceHandler(req: IncomingMessage, res: JsonResponse) {
    applyCorsHeaders(req, res);
    if (req.method && req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const url = new URL(req.url ?? "/", "http://localhost");
    const city = url.searchParams.get("city");
    if (!city || !(LIVE_CITY_SLUGS as readonly string[]).includes(city)) {
      return res.status(400).json({ error: "LIVE_CITY_REQUIRED", message: "Choose one of the live NOAA cities." });
    }
    try {
      const result = await load(city as LiveCitySlug);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ city, packages: result.packages, unavailable: result.unavailable });
    } catch (error) {
      return res.status(503).json({ error: "DATA_UNAVAILABLE", message: error instanceof Error ? error.message : "NOAA analogue packages are unavailable." });
    }
  };
}
