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
  export const Animated = { Value, View, Text, createAnimatedComponent: c => c, timing: () => ({ start() {}, stop() {} }), spring: () => ({ start() {}, stop() {} }), multiply: () => 0 };
  export const Easing = { bezier: () => null, out: () => null, cubic: null };
  export const useWindowDimensions = () => ({ width: 393, height: 852 });
`;
let PurchaseReceipt: any, ForecastBlock: any, EdgeChip: any, HowPayout: any, CoverGauge: any;
before(async () => {
const result = await build({
  stdin: { contents: 'export { PurchaseReceipt } from "./line/PurchaseReceipt.tsx"; export { ForecastBlock, EdgeChip } from "./line/ForecastBlock.tsx"; export { HowPayout } from "./line/HowPayout.tsx"; export { CoverGauge } from "./line/CoverGauge.tsx";', resolveDir: new URL("./", import.meta.url).pathname }, bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "native-test-host", setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
    builder.onResolve({ filter: /^react-native$/ }, () => ({ path: "native", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: "svg", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: "safe", namespace: "host" }));
    builder.onResolve({ filter: /liquid-glass(?:\.tsx)?$/ }, () => ({ path: "motion", namespace: "host" }));
    builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({ contents: path === "native" ? host : path === "safe" ? 'export const useSafeAreaInsets = () => ({top:28, bottom:24});' : path === "motion" ? 'export const useReducedMotion = () => true;' : `import React from 'react'; const tag = name => ({children, accessible, ...props}) => React.createElement(name, props, children); export default tag('svg'); export const G=tag('g'), Path=tag('path'), Line=tag('line'), Rect=tag('rect'), Circle=tag('circle'), Text=tag('text');` }));
  } }],
});
const module = { exports: {} as any };
new Function("require", "module", "exports", result.outputFiles[0].text)(rootRequire, module, module.exports);
({ PurchaseReceipt, ForecastBlock, EdgeChip, HowPayout, CoverGauge } = module.exports);
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
test("actual payout sheet includes one-tap collection copy and no automatic claim", () => {
  const html = render(HowPayout, { explanation: { station: "Central Park", peril: "rain", end: "Nov 9", pay: "47.00", payout: "100.00" }, onClose: noop });
  assert.match(html, /Collect with one tap/); assert.doesNotMatch(html, /automatic/i); assert.match(html, /Phantom/);
});
test("actual gauge shows unavailable rather than a fabricated observation", () => {
  const receipt = receiptModel({ address: "p", market: "m", premiumPaid: "47000000", protectedAmount: "100000000", city: "New York", peril: "rain", triggerValue: 2, statusLabel: "Active" }, [], []);
  const html = render(CoverGauge, { receipt, progress: null });
  assert.match(html, /Rain so far unavailable/); assert.doesNotMatch(html, /0.0 of/);
});
