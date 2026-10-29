import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { DISCOVERY_QUOTES, PREVIEW_NOW } from "../../shared/ui-discovery-fixtures.ts";
import { marketModels } from "../../shared/ui-discovery.ts";
import { citySheetRows, coldCard, elsewhereCards, featuredCity, marketsV4Layout as L, marketsMotion as M, marketsPanel, moreInCity, pendingCards } from "../../shared/ui-markets.ts";
const screen = readFileSync(new URL("./line/MarketsLine.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const markets = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);

test("393x852 first paint fits the v4 full hero and More title above navigation", () => {
  const hero = 32 + 44 + 16 + 16 + 4 + 66 + 14 + 36 + 14 + 69 + 14 + L.cta + 10 + 32;
  const moreTitleBottom = 28 + L.header + 8 + L.covers + 12 + L.tile + 16 + hero + 28 + 24;
  assert.ok(moreTitleBottom <= 852 - L.tab);
  assert.deepEqual([L.tile, L.row, L.heroAvatar, L.avatar, L.strike, L.cta, L.heroSkeleton], [88, 72, 44, 40, 36, 52, 340]);
  assert.equal(L.dividerInset, 66);
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
  assert.match(screen, /onSelect\(m\)/);
  assert.match(screen, /onPreview\(card.selection\)/);
});

test("city sheet, Cold sheet and error recovery are complete, accessible and registry-backed", () => {
  assert.equal(citySheetRows(markets).length, 9);
  assert.match(screen, /cityRow: \{ height: 72/);
  assert.match(screen, /<Modal transparent visible/);
  assert.match(screen, /onRequestClose=\{onClose\}/);
  assert.match(screen, /accessibilityViewIsModal/);
  assert.match(screen, /accessibilityState=\{\{ selected: city === row.id \}\}/);
  assert.match(screen, /sheet === "cold"/);
  assert.match(screen, /coldCard.explanation/);
  assert.equal(coldCard.city, "Everywhere");
  assert.match(coldCard.explanation, /can't take triggers below zero/);
  assert.match(screen, /copy.MARKETS_ERROR/);
  assert.match(screen, /copy.RETRY/);
});

test("Markets uses v4 tiles and token rows without instruments, card grid or extra yellow", () => {
  assert.doesNotMatch(screen, /MarketInstrument|instrumentArt|LineArt|F.heading|F.mono|s.grid|function Card\(/);
  assert.doesNotMatch(screen, /Opening later|Chance · Multiple|Opening soon|Notify|Opens |\bsoon\b/);
  assert.equal((screen.match(/C\.slicker/g) ?? []).length, 1);
  assert.match(screen, /heroNumeral:.*color: C.slicker/);
  const row = screen.slice(screen.indexOf('function MarketRow('), screen.indexOf('function Hero('));
  assert.doesNotMatch(row, /\.chance|\.multiple|\.loss|MAX_LOSS|CHANCE|MULTIPLE/);
  assert.match(row, /copy.CLOSES_WORD/);
  assert.match(row, /copy.COVERED_WORD/);
  const avatar = readFileSync(new URL('./line/PerilAvatar.tsx', import.meta.url), 'utf8');
  assert.match(avatar, /phosphor-react-native/);
  for (const glyph of ['CloudRain', 'Snowflake', 'Wind', 'Sun', 'ThermometerSimple']) assert.ok(avatar.includes(glyph));
  assert.match(avatar, /weight="bold"/);
  assert.doesNotMatch(avatar, /<Path|<Svg/);
  assert.match(avatar, /32: 18, 36: 20, 40: 22, 44: 24/);
  assert.doesNotMatch(app, /tabTick|tabIndicator/);
  assert.match(app, /tabLabel:.*lineTokens.dryText.*F.bodySemi.*fontSize: 13/);
  const tabs = readFileSync(new URL('./line/TabGlyph.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tabs, /stroke=|fill="none"/);
});

test("type and control sizes clear the Line minimum across native Line sources", () => {
  const dir = new URL("./line/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => /\.tsx$/.test(n))) {
    const source = readFileSync(new URL(name, dir), "utf8");
    for (const match of source.matchAll(/fontSize[:=]\s*\{?(\d+)/g)) assert.ok(Number(match[1]) >= 13, `${name}: ${match[0]}`);
    assert.doesNotMatch(source, /opacity:\s*0(?:\.\d+)?\b/);
  }
  assert.ok(L.target >= 48); assert.ok(L.row >= 48); assert.ok(L.header >= 48); assert.ok(L.cta >= 48); assert.ok(L.tile >= 48);
  assert.match(screen, /cityTarget: \{ minHeight: L.target, minWidth: L.target/);
  assert.match(screen, /row: \{ height: L.row, minHeight: L.target/);
});

test("motion honors reduced motion, press springs and exact loading geometry", () => {
  assert.deepEqual([M.pressScale, M.pressIn, M.pressOut, M.numeral, M.stagger, M.city], [.96, 150, 150, 240, 30, 200]);
  assert.match(screen, /if \(reduced \|\| !enabled\)/);
  assert.match(screen, /useNativeDriver: true/);
  assert.match(screen, /duration: 1200/);
  assert.match(screen, /rgba\(242,245,248,0.06\)/);
  assert.match(screen, /heroSkeleton:.*height: L.heroSkeleton/);
  assert.match(screen, /rowSkeleton: \{ height: L.row/);
  assert.doesNotMatch(screen, /ActivityIndicator/);
  const press = readFileSync(new URL('./line/pressable.tsx', import.meta.url), 'utf8');
  assert.match(press, /lineMotion.pressScale/); assert.match(press, /Animated.spring/);
  assert.match(press, /lineMotion.springDamping/); assert.match(press, /lineMotion.springStiffness/);
  const discovery = readFileSync(new URL('./line/use-discovery.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(discovery, /setState\(\{ quotes: \[\], loading: true/);
});

test("Cold tile and Coming up row both open the existing explanation sheet", () => {
  assert.match(screen, /const action = perilTileAction\(filter, peril\)/);
  assert.match(screen, /if \(action.sheet\) setSheet\(action.sheet\)/);
  assert.match(screen, /<MarketRow peril="cold".*onPress=\{\(\) => setSheet\("cold"\)\}/);
  assert.match(screen, /sheet === "cold".*coldCard.explanation/);
  assert.match(screen, /const city = selectedCity \?\? "new-york"/);
});
