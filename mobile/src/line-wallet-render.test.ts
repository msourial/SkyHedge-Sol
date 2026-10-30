/** Render the actual RN component against test host primitives; this is not a device screenshot. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { build } from "esbuild";
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
let WalletLine: any, PayoffChart: any;
before(async () => {
const result = await build({
  stdin: { contents: 'export { WalletLine } from "./line/WalletLine.tsx"; export { PayoffChart } from "./line/payout-graphics.tsx";', resolveDir: new URL("./", import.meta.url).pathname }, bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "native-test-host", setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
    builder.onResolve({ filter: /^react-native$/ }, () => ({ path: "native", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: "svg", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: "safe", namespace: "host" }));
    builder.onResolve({ filter: /liquid-glass(?:\.tsx)?$/ }, () => ({ path: "motion", namespace: "host" }));
    builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({ contents: path === "native" ? host : path === "safe" ? 'export const useSafeAreaInsets = () => ({top:28, bottom:24});' : path === "motion" ? 'export const useReducedMotion = () => true;' : `import React from 'react'; const tag = name => ({children, accessible, ...props}) => React.createElement(name, props, children); export default tag('svg'); export const G=tag('g'), Path=tag('path'), Line=tag('line'), Rect=tag('rect'), Circle=tag('circle'), Text=tag('text');` }));
  } }],
});
const module = { exports: {} as { WalletLine: any; PayoffChart: any } };
new Function("require", "module", "exports", result.outputFiles[0].text)(rootRequire, module, module.exports);
({ WalletLine, PayoffChart } = module.exports);
});
const noop = () => {};
const base = receiptModel({ address: "position", market: "unknown", premiumPaid: "24000000", protectedAmount: "100000000", statusLabel: "Active", city: "New York", peril: "rain", triggerValue: 2 }, [], DISCOVERY_QUOTES);
const known = { ...base, windowKey: "2026-11-01/2026-12-01", windowLabel: "Nov 1 to Dec 1", windowStart: "2026-11-01", windowEnd: "2026-12-01" };
function render(receipts: ReceiptModel[]) {
  const nodes: any[] = [];
  (globalThis as any).__walletNodes = nodes;
  try {
    const html = renderToStaticMarkup(React.createElement(WalletLine, { wallet: "wallet", balance: "100", receipts, totals: null, loading: false, failed: false, onConnect: noop, onRetry: noop, onDisconnect: noop, onMarkets: noop }));
    return { nodes, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") };
  } finally { delete (globalThis as any).__walletNodes; }
}
function checkGroup(nodes: any[]) {
  assert.equal(nodes.filter(n => Array.isArray(n.style) && n.style[0]?.overflow === "hidden").length, 1);
  assert.equal(nodes.filter(n => n.style?.height === 36 && n.style?.paddingHorizontal === 14).length, 1);
}
const section = (nodes: any[]) => nodes.find(n => n.style?.marginTop === 28);
const sublines = (nodes: any[]) => nodes.filter(n => Array.isArray(n.style) && n.style[1]?.marginTop === 2).map(n => n.children.flat().join(""));
test("Wallet renders one group and header, with mixed windows below each city", () => {
  const { nodes, text } = render([known, { ...base, id: "unknown" }, { ...known, id: "second", windowKey: "2026-12-01/2027-01-01", windowLabel: "Dec 1 to Jan 1" }]);
  checkGroup(nodes);
  assert.doesNotMatch(text, /Window unavailable/);
  assert.equal(section(nodes).children[1], null);
  assert.deepEqual(sublines(nodes), ["New York\nNov 1 – Dec 1", "New York", "New York\nDec 1 – Jan 1"]);
});
test("Wallet shows a shared known window right-aligned in the title only", () => {
  for (const receipts of [[known], [known, { ...known, id: "second" }]]) {
    const { nodes } = render(receipts);
    checkGroup(nodes);
    assert.equal(section(nodes).children[1].props.children, "Rain · Nov 1 – Dec 1");
    assert.equal(section(nodes).children[1].props.style[1].textAlign, "right");
    assert.deepEqual(sublines(nodes), receipts.map(() => "New York"));
  }
});
test("Wallet omits unknown windows and compares keys rather than display labels", () => {
  const unknown = render([base, { ...base, id: "second" }]);
  checkGroup(unknown.nodes);
  assert.equal(section(unknown.nodes).children[1], null);
  assert.deepEqual(sublines(unknown.nodes), ["New York", "New York"]);
  assert.doesNotMatch(unknown.text, /Window unavailable/);
  const sameLabel = render([known, { ...known, id: "other-year", windowKey: "2027-11-01/2027-12-01" }]);
  assert.equal(section(sameLabel.nodes).children[1], null);
});
test("Android selected labels use one native text run with space for the number and unit", () => {
  for (const trigger of [2, 6]) {
    const nodes: any[] = [];
    (globalThis as any).__walletNodes = nodes;
    try {
      renderToStaticMarkup(React.createElement(PayoffChart, { diagram: { maximum: 40, lossBase: "47000000", gainBase: "53000000", domain: { loss: 47, gain: 76 }, openTriggers: [2, 6], description: "Payoff" }, trigger, unit: "mm", peril: "rain", highLabel: "40 mm · 10-year high" }));
      const label = nodes.find(n => n.tag === "span" && n.children === `${trigger} mm`);
      assert.ok(label);
      assert.equal(label.numberOfLines, 1);
      assert.equal(label.style.letterSpacing, undefined);
      assert.ok(parseFloat(label.style.width) / 100 * 329 >= 64);
      assert.equal(label.ellipsizeMode, undefined);
    } finally { delete (globalThis as any).__walletNodes; }
  }
});
test("all tab changes and Wallet reselect reset scroll after mounting", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.equal((app.match(/setTab\("wallet"\)/g) ?? []).length, 1);
  assert.match(app, /const openWallet = \(\) => \{\s*setTab\("wallet"\);\s*scrollRef.current\?\.scrollTo\(\{ y: 0, animated: false \}\);/);
  assert.match(app, /useEffect\(\(\) => \{\s*scrollRef.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\s*\}, \[tab\]\)/);
  assert.match(app, /label="Wallet"[^\n]*onPress=\{openWallet\}/);
  assert.doesNotMatch(app, /onWallet=\{(?!openWallet)/);
});

test("chart extends the right-edge trigger, renders it once and separates values from plot and axis", () => {
  for (const [loss, gain] of [[24, 76], [.000001, 1e9], [1e9, .000001]]) {
    const nodes: any[] = [];
    (globalThis as any).__walletNodes = nodes;
    try {
      const html = renderToStaticMarkup(React.createElement(PayoffChart, { diagram: { maximum: 69, lossBase: String(loss * 1e6), gainBase: String(gain * 1e6), domain: { loss, gain }, openTriggers: [69], description: "Payoff" }, trigger: 69, unit: "mm", peril: "rain", highLabel: "69 mm" }));
      assert.equal((html.match(/>69 mm</g) ?? []).length, 1);
      const gainText = nodes.find(n => n.children === `+${gain.toFixed(2)}`);
      const lossText = nodes.find(n => n.children === `−${loss.toFixed(2)}`);
      assert.equal(gainText.style.color, "#7CC4FF");
      assert.equal(lossText.style.color, "#E8795A");
      assert.deepEqual(gainText.style.fontVariant, ["tabular-nums"]);
      assert.deepEqual(lossText.style.fontVariant, ["tabular-nums"]);
      const gainBox = nodes.find(n => n.children?.[1]?.props?.children === gainText.children);
      const lossBox = nodes.find(n => n.children?.[1]?.props?.children === lossText.children);
      const trigger = nodes.find(n => n.children === "69 mm");
      assert.ok(parseFloat(lossBox.style.left) + parseFloat(lossBox.style.width) < parseFloat(gainBox.style.left));
      assert.ok(gainBox.style.top + gainBox.style.height + 8 <= 44);
      assert.ok(lossBox.style.top + lossBox.style.height + 8 <= 44);
      const rects = [...html.matchAll(/<rect\b([^>]*)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
      const gainBand = rects.find(r => r.fill === "#1E3550")!;
      const lossBand = rects.find(r => r.fill === "#432A26")!;
      assert.ok(Number(gainBand.width) > 100 && Number(gainBand.height) > 0);
      assert.ok(Number(lossBand.width) > 0 && Number(lossBand.height) > 0);
      assert.equal(rects.filter(r => r.fill === "#F2C230").length, 1);
      assert.match(html, /0 to 155.25 mm/);
      assert.ok(lossBox.style.top + lossBox.style.height + 8 <= trigger.style.top);
      assert.deepEqual(trigger.style.fontVariant, ["tabular-nums"]);
    } finally { delete (globalThis as any).__walletNodes; }
  }
});
