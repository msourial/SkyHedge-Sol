import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { DISCOVERY_QUOTES, PREVIEW_NOW } from "../../shared/ui-discovery-fixtures.ts";
import { marketModels } from "../../shared/ui-discovery.ts";
import { citySheetRows, coldCard, elsewhereCards, featuredCity, marketsLayout as L, marketsMotion as M, marketsPanel, moreInCity, pendingCards } from "../../shared/ui-markets.ts";
const screen = readFileSync(new URL("./line/MarketsLine.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const markets = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);

test("393x852 first paint fits the New York hero and Covered row above navigation", () => {
  const header = 28 + L.header, covers = 64, hero = L.hero.height;
  const firstRowBottom = header + covers + hero + L.zone.above + L.zone.lineHeight + L.zone.below + L.row;
  assert.equal(firstRowBottom, 598);
  assert.ok(firstRowBottom < 852 - 64 - 24);
  assert.equal(L.hero.beforeCta, 16); assert.equal(L.hero.bottom, 24);
  assert.equal(L.hero.textX, L.margin + L.hero.instrumentWidth + 16);
  assert.ok(L.hero.lineEnd < L.hero.textX);
  assert.ok(L.card.width * 2 + L.card.gap + L.margin * 2 <= 393);
});

test("fixture matrix covers loading, mixed, held, fallback, pending-only, error and all perils", () => {
  const rain = markets[0], second = { ...rain, id: "second-ny", trigger: 166 };
  const held = { ...rain, held: true };
  const state = (data = markets, loading = false, failed = false) => marketsPanel({ cityId: featuredCity(data, [], undefined, PREVIEW_NOW), markets: data, pending: [], loading, failed });
  assert.equal(state([], true).kind, "loading");
  assert.equal(state(markets).kind, "open");
  const mixed = [held, second, ...markets.slice(1)];
  const selected = state(mixed);
  assert.equal(selected.kind, "open");
  if (selected.kind === "open") assert.equal(selected.market.id, second.id);
  assert.equal(moreInCity("new-york", mixed, [], PREVIEW_NOW)[0].status, "Covered");
  assert.equal(state([held, ...markets.slice(1)]).kind, "held-receipt-hero");
  assert.equal(featuredCity(markets.slice(1), [], undefined, PREVIEW_NOW), "chicago");
  assert.equal(state([]).kind, "empty");
  assert.equal(state([], false, true).kind, "error");
  assert.deepEqual(new Set(markets.map((m) => m.peril)), new Set(["rain", "snow", "wind", "heat"]));
  const allHeld = markets.map((m) => ({ ...m, held: true }));
  assert.equal(state(allHeld).kind, "held-receipt-hero");
  assert.ok(elsewhereCards("new-york", allHeld).every((card) => card.footer === "Covered"));
  const pending = pendingCards([], [], PREVIEW_NOW);
  assert.equal(marketsPanel({ cityId: "new-york", markets: [], pending, loading: false, failed: false }).kind, "city-not-open");
});

test("Markets navigation uses existing Protect setters with no trigger and remembers the city only in App state", () => {
  assert.match(app, /selectedMarketsCity, setSelectedMarketsCity\] = useState<string \| null>\(null\)/);
  const path = app.slice(app.indexOf('onPreview={(preview)'));
  const callback = path.slice(0, path.indexOf('onWallet='));
  for (const setter of ["setSelectedCity(preview.cityId)", "line.setPeril(preview.peril)", "line.setTenor(preview.tenor)", 'setTab("protect")']) assert.ok(callback.includes(setter), setter);
  assert.doesNotMatch(callback, /chooseMarket|trigger:/);
  assert.match(app, /selectedCity=\{selectedMarketsCity\} onCity=\{setSelectedMarketsCity\}/);
  assert.doesNotMatch(app, /(?:AsyncStorage|SecureStore).*selectedMarketsCity|selectedMarketsCity.*(?:AsyncStorage|SecureStore)/);
  assert.match(screen, /onSelect\(card.selection\)/);
  assert.match(screen, /onPreview\(card.selection\)/);
  assert.match(screen, /onPress=\{onRetry\}/);
  assert.match(screen, /onSelect\(row.selection\)/);
  assert.match(screen, /onPreview\(row.selection\)/);
});

test("city sheet, Cold sheet and error recovery are complete, accessible and registry-backed", () => {
  assert.equal(citySheetRows(markets).length, 9);
  assert.equal(L.cityRow, 72);
  assert.match(screen, /<Modal transparent visible/);
  assert.match(screen, /onRequestClose=\{onClose\}/);
  assert.match(screen, /accessibilityViewIsModal/);
  assert.match(screen, /accessibilityState=\{\{ selected: city === row.id \}\}/);
  assert.match(screen, /sheet === "cold"/);
  assert.match(screen, /coldCard.explanation/);
  assert.equal(coldCard.city, "Everywhere");
  assert.match(coldCard.explanation, /can't take triggers below zero/);
  assert.match(screen, /copy.MARKETS_PARTIAL/);
  assert.match(screen, /panel.reason/);
});

test("Markets removes the peril filter, unavailable list, row economics and obsolete copy", () => {
  assert.doesNotMatch(screen, /<Filter|unavailableMarkets|notOpenMarkets|CHANCE_MULTIPLE/);
  assert.doesNotMatch(screen, /Opening later|Chance · Multiple|Opening soon|Notify|Opens |\bsoon\b/);
  const rows = screen.slice(screen.indexOf('{rows.length'), screen.indexOf('{cards.length'));
  const cards = screen.slice(screen.indexOf('function Card('), screen.indexOf('export function MarketsLine('));
  for (const part of [rows, cards]) assert.doesNotMatch(part, /\.chance|\.multiple|\.loss|MAX_LOSS|CHANCE|MULTIPLE/);
});

test("type and control sizes clear the Line minimum across native Line sources", () => {
  const dir = new URL("./line/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => /\.tsx$/.test(n))) {
    const source = readFileSync(new URL(name, dir), "utf8");
    for (const match of source.matchAll(/fontSize[:=]\s*\{?(\d+)/g)) assert.ok(Number(match[1]) >= 13, `${name}: ${match[0]}`);
    assert.doesNotMatch(source, /opacity:\s*0(?:\.\d+)?\b/);
  }
  assert.ok(L.target >= 48); assert.ok(L.row >= 48); assert.ok(L.header >= 48); assert.ok(L.hero.cta >= 48); assert.ok(L.card.height >= 48);
  assert.match(screen, /cityButton: \{ minHeight: L.target, minWidth: L.target/);
  assert.match(screen, /row: \{ height: L.row, minHeight: L.target/);
});

test("motion stays on transform and opacity, honors reduced motion and reserves equal loading geometry", () => {
  assert.equal(M.pressScale, .98); assert.equal(M.pressIn, 90); assert.equal(M.pressOut, 140);
  assert.deepEqual([M.heroLine, M.numeral, M.card, M.stagger, M.maxSteps, M.cardLine, M.city], [420, 160, 200, 40, 6, 320, 160]);
  assert.match(screen, /duration: reduced \? 0 : duration/);
  assert.match(screen, /useNativeDriver: true/);
  assert.match(screen, /if \(!live\) return/);
  assert.match(screen, /60000/);
  assert.match(screen, /card: \{ height: L.card.height/);
  assert.match(screen, /cardShell: \{ height: L.card.height/);
  assert.match(screen, /hero: \{ height: L.hero.height/);
  const discovery = readFileSync(new URL("./line/use-discovery.ts", import.meta.url), "utf8");
  assert.doesNotMatch(discovery, /setState\(\{ quotes: \[\], loading: true/);
});
