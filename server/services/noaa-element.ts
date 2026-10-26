import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { parseCdoObservation, type DailyObservation } from "./ghcnd-daily.js";
import { PERILS, type PerilId } from "../../shared/perils.js";

/** CDO v2 reader for one GHCN element. Settlement of rain does not use this. */
export class NoaaElementProvider {
  private readonly token = process.env.NOAA_TOKEN;

  async daily(peril: PerilId, stationId: string, start: string, endInclusive: string): Promise<DailyObservation[]> {
    const spec = PERILS[peril];
    if (!spec.open || !spec.ghcndElement) throw new DataUnavailableError(spec.closedReason ?? "This peril is not open");
    if (!this.token) throw new DataUnavailableError("NOAA_TOKEN is required to read NOAA station observations");
    const dataset = stationId.startsWith("GSOD:") ? "GSOD" : "GHCND";
    const query = new URLSearchParams({
      datasetid: dataset,
      datatypeid: spec.ghcndElement,
      stationid: stationId,
      startdate: start,
      enddate: endInclusive,
      units: "metric",
      limit: "1000",
    });
    let response: Response;
    try { response = await fetch(`https://www.ncei.noaa.gov/cdo-web/api/v2/data?${query}`, { headers: { token: this.token } }); }
    catch { throw new DataUnavailableError("NOAA station-observation request failed"); }
    if (!response.ok) throw new DataUnavailableError(`NOAA station observations unavailable (${response.status})`);
    const body = await response.json() as { results?: Array<{ date?: unknown; value?: unknown; attributes?: unknown }> };
    if (!body.results?.length) throw new DataUnavailableError("NOAA returned no observations for the pinned station/window");
    return body.results.map((record) => parseCdoObservation(peril, record));
  }
}

export function stationFor(city: SkyHedgeCity) {
  return NOAA_STATIONS[city];
}
