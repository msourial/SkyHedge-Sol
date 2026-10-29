import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sqrtMeasure, payoffGeometry, payoffDomain, payoffLabelBoxes, chanceBarWidth, splitProportion, sparkHeights } from "../../shared/ui-payoff.ts";
import { buildProtectModel, type ProtectBuildInput } from "../../shared/ui-view.ts";
import { NYC_RAIN_OPTION_B } from "../../shared/ui-fixtures.ts";
import { rungEconomics, ticketFromBases } from "../../shared/ui-money.ts";
const input: ProtectBuildInput = { cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: NYC_RAIN_OPTION_B.windowStart, windowEnd: NYC_RAIN_OPTION_B.windowEnd, quote: NYC_RAIN_OPTION_B, single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: null, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < .1, `${actual} ≈ ${expected}`);
test("payoff uses the labelled square-root scale and exact 8dp insets", () => {
  near(sqrtMeasure(2, 40), 73.6); near(sqrtMeasure(6, 40), 127.4); assert.equal(sqrtMeasure(40, 40), 329);
  assert.equal(sqrtMeasure(0, 40), 0); assert.equal(sqrtMeasure(99, 40), 329);
  const d = payoffDomain([{ loss: 47, gain: 53 }, { loss: 24, gain: 76 }]);
  assert.deepEqual(d, { loss: 47, gain: 76 });
  const a = payoffGeometry(2, 40, 47, 53, d), b = payoffGeometry(6, 40, 24, 76, d);
  assert.equal(a.zero, b.zero); assert.equal(a.lossY, 124); assert.equal(b.gainY, 8);
  assert.ok(a.gainY > b.gainY); assert.ok(a.lossY > b.lossY);
});
test("every cover size fixes its vertical domain across real open quote strikes", () => {
  for (const cover of [50, 100, 250] as const) {
    const expected = payoffDomain(NYC_RAIN_OPTION_B.rungs.flatMap(r => { const e = rungEconomics(r, cover), t = e && ticketFromBases(e.premium, e.payout); return t ? [{ loss: Number(t.maxLoss) / 1e6, gain: Number(t.maxGain) / 1e6 }] : []; }));
    for (const rung of NYC_RAIN_OPTION_B.rungs) {
      const model = buildProtectModel({ ...input, cover, selectedTrigger: rung.triggerValue });
      assert.deepEqual(model.payoff?.domain, expected);
      assert.equal(model.payoff?.maximum, 114);
      assert.equal(model.payoff?.openTriggers.length, NYC_RAIN_OPTION_B.rungs.length);
    }
  }
});
test("2mm and 6mm label boxes stay disjoint at sizes 50, 100 and 250", () => {
  for (const cover of [50, 100, 250]) for (const trigger of [2,6]) {
    const domain = { loss: 47 * cover / 100, gain: 76 * cover / 100 };
    const g = payoffGeometry(trigger, 40, (trigger === 2 ? 47 : 24) * cover / 100, (trigger === 2 ? 53 : 76) * cover / 100, domain);
    const labels = payoffLabelBoxes(trigger, 40, [trigger === 2 ? 6 : 2], "mm", "40 mm · 10-year high");
    const boxes = [labels.selected, labels.high, ...labels.ticks];
    for (let i=0; i<boxes.length; i++) for (let j=i+1; j<boxes.length; j++) assert.ok(boxes[i].y !== boxes[j].y || boxes[i].right + 4 < boxes[j].left || boxes[j].right + 4 < boxes[i].left);
    assert.ok(g.x + 24 < 251); assert.ok(labels.selected.y > 132);
  }
});
test("chance bars retain tiny probabilities and clamp to the 64dp track", () => {
  near(chanceBarWidth(.4), 25.6); near(chanceBarWidth(.2), 12.8);
  assert.equal(chanceBarWidth(.01), 2); assert.equal(chanceBarWidth(1), 64); assert.equal(chanceBarWidth(2), 64);
});
test("wallet split uses totals and sparklines share both position scales", () => {
  near(splitProportion(74.15, 325.85), .185375); assert.equal(splitProportion(0,0), 0);
  const domain = payoffDomain([{ loss: 24, gain: 76 }, { loss: 2.15, gain: 97.85 }]);
  assert.deepEqual(sparkHeights(24,97.85,domain), { loss: 8, gain: 13 });
  assert.equal(sparkHeights(2.15,76,domain).loss, 2);
  near(sparkHeights(24,76,domain).gain, 10.097);
});
test("renderer keeps one 640ms geometry/count-up clock, 150ms reduced-motion fade and accessible scale", () => {
  const graphics = readFileSync(new URL("./line/payout-graphics.tsx", import.meta.url), "utf8");
  assert.match(graphics, /duration = lineMotion.fillMs/); assert.match(graphics, /delay: pressDelay/);
  assert.match(graphics, /duration: 150, useNativeDriver: true/); assert.match(graphics, /Square-root horizontal scale/);
  assert.match(graphics, /current.current = next; setFrame\(next\)/);
  const wallet = readFileSync(new URL("./line/WalletLine.tsx", import.meta.url), "utf8");
  assert.match(wallet, /onPress=\{\(\) => setSelected\(r.id\)\}/);
  assert.match(wallet, /onPress=\{onMarkets\}/); assert.match(wallet, /onPress=\{onDisconnect\}/);
  assert.match(wallet, /onPress=\{onRetry\}/); assert.match(wallet, /onPress=\{onConnect\}/);
});
