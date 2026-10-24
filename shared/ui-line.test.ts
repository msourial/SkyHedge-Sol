import assert from "node:assert/strict";
import { test } from "node:test";
import { NYC_RAIN_MODELLED, NYC_RAIN_OPTION_B } from "./ui-fixtures.ts";
import { instrumentArt } from "./ui-instrument.ts";
import { chainFigures, quoteFromTriggerRows, upcomingWindow } from "./ui-ladder.ts";
import {
  breakEvenLabel,
  chipExceedsCap,
  formatBase,
  multipleLabel,
  payoffPixels,
  premiumFromRate,
  protocolFeeBase,
  ticketFromBases,
} from "./ui-money.ts";
import { copySamples, forbiddenHits } from "./ui-copy.ts";
import { firstOpenPair, perilById, perilOpen } from "./peril-registry.ts";
import { buildProtectModel, type ProtectBuildInput } from "./ui-view.ts";
import type { CoverSize } from "./ui-quote-types.ts";

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
  if (wind.panel.kind === "not-open") assert.match(wind.panel.go?.label ?? "", /Chicago/);
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

test("stage instruments label only zero and the trigger", () => {
  for (const peril of ["rain", "snow", "wind"] as const) {
    const art = instrumentArt({ peril, rungs: [10, 20], selected: 20, reading: null, state: "idle", size: "stage", unit: peril === "wind" ? "m/s" : "mm" });
    const texts = art.ops.filter((op) => op.op === "text").map((op) => op.op === "text" ? op.text : "");
    assert.deepEqual(texts.sort(), ["0", "20"]);
    const mini = instrumentArt({ peril, rungs: [10, 20], selected: 20, reading: null, state: "idle", size: "mini", unit: "mm" });
    assert.equal(mini.ops.some((op) => op.op === "text"), false);
  }
});

test("quote adapter keeps modelled rows closed and reads the year count it is given", () => {
  const quote = quoteFromTriggerRows({
    cityId: "new-york",
    stationId: "GHCND:USW00094728",
    windowStart: "2026-10-26",
    windowEnd: "2026-11-02",
    salesCloseAt: "2026-10-26",
    analogueYears: 10,
    marketAddress: "Market111",
    rows: [
      { thresholdMm: 29, probabilityBps: 6000, premiumRateBps: 7000, onChain: false },
      { thresholdMm: 69, probabilityBps: 2000, premiumRateBps: 2400, onChain: true },
    ],
  });
  assert.ok(quote);
  assert.equal(quote.analogueYears, 10);
  assert.equal(quote.rungs.find((rung) => rung.triggerValue === 29)?.marketAddress, null);
  assert.equal(quote.rungs.find((rung) => rung.triggerValue === 69)?.marketAddress, "Market111");
  assert.equal(quoteFromTriggerRows({ ...{
    cityId: "new-york", stationId: "x", windowStart: "2026-10-26", windowEnd: "2026-11-02", salesCloseAt: "2026-10-26", marketAddress: "M", rows: [],
  }, analogueYears: 0 }), null);
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
  assert.equal(dry.odds, null);
  assert.equal(dry.panel.kind, "dry");
});

test("pricing sentence and refund sentence are the task facts", () => {
  const model = buildProtectModel(coverInput());
  assert.match(model.ticket?.sheet ?? "", /Includes a 15% margin on the odds and a 1% protocol fee \(1\.00 SKYT\)\./);
  assert.match(model.ticket?.sheet ?? "", /full premium is refundable/);
  assert.match(model.subline ?? "", /Sales close Oct 26/);
  assert.equal(/Opens /.test(model.subline ?? ""), false);
});
