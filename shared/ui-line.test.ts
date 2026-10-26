import assert from "node:assert/strict";
import { test } from "node:test";
import { NYC_RAIN_MODELLED, NYC_RAIN_OPTION_B } from "./ui-fixtures.ts";
import { instrumentArt, lineEndX } from "./ui-instrument.ts";
import { chainFigures, upcomingWindow } from "./ui-ladder.ts";
import {
  breakEvenLabel,
  chipExceedsCap,
  formatBase,
  multipleLabel,
  payoffPixels,
  premiumFromRate,
  protocolFeeBase,
  ticketFromBases,
  rungEconomics,
} from "./ui-money.ts";
import { copySamples, forbiddenHits } from "./ui-copy.ts";
import { firstOpenPair, perilById, perilOpen } from "./peril-registry.ts";
import { buildProtectModel, type ProtectBuildInput } from "./ui-view.ts";
import { readCatalogueWindowQuote } from "../server/services/window-quote-read.ts";
import { matchingQuote, pickDefaultWindow, windowQuoteRequest, type QuoteWindow } from "./ui-window-quote.ts";
import type { CoverSize } from "./ui-types.ts";

const BASE = 1_000_000n;

function coverInput(over: Partial<ProtectBuildInput> = {}): ProtectBuildInput {
  return {
    cityId: "new-york",
    peril: "rain",
    tenor: "weekly",
    windowStart: "2026-10-26",
    windowEnd: "2026-11-02",
    quote: NYC_RAIN_OPTION_B,
    single: null,
    loading: false,
    failed: false,
    connected: true,
    signing: false,
    cover: 100,
    selectedTrigger: null,
    defaultTrigger: 69,
    coveredMarket: null,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
    ...over,
  };
}

test("100 SKYT at the New York pinned rate", () => {
  const premium = premiumFromRate(100, 2400);
  assert.equal(premium, 24_000_000n);
  const deal = ticketFromBases(premium!, 100n * BASE);
  assert.ok(deal);
  assert.equal(formatBase(deal.maxLoss), "24.00");
  assert.equal(formatBase(deal.maxGain), "76.00");
  assert.equal(formatBase(protocolFeeBase(100)!), "1.00");
  assert.equal(breakEvenLabel(deal.breakEvenTenths), "24.0%");
  assert.equal(multipleLabel(deal.multipleTenths), "4.1x");
  assert.notEqual(formatBase(deal.maxLoss), "24.39");
});

test("protocol fee is 1% of cover, rounded up", () => {
  assert.equal(protocolFeeBase(50), 500_000n);
  assert.equal(protocolFeeBase(100), 1_000_000n);
  assert.equal(protocolFeeBase(250), 2_500_000n);
});

test("option B ladder matches the protocol curve and falls in chance", () => {
  const rows = chainFigures(NYC_RAIN_OPTION_B, 100);
  assert.deepEqual(rows.map((row) => [row.trigger, row.chance, row.multiple, row.maxLoss]), [
    [47, "60.0%", "1.4x", "-70.00"],
    [50, "50.0%", "1.7x", "-58.50"],
    [56, "40.0%", "2.1x", "-47.00"],
    [69, "20.0%", "4.1x", "-24.00"],
    [84, "20.0%", "4.1x", "-24.00"],
    [114, "10.0%", "8.0x", "-12.50"],
  ]);
  const chances = rows.map((row) => Number(row.chance.replace("%", "")));
  const multiples = rows.map((row) => Number(row.multiple.replace("x", "")));
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(chances[index]! <= chances[index - 1]!);
    assert.ok(multiples[index]! >= multiples[index - 1]!);
  }
});

test("modelled rungs have no max loss and cannot be selected", () => {
  const rows = chainFigures(NYC_RAIN_MODELLED, 100);
  assert.equal(rows.filter((row) => row.open).length, 1);
  assert.equal(rows.find((row) => row.trigger === 47)?.maxLoss, null);
  const model = buildProtectModel(coverInput({ quote: NYC_RAIN_MODELLED, selectedTrigger: 47 }));
  assert.equal(model.selected, 69);
  assert.equal(model.rows.find((row) => row.trigger === 47)?.inert, true);
  assert.equal(model.ticket?.loss.whole, "24");
});

test("selecting an open rung moves the ticket", () => {
  const model = buildProtectModel(coverInput({ selectedTrigger: 114, connected: false }));
  assert.equal(model.selected, 114);
  assert.equal(model.rows.find((row) => row.trigger === 114)?.selected, true);
  assert.equal(model.ticket?.loss.whole, "12");
  assert.equal(model.ticket?.loss.fraction, "50");
  assert.equal(model.ticket?.gain.whole, "87");
  assert.equal(model.panel.kind, "connect");
});

test("a cover on the window locks every rung", () => {
  const model = buildProtectModel(coverInput({ coveredMarket: "fixture-69" }));
  assert.equal(model.panel.kind, "covered");
  assert.equal(model.blocked, "You already have cover for this window.");
  assert.ok(model.rows.every((row) => row.inert));
  assert.equal(model.rows.find((row) => row.trigger === 69)?.yourCover, true);
});

test("payoff bars use the integer 40px rule", () => {
  const pixels = payoffPixels(24_000_000n, 76_000_000n);
  assert.equal(pixels.loss, 12.6);
  assert.equal(pixels.gain, 40);
});

test("integer money identities hold for random covers and rates", () => {
  let seed = 0x5eed;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
  for (let index = 0; index < 40; index += 1) {
    const cover = (next() % 500) + 1;
    const rate = (next() % 8_900) + 100;
    const premium = premiumFromRate(cover, rate);
    const payout = BigInt(cover) * BASE;
    assert.ok(premium);
    const deal = ticketFromBases(premium, payout);
    assert.ok(deal);
    assert.equal(deal.maxGain + deal.premium, deal.payout);
    assert.equal(deal.multipleTenths, Number((payout * 10n) / premium));
    assert.equal(deal.breakEvenTenths, Number((premium * 1_000n + payout - 1n) / payout));
    const fee = protocolFeeBase(cover);
    assert.equal(fee, (BigInt(cover) * BASE * 100n + 9_999n) / 10_000n);
  }
  assert.equal(chipExceedsCap(250, 300), true);
  assert.equal(chipExceedsCap(250, 200), false);
});

test("peril registry is data and cold is closed", () => {
  assert.equal(perilOpen({ cityId: "new-york", peril: "rain", windowStart: "2026-10-26", tenor: "weekly" }), true);
  assert.equal(perilOpen({ cityId: "new-york", peril: "wind", windowStart: "2026-10-26", tenor: "weekly" }), false);
  assert.equal(perilOpen({ cityId: "chicago", peril: "wind", windowStart: "2026-10-26", tenor: "weekly" }), true);
  assert.equal(perilOpen({ cityId: "miami", peril: "heat", windowStart: "2026-10-26", tenor: "weekly" }), true);
  assert.equal(perilOpen({ cityId: "chicago", peril: "snow", windowStart: "2026-11-02", tenor: "weekly" }), false);
  assert.equal(perilOpen({ cityId: "chicago", peril: "snow", windowStart: "2026-11-09", tenor: "weekly" }), true);
  assert.equal(perilOpen({ cityId: "chicago", peril: "snow", windowStart: "2026-11-01", tenor: "monthly" }), true);
  assert.equal(perilOpen({ cityId: "new-york", peril: "snow", windowStart: "2026-11-09", tenor: "weekly" }), false);
  assert.equal(perilOpen({ cityId: "new-york", peril: "snow", windowStart: "2026-12-07", tenor: "weekly" }), true);
  assert.equal(perilOpen({ cityId: "miami", peril: "cold", windowStart: "2026-12-07", tenor: "weekly" }), false);
  assert.equal(perilById("cold", []), undefined);
  const wind = buildProtectModel(coverInput({ cityId: "new-york", peril: "wind", quote: null }));
  assert.equal(wind.instrument, "ghost");
  assert.equal(wind.panel.kind, "not-open");
  if (wind.panel.kind === "not-open") assert.equal(wind.panel.go, null);
  const cold = buildProtectModel(coverInput({ peril: "cold", quote: null }));
  assert.equal(cold.panel.kind, "not-open");
  if (cold.panel.kind === "not-open") assert.equal(cold.panel.go, null);
  assert.match(perilById("wind")?.verb("14 m/s") ?? "", /peak wind/);
  assert.equal(/gust/i.test(perilById("wind")?.verb("14 m/s") ?? "gust"), false);
  assert.equal(firstOpenPair("2026-10-26", "weekly")?.peril, "rain");
});

test("copy samples contain none of the forbidden words", () => {
  assert.deepEqual(forbiddenHits(copySamples().join("\n")), []);
});

test("stage instruments label only unit-aware zero", () => {
  for (const peril of ["rain", "snow", "wind"] as const) {
    const art = instrumentArt({ peril, rungs: [10, 20], selected: 20, reading: null, state: "idle", size: "stage", unit: peril === "wind" ? "m/s" : "mm" });
    const texts = art.ops.filter((op) => op.op === "text").map((op) => op.op === "text" ? op.text : "");
    assert.deepEqual(texts, [peril === "wind" ? "0 m/s" : "0 mm"]);
    const mini = instrumentArt({ peril, rungs: [10, 20], selected: 20, reading: null, state: "idle", size: "mini", unit: "mm" });
    assert.equal(mini.ops.some((op) => op.op === "text"), false);
  }
});

test("the next weekly window after 24 Oct 2026 starts 26 Oct", () => {
  const week = upcomingWindow(Date.UTC(2026, 9, 24, 12), "weekly");
  assert.equal(week.start, "2026-10-26");
  assert.equal(week.end, "2026-11-02");
});

test("cover chips and money cells share one figure shape", () => {
  const model = buildProtectModel(coverInput({ cover: 50 as CoverSize }));
  assert.equal(model.ticket?.loss.whole, "12");
  assert.equal(model.ticket?.gain.whole, "38");
  assert.equal(model.panel.kind, "ready");
  if (model.panel.kind === "ready") assert.equal(model.panel.cta, "Protect for 12.00 SKYT");
  const paid = buildProtectModel(coverInput({ settlement: { kind: "paid" } }));
  assert.equal(paid.panel.kind, "paid");
  const dry = buildProtectModel(coverInput({ settlement: { kind: "dry" } }));
  assert.equal(dry.panel.kind, "dry");
});

test("pricing sentence and refund sentence are the task facts", () => {
  const model = buildProtectModel(coverInput());
  assert.match(model.ticket?.sheet ?? "", /Includes a 15% margin on the odds and a 1% protocol fee \(1\.00 SKYT\)\./);
  assert.match(model.ticket?.sheet ?? "", /full premium is refundable/);
  assert.match(model.subline ?? "", /Sales close Oct 26/);
  assert.equal(/Opens /.test(model.subline ?? ""), false);
});

test("backend rain quote supplies the only open rung and its exact cover premiums", async () => {
  const quote = await readCatalogueWindowQuote({
    cityId: "new-york", peril: "rain", windowStart: "2026-10-26", windowEnd: "2026-11-02",
    markets: [{ scaledX100: 6900, address: "fixture-pinned-rain", operator: "gte", probabilityBps: 2000, premiumRateBps: 2400, quoteInputsHash: "ab".repeat(32) }],
  });
  assert.equal(quote.analogueYears, 10);
  assert.deepEqual(quote.rungs.map((rung) => rung.triggerValue), [50, 69, 114]);
  assert.deepEqual(quote.rungs.filter((rung) => rung.marketAddress).map((rung) => rung.triggerValue), [69]);
  for (const [cover, premium] of [[50, 12_000_000n], [100, 24_000_000n], [250, 60_000_000n]] as const) {
    const model = buildProtectModel(coverInput({ quote, cover }));
    assert.equal(model.panel.kind, "ready");
    assert.equal(model.rows.filter((row) => row.open).length, 1);
    assert.deepEqual(model.rows.filter((row) => row.inert && row.maxLoss === "Not open").map((row) => row.trigger), [50, 114]);
    assert.equal(`${model.ticket?.loss.whole}.${model.ticket?.loss.fraction}`, formatBase(premium));
    assert.equal(`${model.ticket?.gain.whole}.${model.ticket?.gain.fraction}`, formatBase(BigInt(cover) * BASE - premium));
  }
});

test("quoted premium map is authoritative even when the displayed multiple is stale", () => {
  const rung = { ...NYC_RAIN_MODELLED.rungs.find((rung) => rung.marketAddress)!,
    premiumBase: { "50": "12345679", "100": "24691357", "250": "61728391" }, multipleTenths: 999 };
  for (const cover of [50, 100, 250] as const) {
    assert.deepEqual(rungEconomics(rung, cover), { premium: BigInt(rung.premiumBase[cover]), payout: BigInt(cover) * BASE });
  }
  assert.equal(rungEconomics({ ...rung, marketAddress: null }, 100), null);
  const model = buildProtectModel(coverInput({ quote: { ...NYC_RAIN_MODELLED, analogueYears: 8, rungs: [rung] } }));
  assert.equal(model.showChain, false);
  assert.equal(model.ticket?.loss.whole, "24");
  assert.equal(model.ticket?.loss.fraction, "69");
  assert.equal(model.ticket?.breakEven, "24.7%");
  assert.equal(model.ticket?.note, "Chance is from 8 years of NOAA history, not a forecast.");
});

test("backend snow, wind and heat quotes remain modelled with no ticket or selection", async () => {
  for (const input of [
    { cityId: "chicago", peril: "snow" as const, windowStart: "2026-11-09", windowEnd: "2026-11-16" },
    { cityId: "chicago", peril: "wind" as const, windowStart: "2026-10-26", windowEnd: "2026-11-02" },
    { cityId: "miami", peril: "heat" as const, windowStart: "2026-10-26", windowEnd: "2026-11-02" },
  ]) {
    const quote = await readCatalogueWindowQuote(input);
    assert.ok(quote.rungs.length > 1);
    assert.ok(quote.rungs.every((rung) => rung.marketAddress === null));
    const model = buildProtectModel(coverInput({ ...input, quote, selectedTrigger: quote.rungs[0]!.triggerValue }));
    assert.equal(model.showChain, false);
    assert.deepEqual(model.rows, []);
    assert.equal(model.hero, null);
    assert.equal(model.selected, null);
    assert.equal(model.ticket, null);
    assert.equal(model.panel.kind, "not-open");
    assert.equal(model.footnote, null);
  }
});

test("cold stays closed even if a response incorrectly supplies an open market", () => {
  const model = buildProtectModel(coverInput({ peril: "cold", quote: { ...NYC_RAIN_OPTION_B, peril: "cold" } }));
  assert.equal(model.instrument, "ghost");
  assert.deepEqual(model.rows, []);
  assert.equal(model.ticket, null);
  assert.equal(model.panel.kind, "not-open");
});

test("quote requests match city, peril and dates and never reuse a different selection", () => {
  const input = { cityId: "chicago", peril: "wind" as const, tenor: "weekly" as const, windows: [], nowSeconds: Date.UTC(2026, 9, 24) / 1000 };
  const request = windowQuoteRequest(input);
  assert.equal(request.path, "/api/mobile?resource=window-quote&city=chicago&peril=wind&windowStart=2026-10-26&windowEnd=2026-11-02");
  assert.equal(windowQuoteRequest({ ...input, peril: "cold" }).path, null);
  assert.equal(windowQuoteRequest({ ...input, cityId: "new-york" }).path, null);
  assert.equal(matchingQuote(NYC_RAIN_MODELLED, { ...input, ...request }), null);
  assert.equal(matchingQuote(NYC_RAIN_MODELLED, { cityId: "new-york", peril: "rain", ...request }), NYC_RAIN_MODELLED);
  assert.equal(matchingQuote(NYC_RAIN_MODELLED, { cityId: "new-york", peril: "rain", ...request, start: "2026-11-02" }), null);
});

// Explicit fixtures for the v4 New York monthly example; never used in a live path.
const MONTHLY = {
  ...NYC_RAIN_MODELLED, windowStart: "2026-11-01", windowEnd: "2026-12-01", salesCloseAt: "2026-11-01",
  rungs: [NYC_RAIN_MODELLED.rungs[0], NYC_RAIN_MODELLED.rungs[3], NYC_RAIN_MODELLED.rungs[5]].map((rung, index) => ({ ...rung, triggerValue: [80, 102, 194][index] })),
};
const NOW = Date.UTC(2026, 9, 26, 12) / 1000;
const LIVE_WINDOWS: QuoteWindow[] = [NYC_RAIN_MODELLED, MONTHLY].map((quote, index) => ({ city: quote.cityId, peril: quote.peril,
  tenor: index === 0 ? "weekly" : "monthly", address: quote.rungs.find((rung) => rung.marketAddress)!.marketAddress!,
  observationStart: Date.parse(quote.windowStart) / 1000, observationEnd: Date.parse(quote.windowEnd) / 1000, salesCloseAt: Date.parse(quote.salesCloseAt) / 1000 }));

test("bare Protect selects the open month when the New York week has closed and gets a hero", () => {
  const selection = pickDefaultWindow({ cityId: "new-york", peril: "rain", windows: LIVE_WINDOWS, nowSeconds: NOW });
  assert.equal(selection.tenor, "monthly");
  assert.deepEqual(selection.tenorAvailability, { weekly: false, monthly: true });
  const request = windowQuoteRequest({ cityId: "new-york", peril: "rain", windows: LIVE_WINDOWS, nowSeconds: NOW, tenor: selection.tenor! });
  const model = buildProtectModel(coverInput({ tenor: selection.tenor!, windowStart: request.start, windowEnd: request.end,
    quote: MONTHLY, windows: LIVE_WINDOWS, nowSeconds: NOW }));
  assert.equal(model.panel.kind, "ready");
  assert.equal(model.hero?.numeral, "102");
  assert.deepEqual(model.tenorOpen, { weekly: false, monthly: true });
  assert.deepEqual(model.rungs, [80, 102, 194]);
  assert.equal(model.showChain, true);
});

test("default selection prefers an open week, respects the sales cutoff, city, peril and registry", () => {
  const select = (windows: QuoteWindow[], nowSeconds = NOW, peril: "rain" | "cold" | "wind" = "rain") => pickDefaultWindow({ cityId: "new-york", peril, windows, nowSeconds });
  assert.equal(select([...LIVE_WINDOWS].reverse(), Date.UTC(2026, 9, 24) / 1000).tenor, "weekly");
  assert.deepEqual(select(LIVE_WINDOWS, LIVE_WINDOWS[0].salesCloseAt!).tenorAvailability, { weekly: false, monthly: true });
  assert.equal(select(LIVE_WINDOWS, NOW, "cold").tenor, null);
  assert.equal(select(LIVE_WINDOWS.map((window) => ({ ...window, peril: "wind" })), NOW, "wind").tenor, null);
  for (const windows of [[], LIVE_WINDOWS.map((window) => ({ ...window, city: "chicago" })), LIVE_WINDOWS.map((window) => ({ ...window, address: "" })), LIVE_WINDOWS.map((window) => ({ ...window, observationEnd: window.observationStart }))]) {
    assert.deepEqual(select(windows), { tenor: null, window: null, tenorAvailability: { weekly: false, monthly: false } });
  }
  assert.deepEqual(select(LIVE_WINDOWS, LIVE_WINDOWS[1].observationStart).tenorAvailability, { weekly: false, monthly: false });
  const legacy = { ...LIVE_WINDOWS[1], peril: undefined, salesCloseAt: null };
  assert.equal(select([legacy]).tenor, "monthly");
});

test("hero and ticket expose exact v4 data with no start-date reading or odds band", () => {
  const model = buildProtectModel(coverInput({ tenor: "monthly", windowStart: MONTHLY.windowStart, windowEnd: MONTHLY.windowEnd, quote: MONTHLY }));
  assert.deepEqual(model.hero, { label: "Trigger", numeral: "102", unit: "mm", chance: "20.0%", multiple: "4.1x", soFar: null });
  assert.equal(model.soFarValue, "");
  assert.deepEqual(model.header, ["Trigger (mm)", "Chance", "Multiple", "Max loss"]);
  assert.deepEqual(model.rows.map((row) => [row.trigger, row.kind, row.maxLoss, row.selected, row.inert]), [
    [80, "modelled", "Not open", false, true], [102, "open", "-24.00", true, false], [194, "modelled", "Not open", false, true],
  ]);
  assert.deepEqual(model.footnotes, ["Only the highlighted trigger can be covered for this window.", "Chance is from 10 years of NOAA history, not a forecast."]);
  assert.deepEqual(model.rows.map((row) => row.topTag), [null, null, "Highest in 10 years"]);
  assert.equal(model.payoff?.lossBase, "24000000"); assert.equal(model.payoff?.gainBase, "76000000");
  assert.equal(model.payoff?.lossPx, 12.6); assert.equal(model.payoff?.gainPx, 40);
  assert.deepEqual([model.payoff?.lossLabel, model.payoff?.gainLabel, model.payoff?.triggerLabel], ["-24.00", "+76.00", "102 mm"]);
  assert.equal(model.coverSentence, "You get 100.00 SKYT if Central Park records 102 mm or more by Dec 1. If not, you lose the 24.00 SKYT you paid.");
  assert.deepEqual(model.signRows, [
    { label: "Trigger", value: "102 mm or more" }, { label: "Window", value: "Nov 1 to Dec 1" }, { label: "Station", value: "Central Park" },
    { label: "Payout", value: "100.00 SKYT", payout: true }, { label: "Chance", value: "20.0%" },
    { label: "Break-even chance", value: "24.0%" }, { label: "Fee included", value: "1.00 SKYT" },
  ]);
  assert.equal(model.ticket?.salesClose, "Sales close Nov 1.");
  assert.deepEqual(forbiddenHits(JSON.stringify(model)), []);
  const running = buildProtectModel(coverInput({ running: true, reading: 38 }));
  assert.deepEqual(running.hero?.soFar, { label: "So far", value: "38 mm" });
  const zero = buildProtectModel(coverInput({ running: true, reading: 0 }));
  assert.equal(zero.hero?.soFar?.value, "0 mm");
  assert.equal(buildProtectModel(coverInput({ running: true, reading: NaN })).hero?.soFar, null);
});

test("covered selection wins over stale user selection and freezes chain and ticket with no chips", () => {
  const model = buildProtectModel(coverInput({ selectedTrigger: 114, coveredMarket: "fixture-69", nowSeconds: NOW }));
  assert.equal(model.selected, 69);
  assert.equal(model.hero?.numeral, "69");
  assert.equal(model.panel.kind, "covered");
  assert.equal(model.yourCover, "Your cover");
  assert.equal(model.readOnly, true); assert.equal(model.ticket?.readOnly, true);
  assert.equal(model.rows.filter((row) => row.selected).length, 1);
  assert.equal(model.rows.find((row) => row.selected)?.tag, "Your cover");
  assert(model.rows.every((row) => row.inert)); assert.deepEqual(model.chips, []);
});

test("a single open rung follows the hero directly without a one-row table", () => {
  const model = buildProtectModel(coverInput({ quote: { ...NYC_RAIN_MODELLED, rungs: [NYC_RAIN_MODELLED.rungs[3]] } }));
  assert(model.hero); assert(model.ticket); assert.equal(model.showChain, false); assert.deepEqual(model.rows, []);
  assert.equal(model.optionAFootnote, null);
});

test("not-open panel links to an open same-city window before an open other city, never Cold", () => {
  const model = buildProtectModel(coverInput({ quote: null, windows: LIVE_WINDOWS, nowSeconds: NOW }));
  assert.equal(model.panel.kind, "not-open");
  if (model.panel.kind !== "not-open") return;
  assert.equal(model.panel.line, "Rain isn't open for New York this week.");
  assert.deepEqual(model.panel.go, { label: "Open Nov 1 to Dec 1 instead", cityId: "new-york", tenor: "monthly", windowStart: "2026-11-01", windowEnd: "2026-12-01" });
  assert.equal(model.hero, null); assert.equal(model.ticket, null); assert.deepEqual(model.rows, []);
  const other = buildProtectModel(coverInput({ quote: null, windows: [{ ...LIVE_WINDOWS[1], city: "des-moines" }], nowSeconds: NOW }));
  if (other.panel.kind !== "not-open") assert.fail("Expected not-open panel");
  assert.equal(other.panel.go?.label, "Rain is open in Des Moines. Go there");
  const none = buildProtectModel(coverInput({ quote: null, windows: [], nowSeconds: NOW }));
  if (none.panel.kind !== "not-open") assert.fail("Expected not-open panel");
  assert.equal(none.panel.go, null);
  const cold = buildProtectModel(coverInput({ peril: "cold", quote: null, windows: LIVE_WINDOWS, nowSeconds: NOW }));
  assert.deepEqual(cold.panel, { kind: "not-open", line: "Cold isn't open yet.", go: null });
});

test("expired quotes cannot expose a hero or ticket even when a market address remains", () => {
  const model = buildProtectModel(coverInput({ nowSeconds: NOW }));
  assert.equal(model.panel.kind, "not-open"); assert.equal(model.hero, null); assert.equal(model.ticket, null);
  assert.equal(model.tenorOpen.weekly, false);
});

test("hero geometry keeps every peril's trigger before x=96 and every operation before x=104", () => {
  for (const peril of ["rain", "snow", "wind", "heat", "cold"] as const) {
    const rungs = peril === "cold" ? [-12, -8, -4, 0, 4, 8] : [10, 20, 30, 40, 50, 60];
    for (const selected of rungs) for (const state of ["idle", "covered", "paid", "dry"] as const) {
      const unit = peril === "wind" ? "m/s" : peril === "heat" || peril === "cold" ? "C" : "mm";
      const art = instrumentArt({ peril, rungs, selected, reading: null, state, size: "hero", unit });
      assert.equal(art.lineEndX, 96); assert.equal(lineEndX, 96); assert.notEqual(art.anchorY, null);
      const triggerLines = art.ops.filter((op) => op.op === "line" && op.stroke === "#F2C230");
      assert.equal(triggerLines.length, 1);
      for (const op of art.ops) {
        if (op.op === "text") { assert(op.size >= 13); assert.equal(op.text, `0 ${unit}`); assert(op.x <= 104); }
        else if (op.op === "line") {
          assert(Math.max(op.x1, op.x2) + (op.x1 === op.x2 ? op.sw / 2 : 0) <= 104);
          if (op.stroke === "#F2C230") { assert(op.x1 <= 96 && op.x2 <= 96); assert.equal(op.sw, 2); }
        } else if (op.op === "rect") assert(op.x + op.w + (op.sw ?? 0) / 2 <= 104);
        else if (op.op === "circle") assert(op.cx + op.r + (op.sw ?? 0) / 2 <= 104);
        else {
          // The only path is the wind's 240-degree circular arc. Its entire
          // circle, including stroke, fits before the right-column boundary.
          const values = op.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
          const [x1, y1, radius, , , large, sweep, x2, y2] = values;
          const dx = x1 - x2, dy = y1 - y2;
          const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (radius * radius - (dx * dx + dy * dy) / 4) / ((dx * dx + dy * dy) / 4)));
          const cx = (x1 + x2) / 2 + coefficient * dy / 2;
          assert(cx + radius + (op.sw ?? 0) / 2 <= 104, op.d);
        }
      }
      if (peril !== "wind") {
        const trigger = triggerLines[0];
        assert(trigger.op === "line"); assert.equal(trigger.x1, 8); assert.equal(trigger.x2, 96);
        assert(art.ops.some((op) => op.op === "rect" && op.x === 90 && op.w === 6 && op.h === 6));
      }
    }
  }
});

test("hero instruments use the specified footprints and only fill from a real reading", () => {
  for (const peril of ["rain", "snow", "wind", "heat", "cold"] as const) {
    const input = { peril, rungs: [10, 20, 30, 40, 50, 60], selected: 40, reading: null, state: "idle" as const, size: "hero" as const, unit: "mm" };
    const art = instrumentArt(input);
    const tint = perilById(peril)!.tint;
    assert.equal(art.ops.some((op) => "fill" in op && op.fill === tint || "stroke" in op && op.stroke === tint && op.op === "path"), false);
    const filled = instrumentArt({ ...input, reading: 20 });
    assert(filled.ops.some((op) => "fill" in op && op.fill === tint || "stroke" in op && op.stroke === tint && op.op === "path"));
    for (const size of ["hero", "stage"] as const) assert.deepEqual(instrumentArt({ ...input, size, state: "ghost" }).ops, []);
    if (peril === "snow") assert.equal(art.ops.filter((op) => op.op === "rect" && op.w === 40 && op.h === 8).length, 12);
    if (peril === "rain") assert(art.ops.some((op) => op.op === "rect" && op.w === 56 && op.h === 136));
    if (peril === "heat" || peril === "cold") {
      assert(art.ops.some((op) => op.op === "rect" && op.w === 32 && op.h === 136));
      assert(art.ops.some((op) => op.op === "circle" && op.r === 20));
    }
  }
});
