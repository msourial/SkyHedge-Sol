import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import * as copy from "./ui-copy.ts";
import { DISCOVERY_QUOTES, PREVIEW_NOW, fixtureClaim, fixturePosition } from "./ui-discovery-fixtures.ts";
import {
  emptyPerilNote, filterReceipts, groupReceiptsByWindow, marketModels, openCoverTotals,
  orderMarkets, pickHero, receiptModel, walletPerils,
} from "./ui-discovery.ts";
import { formatBase, formatBaseGrouped, groupDigits, moneyParts, walletBalanceModel } from "./ui-money.ts";
import type { PerilId, WindowQuote } from "./ui-types.ts";
import type { QuoteWindow } from "./ui-window-quote.ts";

// Explicit fixtures only; none of these dates or addresses enter a live data path.
function marketQuote(peril: PerilId, address: string, chanceBps = 2000, start = "2026-11-01"): WindowQuote {
  const source = DISCOVERY_QUOTES.find((quote) => quote.peril === peril)!;
  const rung = source.rungs.find((rung) => rung.marketAddress)!;
  return { ...source, windowStart: start, windowEnd: "2026-12-01", salesCloseAt: start,
    rungs: [{ ...rung, marketAddress: address, chanceBps }] };
}
function monthlyReceipt(peril: PerilId, start = "2026-11-01", end = "2026-12-01", trigger?: number) {
  const quote = marketQuote(peril, `fixture-${peril}-${start}`, 2000, start);
  quote.windowEnd = end;
  if (trigger != null) quote.rungs[0].triggerValue = trigger;
  const position = { ...fixturePosition(peril), market: quote.rungs[0].marketAddress!, address: `position-${peril}-${start}` };
  return receiptModel(position, [], [quote], fixtureClaim("open"));
}

test("All uses registry round robin, sorts exact chance within open and held groups, then puts held last", () => {
  const quotes = [
    marketQuote("rain", "rain-third", 3000), marketQuote("rain", "rain-tie-late", 1000, "2026-11-09"),
    marketQuote("rain", "rain-tie-first", 1000), marketQuote("rain", "rain-tie-second", 1000),
    marketQuote("rain", "rain-low", 999), marketQuote("heat", "heat-second", 2500),
    marketQuote("heat", "heat-first", 1500), marketQuote("wind", "wind-first", 2000),
    marketQuote("snow", "snow-first", 2000), marketQuote("snow", "snow-second", 3000),
  ];
  const markets = marketModels(quotes, PREVIEW_NOW);
  const before = markets.map((market) => market.id);
  const ordered = orderMarkets(markets, "all");
  assert.deepEqual(ordered.slice(0, 4).map((market) => market.peril), ["rain", "snow", "wind", "heat"]);
  assert.deepEqual(ordered.map((market) => market.id), [
    "rain-low", "snow-first", "wind-first", "heat-first", "rain-tie-first", "snow-second", "heat-second",
    "rain-tie-second", "rain-tie-late", "rain-third",
  ]);
  assert.deepEqual(markets.map((market) => market.id), before);
  assert.deepEqual(orderMarkets(markets, "rain").map((market) => market.id), [
    "rain-low", "rain-tie-first", "rain-tie-second", "rain-tie-late", "rain-third",
  ]);
  assert.deepEqual(orderMarkets(markets, "cold"), []);
  assert.deepEqual(orderMarkets([], "all"), []);
  const held = marketModels(quotes, PREVIEW_NOW, 100, ["rain-low", "snow-first"]);
  const orderedHeld = orderMarkets(held, "all");
  assert.deepEqual(orderedHeld.filter((market) => !market.held).slice(0, 4).map((market) => market.peril), ["rain", "snow", "wind", "heat"]);
  assert.deepEqual(orderedHeld.slice(-2).map((market) => market.id), ["rain-low", "snow-first"]);
});

test("hero follows the list, skips all held states and respects the selected peril", () => {
  const quotes = [marketQuote("rain", "rain-best", 1000), marketQuote("rain", "rain-second", 2000),
    marketQuote("snow", "snow-best"), marketQuote("wind", "wind-best"), marketQuote("heat", "heat-best")];
  for (const held of [["rain-best"], new Set(["rain-best", "snow-best"])]) {
    const markets = marketModels(quotes, PREVIEW_NOW, 100, held);
    const ordered = orderMarkets(markets, "all");
    assert.equal(ordered[0].held, false);
    assert.equal(ordered.length, quotes.length);
    const hero = pickHero(ordered, "all");
    assert.equal(hero, ordered.find((market) => !market.held));
    assert.equal(hero?.held, false);
    assert.equal(pickHero(orderMarkets(markets, "rain"), "rain")?.id, "rain-second");
    assert.equal(pickHero(ordered, "cold"), null);
  }
  const allHeld = marketModels(quotes, PREVIEW_NOW, 100, quotes.map((quote) => quote.rungs[0].marketAddress!));
  assert.equal(pickHero(orderMarkets(allHeld, "all"), "all"), null);
  assert.equal(pickHero(orderMarkets(allHeld, "rain"), "rain"), null);
  assert.equal(pickHero([], "all"), null);
  assert.equal(pickHero(orderMarkets(marketModels(quotes, PREVIEW_NOW), "all"), "all")?.id, "rain-best");
});

test("every buyable rung remains discoverable when another rung in its window is held", () => {
  const quote = marketQuote("rain", "held", 1000);
  quote.rungs.push({ ...quote.rungs[0], triggerValue: 200, marketAddress: "available", chanceBps: 500 });
  const ordered = orderMarkets(marketModels([quote], PREVIEW_NOW, 100, ["held"]), "rain");
  assert.deepEqual(ordered.map((market) => [market.id, market.held]), [["available", false], ["held", true]]);
  assert.equal(pickHero(ordered, "rain")?.id, "available");
});

test("hero combines station and close copy; the right column and held tag have shared copy", () => {
  const market = marketModels([marketQuote("rain", "fixture-rain")], PREVIEW_NOW)[0];
  assert.equal(market.heroLine, "Central Park · Sales close Nov 1");
  assert.equal(copy.COVERED_TAG, "Covered");
  assert.equal(copy.CHANCE, "Chance"); assert.equal(copy.MULTIPLE, "Multiple");
});

test("empty peril names no opening without an actual eligible future window and a clock", () => {
  assert.deepEqual(emptyPerilNote("snow", []), { line: "Snow isn't open yet.", note: null });
  assert.deepEqual(emptyPerilNote("cold", []), { line: "Cold isn't open yet.", note: null });
  const future: QuoteWindow = { city: "chicago", peril: "snow", tenor: "monthly", address: "fixture-future",
    observationStart: Date.UTC(2026, 11, 1) / 1000, observationEnd: Date.UTC(2027, 0, 1) / 1000,
    salesCloseAt: Date.UTC(2026, 11, 1) / 1000 };
  assert.deepEqual(emptyPerilNote("snow", [], [future], PREVIEW_NOW), {
    line: "Snow isn't open yet.", note: "Chicago snow opens in December",
  });
  assert.equal(emptyPerilNote("snow", [], [future])?.note, null);
  assert.equal(emptyPerilNote("snow", [], [future], future.observationStart)?.note, null);
  for (const window of [
    { ...future, city: "miami" }, { ...future, city: "unknown" }, { ...future, address: "" },
    { ...future, observationEnd: future.observationStart }, { ...future, salesCloseAt: PREVIEW_NOW },
    { ...future, observationStart: Date.UTC(2026, 9, 1) / 1000 }, { ...future, peril: "cold" as const },
  ]) assert.equal(emptyPerilNote("snow", [], [window], PREVIEW_NOW)?.note, null);
  assert.equal(emptyPerilNote("snow", marketModels(DISCOVERY_QUOTES, PREVIEW_NOW), [future], PREVIEW_NOW), null);
});

test("receipt lead and detail lines retain the matched window, direction and native unit", () => {
  const cases = [
    ["rain", 102, "102 mm or more", "Rain · New York"],
    ["wind", 14.8, "14.8 m/s or more", "Wind · Chicago"],
    ["heat", 30.6, "30.6 C or more", "Heat · Miami"],
  ] as const;
  for (const [peril, trigger, triggerLine, detailLine] of cases) {
    const receipt = monthlyReceipt(peril, "2026-11-01", "2026-12-01", trigger);
    assert.equal(receipt.triggerLine, triggerLine);
    assert.equal(receipt.detailLine, detailLine);
    assert.equal(receipt.title, detailLine.split(" · ").slice(0, 2).join(" · "));
    assert.equal(receipt.windowKey, "2026-11-01/2026-12-01");
    assert.equal(receipt.windowLabel, "Nov 1 to Dec 1");
  }
  const cold = receiptModel({ ...fixturePosition(), market: "fixture-cold", peril: "cold", cityId: "new-york", triggerValue: -4 }, [], []);
  assert.equal(cold.triggerLine, "-4 C or less");
  assert.equal(cold.detailLine, "Cold · New York");
  assert.equal(cold.windowKey, null); assert.equal(cold.windowLabel, null);
});

test("receipt dates use address matches only, with missing date parts omitted", () => {
  const position = { ...fixturePosition(), cityId: "new-york", triggerValue: 29 };
  const window: QuoteWindow = { address: position.market, city: "new-york", peril: "rain", tenor: "weekly",
    observationStart: Date.UTC(2026, 10, 2) / 1000, observationEnd: Date.UTC(2026, 10, 9) / 1000, salesCloseAt: null };
  assert.equal(receiptModel(position, [window], []).detailLine, "Rain · New York");
  const unknown = receiptModel(position, [{ ...window, address: "other-market" }], [marketQuote("rain", "other-market")]);
  assert.equal(unknown.detailLine, "Rain · New York");
  assert.equal(unknown.windowKey, null); assert.equal(unknown.windowLabel, null);
  const partial = receiptModel(position, [window], [{ ...marketQuote("rain", position.market), windowEnd: "" }]);
  assert.equal(partial.detailLine, "Rain · New York");
  assert.equal(partial.windowEnd, null);
  const missing = receiptModel({ ...position, peril: undefined, triggerValue: undefined }, [], []);
  assert.equal(missing.triggerLine, null);
  assert.equal(missing.windowLabel, null);
});

test("wallet peril filters preserve list order and include every held state in registry order", () => {
  const receipts = [monthlyReceipt("heat"), monthlyReceipt("rain"), monthlyReceipt("wind"), monthlyReceipt("rain", "2026-12-01", "2027-01-01"), monthlyReceipt("snow")];
  receipts[0] = { ...receipts[0], kind: "paid" };
  assert.deepEqual(walletPerils(receipts), ["rain", "snow", "wind", "heat"]);
  assert.equal(walletPerils(receipts).length >= 2, true);
  assert.deepEqual(walletPerils([receipts[1], receipts[3]]), ["rain"]);
  assert.deepEqual(walletPerils([]), []);
  assert.deepEqual(filterReceipts(receipts, "rain"), [receipts[1], receipts[3]]);
  assert.deepEqual(filterReceipts(receipts, "all"), receipts);
  assert.notEqual(filterReceipts(receipts, "all"), receipts);
  assert.deepEqual(filterReceipts(receipts, "cold"), []);
});

test("wallet groups by real bounds, sorts by start and retains unknowns without inventing a label", () => {
  const november = monthlyReceipt("rain");
  const wind = monthlyReceipt("wind");
  const december = monthlyReceipt("heat", "2026-12-01", "2027-01-01");
  const nextYear = monthlyReceipt("rain", "2027-11-01", "2027-12-01");
  const unknown = receiptModel(fixturePosition(), [], []);
  assert.deepEqual(groupReceiptsByWindow([unknown, nextYear, december, november, wind]), [
    { label: "Nov 1 to Dec 1", receipts: [november, wind] },
    { label: "Dec 1 to Jan 1", receipts: [december] },
    { label: "Nov 1 to Dec 1", receipts: [nextYear] },
    { label: null, receipts: [unknown] },
  ]);
  assert.deepEqual(groupReceiptsByWindow([]), []);
  assert.deepEqual(groupReceiptsByWindow([november]), [{ label: "Nov 1 to Dec 1", receipts: [november] }]);
});

test("money display groups exact integer units without rounding or losing signs or fractions", () => {
  const cases = [
    [321_925_850_000n, "321,925.85"], [1_000_000_000n, "1,000.00"], [999_999_999n, "999.99"],
    [-321_925_850_000n, "-321,925.85"], [-1_000_000_000n, "-1,000.00"],
    [1_234_567_890_123n, "1,234,567.89"], [0n, "0.00"],
  ] as const;
  for (const [base, grouped] of cases) {
    assert.equal(formatBaseGrouped(base), grouped);
    assert.equal(grouped.replaceAll(",", ""), formatBase(base));
  }
  assert.equal(formatBaseGrouped(1_234_567_890_123n, 6), "1,234,567.890123");
  assert.equal(formatBaseGrouped(-1_234_567_890_123n, 0), "-1,234,567");
  assert.equal(groupDigits("+1234567.01"), "+1,234,567.01");
  assert.deepEqual(moneyParts(-1_234_567_890_123n), { sign: "-", whole: "1,234,567", fraction: "89" });
  assert.deepEqual(walletBalanceModel(321_925_850_000n), { figure: "321,925.85", unit: "SKYT" });
  assert.deepEqual(walletBalanceModel(null), { figure: null, unit: "SKYT" });
  assert.equal(copy.BALANCE, "Balance");
});

test("receipt displays and open totals group large stored payouts and retain six-decimal precision", () => {
  const position = { ...fixturePosition(), premiumPaid: "1234567890123", potentialPayout: "2234567890123" };
  const receipt = receiptModel(position, [], DISCOVERY_QUOTES, fixtureClaim("paid"));
  assert.equal(receipt.loss, "1,234,567.890123"); assert.equal(receipt.gain, "1,000,000.00");
  assert.equal(receipt.payout, "2,234,567.890123"); assert.equal(receipt.result, "Result +1,000,000.00 SKYT");
  assert.equal(receipt.diagram?.loss, "-1,234,567.890123"); assert.equal(receipt.diagram?.gain, "+1,000,000.00");
  const open = receiptModel(position, [], DISCOVERY_QUOTES, fixtureClaim("open"));
  assert.deepEqual(openCoverTotals([position], [open]), { loss: "1,234,567.890123", gain: "1,000,000.00" });
});

test("wallet captions handle singular and plural and keep the two totals labels", () => {
  assert.equal(copy.totalsCaption(1), "Totals in SKYT across 1 open cover.");
  assert.equal(copy.totalsCaption(4), "Totals in SKYT across 4 open covers.");
  assert.equal(copy.totalsCaption(0), "Totals in SKYT across 0 open covers.");
  assert.equal(copy.LOSS_OPEN, "Max loss, open covers"); assert.equal(copy.GAIN_OPEN, "Max gain, open covers");
  assert.equal(copy.highInYears(10), "10-year high"); assert.equal(copy.highInYears(7), "7-year high");
  assert.equal(copy.highestInYears(7), "7-year high");
  for (const years of [0, -1, 1.5, NaN]) assert.equal(copy.highInYears(years), null);
});

test("retired top-rung wording is absent throughout shared and both renderers", () => {
  const self = fileURLToPath(import.meta.url);
  const root = resolve(dirname(self), "..");
  function scan(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return scan(path);
      return path !== self && [".ts", ".tsx", ".js", ".jsx", ".css"].includes(extname(path))
        && readFileSync(path, "utf8").includes("Highest in") ? [path] : [];
    });
  }
  assert.deepEqual(["shared", "client/src", "mobile/src"].flatMap((directory) => scan(join(root, directory))), []);
});
