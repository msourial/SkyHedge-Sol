import { useEffect, useMemo, useState } from "react";
import { CITIES } from "../../../shared/peril-registry.ts";
import { rainQuoteForWindow, soonestWindow, type RainWindow } from "../../../shared/ui-rain-quote.ts";
import type { CoverSize, PerilId } from "../../../shared/ui-quote-types.ts";
import { upcomingWindow } from "../../../shared/ui-ladder.ts";
import { buildProtectModel, type ProtectModel } from "../../../shared/ui-view.ts";
import type { WindowEvidencePackage } from "../../../shared/window-chain.ts";
import type { SheetName } from "./types.ts";

export type { SheetName };

export function useLineProtect(input: {
  cityId: string;
  windows: readonly RainWindow[];
  evidence: readonly WindowEvidencePackage[] | null;
  evidenceLoading: boolean;
  evidenceFailed: boolean;
  statusLoading: boolean;
  statusFailed: boolean;
  connected: boolean;
  signing: boolean;
  coveredMarket: string | null;
  nowSeconds: number;
}) {
  const [peril, setPeril] = useState<PerilId>("rain");
  const [tenor, setTenor] = useState<"weekly" | "monthly">("weekly");
  const [cover, setCover] = useState<CoverSize>(100);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const dates = upcomingWindow(input.nowSeconds * 1000, tenor);
  const window = peril === "rain" ? soonestWindow(input.windows, input.cityId, tenor, input.nowSeconds) : null;
  const rain = window ? rainQuoteForWindow(window, input.evidence) : { quote: null, defaultTrigger: null };
  const quote = peril === "rain" ? rain.quote : null;
  const loading = input.statusLoading || (peril === "rain" && !!window && input.evidenceLoading);
  const failed = input.statusFailed || (peril === "rain" && !!window && input.evidenceFailed);
  const model = useMemo(() => buildProtectModel({
    cityId: input.cityId,
    peril,
    tenor,
    windowStart: quote?.windowStart ?? (window ? new Date(window.observationStart * 1000).toISOString().slice(0, 10) : dates.start),
    windowEnd: quote?.windowEnd ?? (window ? new Date(window.observationEnd * 1000).toISOString().slice(0, 10) : dates.end),
    quote,
    single: null,
    loading,
    failed,
    connected: input.connected,
    signing: input.signing,
    cover,
    selectedTrigger,
    defaultTrigger: rain.defaultTrigger,
    coveredMarket: input.coveredMarket,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
  }), [input.cityId, input.connected, input.signing, input.coveredMarket, peril, tenor, quote, window, dates.start, dates.end, loading, failed, cover, selectedTrigger, rain.defaultTrigger]);
  useEffect(() => { setSelectedTrigger(null); setSheet(null); }, [input.cityId, tenor, peril]);
  const market = quote?.rungs.find((rung) => (rung.triggerValue ?? rung.triggerMm) === model.selected)?.marketAddress ?? null;
  return {
    model,
    cityId: input.cityId,
    windowStart: quote?.windowStart ?? dates.start,
    cities: CITIES,
    sheet,
    setSheet,
    setPeril,
    setTenor,
    setCover,
    setSelectedTrigger,
    approveTarget: market ? { market, amount: `${cover}000000` } : null,
  };
}

export type LineController = {
  model: ProtectModel;
  cityId: string;
  windowStart: string;
  cities: typeof CITIES;
  sheet: SheetName;
  setSheet: (sheet: SheetName) => void;
  setPeril: (peril: PerilId) => void;
  setTenor: (tenor: "weekly" | "monthly") => void;
  setCover: (cover: CoverSize) => void;
  setSelectedTrigger: (trigger: number) => void;
  approveTarget: { market: string; amount: string } | null;
};
