/** Render the actual RN component against test host primitives; this is not a device screenshot. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { build } from "esbuild";
import { buildProtectModel } from "../../shared/ui-view.ts";
import { NYC_RAIN_MODELLED } from "../../shared/ui-fixtures.ts";
import { DISCOVERY_QUOTES } from "../../shared/ui-discovery-fixtures.ts";
import { receiptModel, type ReceiptModel } from "../../shared/ui-discovery.ts";

const rootRequire = createRequire(new URL("../../package.json", import.meta.url));
const React = rootRequire("react");
const { renderToStaticMarkup } = rootRequire("react-dom/server");
const host = `
  import React from "react";
  function words(child) { return Array.isArray(child) ? child.map(words).join(' ') : React.isValidElement(child) ? words(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : ''; }
  function node(tag, props) {
    globalThis.__walletNodes?.push({ tag, ...props });
    if (props.onPress && !props.disabled) globalThis.__marketPresses?.push({ label: props.accessibilityLabel ?? words(props.children), press: props.onPress });
    const { children, style, accessibilityRole: role, accessibilityLabel, disabled } = props;
    return React.createElement(tag, { role, disabled, 'aria-label': accessibilityLabel, 'data-style': JSON.stringify(style) }, children);
  }
  export const View = p => node('div', p), Text = p => node('span', p), Pressable = p => node('button', p), ScrollView = p => node('section', p), Modal = p => node('dialog', p);
  export const Platform = { OS: "android" }, Clipboard = { setString() {} };
  export const AppState = { addEventListener: () => ({remove() {}}) };
  export const Linking = { openURL: async () => {} };
  export const StyleSheet = { create: v => v, absoluteFill: {}, absoluteFillObject: {} };
  class Value { constructor(v) { this.value = v; } setValue(v) { this.value = v; } stopAnimation() {} interpolate({outputRange}) { return outputRange.at(-1); } toJSON() { return this.value; } }
  export const Vibration = { vibrate() {} };
  export const AccessibilityInfo = { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove() {} }), announceForAccessibility() {} };
  export const Animated = { Value, View, Text, createAnimatedComponent: c => c, timing: () => ({ start() {}, stop() {} }), spring: () => ({ start() {}, stop() {} }), multiply: () => 0 };
  export const Easing = { bezier: () => null, out: () => null, cubic: null };
  export const useWindowDimensions = () => ({ width: 393, height: 852 });
`;
let PurchaseReceipt: any, ForecastBlock: any, EdgeChip: any, HowPayout: any, CoverGauge: any, CoverDetail: any, ProtectBody: any;
before(async () => {
const result = await build({
  stdin: { contents: 'export { PurchaseReceipt } from "./line/PurchaseReceipt.tsx"; export { ForecastBlock, EdgeChip } from "./line/ForecastBlock.tsx"; export { HowPayout } from "./line/HowPayout.tsx"; export { CoverGauge } from "./line/CoverGauge.tsx"; export { CoverDetail } from "./line/CoverDetail.tsx"; export { ProtectBody } from "./line/ProtectLine.tsx";', resolveDir: new URL("./", import.meta.url).pathname }, bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "native-test-host", setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
    builder.onResolve({ filter: /multiple-tip-store(?:\.ts)?$/ }, () => ({ path: "store", namespace: "host" }));
    builder.onResolve({ filter: /^react-native$/ }, () => ({ path: "native", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: "svg", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: "safe", namespace: "host" }));
    builder.onResolve({ filter: /liquid-glass(?:\.tsx)?$/ }, () => ({ path: "motion", namespace: "host" }));
    builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({ contents: path === "store" ? "export const multipleTipStorage = { getItem: async () => null, setItem: async () => {} };" : path === "native" ? host : path === "safe" ? 'export const useSafeAreaInsets = () => ({top:28, bottom:24});' : path === "motion" ? 'export const useReducedMotion = () => true;' : `import React from 'react'; const tag = name => ({children, accessible, ...props}) => React.createElement(name, props, children); export default tag('svg'); export const G=tag('g'), Path=tag('path'), Line=tag('line'), Rect=tag('rect'), Circle=tag('circle'), Text=tag('text');` }));
  } }],
});
const module = { exports: {} as any };
new Function("require", "module", "exports", result.outputFiles[0].text)(rootRequire, module, module.exports);
({ PurchaseReceipt, ForecastBlock, EdgeChip, HowPayout, CoverGauge, CoverDetail, ProtectBody } = module.exports);
});

const noop = () => {};
const render = (component: any, props: any) => renderToStaticMarkup(React.createElement(component, props));
const ticket = buildProtectModel({ cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: NYC_RAIN_MODELLED.windowStart, windowEnd: NYC_RAIN_MODELLED.windowEnd, quote: NYC_RAIN_MODELLED, single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: null, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false }).ticket!;
const review = { target: { market: "market", amount: "100000000", premiumBase: "47000000", salesCloseAt: "2026-11-02" }, ticket: { ...ticket, payout: "100.00" }, wallet: "wallet", context: { premiumBase: "47000000", balanceBase: null, cityName: "New York", peril: "rain", triggerLabel: "2 mm or more", windowLabel: "Nov 2 to Nov 9" } };
test("actual purchase receipt renders frozen amounts, buttons and real explorer action", () => {
  const presses: any[] = []; (globalThis as any).__marketPresses = presses;
  try {
    const html = render(PurchaseReceipt, { review, state: "success", signature: "actual-signature-1234", onDone: noop, onWallet: noop, onRetry: noop, reducedMotion: true });
    assert.match(html, /You&#x27;re covered/); assert.match(html, /47.00 SKYT/); assert.match(html, /100.00 SKYT/);
    assert.ok(presses.some(p => p.label.includes("View transaction"))); assert.ok(presses.some(p => p.label === "View in Wallet"));
    assert.doesNotMatch(html, /automatic/i);
  } finally { delete (globalThis as any).__marketPresses; }
});
test("actual pending, timeout, failure and rejection receipts render distinct honest copy", () => {
  for (const [state, title] of [["pending", "Confirming on Devnet"], ["still_confirming", "Still confirming"], ["failed", "Cover not bought"], ["cancelled", "Cancelled in Phantom"]]) {
    const html = render(PurchaseReceipt, { review, state, reason: "Position opening window closed (6012)", onDone: noop, onWallet: noop, onRetry: noop });
    assert.match(html, new RegExp(title)); assert.doesNotMatch(html, /nothing was charged/i);
    if (state === "pending") assert.match(html, /disabled/);
    if (state === "cancelled") assert.doesNotMatch(html, /6012/);
  }
});
test("actual forecast components disappear on null and label both sources when present", () => {
  const edge = { historyProbability: .2, forecast: null };
  assert.equal(render(ForecastBlock, { edge, condition: "6 mm or more" }), "");
  assert.equal(render(EdgeChip, { edge }), "");
  edge.forecast = { probability: .45 } as any;
  const html = render(ForecastBlock, { edge, condition: "6 mm or more" });
  assert.match(html, /Forecast/); assert.match(html, /History/); assert.match(html, /45/); assert.match(html, /20.0/);
});
test("forecast and history bars render below a 5-point edge while the chip stays hidden", () => {
  const edge = { historyProbability: .2, forecast: { probability: .24 } };
  const html = render(ForecastBlock, { edge, condition: "6 mm or more" });
  assert.match(html, /Forecast/); assert.match(html, /History/);
  assert.match(html, /24%/); assert.match(html, /20.0%/);
  assert.equal(render(EdgeChip, { edge }), "");
});
test("actual payout sheet includes one-tap collection copy and no automatic claim", () => {
  const html = render(HowPayout, { explanation: { station: "Central Park", peril: "rain", end: "Nov 9", pay: "47.00", payout: "100.00" }, onClose: noop });
  assert.match(html, /Collect with one tap/); assert.doesNotMatch(html, /automatic/i); assert.match(html, /Phantom/);
});
test("actual gauge shows unavailable rather than a fabricated observation", () => {
  const receipt = receiptModel({ address: "p", market: "m", premiumPaid: "47000000", protectedAmount: "100000000", city: "New York", peril: "rain", triggerValue: 2, statusLabel: "Active" }, [], []);
  const html = render(CoverGauge, { receipt, progress: null });
  assert.match(html, /Rain so far unavailable/); assert.doesNotMatch(html, /0.0 of/);
});

// Force only the owning component's sheet state open; child hooks keep their normal state.
function renderOpenSheet(component: any, props: any, stateIndex: number) {
  const useState = React.useState;
  let calls = 0;
  React.useState = (initial: unknown) => {
    const [value, setter] = useState(initial);
    return [calls++ === stateIndex ? true : value, setter];
  };
  try { return render(component, props); } finally { React.useState = useState; }
}
test("CoverDetail renders portfolio window dates in header and row and passes the UTC date to its sheet", () => {
  const receipt = receiptModel({ address: "cover", market: "legacy", premiumPaid: "24000000", protectedAmount: "100000000", cityId: "new-york", peril: "rain", triggerValue: 69, statusLabel: "Active", windowStart: "2026-10-22T00:00:00.000Z", windowEnd: "2026-10-29T00:00:00.000Z", settlementDate: "2026-10-29T00:00:00.000Z" }, [], []);
  const html = renderOpenSheet(CoverDetail, { receipt, progress: null, now: Date.parse("2026-10-25"), onClose: noop }, 0);
  assert.equal((html.match(/Oct 22 – Oct 29/g) ?? []).length, 2);
  assert.match(html, /Central Park, New York/);
  assert.match(html, /Settles on its own after Oct 29 \(UTC\)/);
  assert.doesNotMatch(html, /— – —|after —/);
  const unknown = renderOpenSheet(CoverDetail, { receipt: { ...receipt, windowStart: null, windowEnd: null, settlementDate: null }, onClose: noop }, 0);
  assert.match(unknown, /Window not available/);
  assert.match(unknown, /Settles on its own after the window ends/);
  assert.doesNotMatch(unknown, /— – —|after —/);
});
test("Protect's market payout sheet uses the structured UTC end even without a Window display row", () => {
  const model = buildProtectModel({ cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: NYC_RAIN_MODELLED.windowStart, windowEnd: NYC_RAIN_MODELLED.windowEnd, quote: NYC_RAIN_MODELLED, single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: null, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false });
  const html = renderOpenSheet(ProtectBody, { line: { model: { ...model, signRows: [] }, sheet: null, cities: [], approveTarget: null }, onCity: noop, onWallet: noop, onRetry: noop }, 1);
  const end = new Date(NYC_RAIN_MODELLED.windowEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  assert.ok(html.includes(`Settles on its own after ${end} (UTC)`));
  assert.doesNotMatch(html, /after —|after null/);
  const unknown = renderOpenSheet(ProtectBody, { line: { model: { ...model, settlementDate: null }, sheet: null, cities: [], approveTarget: null }, onCity: noop, onWallet: noop, onRetry: noop }, 1);
  assert.match(unknown, /Settles on its own after the window ends/);
});

test("CoverDetail passes a real 69mm receipt to a two-band step chart with one trigger label", () => {
  for (const rungs of [[69], [2, 6, 69], [69, 69]]) {
    const receipt = { ...receiptModel({ address: "cover", market: "legacy", premiumPaid: "24000000", protectedAmount: "100000000", cityId: "new-york", peril: "rain", triggerValue: 69, statusLabel: "Active" }, [], []), rungs };
    assert.ok(receipt.diagram);
    const html = render(CoverDetail, { receipt, onClose: noop });
    assert.match(html, /Payout at the trigger/);
    assert.match(html, /Max loss 24.00, max gain 76.00 SKYT/);
    assert.match(html, /0 to 155.25 mm/);
    assert.equal((html.match(/>69 mm</g) ?? []).length, 1);
    const rects = [...html.matchAll(/<rect\b([^>]*)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
    const loss = rects.find(r => r.fill === "#432A26")!, gain = rects.find(r => r.fill === "#1E3550")!;
    const lossLine = rects.find(r => r.fill === "#E8795A")!, gainLine = rects.find(r => r.fill === "#7CC4FF")!;
    assert.ok(Number(loss.width) > 0 && Number(loss.height) > 0);
    assert.ok(Number(gain.width) > 100 && Number(gain.height) > 0);
    assert.equal(Number(gain.x), Number(loss.width));
    assert.equal(Number(loss.y), Number(gain.y) + Number(gain.height));
    assert.equal(lossLine.width, loss.width);
    assert.equal(gainLine.width, gain.width);
    assert.equal(rects.filter(r => r.fill === "#F2C230").length, 1);
  }
});
