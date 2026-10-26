import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCOVERY_QUOTES, PREVIEW_NOW, fixtureClaim, fixturePosition } from "./ui-discovery-fixtures.ts";
import { discoveryRequests, loadDiscovery, marketModels, openCoverTotals, receiptModel } from "./ui-discovery.ts";
import { copySamples, forbiddenHits } from "./ui-copy.ts";
import { CITIES, PERILS } from "./peril-registry.ts";

// All values in this module are explicit test fixtures.
test("discovery requires an address, exact premium, valid history and an unexpired sales window", () => {
  const markets = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
  assert.deepEqual(markets.map((m) => m.peril), ["rain", "snow", "wind", "heat"]);
  assert.deepEqual(markets.map((m) => m.loss), ["24.00", "24.00", "24.00", "24.00"]);
  assert.deepEqual(markets.map((m) => m.gain), ["76.00", "76.00", "76.00", "76.00"]);
  assert.equal(markets[0].chance, "20.0%");
  assert.equal(markets[0].multiple, "4.1x");
  for (const q of DISCOVERY_QUOTES) {
    assert.equal(marketModels([{ ...q, rungs: q.rungs.map((r) => ({ ...r, marketAddress: null })) }], PREVIEW_NOW).length, 0);
    assert.equal(marketModels([{ ...q, analogueYears: 0 }], PREVIEW_NOW).length, 0);
    assert.equal(marketModels([{ ...q, peril: "cold" }], PREVIEW_NOW).length, 0);
    assert.equal(marketModels([q], Date.parse(q.salesCloseAt) / 1000).length, 0);
  }
  const edited = { ...DISCOVERY_QUOTES[0], rungs: DISCOVERY_QUOTES[0].rungs.map((r) => ({ ...r, multipleTenths: 999, premiumBase: { ...r.premiumBase, "50": "13500000" } })) };
  assert.equal(marketModels([edited], PREVIEW_NOW, 50)[0].loss, "13.50");
  assert.equal(marketModels([edited], PREVIEW_NOW, 50)[0].gain, "36.50");
  assert.equal(marketModels([edited], PREVIEW_NOW, 50)[0].multiple, "3.7x");
});
test("discovery never requests cold, rejects misrouted replies, distinguishes not-open from failure", async () => {
  const requests = discoveryRequests([], PREVIEW_NOW);
  assert(requests.length > 0);
  assert(requests.every((r) => r.peril !== "cold"));
  const later = discoveryRequests([{ city: "new-york", peril: "snow", tenor: "monthly", address: "fixture-december", observationStart: Date.UTC(2026, 11, 1) / 1000, observationEnd: Date.UTC(2027, 0, 1) / 1000, salesCloseAt: Date.UTC(2026, 11, 1) / 1000 }], PREVIEW_NOW);
  assert(later.some((r) => r.cityId === "new-york" && r.peril === "snow" && r.start === "2026-12-01"));
  const mismatch = await loadDiscovery([], PREVIEW_NOW, async () => ({ ...DISCOVERY_QUOTES[0], cityId: "wrong-city" }));
  assert.deepEqual(mismatch.quotes, []);
  const notOpen = await loadDiscovery([], PREVIEW_NOW, async () => { throw Object.assign(new Error("Not open"), { status: 409 }); });
  assert.equal(notOpen.failed, false);
  const unavailable = await loadDiscovery([], PREVIEW_NOW, async () => { throw new Error("offline"); });
  assert.equal(unavailable.failed, true);
});
test("a ready payout is never labelled Paid out, and missing settlement remains unknown", () => {
  const p = fixturePosition();
  const open = receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim("open"));
  assert.equal(open.kind, "open"); assert.equal(open.loss, "24.00"); assert.equal(open.gain, "76.00");
  const ready = receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim("pending"));
  assert.equal(ready.kind, "pending"); assert.equal(ready.status, "Payout ready to collect"); assert.equal(ready.result, null);
  const paid = receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim("paid"));
  assert.equal(paid.kind, "paid"); assert.equal(paid.status, "Paid out"); assert.equal(paid.result, "Result +76.00 SKYT"); assert.equal(paid.reading, 74);
  const dry = receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim("dry"));
  assert.equal(dry.result, "Result -24.00 SKYT"); assert.equal(dry.reading, 50);
  const unknown = receiptModel({ ...p, peril: undefined, statusLabel: undefined, market: "unknown" }, [], [], null);
  assert.equal(unknown.kind, "unknown"); assert.equal(unknown.peril, null); assert.equal(unknown.trigger, null); assert.equal(unknown.reading, null); assert.equal(unknown.diagram, null);
  const wind = receiptModel(fixturePosition("wind"), [], DISCOVERY_QUOTES, fixtureClaim("paid"));
  assert.equal(wind.reading, null); // Rain-only observation cannot be applied to wind.
  const refund = receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim("refunded"));
  assert.equal(refund.kind, "refunded"); assert.equal(refund.result, "Result 0.00 SKYT");
});
test("open totals sum stored integer amounts and exclude paid, dry and unverified positions", () => {
  const positions = [fixturePosition(), fixturePosition("wind"), fixturePosition("heat")];
  const receipts = positions.map((p, i) => receiptModel(p, [], DISCOVERY_QUOTES, fixtureClaim(i === 2 ? "paid" : "open")));
  assert.deepEqual(openCoverTotals(positions, receipts), { loss: "48.00", gain: "152.00" });
  // Non-default stored premiums must never be replaced by today's quote price.
  const changed = { ...positions[0], premiumPaid: "30000001" };
  const view = receiptModel(changed, [], DISCOVERY_QUOTES, fixtureClaim("open"));
  assert.equal(view.loss, "30.000001"); assert.equal(view.gain, "69.999999");
  assert.deepEqual(openCoverTotals([changed], [view]), { loss: "30.000001", gain: "69.999999" });
  assert.equal(openCoverTotals([], []), null);
});
test("not-open list is registry-driven, with one cold entry and no false open rows", async () => {
  const { unavailableMarkets } = await import("./ui-discovery.ts");
  const all = unavailableMarkets([], "all");
  assert.equal(all.length, (PERILS.length - 1) * CITIES.length + 1);
  assert.equal(all.filter((r) => r.peril === "cold").length, 1);
  const open = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
  assert.equal(unavailableMarkets(open, "wind").some((r) => r.id === "chicago-wind"), false);
  assert.equal(unavailableMarkets(open, "cold")[0].label, "Cold");
  assert.deepEqual(forbiddenHits(copySamples().join("\n")), []);
});

test("native identities match the backend city/peril hash rule", async () => {
  const { marketIdentity } = await import("./ui-market-identity.ts");
  const { perilCityHashHex } = await import("./perils.ts");
  for (const city of CITIES) for (const peril of PERILS) {
    assert.deepEqual(marketIdentity(perilCityHashHex(city.id, peril.id)), { cityId: city.id, peril: peril.id });
  }
  assert.equal(marketIdentity("unknown"), null);
});

test("Markets exposes factual quote data with no wry odds band", () => {
  const markets = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
  for (const market of markets) {
    assert.equal("odds" in market, false);
    assert.equal("band" in market, false);
    assert.equal(market.note, `Chance is from ${market.quote.analogueYears} years of NOAA history, not a forecast.`);
    assert.deepEqual(forbiddenHits(JSON.stringify(market)), []);
  }
});
