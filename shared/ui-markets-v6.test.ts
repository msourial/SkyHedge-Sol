import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCOVERY_QUOTES, PREVIEW_NOW } from "./ui-discovery-fixtures.ts";
import { marketModels, type MarketModel } from "./ui-discovery.ts";
import { featuredCity, leadMarket, moreInCity, elsewhereCards, pendingCards, coldCard, heroSentence, countdown, citySheetRows, marketsPanel, marketsLayout, rankedCities } from "./ui-markets.ts";
import type { QuoteWindow } from "./ui-window-quote.ts";
const base = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
function market(cityId: string, peril: MarketModel["peril"], id: string, close = "2026-11-01T00:00:00Z"): MarketModel {
  const source = base.find((m) => m.peril === peril)!;
  return { ...source, id, cityId, held: false, quote: { ...source.quote, salesCloseAt: close } };
}
const ny = market("new-york", "rain", "ny"), nyLater = market("new-york", "rain", "ny-later", "2026-12-01T00:00:00Z");
const chicago = market("chicago", "snow", "chicago"), desMoines = market("des-moines", "rain", "dsm");
const snowWindow: QuoteWindow = { city: "new-york", peril: "snow", address: "fixture-december", tenor: "monthly", observationStart: Date.UTC(2026, 11, 1) / 1000, observationEnd: Date.UTC(2027, 0, 1) / 1000, salesCloseAt: Date.UTC(2026, 11, 1) / 1000 };
const mixed = [desMoines, chicago, ny, nyLater];
test("New York held (one of two) stays featured and the other market leads", () => {
  const held = mixed.map((m) => ({ ...m, held: m.id === "ny" }));
  assert.equal(featuredCity(held, [], ["ny"], PREVIEW_NOW), "new-york");
  assert.equal(leadMarket("new-york", held)?.id, "ny-later");
  const row = moreInCity("new-york", held, [], PREVIEW_NOW).find((r) => r.id === "ny");
  assert.equal(row?.status, "Covered");
});
test("NY all held uses nearest-closing receipt hero and never changes city", () => {
  const held = mixed.map((m) => ({ ...m, held: m.cityId === "new-york" }));
  assert.equal(featuredCity(held, [], [], PREVIEW_NOW), "new-york");
  const panel = marketsPanel({ cityId: "new-york", markets: held, pending: [], loading: false, failed: false });
  assert.equal(panel.kind, "held-receipt-hero");
  if (panel.kind === "held-receipt-hero") { assert.equal(panel.market.id, "ny"); assert.equal(panel.cta, "View cover"); }
});
test("NY none open opens on Chicago, and Des Moines leads only when it is the only open city", () => {
  assert.equal(featuredCity([desMoines, chicago], [], [], PREVIEW_NOW), "chicago");
  assert.equal(featuredCity([desMoines], [], [], PREVIEW_NOW), "des-moines");
  for (const city of rankedCities.filter((c) => c.id !== "new-york" && c.id !== "des-moines")) assert.equal(featuredCity([desMoines, market(city.id, "rain", city.id)], [], [], PREVIEW_NOW), city.id);
});
test("pending New York keeps the default; nothing open anywhere still selects New York", () => {
  assert.equal(featuredCity([chicago], [snowWindow], [], PREVIEW_NOW), "new-york");
  assert.equal(featuredCity([], [], [], PREVIEW_NOW), "new-york");
  assert.equal(marketsPanel({ cityId: "new-york", markets: [], pending: pendingCards([], [snowWindow], PREVIEW_NOW), loading: false, failed: false }).kind, "city-not-open");
});
test("lead chooses unheld across all perils, then registry peril order, then sales close", () => {
  const rain = { ...ny, held: true }, snow = market("new-york", "snow", "snow");
  assert.equal(leadMarket("new-york", [rain, snow])?.id, "snow");
  assert.equal(leadMarket("new-york", [snow, nyLater])?.id, "ny-later");
  assert.equal(leadMarket("new-york", [nyLater, ny])?.id, "ny");
});
test("card order is consumer rank and peril registry order, independent of chance, dates and held state", () => {
  const wind = market("chicago", "wind", "wind", "2026-10-30T00:00:00Z");
  const heat = market("miami", "heat", "heat");
  const cards = elsewhereCards("new-york", [desMoines, heat, wind, { ...chicago, held: true }]);
  assert.deepEqual(cards.map((c) => c.id), ["chicago-snow", "chicago-wind", "miami-heat", "des-moines-rain"]);
  assert.equal(cards[0].held, true);
});
test("grouped cards use nearest unheld window numeral, count windows, and flag held-only", () => {
  const second = { ...chicago, id: "chicago-later", trigger: 102, windowStart: "2026-12-01", windowEnd: "2027-01-01", quote: { ...chicago.quote, salesCloseAt: "2026-12-01T00:00:00Z" } };
  const [card] = elsewhereCards("new-york", [{ ...chicago, held: true }, second]);
  assert.equal(card.trigger, "102"); assert.equal(card.windowCount, 2); assert.match(card.footer, / · 2 windows$/);
  assert.equal(elsewhereCards("new-york", [{ ...chicago, held: true }, { ...second, held: true }])[0].footer, "Covered");
});
test("pending requires real future evidence, eligible registry pair and no open pair", () => {
  assert.deepEqual(pendingCards([], [], PREVIEW_NOW, []), []);
  assert.deepEqual(pendingCards([], [snowWindow], undefined), []);
  assert.deepEqual(pendingCards([], [{ ...snowWindow, address: "" }], PREVIEW_NOW, []), []);
  assert.deepEqual(pendingCards([], [{ ...snowWindow, peril: "wind" }], PREVIEW_NOW, []), []);
  assert.deepEqual(pendingCards([], [{ ...snowWindow, peril: "cold" }], PREVIEW_NOW, []), []);
  assert.deepEqual(pendingCards([], [snowWindow], snowWindow.observationStart, []), []);
  assert.deepEqual(pendingCards([market("new-york", "snow", "snow")], [snowWindow], PREVIEW_NOW, []), []);
  const [card] = pendingCards([], [snowWindow], PREVIEW_NOW, []);
  assert.equal(card.month, "Dec"); assert.equal(card.status, "Season starts Dec"); assert.equal(card.selection.tenor, "monthly"); assert.ok(!("trigger" in card.selection));
  const registryOnly = pendingCards([], [], PREVIEW_NOW, [{ cityId: "chicago", peril: "snow", open: true, weeklyNotBefore: "2026-11-09" }]);
  assert.equal(registryOnly[0].status, "Not open yet"); assert.equal(registryOnly[0].month, null);
  assert.deepEqual(pendingCards([], [], PREVIEW_NOW, [{ cityId: "new-york", peril: "snow", open: true, months: [12] }]), []);
});
test("rows put open before held; card and row models contain no economics", () => {
  const rows = moreInCity("new-york", [ny, { ...nyLater, held: true }, market("new-york", "snow", "snow")], [], PREVIEW_NOW);
  assert.deepEqual(rows.map((r) => r.id), ["snow", "ny-later"]);
  const models = [...rows, ...elsewhereCards("new-york", mixed), ...pendingCards([], [snowWindow], PREVIEW_NOW), coldCard];
  for (const model of models) assert.doesNotMatch(JSON.stringify(model), /"(?:chance|multiple|loss|maxLoss|gain|quote)"/);
  assert.equal(coldCard.city, "Everywhere"); assert.equal(coldCard.status, "Not available yet"); assert.match(coldCard.explanation, /can't take triggers below zero/);
});
test("countdown covers days, hours, today and seven-day date boundary", () => {
  const now = Date.UTC(2026, 9, 28);
  const at = (hours: number) => new Date(now + hours * 3600000).toISOString();
  assert.equal(countdown(at(72), now), "Closes in 3 days");
  assert.equal(countdown(at(5), now), "Closes in 5 hours");
  assert.equal(countdown(at(.5), now), "Closes today");
  assert.equal(countdown(at(-1), now), "Closes today");
  assert.equal(countdown(at(168), now), "Sales close Nov 4");
});
test("hero sentence uses registry verb and the window end, with wind/heat honesty", () => {
  const rain = { ...ny, station: "Central Park", trigger: 166, quote: { ...ny.quote, windowEnd: "2027-01-01" } };
  assert.equal(heroSentence(rain), "Pays out if Central Park records 166 mm or more by Jan 1.");
  for (const peril of ["wind", "heat"] as const) { const panel = marketsPanel({ cityId: base.find((m) => m.peril === peril)!.cityId, markets: base.filter((m) => m.peril === peril), pending: [], loading: false, failed: false }); assert.ok((panel.kind === "open" || panel.kind === "held-receipt-hero") && panel.honesty); }
});
test("city sheet includes all nine registry cities in consumer order and at most two glyphs", () => {
  const rows = citySheetRows(base, []);
  assert.deepEqual(rows.map((r) => r.id), rankedCities.map((c) => c.id)); assert.equal(rows.length, 9);
  assert.equal(rows.find((r) => r.id === "dallas")?.subtitle, "Nothing open yet");
  assert.ok(rows.every((r) => r.glyphs.length <= 2));
});
test("loading, empty, error and fully populated week share explicit panel models", () => {
  const state = { cityId: "new-york", markets: [] as MarketModel[], pending: [], loading: false, failed: false };
  assert.equal(marketsPanel(state).kind, "empty");
  assert.equal(marketsPanel({ ...state, loading: true }).kind, "loading");
  assert.equal(marketsPanel({ ...state, failed: true, reason: "offline" }).kind, "error");
  assert.equal(marketsPanel({ ...state, markets: base }).kind, "open");
  assert.equal(marketsLayout.hero.height, marketsLayout.hero.top + marketsLayout.hero.content + marketsLayout.hero.beforeStats + marketsLayout.hero.stats + marketsLayout.hero.beforeCta + marketsLayout.hero.cta + marketsLayout.hero.bottom);
  assert.deepEqual([marketsLayout.card.width, marketsLayout.card.height, marketsLayout.row], [174, 224, 64]);
});

test("explicit held sets control the lead and all-held receipt flag without mutating inputs", () => {
  assert.equal(leadMarket("new-york", [ny, nyLater], new Set([ny.id]))?.id, nyLater.id);
  const receipt = leadMarket("new-york", [ny, nyLater], new Set([ny.id, nyLater.id]));
  assert.equal(receipt?.id, ny.id); assert.equal(receipt?.held, true); assert.equal(ny.held, false);
});

test("pending evidence rejects impossible registry dates and non-finite feed dates", () => {
  assert.deepEqual(pendingCards([], [], PREVIEW_NOW, [{ cityId: "chicago", peril: "snow", open: true, weeklyNotBefore: "2026-11-31" }]), []);
  assert.deepEqual(pendingCards([], [{ ...snowWindow, observationEnd: Infinity }], PREVIEW_NOW, []), []);
  assert.deepEqual(pendingCards([], [{ ...snowWindow, salesCloseAt: Infinity }], PREVIEW_NOW, []), []);
});

test("Markets runtime copy contains none of the removed screen strings", () => {
  const pending = pendingCards([], [snowWindow], PREVIEW_NOW);
  const values = [coldCard, ...pending, ...elsewhereCards("new-york", base), ...moreInCity("new-york", base, [snowWindow], PREVIEW_NOW), ...citySheetRows(base), heroSentence(ny), countdown(ny.quote.salesCloseAt, PREVIEW_NOW * 1000)];
  assert.doesNotMatch(JSON.stringify(values), /Opening later|Chance · Multiple|Opening soon|Notify|Opens |\bsoon\b/);
});

test("wind art fits its native reserved columns under uniform scaling", () => {
  assert.ok(112 * marketsLayout.hero.windInstrumentScale <= marketsLayout.hero.instrumentWidth);
  assert.ok(112 * marketsLayout.card.windInstrumentScale <= 44);
});
