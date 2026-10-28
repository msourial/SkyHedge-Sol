/** Pure city-led Markets presentation. All scheduling evidence is supplied by the caller. */
import { CONSUMER_CITIES } from "./consumer-cities.ts";
import { CITIES, PERILS, PERIL_AVAILABILITY, cityById, perilById, perilOpen, type AvailabilityRecord } from "./peril-registry.ts";
import { emptyPerilNote, type MarketModel, type MarketSelection, type ReceiptModel } from "./ui-discovery.ts";
import { dayFromIso, isoFromSeconds } from "./ui-ladder.ts";
import { measureLabel } from "./ui-money.ts";
import type { PerilId } from "./ui-types.ts";
import type { QuoteWindow } from "./ui-window-quote.ts";
import * as copy from "./ui-copy.ts";
export { marketsLayout, marketsMotion } from "./ui-markets-layout.ts";
export type HeldMarkets = ReadonlySet<string> | readonly string[];
export type PreviewSelection = { cityId: string; peril: PerilId; tenor: "weekly" | "monthly" };
export const rankedCities = CONSUMER_CITIES.flatMap((c) => { const city = cityById(c.slug); return city ? [city] : []; });
const rank = (cityId: string) => rankedCities.findIndex((c) => c.id === cityId);
const perilRank = (peril: PerilId) => PERILS.findIndex((p) => p.id === peril);
const closing = (a: MarketModel, b: MarketModel) => Date.parse(a.quote.salesCloseAt) - Date.parse(b.quote.salesCloseAt) || a.id.localeCompare(b.id);
const isHeld = (m: MarketModel, held?: HeldMarkets) => held ? new Set(held).has(m.id) : m.held;
const selection = (m: MarketModel): MarketSelection => ({ cityId: m.cityId, peril: m.peril, tenor: m.tenor, trigger: m.trigger, windowStart: m.windowStart, windowEnd: m.windowEnd });

export type PendingCard = { kind: "pending"; id: string; cityId: string; city: string; peril: PerilId; label: string; station: string; month: string | null; status: string; footer: string; selection: PreviewSelection };
/** Month-only availability is not a date. Never fabricate a season from it. */
export function pendingCards(markets: readonly MarketModel[], windows: readonly QuoteWindow[], nowSeconds?: number, availability: readonly AvailabilityRecord[] = PERIL_AVAILABILITY): PendingCard[] {
  if (nowSeconds == null || !Number.isFinite(nowSeconds)) return [];
  const candidates = windows.filter((w) => {
    const start = isoFromSeconds(w.observationStart), end = isoFromSeconds(w.observationEnd), peril = w.peril ?? "rain";
    return !!w.address && !!start && !!end && Number.isFinite(w.salesCloseAt ?? w.observationStart) && !!cityById(w.city) && peril !== "cold" && w.observationStart > nowSeconds
      && w.observationEnd > w.observationStart && (w.salesCloseAt ?? w.observationStart) > nowSeconds
      && perilOpen({ cityId: w.city, peril, windowStart: start, tenor: w.tenor });
  }).sort((a, b) => a.observationStart - b.observationStart);
  const pairs = new Map<string, PendingCard>();
  function add(cityId: string, peril: PerilId, tenor: PreviewSelection["tenor"], window?: QuoteWindow) {
    const city = cityById(cityId), definition = perilById(peril), id = `${cityId}-${peril}`;
    if (!city || !definition || peril === "cold" || pairs.has(id) || markets.some((m) => m.cityId === cityId && m.peril === peril)) return;
    // Reuse the proven empty-peril lookup for season evidence, scoped to this city.
    const note = window && emptyPerilNote(peril, [], [window], nowSeconds);
    const month = note && note.note ? new Date(window!.observationStart * 1000).toLocaleString("en-US", { month: "short", timeZone: "UTC" }) : null;
    pairs.set(id, { kind: "pending", id, cityId, city: city.name, station: city.station, peril, label: definition.label, month, status: month ? copy.seasonStarts(month) : copy.NOT_OPEN_YET, footer: copy.SEE_TRIGGER_CHAIN, selection: { cityId, peril, tenor } });
  }
  for (const w of candidates) add(w.city, w.peril ?? "rain", w.tenor, w);
  for (const record of availability) {
    const date = record.weeklyNotBefore;
    if (record.open && date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && Date.parse(date) / 1000 > nowSeconds
      && perilOpen({ cityId: record.cityId, peril: record.peril, tenor: "weekly", windowStart: date }, availability)) add(record.cityId, record.peril, "weekly");
  }
  return [...pairs.values()].sort((a, b) => rank(a.cityId) - rank(b.cityId) || perilRank(a.peril) - perilRank(b.peril));
}
export function featuredCity(markets: readonly MarketModel[], windows: readonly QuoteWindow[], _held?: HeldMarkets, nowSeconds?: number): string {
  if (markets.some((m) => m.cityId === "new-york") || pendingCards(markets, windows, nowSeconds).some((p) => p.cityId === "new-york")) return "new-york";
  return rankedCities.find((c) => markets.some((m) => m.cityId === c.id))?.id ?? "new-york";
}
/** Held is a receipt fallback only after every unheld candidate in the city. */
export function leadMarket(city: string, markets: readonly MarketModel[], held?: HeldMarkets): MarketModel | null {
  const group = markets.filter((m) => m.cityId === city);
  const unheld = group.filter((m) => !isHeld(m, held));
  const lead = unheld.sort((a, b) => perilRank(a.peril) - perilRank(b.peril) || closing(a, b))[0] ?? group.sort(closing)[0] ?? null;
  return lead && held ? { ...lead, held: isHeld(lead, held) } : lead;
}
export type OpenCard = { kind: "open"; id: string; cityId: string; city: string; peril: PerilId; label: string; trigger: string; unit: string; rungs: number[]; held: boolean; windowCount: number; footer: string; selection: MarketSelection };
function openCard(m: MarketModel, group: readonly MarketModel[], held?: HeldMarkets): OpenCard {
  const covered = group.every((item) => isHeld(item, held));
  const count = new Set(group.map((item) => `${item.windowStart}/${item.windowEnd}`)).size;
  return { kind: "open", id: `${m.cityId}-${m.peril}`, cityId: m.cityId, city: m.city, peril: m.peril, label: perilById(m.peril)!.label, trigger: measureLabel(m.trigger)!, unit: m.unit, rungs: m.rungs, held: covered, windowCount: count, footer: covered ? copy.COVERED_WORD : copy.closesOn(dayFromIso(m.quote.salesCloseAt) ?? m.quote.salesCloseAt) + copy.windowsCount(count), selection: selection(m) };
}
export function elsewhereCards(city: string, markets: readonly MarketModel[], held?: HeldMarkets): OpenCard[] {
  const groups = new Map<string, MarketModel[]>();
  for (const m of markets) if (m.cityId !== city && cityById(m.cityId) && m.peril !== "cold") { const id = `${m.cityId}-${m.peril}`; groups.set(id, [...(groups.get(id) ?? []), m]); }
  return [...groups.values()].map((group) => { const sorted = [...group].sort((a, b) => Number(isHeld(a, held)) - Number(isHeld(b, held)) || closing(a, b)); return openCard(sorted[0], group, held); })
    .sort((a, b) => rank(a.cityId) - rank(b.cityId) || perilRank(a.peril) - perilRank(b.peril));
}
export type CityRow = { kind: "open"; id: string; peril: PerilId; trigger: string; end: string; status: string; held: boolean; selection: MarketSelection } | PendingCard;
export function moreInCity(city: string, markets: readonly MarketModel[], windows: readonly QuoteWindow[], nowSeconds?: number, held?: HeldMarkets): CityRow[] {
  const lead = leadMarket(city, markets, held);
  const rows: CityRow[] = markets.filter((m) => m.cityId === city && m.id !== lead?.id)
    .sort((a, b) => Number(isHeld(a, held)) - Number(isHeld(b, held)) || perilRank(a.peril) - perilRank(b.peril) || closing(a, b))
    .map((m) => ({ kind: "open", id: m.id, peril: m.peril, trigger: `${perilById(m.peril)?.direction === "down" ? "≤" : "≥"} ${measureLabel(m.trigger)} ${m.unit}`, end: `${copy.BY} ${dayFromIso(m.quote.windowEnd) ?? m.quote.windowEnd}`, status: isHeld(m, held) ? copy.COVERED_WORD : copy.closesOn(dayFromIso(m.quote.salesCloseAt) ?? m.quote.salesCloseAt), held: isHeld(m, held), selection: selection(m) }));
  const pending = pendingCards(markets, windows, nowSeconds).filter((p) => p.cityId === city);
  // With nothing open in the city the not-open panel already represents the first pending peril.
  return [...rows, ...(lead ? pending : pending.slice(1))];
}
export const coldCard = { kind: "cold", id: "cold", peril: "cold", label: "Cold", city: copy.EVERYWHERE, status: copy.NOT_AVAILABLE_YET, footer: copy.WHY, explanation: copy.COLD_EXPLANATION } as const;
export function heroSentence(market: MarketModel): string { return copy.marketsHeroSentence(market.station, perilById(market.peril)!.verb(`${measureLabel(market.trigger)} ${market.unit}`), dayFromIso(market.quote.windowEnd) ?? market.quote.windowEnd); }
/** `now` is epoch milliseconds, as in Date.now(); no clock is read inside this function. */
export function countdown(salesCloseAt: string, now: number): string {
  const remaining = Date.parse(salesCloseAt) - now;
  if (remaining >= 7 * 86400000) return copy.salesCloseLine(dayFromIso(salesCloseAt) ?? salesCloseAt);
  if (remaining >= 86400000) return copy.closesIn(Math.ceil(remaining / 86400000), "day");
  if (remaining >= 3600000) return copy.closesIn(Math.ceil(remaining / 3600000), "hour");
  return copy.CLOSES_TODAY;
}
export function citySheetRows(markets: readonly MarketModel[], _windows: readonly QuoteWindow[] = []) {
  return rankedCities.map((city) => { const perils = PERILS.filter((p) => markets.some((m) => m.cityId === city.id && m.peril === p.id)); return { id: city.id, name: city.name, subtitle: perils.length ? perils.map((p) => p.label).join(" · ") : copy.NOTHING_OPEN, glyphs: perils.slice(0, 2).map((p) => p.id) }; });
}
export function cityNotOpenPanel(cityId: string, pending: readonly PendingCard[]) {
  const p = pending.find((item) => item.cityId === cityId);
  const city = cityById(cityId) ?? CITIES[0];
  return { kind: "city-not-open" as const, height: 200, title: p ? `${p.label} · ${p.station}` : `${perilById("rain")!.label} · ${city.station}`, peril: p?.peril ?? "rain" as PerilId, status: p?.status ?? copy.NOT_OPEN_YET, cta: copy.SEE_TRIGGER_CHAIN, selection: p?.selection ?? { cityId, peril: "rain" as const, tenor: "weekly" as const } };
}
export function marketsPanel(input: { cityId: string; markets: readonly MarketModel[]; pending: readonly PendingCard[]; loading: boolean; failed: boolean; reason?: string; receipts?: readonly ReceiptModel[] }) {
  if (input.loading) return { kind: "loading" as const, numeral: "--", stats: [copy.CHANCE, copy.MULTIPLE, copy.MAX_LOSS].map((label) => ({ label, value: "--" })), cta: copy.COVER_THIS, shells: 4 };
  if (input.failed && !input.markets.length) return { kind: "error" as const, title: copy.MARKETS_ERROR, reason: input.reason ?? null, cta: copy.TRY_AGAIN };
  if (!input.markets.length && !input.pending.length) return { kind: "empty" as const, title: copy.NO_MARKETS_SCHEDULED };
  const lead = leadMarket(input.cityId, input.markets);
  const receipt = lead?.held ? input.receipts?.find((r) => r.market === lead.id) : null;
  const market = lead && receipt ? { ...lead, loss: receipt.loss ?? "--", gain: receipt.gain ?? "--" } : lead;
  if (!market) return cityNotOpenPanel(input.cityId, input.pending);
  return { kind: market.held ? "held-receipt-hero" as const : "open" as const, market, sentence: heroSentence(market), honesty: perilById(market.peril)?.honesty(market.station) ?? null, cta: market.held ? copy.VIEW_COVER : copy.COVER_THIS, note: market.held ? copy.nothingElseOpen(market.city) : null };
}
