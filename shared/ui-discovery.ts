/** Shared browsing and receipt models. A modelled rung never becomes an open market. */
import { CITIES, PERILS, cityById, perilById } from "./peril-registry.ts";
import * as copy from "./ui-copy.ts";
import { dayFromIso, fractionOnScale, scaleFor } from "./ui-ladder.ts";
import { chanceLabel, formatBaseGrouped, measureLabel, multipleLabel, payoffPixels, rungEconomics, ticketFromBases } from "./ui-money.ts";
import { isoFromSeconds } from "./ui-ladder.ts";
import { perilOpen } from "./peril-registry.ts";
import { matchingQuote, quoteNotOpen, windowQuoteRequest, type QuoteWindow } from "./ui-window-quote.ts";
import type { CoverSize, PerilId, WindowQuote } from "./ui-types.ts";

export type MarketSelection = { cityId: string; peril: PerilId; tenor: "weekly" | "monthly"; trigger: number; windowStart?: string; windowEnd?: string };
export type MarketModel = MarketSelection & { id: string; city: string; station: string; quote: WindowQuote; rungs: number[]; unit: string; chance: string; multiple: string; loss: string; gain: string; note: string; close: string; heroLine: string; held: boolean; triggerLabel: string };
export type PerilFilter = PerilId | "all";

export function marketModels(quotes: readonly WindowQuote[], nowSeconds: number, cover: CoverSize = 100, heldMarkets: ReadonlySet<string> | readonly string[] = []): MarketModel[] {
  const held = new Set(heldMarkets);
  return quotes.flatMap((quote) => {
    const peril = perilById(quote.peril);
    const city = cityById(quote.cityId);
    const note = copy.chanceNote(quote.analogueYears);
    if (!city || !peril || peril.id === "cold" || !note || !(Date.parse(quote.salesCloseAt) > nowSeconds * 1000)) return [];
    const close = copy.salesCloseLine(dayFromIso(quote.salesCloseAt) ?? quote.salesCloseAt);
    return quote.rungs.flatMap((rung) => {
      const economics = rungEconomics(rung, cover);
      const ticket = economics && ticketFromBases(economics.premium, economics.payout);
      const chance = chanceLabel(rung.chanceBps);
      if (!ticket || !chance || !Number.isFinite(rung.triggerValue)) return [];
      const span = Date.parse(quote.windowEnd) - Date.parse(quote.windowStart);
      return [{ id: rung.marketAddress!, cityId: city.id, city: city.name, station: city.station, peril: peril.id,
        tenor: span > 7 * 86400000 ? "monthly" as const : "weekly" as const, trigger: rung.triggerValue,
        windowStart: quote.windowStart, windowEnd: quote.windowEnd, quote, rungs: quote.rungs.map((r) => r.triggerValue), unit: quote.unit, chance,
        multiple: multipleLabel(ticket.multipleTenths)!, loss: formatBaseGrouped(ticket.maxLoss), gain: formatBaseGrouped(ticket.maxGain), note,
        close, heroLine: copy.marketHeroLine(city.station, close), held: held.has(rung.marketAddress!),
        triggerLabel: `${peril.direction === "down" ? "≤" : "≥"} ${measureLabel(rung.triggerValue)} ${quote.unit} ${copy.BY} ${dayFromIso(quote.windowEnd) ?? quote.windowEnd}` }];
    });
  }).sort((a, b) => Date.parse(a.quote.salesCloseAt) - Date.parse(b.quote.salesCloseAt));
}

/** Use unrounded quote chances, then the earliest close. Exact ties retain feed order. */
function compareMarkets(a: MarketModel, b: MarketModel): number {
  const chance = (market: MarketModel) => market.quote.rungs.find((rung) => rung.marketAddress === market.id)!.chanceBps;
  return chance(a) - chance(b) || Date.parse(a.quote.salesCloseAt) - Date.parse(b.quote.salesCloseAt);
}

/** Every open peril gets one row per round, in registry order. Never mutates the input. */
export function orderMarkets(markets: readonly MarketModel[], filter: PerilFilter): MarketModel[] {
  if (filter !== "all") return markets.filter((market) => market.peril === filter).sort((a, b) => Number(a.held) - Number(b.held) || compareMarkets(a, b));
  const roundRobin = (held: boolean) => {
    const queues = PERILS.map((peril) => markets.filter((market) => market.peril === peril.id && market.held === held).sort(compareMarkets));
    const ordered: MarketModel[] = [];
    for (let round = 0; queues.some((queue) => round < queue.length); round++) {
      for (const queue of queues) if (queue[round]) ordered.push(queue[round]);
    }
    return ordered;
  };
  return [...roundRobin(false), ...roundRobin(true)];
}

/** Consume exactly the list order; held positions in any state remain visible in the list. */
export function pickHero(ordered: readonly MarketModel[], filter: PerilFilter): MarketModel | null {
  return ordered.find((market) => (filter === "all" || market.peril === filter) && market.held === false) ?? null;
}

/**
 * A second line needs a real, registry-eligible feed window and an explicit clock.
 * Without nowSeconds we cannot prove the feed window is future, so omit the claim.
 */
export function emptyPerilNote(peril: PerilId, markets: readonly MarketModel[], windows: readonly QuoteWindow[] = [], nowSeconds?: number): { line: string; note: string | null } | null {
  if (markets.some((market) => market.peril === peril)) return null;
  const future = nowSeconds == null || !Number.isFinite(nowSeconds) ? null : windows.filter((window) => {
    const start = isoFromSeconds(window.observationStart);
    return !!start && !!cityById(window.city) && (window.peril ?? "rain") === peril && !!window.address
      && window.observationStart > nowSeconds && window.observationEnd > window.observationStart
      && (window.salesCloseAt ?? window.observationStart) > nowSeconds
      && peril !== "cold" && perilOpen({ cityId: window.city, peril, windowStart: start, tenor: window.tenor });
  }).sort((a, b) => a.observationStart - b.observationStart)[0];
  const month = future && new Date(future.observationStart * 1000).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return { line: copy.notOpenYet(peril), note: future && month ? copy.futurePerilWindow(cityById(future.city)!.name, peril, month) : null };
}

export function unavailableMarkets(markets: readonly MarketModel[], filter: PerilId | "all") {
  return PERILS.filter((p) => filter === "all" || p.id === filter).flatMap((peril) => {
    if (peril.id === "cold") return [{ id: "cold", peril: peril.id, label: peril.label }];
    return CITIES.filter((city) => !markets.some((m) => m.cityId === city.id && m.peril === peril.id))
      .map((city) => ({ id: `${city.id}-${peril.id}`, peril: peril.id, label: `${city.name} · ${peril.label}` }));
  });
}

/** Week and month requests, including real future windows supplied by the status endpoint. */
export function discoveryRequests(windows: readonly QuoteWindow[], nowSeconds: number) {
  const requests = CITIES.flatMap((city) => PERILS.flatMap((peril) => (["weekly", "monthly"] as const).map((tenor) => ({
    cityId: city.id, peril: peril.id, ...windowQuoteRequest({ cityId: city.id, peril: peril.id, tenor, windows, nowSeconds }),
  }))));
  // Keep later feed-backed windows reachable (for example New York snow in December).
  for (const window of windows) {
    const peril = window.peril ?? "rain";
    const start = isoFromSeconds(window.observationStart), end = isoFromSeconds(window.observationEnd);
    if (!start || !end || (window.salesCloseAt ?? window.observationStart) <= nowSeconds || peril === "cold"
      || !perilOpen({ cityId: window.city, peril, windowStart: start, tenor: window.tenor })) continue;
    const params = new URLSearchParams({ resource: "window-quote", city: window.city, peril, windowStart: start, windowEnd: end });
    requests.push({ cityId: window.city, peril, start, end, path: `/api/mobile?${params}` });
  }
  return [...new Map(requests.filter((r) => r.path != null).map((r) => [r.path, r])).values()];
}
export async function loadDiscovery(windows: readonly QuoteWindow[], nowSeconds: number, read: (path: string) => Promise<WindowQuote>) {
  const requests = discoveryRequests(windows, nowSeconds);
  const results = await Promise.all(requests.map(async (request) => {
    try { return { quote: matchingQuote(await read(request.path!), request), failed: false }; }
    catch (error) { return { quote: null, failed: !quoteNotOpen(error) }; }
  }));
  return { quotes: results.flatMap((r) => r.quote ? [r.quote] : []), failed: results.some((r) => r.failed) };
}

export type StoredCover = { market: string; address: string; premiumPaid: string; protectedAmount: string; potentialPayout?: string; city?: string; statusLabel?: string; peril?: PerilId; cityId?: string; triggerValue?: number; payoutClaimed?: boolean; refundClaimed?: boolean };
export type CoverClaim = { state: string; action: string | null; result: string; observation?: null | { rainfallMmX100: string; windowEnd: number } };
export type ReceiptModel = { id: string; market: string; title: string; triggerLine: string | null; detailLine: string; windowKey: string | null; windowLabel: string | null; windowStart: string | null; windowEnd: string | null; peril: PerilId | null; city: string; station: string | null; unit: string; rungs: number[]; trigger: number | null; reading: number | null; settled: string | null; status: string; kind: "open" | "paid" | "dry" | "pending" | "refunded" | "unknown"; loss: string | null; gain: string | null; payout: string | null; result: string | null; diagram: null | { step: number; ticks: number[]; reading: number | null; lossPx: number; gainPx: number; loss: string; gain: string; trigger: string } };
const formatStored = (amount: bigint) => formatBaseGrouped(amount, amount % 10_000n === 0n ? 2 : 6);
const integer = (raw: string | undefined) => raw && /^\d+$/.test(raw) ? BigInt(raw) : null;

export function receiptModel(position: StoredCover, windows: readonly QuoteWindow[], quotes: readonly WindowQuote[], claim?: CoverClaim | null): ReceiptModel {
  const window = windows.find((w) => w.address === position.market);
  const quote = quotes.find((q) => q.rungs.some((r) => r.marketAddress === position.market));
  const rung = quote?.rungs.find((r) => r.marketAddress === position.market);
  // An address-matched window establishes the peril; the city alone cannot do that.
  const peril = quote?.peril ?? window?.peril ?? (window ? "rain" : position.peril ?? null);
  const city = cityById(quote?.cityId ?? window?.city ?? position.cityId ?? "");
  const premium = integer(position.premiumPaid);
  // protectedAmount is the fixed payout in the existing contract; use a stored potentialPayout when available.
  const payout = integer(position.potentialPayout ?? position.protectedAmount);
  const ticket = premium != null && payout != null ? ticketFromBases(premium, payout) : null;
  const claimResult = claim?.result.toLowerCase();
  const claimed = position.payoutClaimed === true || (claim?.state === "claimed" && claimResult === "triggered");
  const refunded = position.refundClaimed === true || (claim?.state === "claimed" && claimResult === "dataunavailable");
  const dry = claimResult === "nottriggered" || position.statusLabel === "Not triggered";
  const expired = claim?.state === "expired";
  const kind = refunded ? "refunded" : claimed ? "paid" : dry ? "dry" : expired ? "unknown" : claim?.state === "claimable" || claimResult === "triggered" || claimResult === "dataunavailable" ? "pending" : claim?.state === "pending" || (position.statusLabel === "Active" || position.statusLabel === "Awaiting NOAA final data") ? "open" : "unknown";
  const status = kind === "paid" ? copy.PAID_OUT : kind === "dry" ? copy.DRY_WINDOW : kind === "refunded" ? copy.REFUNDED : kind === "open" ? copy.OPEN_WORD : kind === "pending" ? (claim?.action === "claim_premium_refund" ? copy.REFUND_READY : copy.PAYOUT_READY) : expired ? copy.CLAIM_EXPIRED : copy.STATE_UNAVAILABLE;
  const readingRaw = claim?.observation?.rainfallMmX100;
  // This endpoint currently exposes a rain observation only. Never apply it to a different peril.
  const reading = peril === "rain" && readingRaw && /^\d+$/.test(readingRaw) ? Number(readingRaw) / 100 : null;
  const trigger = rung?.triggerValue ?? position.triggerValue ?? (window && "thresholdMmX100" in window && typeof window.thresholdMmX100 === "string" ? Number(window.thresholdMmX100) / 100 : null);
  const rungs = quote?.rungs.map((r) => r.triggerValue) ?? (trigger != null ? [trigger] : []);
  const unit = quote?.unit ?? (peril ? perilById(peril)?.unit ?? "" : "");
  const heights = ticket ? payoffPixels(ticket.maxLoss, ticket.maxGain) : null;
  const scale = peril && rungs.length ? scaleFor(peril, rungs) : null;
  const definition = peril ? perilById(peril) : null;
  const measured = trigger == null ? null : measureLabel(trigger);
  const triggerLine = measured != null && definition && unit ? copy.triggerCondition(`${measured} ${unit}`, definition.direction) : null;
  // Dates come only from an address-matched quote or window, never a current/default window.
  const windowStart = quote ? validDate(quote.windowStart) : window ? isoFromSeconds(window.observationStart) : null;
  const windowEnd = quote ? validDate(quote.windowEnd) : window ? isoFromSeconds(window.observationEnd) : null;
  const startLabel = windowStart && dayFromIso(windowStart), endLabel = windowEnd && dayFromIso(windowEnd);
  const windowLabel = startLabel && endLabel ? copy.windowLabel(startLabel, endLabel) : startLabel || endLabel;
  const title = `${definition?.label ?? copy.WEATHER_WORD} · ${city?.name ?? position.city ?? copy.UNKNOWN_CITY}`;
  return { id: position.address, market: position.market, title, triggerLine,
    detailLine: title, windowStart, windowEnd,
    windowKey: windowStart || windowEnd ? `${windowStart ?? ""}/${windowEnd ?? ""}` : null, windowLabel,
    peril, city: city?.name ?? position.city ?? copy.UNKNOWN_CITY,
    station: quote?.stationId ?? city?.stationId ?? null, unit, rungs, trigger, reading,
    settled: claim?.observation ? dayFromIso(new Date(claim.observation.windowEnd * 1000).toISOString()) : null,
    status, kind, loss: ticket ? formatStored(ticket.maxLoss) : null, gain: ticket ? formatStored(ticket.maxGain) : null,
    payout: ticket ? formatStored(ticket.payout) : null,
    result: ticket && (kind === "paid" || kind === "dry" || kind === "refunded") ? copy.resultLine(kind === "paid" ? "+" : kind === "refunded" ? "" : "-", kind === "paid" ? formatStored(ticket.maxGain) : kind === "refunded" ? formatStored(0n) : formatStored(ticket.maxLoss)) : null,
    diagram: ticket && heights && scale && trigger != null ? { step: fractionOnScale(trigger, scale), ticks: rungs.map((value) => fractionOnScale(value, scale)), reading: reading == null ? null : fractionOnScale(reading, scale), lossPx: heights.loss, gainPx: heights.gain, loss: `-${formatStored(ticket.maxLoss)}`, gain: `+${formatStored(ticket.maxGain)}`, trigger: `${measureLabel(trigger)} ${unit}` } : null };
}

function validDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value ? value : null;
}

/** Distinct held perils, including settled positions, in registry order. */
export function walletPerils(receipts: readonly ReceiptModel[]): PerilId[] {
  return PERILS.filter((peril) => receipts.some((receipt) => receipt.peril === peril.id)).map((peril) => peril.id);
}

export function filterReceipts(receipts: readonly ReceiptModel[], filter: PerilFilter): ReceiptModel[] {
  return receipts.filter((receipt) => filter === "all" || receipt.peril === filter);
}

/** The renderer uses these groups at four or more receipts; unknown dates sort last. */
export function groupReceiptsByWindow(receipts: readonly ReceiptModel[]): Array<{ label: string | null; receipts: ReceiptModel[] }> {
  const groups = new Map<string | null, { label: string | null; receipts: ReceiptModel[]; start: number }>();
  for (const receipt of receipts) {
    let group = groups.get(receipt.windowKey);
    if (!group) {
      group = { label: receipt.windowLabel, receipts: [], start: receipt.windowStart ? Date.parse(receipt.windowStart) : Infinity };
      groups.set(receipt.windowKey, group);
    }
    group.receipts.push(receipt);
  }
  return [...groups.values()].sort((a, b) => a.start - b.start).map(({ label, receipts }) => ({ label, receipts }));
}
export function openCoverTotals(positions: readonly StoredCover[], receipts: readonly ReceiptModel[]) {
  const open = positions.filter((p) => receipts.some((r) => r.id === p.address && r.kind === "open"));
  if (!open.length) return null;
  let loss = 0n, gain = 0n;
  for (const p of open) {
    const premium = integer(p.premiumPaid), payout = integer(p.potentialPayout ?? p.protectedAmount);
    const ticket = premium != null && payout != null ? ticketFromBases(premium, payout) : null;
    if (!ticket) return null;
    loss += ticket.maxLoss; gain += ticket.maxGain;
  }
  return { loss: formatStored(loss), gain: formatStored(gain) };
}
