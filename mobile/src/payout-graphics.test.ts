import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sqrtMeasure, payoffPlot, payoffChartMaximum, payoffAnnotationBoxes, payoffGeometry, payoffDomain, payoffLabelBoxes, chanceBarWidth, splitProportion, sparkHeights } from "../../shared/ui-payoff.ts";
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

type Box = { left: number; right: number; top: number; bottom: number };
const separated = (a: Box, b: Box, gap = 4) => a.right + gap <= b.left || b.right + gap <= a.left || a.bottom + gap <= b.top || b.bottom + gap <= a.top;

test("step domains reserve visible gain width, including a cover's only or highest rung", () => {
  for (const trigger of [0, .000001, 2, 69, 100, 1e9]) {
    for (const rungs of [[trigger], [2, 6, trigger], [trigger, trigger]]) {
      const maximum = payoffChartMaximum(trigger, 0, rungs);
      const g = payoffGeometry(trigger, maximum, 24, 76, { loss: 24, gain: 76 });
      assert.ok(maximum > trigger);
      assert.ok(329 - g.x >= 329 / 3 - 1e-9);
      if (trigger > 0) assert.ok(g.x > 0);
      assert.ok(g.gainY < g.zero && g.lossY > g.zero);
      assert.equal(payoffChartMaximum(trigger, maximum, rungs), maximum);
    }
  }
  const maximum = payoffChartMaximum(69, 0, [69]);
  assert.equal(maximum, 155.25);
  near(payoffGeometry(69, maximum, 24, 76, { loss: 24, gain: 76 }).x, 329 * 2 / 3);
  // Protect keeps one horizontal domain when switching among open strikes.
  const models = NYC_RAIN_OPTION_B.rungs.map(r => buildProtectModel({ ...input, selectedTrigger: r.triggerValue }));
  assert.equal(new Set(models.map(m => payoffChartMaximum(m.selected!, m.payoff!.maximum, m.payoff!.openTriggers))).size, 1);
});

test("value rectangles avoid each other, all band edges, trigger and axis rows at any ratio", () => {
  for (const [loss, gain] of [[.000001, 1e9], [1e9, .000001], [0, 100], [100, 0], [0, 0], [24, 76], [50, 50]]) {
    for (const trigger of [-20, 0, .001, 2, 69, 99.999, 100, 1e9]) {
      for (const size of [.01, 1, 250]) {
        const maximum = payoffChartMaximum(trigger, 100, [0, .001, 2, 69, 99.999, 100]);
        const g = payoffGeometry(trigger, maximum, loss * size, gain * size, { loss: loss * size, gain: gain * size });
        const boxes = payoffAnnotationBoxes();
        const axis = payoffLabelBoxes(trigger, maximum, [0, .001, 2, 69, 99.999, 100], "mm", "100 mm", 100);
        const offset = payoffPlot.annotationHeight;
        const axes = [axis.selected, axis.high, ...axis.ticks].filter(b => b.label).map(b => ({ ...b, top: b.top + offset, bottom: b.bottom + offset }));
        const bands = [
          { left: 0, right: g.x, top: g.zero + offset, bottom: g.lossY + offset },
          { left: g.x, right: 329, top: g.gainY + offset, bottom: g.zero + offset },
          { left: 0, right: g.x, top: g.lossY - 3 + offset, bottom: g.lossY + offset },
          { left: g.x, right: 329, top: g.gainY + offset, bottom: g.gainY + 3 + offset },
          { left: g.x - 1.5, right: g.x + 1.5, top: 2 + offset, bottom: 136 + offset },
        ];
        const labels = [boxes.gain, boxes.loss, ...axes];
        for (let i = 0; i < labels.length; i++) {
          const box = labels[i];
          assert.ok(box.left >= 0 && box.right <= 329);
          for (const band of bands) assert.ok(separated(box, band, 0), JSON.stringify({ box, band }));
          for (let j = i + 1; j < labels.length; j++) assert.ok(separated(box, labels[j]));
        }
        for (const box of [boxes.gain, boxes.loss]) assert.ok(box.bottom + 8 <= offset);
      }
    }
  }
});

test("maximum trigger is rendered once, with any high tag retained separately", () => {
  const labels = payoffLabelBoxes(69, 69, [69, 69], "mm", "69 mm");
  assert.equal(labels.selected.label, "69 mm");
  assert.equal(labels.high.label, "");
  assert.deepEqual(labels.ticks, []);
  assert.equal(payoffLabelBoxes(69, 69, [], "mm", "69 mm · 10-year high").high.label, "10-year high");
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
