import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

type JsonResponse = ServerResponse & { status: (code: number) => JsonResponse; json: (body: unknown) => void };

const STATION_ID = "GHCND:USW00014933";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export default async function handler(req: IncomingMessage, res: JsonResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end) return res.status(400).json({ error: "VALID_DATE_WINDOW_REQUIRED" });
  if (!process.env.NOAA_TOKEN) return res.status(503).json({ error: "DATA_UNAVAILABLE", message: "NOAA_TOKEN is not configured for this deployment." });
  try {
    const query = new URLSearchParams({ datasetid: "GHCND", datatypeid: "PRCP", stationid: STATION_ID, startdate: start, enddate: end, units: "metric", limit: "1000" });
    const response = await fetch(`https://www.ncei.noaa.gov/cdo-web/api/v2/data?${query}`, { headers: { token: process.env.NOAA_TOKEN } });
    if (!response.ok) return res.status(503).json({ error: "DATA_UNAVAILABLE", message: `NOAA final observations unavailable (${response.status})` });
    const body = await response.json() as { results?: Array<{ date: string; value: number }> };
    if (!body.results?.length) return res.status(503).json({ error: "DATA_UNAVAILABLE", message: "NOAA returned no observations for the requested window." });
    const records = body.results.map(({ date, value }) => ({ date: date.slice(0, 10), millimeters: value }));
    const methodology = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "shared/methodology-v1.json"), "utf8"));
    const cumulativeMm = records.reduce((total, record) => total + record.millimeters, 0);
    return res.status(200).json({ validated: true, stationId: STATION_ID, stationIdHash: hash(STATION_ID), providerHash: hash(methodology), methodologyHash: hash(methodology.version), quoteInputsHash: hash({ city: "des-moines", start, end, thresholdMm: 50, probabilityBps: 2_000 }), evidence: { sourceHash: hash({ stationId: STATION_ID, start, end, records }), cumulativeMm, windowStart: start, windowEnd: end } });
  } catch { return res.status(503).json({ error: "DATA_UNAVAILABLE", message: "NOAA evidence request failed." }); }
}
