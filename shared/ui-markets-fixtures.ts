/** FIXTURES for the city-led Markets acceptance matrix. Never imported by live data. */
import { DISCOVERY_QUOTES, PREVIEW_NOW } from "./ui-discovery-fixtures.ts";
import { cityById } from "./peril-registry.ts";
import { marketModels } from "./ui-discovery.ts";
import type { WindowQuote, PerilId } from "./ui-types.ts";
import type { QuoteWindow } from "./ui-window-quote.ts";
function quote(cityId: string, peril: PerilId, trigger: number, start: string, end: string, id: string): WindowQuote {
  const base = DISCOVERY_QUOTES.find((q) => q.peril === peril)!;
  return { ...base, cityId, stationId: cityById(cityId)!.stationId, windowStart: start, windowEnd: end, salesCloseAt: start,
    rungs: base.rungs.map((r, i) => ({ ...r, triggerValue: i === 3 ? trigger : r.triggerValue, marketAddress: i === 3 ? id : null })) };
}
const ny = [quote("new-york", "rain", 102, "2026-11-01", "2026-12-01", "fixture-ny-102"), quote("new-york", "rain", 69, "2026-10-26", "2026-11-02", "fixture-ny-69"), quote("new-york", "rain", 29, "2026-11-02", "2026-11-09", "fixture-ny-29")];
const elsewhere = [quote("des-moines", "rain", 69, "2026-10-26", "2026-11-02", "fixture-dm-rain"), quote("chicago", "snow", 31, "2026-11-09", "2026-11-16", "fixture-chi-snow"), quote("chicago", "wind", 12, "2026-10-26", "2026-11-02", "fixture-chi-wind")];
const heat = quote("miami", "heat", 30.6, "2026-12-01", "2027-01-01", "fixture-miami-heat");
const windowFor = (q: WindowQuote): QuoteWindow => ({ city: q.cityId, peril: q.peril, tenor: Date.parse(q.windowEnd) - Date.parse(q.windowStart) > 7 * 86400000 ? "monthly" : "weekly", address: `window-${q.cityId}-${q.peril}`, observationStart: Date.parse(q.windowStart) / 1000, observationEnd: Date.parse(q.windowEnd) / 1000, salesCloseAt: Date.parse(q.salesCloseAt) / 1000 });
export function marketsFixture(state: string) {
  let quotes = [...ny, ...elsewhere], windows = [windowFor(heat)];
  if (state === "ny-held-one" || state === "ny-all-held") quotes = [...ny.slice(0, 2), ...elsewhere];
  if (state === "ny-none-open") quotes = elsewhere;
  if (state === "nothing-open" || state === "modelled") { windows = [windowFor(ny[0]), windowFor(elsewhere[1]), windowFor(elsewhere[2]), windowFor(heat)]; quotes = []; }
  if (state === "error" || state === "empty" || state === "loading") { quotes = []; windows = state === "error" ? [windowFor(heat)] : []; }
  if (state === "full-week") { quotes = [...quotes, heat, quote("chicago", "rain", 102, "2026-11-01", "2026-12-01", "fixture-chi-rain"), quote("new-york", "snow", 31, "2026-12-01", "2027-01-01", "fixture-ny-snow")]; windows = []; }
  const held = state === "ny-all-held" ? ny.map((q) => q.rungs[3].marketAddress!) : state === "all-covered" ? quotes.map((q) => q.rungs[3].marketAddress!) : ["fixture-ny-102"];
  return { quotes, markets: marketModels(quotes, PREVIEW_NOW, 100, held), windows, nowSeconds: state === "empty" ? Date.UTC(2026, 10, 10) / 1000 : PREVIEW_NOW };
}
