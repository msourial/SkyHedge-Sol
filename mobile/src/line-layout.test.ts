import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lineTokens as C } from "../../shared/ui-tokens.ts";
import { NYC_RAIN_MODELLED } from "../../shared/ui-fixtures.ts";
import { instrumentArt } from "../../shared/ui-instrument.ts";
import { buildProtectModel, scrollBottomPadding, type ProtectBuildInput } from "../../shared/ui-view.ts";
import { marketModels } from "../../shared/ui-discovery.ts";
import { leadMarket, featuredCity, marketsLayout } from "../../shared/ui-markets.ts";
import { lineCoverage, withCoveredReceipt } from "./line-covered.ts";
import { protectChainRowBottom, protectLayout } from "./line/layout.ts";
import type { ChainProtection } from "./positions.ts";

const input: ProtectBuildInput = { cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: "2026-10-26", windowEnd: "2026-11-02", quote: NYC_RAIN_MODELLED, single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: 69, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false };

test("393x851 layout reserves header and five complete chain rows above the bar", () => {
  assert.equal(protectChainRowBottom(0), 338);
  assert.equal(protectChainRowBottom(5), 618);
  assert.deepEqual(protectLayout.columns, [140, 63, 62, 80]);
  assert.equal(protectLayout.columns.reduce((a, b) => a + b, 0) + 16, 393 - 32);
  assert.ok(protectLayout.columns[2] >= 62 && protectLayout.columns[3] >= 60);
  // A 24dp status inset and 24dp gesture inset with 64dp tabs leave 651dp.
  const viewport = 851 - 24 - 24 - 64 - protectLayout.bar;
  assert.ok(protectChainRowBottom(5) <= viewport);
  assert.ok(protectChainRowBottom(6) > viewport);
  const screen = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  assert.match(screen, /head: \{ height: L.header/);
  assert.match(screen, /hero: \{ height: L.hero, marginTop: L.heroGap/);
  assert.match(screen, /chainHead: \{ height: L.chainHeader/);
  assert.match(screen, /row: \{ height: L.chainRow/);
  assert.match(screen, /readout: \{ marginLeft: L.readoutX - L.margin/);
  assert.doesNotMatch(screen, /model.odds|styles.rule/);
});

test("hero art stays before the numeral, with real rung ticks and no small labels", () => {
  const art = instrumentArt({ peril: "rain", rungs: [80, 102, 194], selected: 102, reading: null, state: "idle", size: "hero", unit: "mm" });
  assert.ok(art.lineEndX <= protectLayout.lineEndX);
  assert.ok(art.lineEndX < protectLayout.readoutX);
  const capsule = art.ops.find((op) => op.op === "rect" && op.stroke === C.tick);
  assert.ok(capsule && capsule.op === "rect" && capsule.w === 56 && capsule.h === 136);
  const line = art.ops.find((op) => op.op === "line" && op.stroke === C.slicker);
  assert.ok(line && line.op === "line" && line.x1 === 8 && line.x2 === 96);
  for (const op of art.ops) if (op.op === "text") assert.ok(op.size >= 13);
  for (const name of ["ProtectLine.tsx", "SignSheet.tsx", "art.tsx"]) {
    const source = readFileSync(new URL(`./line/${name}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/fontSize[:=]\s*\{?(\d+)/g)) assert.ok(Number(match[1]) >= 13, name);
  }
});

test("modelled rows are inert, dry, labelled Not open; selection has a tick", () => {
  const model = buildProtectModel(input);
  assert.ok(model.showChain);
  assert.equal(model.header[0], "Trigger (mm)");
  assert.equal(model.hero?.soFar, null);
  assert.equal(model.hero?.numeral, "69");
  assert.ok(model.footnotes.length === 2);
  for (const row of model.rows.filter((r) => r.kind === "modelled")) {
    assert.equal(row.inert, true);
    assert.equal(row.maxLoss, "Not open");
    assert.equal(row.selected, false);
  }
  const source = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  assert.match(source, /disabled=\{row.inert\}/);
  assert.match(source, /!row.open && styles.dry/);
  assert.match(source, /row.selected \? <View style=\{styles.rowTick\}/);
  assert.match(source, /<Payoff diagram=\{model.ticket.payoff\}/);
  assert.equal((source.match(/<SvgText /g) ?? []).length, 3);
});

test("selected rung position produces read-only COVERED even if the legacy window differs", () => {
  const selected = NYC_RAIN_MODELLED.rungs.find((rung) => rung.triggerValue === 69)!;
  const quote = { ...NYC_RAIN_MODELLED, rungs: NYC_RAIN_MODELLED.rungs.map((rung) => rung.triggerValue === 69 ? { ...rung, marketAddress: "selected-market" } : rung) };
  const held = lineCoverage({ quote, selectedTrigger: 69, coveredMarket: "different-legacy-window", positions: [{ market: "selected-market", protectedAmount: "50000000" } as ChainProtection] });
  assert.equal(held.coveredMarket, "selected-market");
  assert.equal(held.cover, 50);
  const model = buildProtectModel({ ...input, quote, coveredMarket: held.coveredMarket, cover: held.cover! });
  assert.equal(model.panel.kind, "covered");
  assert.equal(model.yourCover, null);
  assert.equal(model.showBar, false);
  assert.deepEqual(model.coveredRow, { label: "Covered", action: "View in Wallet" });
  assert.equal(model.chips.length, 0);
  assert.equal(model.readOnly, true);
  assert.equal(scrollBottomPadding(model), 16);
  assert.ok(model.rows.every((row) => row.inert));
  assert.equal(model.rows.find((row) => row.selected)?.tag, "Your cover");
  assert.ok(selected.marketAddress);
  const source = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  assert.match(source, /model\.coveredRow \? <View style=\{styles\.coveredRow\}/);
  assert.doesNotMatch(source, /panel\.kind === "covered"\) return <View style=\{styles\.receipt\}/);
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /line\.model\.showBar/);
  assert.match(app, /scrollBottomPadding\(line\.model\)/);
});

test("every non-covered Protect state reserves the 88dp bar and 16dp clearance", () => {
  for (const kind of ["ready", "connect", "loading", "signing", "error", "closed", "paid", "dry"] as const) {
    assert.equal(scrollBottomPadding(kind), 104, kind);
  }
  assert.equal(scrollBottomPadding("covered"), 16);
});

test("Markets keeps the featured city and uses a receipt hero only when its open markets are all held", () => {
  const now = Math.floor(Date.parse("2026-10-26T00:00:00Z") / 1000) - 1;
  const markets = marketModels([NYC_RAIN_MODELLED], now, 100, ["fixture-69"]);
  assert.equal(featuredCity(markets, [], undefined, now), "new-york");
  assert.equal(leadMarket("new-york", markets)?.held, true);
  const unheld = { ...markets[0], id: "second-window", held: false };
  assert.equal(leadMarket("new-york", [...markets, unheld])?.id, unheld.id);
  const screen = readFileSync(new URL("./line/MarketsLine.tsx", import.meta.url), "utf8");
  assert.match(screen, /featuredCity\(markets, quoteWindows/);
  assert.match(screen, /marketsPanel\(/);
  assert.doesNotMatch(screen, /orderMarkets|pickHero|<Filter/);
});

test("Markets loading and loaded use the same shared hero/card geometry; Protect dry copy stays regular 13px", () => {
  const markets = readFileSync(new URL("./line/MarketsLine.tsx", import.meta.url), "utf8");
  const protect = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  assert.equal(marketsLayout.hero.height, 336);
  assert.equal(marketsLayout.hero.cta, 56);
  assert.match(markets, /hero: \{ height: L.hero.height/);
  assert.match(markets, /cardShell: \{ height: L.card.height/);
  assert.match(markets, /card: \{ height: L.card.height/);
  assert.match(markets, /disabled=\{!m\}/);
  assert.doesNotMatch(markets, /unavailableToggle|perilDot|ctaReserved/);
  assert.match(protect, /value === "Not open" \? styles\.notOpenDry/);
  assert.match(protect, /notOpenDry: \{ color: C\.fg2, fontFamily: F\.body, fontSize: 13/);
  assert.match(protect, /index === 2 \? \{ marginRight: 16 \}/);
});

test("mobile line screens keep required copy and type sizes", async () => {
  const discovery = readFileSync(new URL("./line/Discovery.tsx", import.meta.url), "utf8");
  const protect = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(`${discovery}\n${protect}`, new RegExp("Highest" + " in"));
  assert.match(protect, /row\.tag \? <Text numberOfLines=\{1\} style=\{styles\.rowTag\}/);
  assert.equal((protect.match(/<Text numberOfLines=\{1\} style=\{styles\.rowTag\}>\{row\.tag\}<\/Text>/g) ?? []).length, 1);
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /marketModels\(discovery\.quotes, nowSeconds, 100, storedCovers\.map/);
  const fs = await import("node:fs");
  const dir = new URL("./line/", import.meta.url);
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".tsx"))) {
    const source = fs.readFileSync(new URL(`./line/${name}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/fontSize:\s*(\d+)/g)) assert.ok(Number(match[1]) >= 13, `${name}: ${match[0]}`);
    assert.doesNotMatch(source, new RegExp("Highest" + " in"));
  }
});

test("not-open selections have a panel without a hero or chain", () => {
  const model = buildProtectModel({ ...input, peril: "cold" });
  assert.equal(model.panel.kind, "not-open");
  assert.equal(model.hero, null);
  assert.equal(model.showChain, false);
  assert.equal(model.ticket, null);
});

function contrast(fg: string, bg: string) {
  const luminance = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
test("small text meets contrast on the surface where it is used", () => {
  for (const bg of [C.bg, C.surface1, C.bgRaised]) {
    assert.ok(contrast(C.fg, bg) >= 4.5);
    assert.ok(contrast(C.fg2, bg) >= 4.5);
  }
  assert.ok(contrast(C.dryText, C.bg) >= 4.5); // MODELLED rows stay on the canvas.
  assert.ok(contrast(C.onGlacier, C.glacier) >= 4.5);
});

// Legacy covers can be any integer amount; receipt figures must not default to 100 SKYT.
test("covered receipt keeps the exact held amounts, including legacy cover sizes", () => {
  const market = NYC_RAIN_MODELLED.rungs.find((rung) => rung.marketAddress)!.marketAddress!;
  const model = buildProtectModel({ ...input, coveredMarket: market });
  const position = { market, protectedAmount: "75000000", premiumPaid: "18000000", potentialPayout: "75000000" } as ChainProtection;
  const covered = withCoveredReceipt(model, position, input.windowEnd, 10);
  assert.equal(covered.ticket?.loss.whole, "18");
  assert.equal(covered.ticket?.gain.whole, "57");
  assert.equal(covered.ticket?.payout, "75.00");
  assert.equal(covered.ticket?.fee, "0.75");
  assert.equal(covered.payoff?.lossBase, "18000000");
  assert.equal(covered.payoff?.gainBase, "57000000");
  assert.match(covered.ticket!.sentence, /75.00 SKYT/);
  assert.match(covered.ticket!.sheet!, /0.75/);
  assert.match(covered.payoff!.description, /18.00/);
  assert.equal(covered.panel.kind === "covered" && covered.panel.gain.whole, "57");
});
