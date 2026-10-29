import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { marketsFixture } from "../../../shared/ui-markets-fixtures.ts";
import { DISCOVERY_QUOTES } from "../../../shared/ui-discovery-fixtures.ts";
import { PERILS, CITIES } from "../../../shared/peril-registry.ts";
import { FIXTURE_NOTE, FIXTURE_PINNED_TRIGGER, NYC_RAIN_MODELLED } from "../../../shared/ui-fixtures.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../shared/ui-types.ts";
import { buildProtectModel, type ProtectBuildInput } from "../../../shared/ui-view.ts";
import { type SignAction, type SignErrorKind, type SignState } from "../../../shared/ui-sign.ts";
import { pickDefaultWindow, type QuoteWindow, type Tenor } from "../../../shared/ui-window-quote.ts";
import { ProtectScreen, type SheetName } from "@/components/line/protect-screen";
import type { SignSheetData } from "@/components/line/pay-bar";
import { LineTabs } from "@/components/line/tabs";
import DiscoveryPreview from "./discovery-preview";
import "@/line.css";

const MONTH_QUOTE: WindowQuote = { ...NYC_RAIN_MODELLED, windowStart: "2026-11-01", windowEnd: "2026-12-01", salesCloseAt: "2026-11-01",
  rungs: [80, 102, 194].map((triggerValue, index) => ({ ...NYC_RAIN_MODELLED.rungs[index === 1 ? 3 : index === 0 ? 0 : 5], triggerValue,
    marketAddress: index === 1 ? "fixture-month-102" : null, isTopRung: index === 2 })) };
const MONTH_WINDOW: QuoteWindow = { city: "new-york", peril: "rain", tenor: "monthly", address: "fixture-month-102",
  observationStart: Date.parse(MONTH_QUOTE.windowStart) / 1000, observationEnd: Date.parse(MONTH_QUOTE.windowEnd) / 1000, salesCloseAt: Date.parse(MONTH_QUOTE.salesCloseAt) / 1000 };
const ERROR_STATES: Record<string, SignErrorKind> = { "sign-declined": "declined", "sign-insufficient": "insufficient", "sign-closed": "closed",
  "sign-already": "already-covered", "sign-cap": "cap", "sign-unconfirmed": "unconfirmed", "sign-other": "other", "sign-error": "other" };
function initialSign(state: string, step: string | null): SignState {
  if (state === "sign-progress" || state === "signing") return { status: "progress", step: step === "send" || step === "confirm" ? step : "wallet" };
  if (state === "sign-success") return { status: "success" };
  if (ERROR_STATES[state]) return { status: "error", kind: ERROR_STATES[state] };
  return { status: "review" };
}
export default function LinePreview() {
  const [params] = useSearchParams();
  return params.has("screen") && params.get("screen") !== "protect" ? <DiscoveryPreview/> : <ProtectPreview key={params.toString()} />;
}
function ProtectPreview() {
  const [params] = useSearchParams();
  const state = params.get("state") ?? "ready";
  const sheetFixture = state.startsWith("sign") && state !== "signing";
  const [trigger, setTrigger] = useState<number | null>(params.has("trigger") ? Number(params.get("trigger")) : state === "rung" ? 114 : null);
  const [cover, setCover] = useState<CoverSize>(100);
  const [peril, setPeril] = useState<PerilId>(PERILS.find((p) => p.id === params.get("peril"))?.id ?? initialPeril(state));
  const [city, setCity] = useState(CITIES.find((c) => c.id === params.get("city"))?.id ?? initialCity(state));
  const [tenor, setTenor] = useState<Tenor>(params.get("tenor") === "monthly" || state === "month" ? "monthly" : "weekly");
  const [sheet, setSheet] = useState<SheetName>(sheetFixture ? "sign" : state === "info" ? "info" : null);
  const [signState, setSignState] = useState<SignState>(() => initialSign(state, params.get("step")));
  const [covered, setCovered] = useState(state === "covered" || state === "sign-success");
  const frozenSign = useRef<SignSheetData | null>(null);
  const marketFixture = params.get("marketFixture"), startParam = params.get("start"), endParam = params.get("end");
  const sourceQuote = useMemo(() => marketFixture ? marketsFixture(marketFixture).quotes.find((q) => q.cityId === city && q.peril === peril && q.windowStart === startParam && q.windowEnd === endParam) : undefined, [marketFixture, city, peril, startParam, endParam]);
  const input = useMemo(() => previewInput(state, { city, peril, cover, trigger, tenor, covered }, sourceQuote), [state, city, peril, cover, trigger, tenor, covered, sourceQuote]);
  const model = buildProtectModel(input);
  const signData: SignSheetData | null = model.ticket ? { ticket: model.ticket, state: signState, context: {
    premiumBase: model.ticket.payoff.lossBase, balanceBase: state === "sign-insufficient" ? "12000000" : "1000000000",
    cityName: model.cityName, peril, triggerLabel: model.signRows[0].value, windowLabel: model.signRows[1].value,
  } } : null;
  const openSheet = (value: SheetName) => {
    if (value === "sign") { frozenSign.current = signData; setSignState({ status: "review" }); }
    setSheet(value);
  };
  const action = (value: SignAction) => {
    if (value === "approve") { setSignState({ status: "progress", step: "wallet" }); return; }
    if (value === "retry") { setSignState({ status: "review" }); return; }
    if (value === "wait") return;
    setSheet(null);
    if (value === "wallet") location.href = "/preview?screen=wallet&state=open";
    if (value === "markets") location.href = "/preview?screen=markets&state=ready";
  };
  return <main className="ln-frame" data-fixture={FIXTURE_NOTE}>
    <p className="ln-note ln-fixture-note" role="note">{FIXTURE_NOTE} — preview data</p>
    <ProtectScreen model={model} cityId={city} windowStart={input.windowStart} sheet={sheet} motion="still"
      sign={frozenSign.current ? { ...frozenSign.current, state: signState } : signData} onSignAction={action} onSheet={openSheet}
      onPeril={(value) => { setPeril(value); setTrigger(null); setCovered(false); }}
      onTenor={(value) => { setTenor(value); setTrigger(null); }} onCity={(value) => { setCity(value); setTrigger(null); }}
      onGo={(link) => { setCity(link.cityId); if (link.tenor) setTenor(link.tenor); }}
      onSelect={setTrigger} onCover={setCover} onConnect={() => {}}
      onWallet={() => { location.href = "/preview?screen=wallet&state=open"; }} onRetry={() => {}} />
    <LineTabs tab="protect" onTab={(tab) => { if (tab !== "protect") location.href = `/preview?screen=${tab}`; }} />
  </main>;
}
function initialPeril(state: string): PerilId {
  if (state.startsWith("wind")) return "wind";
  if (state.startsWith("cold")) return "cold";
  if (state === "snow") return "snow";
  if (state.startsWith("heat")) return "heat";
  return "rain";
}
function initialCity(state: string): string {
  if (state.startsWith("wind") || state === "snow") return "chicago";
  if (state.startsWith("heat")) return "miami";
  return "new-york";
}
function previewInput(state: string, live: { city: string; peril: PerilId; cover: CoverSize; trigger: number | null; tenor: Tenor; covered: boolean }, sourceQuote?: WindowQuote): ProtectBuildInput {
  const weekClosed = state === "week-closed" || state === "closed";
  let quote: WindowQuote | null = sourceQuote ?? (live.tenor === "monthly" && live.peril === "rain" && live.city === "new-york" ? MONTH_QUOTE
    : live.peril === "rain" && live.city === "new-york" ? NYC_RAIN_MODELLED
    : DISCOVERY_QUOTES.find((q) => q.cityId === live.city && q.peril === live.peril) ?? null);
  if (weekClosed && live.tenor === "weekly") quote = null;
  if (state === "modelled" && quote) quote = { ...quote, rungs: quote.rungs.map((row) => ({ ...row, marketAddress: null })) };
  const start = sourceQuote?.windowStart ?? (live.peril === "snow" && live.tenor === "weekly" ? "2026-11-09" : live.tenor === "monthly" ? MONTH_QUOTE.windowStart : NYC_RAIN_MODELLED.windowStart);
  const end = sourceQuote?.windowEnd ?? (live.peril === "snow" && live.tenor === "weekly" ? "2026-11-16" : live.tenor === "monthly" ? MONTH_QUOTE.windowEnd : NYC_RAIN_MODELLED.windowEnd);
  if (quote) quote = { ...quote, windowStart: start, windowEnd: end, salesCloseAt: start };
  const windows = weekClosed ? [MONTH_WINDOW] : [];
  return { cityId: live.city, peril: live.peril, tenor: live.tenor,
    windowStart: start,
    windowEnd: end,
    quote: state === "loading" || state === "error" ? null : quote, single: null,
    loading: state === "loading", failed: state === "error", connected: state !== "connect", signing: state === "signing",
    cover: live.cover, selectedTrigger: live.trigger, defaultTrigger: FIXTURE_PINNED_TRIGGER,
    coveredMarket: live.covered ? quote?.rungs.find((rung) => rung.marketAddress)?.marketAddress ?? null : null,
    settlement: state === "paid" || state === "dry" ? { kind: state } : null,
    usedSkyt: state === "cap" ? 480 : 0, reading: paramsReading(state), running: state === "running", windows: windows.length ? windows : undefined,
    tenorOpen: windows.length ? pickDefaultWindow({ cityId: live.city, peril: live.peril, windows, nowSeconds: Date.UTC(2026, 9, 24) / 1000 }).tenorAvailability : undefined,
  };
}
function paramsReading(state: string) { return state === "running" ? 38 : null; }
