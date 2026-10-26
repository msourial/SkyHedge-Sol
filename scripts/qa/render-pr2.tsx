/** Static render smoke check for restricted environments; browser interaction tests remain required. */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MarketsScreen, WalletScreen } from "../../client/src/components/line/discovery.tsx";
import { LandingScreen } from "../../client/src/components/line/landing.tsx";
import { DISCOVERY_QUOTES, PREVIEW_NOW, fixtureClaim, fixturePosition } from "../../shared/ui-discovery-fixtures.ts";
import { marketModels, openCoverTotals, receiptModel } from "../../shared/ui-discovery.ts";
import { forbiddenHits } from "../../shared/ui-copy.ts";
const markets = marketModels(DISCOVERY_QUOTES, PREVIEW_NOW);
const noop = () => {};
const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
let count = 0;
for (const filter of ["all", "rain", "snow", "wind", "heat", "cold"] as const) {
  const html = render(<MarketsScreen markets={markets} filter={filter} onSelect={noop} onReceipt={noop}/>);
  assert.equal(forbiddenHits(html.replace(/<[^>]*>/g, " ")).length, 0);
  assert.equal(html.includes("Cover this"), filter !== "cold");
  if (filter === "cold") assert(html.includes("Cold isn&#x27;t open yet."));
  count++;
}
const coverReceipt = receiptModel(fixturePosition(), [], DISCOVERY_QUOTES, fixtureClaim("open"));
const marketsWithCovers = render(<MarketsScreen markets={markets} receipts={[coverReceipt]} onSelect={noop} onReceipt={noop} onWallet={noop}/>);
assert(marketsWithCovers.includes("Cover this"));
assert(marketsWithCovers.includes("open covers"));
assert(!marketsWithCovers.includes("ln-cover-tile"));
count++;
for (const state of ["open", "paid", "dry", "pending", "refund-ready", "refunded", "unknown"]) {
  const position = fixturePosition();
  const receipt = receiptModel(position, [], DISCOVERY_QUOTES, fixtureClaim(state));
  for (const opened of [false, true]) {
    const html = render(<WalletScreen address="fixture-wallet" balance="1000.00" receipts={[receipt]} totals={openCoverTotals([position], [receipt])} loading={false} failed={false} onConnect={noop} onRetry={noop} initialReceipt={opened ? receipt.id : null}/>);
    assert.equal(forbiddenHits(html.replace(/<[^>]*>/g, " ")).length, 0);
    if (state === "pending") { assert(html.includes("Payout ready to collect")); assert(!html.includes("Paid out")); }
    if (!opened && state === "open") { assert(html.includes("69 mm or more · Nov 1 to Dec 1")); assert(html.includes("Max gain")); }
    if (opened && state === "paid") assert(html.includes("Result +76.00 SKYT"));
    if (opened && state === "dry") assert(html.includes("Result -24.00 SKYT"));
    count++;
  }
}
for (const peril of ["rain", "snow", "wind", "heat", "cold"] as const) {
  const html = render(<LandingScreen quotes={DISCOVERY_QUOTES} loading={false} failed={false} initialPeril={peril} nowSeconds={PREVIEW_NOW}/>);
  assert(html.includes("Weather on your plans? Get paid."));
  assert.equal(forbiddenHits(html.replace(/<[^>]*>/g, " ")).length, 0);
  assert.equal(html.includes("Chance is from 10 years of NOAA history, not a forecast."), peril !== "cold");
  count++;
}
console.log(`PASS: ${count} static screen renders; no forbidden visible copy.`);
