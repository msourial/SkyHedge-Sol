import { useEffect, useMemo, useState } from "react";
import { CITIES } from "../../../shared/peril-registry.ts";
import { matchingQuote, quoteNotOpen, windowQuoteRequest, type QuoteWindow } from "../../../shared/ui-window-quote.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../shared/ui-types.ts";
import { getJson } from "../api.ts";
import { buildProtectModel, type ProtectModel } from "../../../shared/ui-view.ts";
import type { SheetName } from "./types.ts";

export type { SheetName };

export function useLineProtect(input: {
  cityId: string;
  windows: readonly QuoteWindow[];
  retryKey: number;
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
  const request = windowQuoteRequest({ ...input, peril, tenor });
  const [result, setResult] = useState<{ path: string | null; quote: WindowQuote | null; loading: boolean; failed: boolean }>({ path: null, quote: null, loading: false, failed: false });
  useEffect(() => {
    let cancelled = false;
    const path = request.path;
    setResult({ path, quote: null, loading: path != null, failed: false });
    if (path) void getJson<WindowQuote>(path)
      .then((quote) => { if (!cancelled) setResult({ path, quote, loading: false, failed: false }); })
      .catch((error) => { if (!cancelled) setResult({ path, quote: null, loading: false, failed: !quoteNotOpen(error) }); });
    return () => { cancelled = true; };
  }, [request.path, input.retryKey]);
  const quote = matchingQuote(result.path === request.path ? result.quote : null, { cityId: input.cityId, peril, ...request });
  const loading = input.statusLoading || (request.path != null && (result.path !== request.path || result.loading));
  const failed = request.path != null && result.path === request.path && result.failed;
  const coveredMarket = quote?.rungs.some((rung) => rung.marketAddress === input.coveredMarket) ? input.coveredMarket : null;
  const model = useMemo(() => buildProtectModel({
    cityId: input.cityId,
    peril,
    tenor,
    windowStart: request.start,
    windowEnd: request.end,
    quote,
    single: null,
    loading,
    failed,
    connected: input.connected,
    signing: input.signing,
    cover,
    selectedTrigger,
    defaultTrigger: null,
    coveredMarket,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
  }), [input.cityId, input.connected, input.signing, coveredMarket, peril, tenor, quote, request.start, request.end, loading, failed, cover, selectedTrigger]);
  useEffect(() => { setSelectedTrigger(null); setSheet(null); }, [input.cityId, tenor, peril]);
  const market = quote?.rungs.find((rung) => rung.triggerValue === model.selected)?.marketAddress ?? null;
  return {
    model,
    cityId: input.cityId,
    windowStart: request.start,
    cities: CITIES,
    sheet,
    setSheet,
    setPeril,
    setTenor,
    setCover,
    setSelectedTrigger,
    approveTarget: market && model.panel.kind === "ready" && !model.blocked && !model.chips.some((chip) => chip.selected && chip.disabled) ? { market, amount: `${cover}000000` } : null,
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
