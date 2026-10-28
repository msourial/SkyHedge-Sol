import { useSearchParams } from "react-router-dom";
import { DISCOVERY_QUOTES, PREVIEW_ADDRESS, PREVIEW_BALANCE, PREVIEW_NOW, fixtureClaim, fixturePosition } from "../../../shared/ui-discovery-fixtures.ts";
import { openCoverTotals, receiptModel } from "../../../shared/ui-discovery.ts";
import { formatBaseGrouped } from "../../../shared/ui-money.ts";
import * as copy from "../../../shared/ui-copy.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
import { marketsFixture } from "../../../shared/ui-markets-fixtures.ts";
import { MarketsScreen, WalletScreen } from "@/components/line/discovery";
import { LandingScreen } from "@/components/line/landing";
import { LineTabs } from "@/components/line/tabs";
import "@/line.css";

export default function DiscoveryPreview() {
  const [params] = useSearchParams();
  const screen = params.get("screen") ?? "markets", state = params.get("state") ?? "ready";
  const fixture = marketsFixture(state);
  const filter = params.get("peril") as PerilId | null;
  const positions = state === "empty" || state === "connect" ? [] : state === "wallet-multi" ? [fixturePosition("rain"), fixturePosition("snow"), fixturePosition("wind"), fixturePosition("heat")] : state === "wallet-two" ? [fixturePosition("rain"), fixturePosition("snow")] : (state === "rail" ? [fixturePosition("rain"), fixturePosition("wind"), fixturePosition("heat")] : state === "markets-mixed" ? [fixturePosition("rain")] : [fixturePosition("rain")]);
  const quotes = state === "modelled" ? DISCOVERY_QUOTES.map((q) => ({ ...q, rungs: q.rungs.map((r) => ({ ...r, marketAddress: null })) }))
    : state === "wallet-multi" ? DISCOVERY_QUOTES.map((q) => ({ ...q, windowStart: "2026-11-01", windowEnd: "2026-12-01", salesCloseAt: "2026-11-01" }))
    : DISCOVERY_QUOTES;
  const receipts = positions.map((p) => receiptModel(state === "unknown" ? { ...p, market: "fixture-unknown", statusLabel: undefined, peril: undefined } : p, [], quotes, state === "open" || state === "wallet" || state === "wallet-two" || state === "wallet-multi" ? null : fixtureClaim(state)));

  const go = (tab: string) => { window.location.href = `/preview?screen=${tab}&state=ready`; };
  return <main className="ln-preview-page" data-fixture="Fixture"><p className="ln-preview-banner" role="note">{copy.FIXTURE_BANNER}</p>
    {screen === "markets" ? <MarketsScreen markets={fixture.markets} quoteWindows={fixture.windows} nowSeconds={fixture.nowSeconds} receipts={fixture.markets.filter((m) => m.held).map((m) => ({ ...receiptModel({ ...fixturePosition(m.peril), market: m.id }, [], fixture.quotes, null), kind: "open" as const }))} loading={state === "loading"} failed={state === "error"} onSelect={(m) => { window.location.href = `/preview?screen=protect&state=${m.peril === "rain" ? m.tenor === "monthly" ? "month" : "ready" : m.peril}&peril=${m.peril}&city=${m.cityId}&tenor=${m.tenor}&trigger=${m.trigger}&marketFixture=${state}&start=${m.windowStart}&end=${m.windowEnd}`; }} onPreview={(m) => { window.location.href = `/preview?screen=protect&state=${m.peril === "rain" ? "modelled" : m.peril}&city=${m.cityId}&peril=${m.peril}&tenor=${m.tenor}`; }} onReceipt={() => go("wallet")} onWallet={() => go("wallet")} onRetry={() => go("markets")}/> : null}
    {screen === "wallet" ? <WalletScreen address={state === "connect" ? null : PREVIEW_ADDRESS} balance={state === "loading" || state === "error" ? null : formatBaseGrouped(BigInt(PREVIEW_BALANCE))} receipts={state === "error" || state === "loading" ? [] : receipts} totals={openCoverTotals(positions, receipts)} loading={state === "loading"} failed={state === "error"} onConnect={() => {}} onRetry={() => {}} onDisconnect={() => {}} technicalOpen={state === "technical"} initialReceipt={params.get("receipt") === "1" ? receipts[0]?.id : null}/> : null}
    {screen === "landing" ? <LandingScreen quotes={state === "empty" || state === "error" || state === "loading" ? [] : quotes} loading={state === "loading"} failed={state === "error"} initialPeril={filter ?? (state === "cold" ? "cold" : "rain")} nowSeconds={PREVIEW_NOW}/> : null}

    {screen !== "landing" ? <LineTabs tab={screen} onTab={go}/> : null}
  </main>;
}
