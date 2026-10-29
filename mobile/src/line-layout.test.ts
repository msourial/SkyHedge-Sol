import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lineTokens as C } from "../../shared/ui-tokens.ts";
import { NYC_RAIN_MODELLED } from "../../shared/ui-fixtures.ts";
import { instrumentArt } from "../../shared/ui-instrument.ts";
import { buildProtectModel, type ProtectBuildInput } from "../../shared/ui-view.ts";
import { lineCoverage, withCoveredReceipt } from "./line-covered.ts";
import { protectChainRowBottom, protectLayout } from "./line/layout.ts";
import type { ChainProtection } from "./positions.ts";

const input: ProtectBuildInput = { cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: "2026-10-26", windowEnd: "2026-11-02", quote: NYC_RAIN_MODELLED, single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: 69, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false };

test("393x851 layout reserves header and five complete chain rows above the bar", () => {
  assert.equal(protectChainRowBottom(0), 338);
  assert.equal(protectChainRowBottom(5), 618);
  assert.deepEqual(protectLayout.columns, [112, 80, 72, 97]);
  assert.equal(protectLayout.columns.reduce((a, b) => a + b, 0), 393 - 32);
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
  assert.equal(model.yourCover, "Your cover");
  assert.equal(model.chips.length, 0);
  assert.equal(model.readOnly, true);
  assert.ok(model.rows.every((row) => row.inert));
  assert.equal(model.rows.find((row) => row.selected)?.tag, "Your cover");
  assert.ok(selected.marketAddress);
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
