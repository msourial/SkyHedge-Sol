import { useEffect, useMemo, useState } from "react";
import { CITIES } from "../../../shared/peril-registry.ts";
import { TRIGGER, WINDOW_WORD } from "../../../shared/ui-copy.ts";
import { matchingQuote, pickDefaultWindow, quoteNotOpen, windowQuoteRequest, type QuoteWindow, type TenorAvailability } from "../../../shared/ui-window-quote.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../shared/ui-types.ts";
import type { MarketSelection } from "../../../shared/ui-discovery.ts";
import { getJson } from "../api.ts";
import { buildProtectModel, type ProtectModel } from "../../../shared/ui-view.ts";
import { lineCoverage, withCoveredReceipt } from "../line-covered.ts";
import type { ChainProtection } from "../positions.ts";
import type { LineSubmitTarget } from "../line-submit.ts";
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
  chainPositions?: readonly ChainProtection[] | null;
  nowSeconds: number;
}) {
  const [peril, setPeril] = useState<PerilId>("rain");
  const [chosenTenor, setChosenTenor] = useState<"weekly" | "monthly" | null>(null);
  const defaultWindow = pickDefaultWindow({ ...input, peril });
  const tenor = chosenTenor ?? defaultWindow.tenor ?? "weekly";
  const tenorOpen = defaultWindow.tenorAvailability;
  const setTenor = (value: "weekly" | "monthly") => setChosenTenor(value);
  const [cover, setCover] = useState<CoverSize>(100);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [selection, setSelection] = useState<MarketSelection | null>(null);
  const selectedWindow = selection?.cityId === input.cityId && selection.peril === peril && selection.tenor === tenor && selection.windowStart && selection.windowEnd ? { start: selection.windowStart, end: selection.windowEnd } : null;
  const request = windowQuoteRequest({ ...input, peril, tenor, selectedWindow });
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
  const held = lineCoverage({ quote, selectedTrigger, coveredMarket: input.coveredMarket, positions: input.chainPositions });
  const coveredMarket = held.coveredMarket;
  const displayedCover = held.cover ?? cover;
  const model = useMemo(() => withCoveredReceipt(buildProtectModel({
    cityId: input.cityId,
    windows: input.windows,
    nowSeconds: input.nowSeconds,
    tenorOpen,
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
    cover: displayedCover,
    selectedTrigger,
    defaultTrigger: null,
    coveredMarket,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
  }), held.position, request.end, quote?.analogueYears), [held.position, input.cityId, input.windows, input.nowSeconds, tenorOpen.weekly, tenorOpen.monthly, input.connected, input.signing, coveredMarket, peril, tenor, quote, request.start, request.end, loading, failed, displayedCover, selectedTrigger]);
  useEffect(() => { setSelectedTrigger(null); setSheet(null); }, [input.cityId, tenor, peril]);
  const rung = quote?.rungs.find((rung) => rung.triggerValue === model.selected);
  const market = rung?.marketAddress ?? null;
  const premiumBase = rung?.premiumBase[cover];
  const triggerLabel = model.signRows.find((row) => row.label === TRIGGER)?.value;
  const windowLabel = model.signRows.find((row) => row.label === WINDOW_WORD)?.value;
  return {
    model,
    tenorOpen,
    cityId: input.cityId,
    windowStart: request.start,
    cities: CITIES,
    sheet,
    setSheet,
    setPeril,
    setTenor,
    setCover,
    setSelectedTrigger,
    clearMarketSelection: () => { setSelection(null); setSelectedTrigger(null); },
    chooseMarket: (market: MarketSelection) => { setSelection(market); setPeril(market.peril); setTenor(market.tenor); setCover(100); setSelectedTrigger(market.trigger); },
    approveTarget: market && premiumBase && /^\d+$/.test(premiumBase) && triggerLabel && windowLabel && model.panel.kind === "ready" && !model.blocked && !model.chips.some((chip) => chip.selected && chip.disabled) ? { market, amount: `${cover}000000`, cover, premiumBase, triggerLabel, windowLabel, salesCloseAt: quote?.salesCloseAt ?? request.start } : null,
  };
}

export type LineController = {
  model: ProtectModel;
  tenorOpen: TenorAvailability;
  cityId: string;
  windowStart: string;
  cities: typeof CITIES;
  sheet: SheetName;
  setSheet: (sheet: SheetName) => void;
  setPeril: (peril: PerilId) => void;
  setTenor: (tenor: "weekly" | "monthly") => void;
  setCover: (cover: CoverSize) => void;
  setSelectedTrigger: (trigger: number) => void;
  approveTarget: (LineSubmitTarget & { cover: CoverSize; triggerLabel: string; windowLabel: string }) | null;
};
