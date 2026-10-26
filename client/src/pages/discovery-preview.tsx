import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DISCOVERY_QUOTES, PREVIEW_ADDRESS, PREVIEW_BALANCE, PREVIEW_NOW, fixtureClaim, fixturePosition } from "../../../shared/ui-discovery-fixtures.ts";
import { marketModels, openCoverTotals, receiptModel } from "../../../shared/ui-discovery.ts";
import { formatBase } from "../../../shared/ui-money.ts";
import * as copy from "../../../shared/ui-copy.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
import { MarketsScreen, WalletScreen, FirstRun } from "@/components/line/discovery";
import { LandingScreen } from "@/components/line/landing";
import { LineTabs } from "@/components/line/tabs";
import { ProtectScreen } from "@/components/line/protect-screen";
import { buildProtectModel } from "../../../shared/ui-view.ts";
import "@/line.css";

export default function DiscoveryPreview() {
  const [params] = useSearchParams();
  const screen = params.get("screen") ?? "markets", state = params.get("state") ?? "ready";
  const [intro, setIntro] = useState(state !== "dismissed");
  const filter = params.get("peril") as PerilId | null;
  const positions = state === "empty" || state === "connect" ? [] : (state === "rail" ? [fixturePosition("rain"), fixturePosition("wind"), fixturePosition("heat")] : [fixturePosition("rain")]);
  const receipts = positions.map((p) => receiptModel(state === "unknown" ? { ...p, market: "fixture-unknown", statusLabel: undefined, peril: undefined } : p, [], DISCOVERY_QUOTES, fixtureClaim(state)));
  const quotes = state === "modelled" ? DISCOVERY_QUOTES.map((q) => ({ ...q, rungs: q.rungs.map((r) => ({ ...r, marketAddress: null })) })) : DISCOVERY_QUOTES;
  const markets = marketModels(quotes, PREVIEW_NOW);
  const go = (tab: string) => { window.location.href = `/preview?screen=${tab}&state=ready`; };
  return <main className="ln-preview-page" data-fixture="Fixture"><p className="ln-preview-banner" role="note">{copy.FIXTURE_BANNER}</p>
    {screen === "markets" ? <MarketsScreen markets={state === "empty" ? [] : markets} receipts={state === "rail" ? receipts : []} loading={state === "loading"} failed={state === "error"} filter={filter ?? (state === "cold" ? "cold" : "all")} expanded={state === "expanded"} onSelect={(m) => { window.location.href = `/preview?state=ready&peril=${m.peril}&city=${m.cityId}`; }} onReceipt={() => go("wallet")}/> : null}
    {screen === "wallet" ? <WalletScreen address={state === "connect" ? null : PREVIEW_ADDRESS} balance={state === "loading" || state === "error" ? null : formatBase(BigInt(PREVIEW_BALANCE))} receipts={state === "error" || state === "loading" ? [] : receipts} totals={openCoverTotals(positions, receipts)} loading={state === "loading"} failed={state === "error"} onConnect={() => {}} onRetry={() => {}} technicalOpen={state === "technical"} initialReceipt={params.get("receipt") === "1" ? receipts[0]?.id : null}/> : null}
    {screen === "landing" ? <LandingScreen quotes={state === "empty" || state === "error" || state === "loading" ? [] : quotes} loading={state === "loading"} failed={state === "error"} initialPeril={filter ?? (state === "cold" ? "cold" : "rain")} nowSeconds={PREVIEW_NOW}/> : null}
    {screen === "first-run" ? <><div className="ln ln-intro-wrap">{intro ? <FirstRun onDismiss={() => setIntro(false)}/> : null}</div><ProtectScreen model={buildProtectModel({ cityId: "new-york", peril: "rain", tenor: "weekly", windowStart: quotes[0].windowStart, windowEnd: quotes[0].windowEnd, quote: quotes[0], single: null, loading: false, failed: false, connected: true, signing: false, cover: 100, selectedTrigger: null, defaultTrigger: null, coveredMarket: null, settlement: null, usedSkyt: 0, reading: null, running: false })} cityId="new-york" windowStart={quotes[0].windowStart} sheet={null} motion="still" signError={null} onSheet={() => {}} onPeril={() => {}} onTenor={() => {}} onCity={() => {}} onSelect={() => {}} onCover={() => {}} onConnect={() => {}} onApprove={() => {}} onWallet={() => go("wallet")} onRetry={() => {}}/></> : null}
    {screen !== "landing" ? <LineTabs tab={screen === "first-run" ? "protect" : screen} onTab={go}/> : null}
  </main>;
}
