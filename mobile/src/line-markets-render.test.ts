/** Render the actual RN component against test host primitives; this is not a device screenshot. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { build } from "esbuild";
import { DISCOVERY_QUOTES, PREVIEW_NOW } from "../../shared/ui-discovery-fixtures.ts";
import { marketModels, receiptModel } from "../../shared/ui-discovery.ts";
import type { QuoteWindow } from "../../shared/ui-window-quote.ts";

const rootRequire = createRequire(new URL("../../package.json", import.meta.url));
const React = rootRequire("react");
const { renderToStaticMarkup } = rootRequire("react-dom/server");
const host = `
  import React from "react";
  function words(child) { return Array.isArray(child) ? child.map(words).join(' ') : React.isValidElement(child) ? words(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : ''; }
  function node(tag, props) {
    if (props.onPress && !props.disabled) globalThis.__marketPresses?.push({ label: props.accessibilityLabel ?? words(props.children), press: props.onPress });
    const { children, style, accessibilityRole: role, accessibilityLabel, disabled } = props;
    return React.createElement(tag, { role, disabled, 'aria-label': accessibilityLabel, 'data-style': JSON.stringify(style) }, children);
  }
  export const View = p => node('div', p), Text = p => node('span', p), Pressable = p => node('button', p), ScrollView = p => node('section', p), Modal = p => node('dialog', p);
  export const StyleSheet = { create: v => v, absoluteFill: {}, absoluteFillObject: {} };
  class Value { constructor(v) { this.value = v; } setValue(v) { this.value = v; } stopAnimation() {} interpolate({outputRange}) { return outputRange.at(-1); } toJSON() { return this.value; } }
  export const Vibration = { vibrate() {} };
  export const Animated = { Value, View, Text, createAnimatedComponent: c => c, timing: () => ({ start() {}, stop() {} }), spring: () => ({ start() {}, stop() {} }), multiply: () => 0 };
  export const Easing = { bezier: () => null, out: () => null, cubic: null };
  export const useWindowDimensions = () => ({ width: 393, height: 852 });
`;
let MarketsLine: any;
before(async () => {
const result = await build({
  entryPoints: [new URL("./line/MarketsLine.tsx", import.meta.url).pathname], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "native-test-host", setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
    builder.onResolve({ filter: /^react-native$/ }, () => ({ path: "native", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: "svg", namespace: "host" }));
    builder.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: "safe", namespace: "host" }));
    builder.onResolve({ filter: /liquid-glass(?:\.tsx)?$/ }, () => ({ path: "motion", namespace: "host" }));
    builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({ contents: path === "native" ? host : path === "safe" ? 'export const useSafeAreaInsets = () => ({top:28, bottom:24});' : path === "motion" ? 'export const useReducedMotion = () => true;' : `import React from 'react'; const tag = name => ({children, accessible, ...props}) => React.createElement(name, props, children); export default tag('svg'); export const G=tag('g'), Path=tag('path'), Line=tag('line'), Rect=tag('rect'), Circle=tag('circle'), Text=tag('text');` }));
  } }],
});
const module = { exports: {} as { MarketsLine: any } };
new Function("require", "module", "exports", result.outputFiles[0].text)(rootRequire, module, module.exports);
MarketsLine = module.exports.MarketsLine;
});
const base = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
const pendingWindow: QuoteWindow = { city: "new-york", peril: "snow", address: "fixture-december", tenor: "monthly", observationStart: Date.UTC(2026, 11, 1) / 1000, observationEnd: Date.UTC(2027, 0, 1) / 1000, salesCloseAt: Date.UTC(2026, 11, 1) / 1000 };
const noop = () => {};
function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(React.createElement(MarketsLine, { markets: base, receipts: [], loading: false, failed: false, selectedCity: null, quoteWindows: [pendingWindow], nowSeconds: PREVIEW_NOW, onSelect: noop, onPreview: noop, onWallet: noop, onRetry: noop, onCity: noop, ...overrides }));
}
function text(html: string) { return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replaceAll("&#x27;", "'").trim(); }

test("native host: loading has five tiles, a 64dp covers skeleton, a 340dp hero and 72dp rows", () => {
  const html = render({ markets: [], loading: true });
  assert.match(text(html), /Devnet/);
  assert.equal((html.match(/&quot;height&quot;:88/g) ?? []).length, 5);
  assert.match(html, /&quot;height&quot;:340/);
  assert.equal((html.match(/&quot;height&quot;:72/g) ?? []).length, 3);
  assert.doesNotMatch(text(html), /Chance|Multiple|Cover this|--/);
  assert.doesNotMatch(html, /spinner|progressbar/);
});

test("native host: mixed and held fixtures show v4 hero, one yellow numeral and a Covered row", () => {
  const second = { ...base[0], id: "fixture-ny-166", trigger: 166, quote: { ...base[0].quote, windowEnd: "2027-01-01" } };
  const html = render({ markets: [{ ...base[0], held: true }, second, ...base.slice(1)] });
  const content = text(html);
  assert.match(content, /^NY New York Devnet Rain Snow Wind Heat Cold/);
  assert.match(content, /Rain in Central Park Window Oct 26 – Jan 1.*Pays out at 166 mm or more/);
  assert.match(content, /More in New York 1 market Rain ≥ 69 mm Central Park · by Nov 2 Covered/);
  assert.match(content, /Open elsewhere 2 cities Snow ≥.*Chicago.*Wind ≥.*Chicago.*Heat ≥.*°C.*Miami/);
  assert.match(content, /Coming up.*Cold Not available yet Why/);
  assert.doesNotMatch(content, /Pays out if/);
  assert.equal((html.match(/#F2C230/g) ?? []).length, 1);
});

test("native host: receipt hero uses actual held money, glacier Covered and View cover", () => {
  const held = base.map((m) => ({ ...m, held: true }));
  const receipt = receiptModel({ address: "position", market: base[0].id, premiumPaid: "18000000", protectedAmount: "75000000" }, [], DISCOVERY_QUOTES);
  const html = render({ markets: held, receipts: [receipt] });
  const content = text(html);
  assert.match(content, /Covered ✓ Max gain \+57.00 Max loss −18.00 View cover/);
  assert.match(content, /Nothing else is open in New York right now\./);
  assert.doesNotMatch(content, /Chance|Multiple|Cover this|Pays out if/);
  assert.doesNotMatch(html, /#F2C230/);
});

test("native host: cold start keeps New York, city selection and future previews remain reachable", () => {
  assert.match(text(render({ markets: base.slice(1), quoteWindows: [] })), /^NY New York Devnet/);
  assert.match(text(render({ selectedCity: "chicago" })), /^C Chicago Devnet/);
  const content = text(render({ markets: [] }));
  assert.match(content, /^NY New York Devnet/);
  assert.match(content, /Snow New York · Season starts Dec From Dec/);
  assert.doesNotMatch(content, /Chance|Multiple|Max loss/);
});

test("native host: error Retry row retains pending previews and verified partial data", () => {
  const error = text(render({ markets: [], failed: true, reason: "Offline" }));
  assert.match(error, /Couldn't load markets Retry/);
  assert.match(error, /Coming up Snow New York/);
  assert.match(text(render({ failed: true })), /Couldn't load markets Retry Rain in Central Park/);
  assert.match(text(render({ markets: [], quoteWindows: [], nowSeconds: Date.UTC(2027, 0, 1) / 1000 })), /No markets are scheduled\./);
});

test("native host: row press handlers route real open selections and pending previews", () => {
  const events: Array<{ label: string; press: () => void }> = [];
  const calls: unknown[] = [];
  (globalThis as any).__marketPresses = events;
  try {
    render({ onSelect: (selection: unknown) => calls.push(selection), onPreview: (selection: unknown) => calls.push(selection) });
    events.find((event) => event.label.startsWith("Snow ≥") && event.label.includes("Chicago"))!.press();
    assert.equal((calls[0] as any).cityId, "chicago");
    assert.equal((calls[0] as any).peril, "snow");
    assert.ok("trigger" in (calls[0] as any));
    events.find((event) => event.label.includes("Season starts Dec"))!.press();
    assert.deepEqual(calls[1], { cityId: "new-york", peril: "snow", tenor: "monthly" });
  } finally { delete (globalThis as any).__marketPresses; }
});

test("native host: Retry and receipt View cover execute their real callbacks", () => {
  const events: Array<{ label: string; press: () => void }> = [];
  let retries = 0, wallet = 0;
  (globalThis as any).__marketPresses = events;
  try {
    render({ markets: [], failed: true, onRetry: () => retries++ });
    events.find((event) => event.label === "Retry")!.press();
    assert.equal(retries, 1);
    events.length = 0;
    render({ markets: base.map((m) => ({ ...m, held: true })), onWallet: () => wallet++ });
    events.find((event) => event.label === "View cover")!.press();
    assert.equal(wallet, 1);
  } finally { delete (globalThis as any).__marketPresses; }
});

test("native host: city sheet renders all cities and Cold explains only inside its sheet", () => {
  const original = React.useState;
  function sheetState(value: string) {
    let calls = 0;
    React.useState = (initial: unknown) => original(++calls === 1 ? value : initial);
  }
  try {
    sheetState("city");
    const cities = text(render());
    assert.match(cities, /Choose a city New York Rain Chicago Snow · Wind Miami Heat Dallas Nothing open yet/);
    assert.match(cities, /Austin Nothing open yet Des Moines Nothing open yet Close/);
    sheetState("cold");
    assert.match(text(render()), /Not available yet Cold cover isn't available yet. The contract can't take triggers below zero. Close/);
  } finally { React.useState = original; }
  assert.doesNotMatch(text(render()), /can't take triggers below zero/);
});

 test("native host: zero covers hides summary; held perils have at most three 32dp avatars", () => {
  assert.doesNotMatch(text(render()), /open covers/);
  const receipts = base.map((m) => ({ ...receiptModel({ address: `position-${m.peril}`, market: m.id, premiumPaid: "24000000", protectedAmount: "100000000", statusLabel: "Active" }, [], DISCOVERY_QUOTES), kind: "open" as const }));
  const html = render({ receipts, totals: { loss: "96.00", gain: "304.00" } });
  assert.match(text(html), /4 open covers Max loss −96.00 Max gain \+304.00/);
  assert.equal((html.match(/&quot;width&quot;:32,&quot;height&quot;:32,&quot;borderRadius&quot;:16,&quot;backgroundColor&quot;:&quot;#(?:1E3550|2E3644|1B3A36|432A26)/g) ?? []).length, 3);
});
