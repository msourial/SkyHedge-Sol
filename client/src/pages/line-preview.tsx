import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CHAIN_ERROR } from "../../../shared/ui-copy.ts";
import { FIXTURE_NOTE, FIXTURE_PINNED_TRIGGER, NYC_RAIN_MODELLED, NYC_RAIN_OPTION_B } from "../../../shared/ui-fixtures.ts";
import { upcomingWindow } from "../../../shared/ui-ladder.ts";
import type { CoverSize, PerilId } from "../../../shared/ui-quote-types.ts";
import { buildProtectModel, type ProtectBuildInput } from "../../../shared/ui-view.ts";
import { ProtectScreen, type SheetName } from "@/components/line/protect-screen";
import { LineTabs } from "@/components/line/tabs";
import "@/line.css";

const WEEK = { start: "2026-10-26", end: "2026-11-02" };

export default function LinePreview() {
  const [params] = useSearchParams();
  const state = params.get("state") ?? "ready";
  const [trigger, setTrigger] = useState<number | null>(state === "rung" ? 114 : null);
  const [cover, setCover] = useState<CoverSize>(100);
  const [peril, setPeril] = useState<PerilId>(initialPeril(state));
  const [city, setCity] = useState(initialCity(state));
  const [sheet, setSheet] = useState<SheetName>(state === "sign" ? "sign" : state === "info" ? "info" : null);
  const input = useMemo(() => previewInput(state, { city, peril, cover, trigger }), [state, city, peril, cover, trigger]);
  const model = buildProtectModel(input);
  const dates = state.startsWith("oct") ? WEEK : { start: input.windowStart, end: input.windowEnd };
  return (
    <main className="ln-frame" data-fixture={FIXTURE_NOTE}>
      <ProtectScreen
        model={model}
        cityId={city}
        windowStart={dates.start}
        sheet={sheet}
        motion="still"
        signError={state === "sign-error" ? CHAIN_ERROR : null}
        onSheet={setSheet}
        onPeril={setPeril}
        onTenor={() => {}}
        onCity={setCity}
        onSelect={setTrigger}
        onCover={setCover}
        onConnect={() => {}}
        onApprove={() => {}}
        onWallet={() => {}}
        onRetry={() => {}}
      />
      <LineTabs tab="protect" onTab={() => {}} />
    </main>
  );
}

function initialPeril(state: string): PerilId {
  if (state === "wind" || state === "wind-chicago") return "wind";
  if (state === "cold") return "cold";
  if (state === "snow") return "snow";
  if (state === "heat") return "heat";
  return "rain";
}

function initialCity(state: string): string {
  if (state === "wind-chicago" || state === "snow") return "chicago";
  if (state === "heat-miami") return "miami";
  return "new-york";
}

function previewInput(state: string, live: { city: string; peril: PerilId; cover: CoverSize; trigger: number | null }): ProtectBuildInput {
  const dates = upcomingWindow(Date.UTC(2026, 9, 24, 12), "weekly");
  const base: ProtectBuildInput = {
    cityId: live.city,
    peril: live.peril,
    tenor: "weekly",
    windowStart: WEEK.start,
    windowEnd: WEEK.end,
    quote: NYC_RAIN_OPTION_B,
    single: null,
    loading: false,
    failed: false,
    connected: true,
    signing: false,
    cover: live.cover,
    selectedTrigger: live.trigger,
    defaultTrigger: FIXTURE_PINNED_TRIGGER,
    coveredMarket: null,
    settlement: null,
    usedSkyt: state === "cap" ? 480 : 0,
    reading: null,
    running: false,
  };
  if (state === "modelled") return { ...base, quote: NYC_RAIN_MODELLED };
  if (state === "connect") return { ...base, connected: false };
  if (state === "signing") return { ...base, signing: true };
  if (state === "covered") return { ...base, coveredMarket: "fixture-69" };
  if (state === "paid") return { ...base, settlement: { kind: "paid" } };
  if (state === "dry") return { ...base, settlement: { kind: "dry" } };
  if (state === "loading") return { ...base, quote: null, loading: true };
  if (state === "error") return { ...base, quote: null, failed: true };
  if (state === "wind") return { ...base, cityId: "new-york", peril: "wind", quote: null, windowStart: dates.start, windowEnd: dates.end };
  if (state === "wind-chicago") return { ...base, cityId: "chicago", peril: "wind", quote: null };
  if (state === "cold") return { ...base, peril: "cold", quote: null };
  if (state === "snow") return { ...base, cityId: "chicago", peril: "snow", quote: null, windowStart: "2026-10-26" };
  if (state === "heat") return { ...base, cityId: "new-york", peril: "heat", quote: null };
  if (state === "closed") return { ...base, quote: null };
  return base;
}
