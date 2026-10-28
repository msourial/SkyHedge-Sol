import { useEffect, useState } from "react";
import { loadDiscovery, marketModels, openCoverTotals, receiptModel, type CoverClaim, type StoredCover } from "../../../shared/ui-discovery.ts";
import type { WindowQuote } from "../../../shared/ui-types.ts";
import type { QuoteWindow } from "../../../shared/ui-window-quote.ts";
import { friendlyError } from "../friendly-errors.ts";
import { getJson } from "../api.ts";

export function useDiscovery(windows: readonly QuoteWindow[], retry: number, now: number) {
  const key = JSON.stringify(windows);
  const [state, setState] = useState<{ quotes: WindowQuote[]; loading: boolean; failed: boolean; reason?: string }>({ quotes: [], loading: true, failed: false });
  useEffect(() => {
    let cancelled = false;
    // Retain verified content during refresh and retry; only first load owns the shells.
    void loadDiscovery(windows, now, (path) => getJson<WindowQuote>(path)).then((data) => {
      if (!cancelled) setState({ ...data, reason: data.reason ? friendlyError(data.reason) : undefined, loading: false });
    });
    return () => { cancelled = true; };
  }, [key, retry, Math.floor(now / 60)]);
  return { ...state, markets: marketModels(state.quotes, now), quoteWindows: windows, nowSeconds: now };
}
export function useReceipts(positions: readonly StoredCover[], wallet: string | null, windows: readonly QuoteWindow[], quotes: readonly WindowQuote[], retry: number) {
  const [claims, setClaims] = useState<{ wallet: string | null; data: Record<string, CoverClaim | null> }>({ wallet: null, data: {} });
  const key = JSON.stringify(positions);
  useEffect(() => {
    let cancelled = false;
    setClaims({ wallet, data: {} });
    if (wallet) void Promise.all(positions.map(async (p) => {
      try { return [p.market, await getJson<CoverClaim>(`/api/mobile?resource=claim-readiness&market=${encodeURIComponent(p.market)}&wallet=${encodeURIComponent(wallet)}`)] as const; }
      catch { return [p.market, null] as const; }
    })).then((rows) => { if (!cancelled) setClaims({ wallet, data: Object.fromEntries(rows) }); });
    return () => { cancelled = true; };
  }, [wallet, key, retry]);
  const receipts = positions.map((p) => receiptModel(p, windows, quotes, claims.wallet === wallet ? claims.data[p.market] : null));
  return { receipts, totals: openCoverTotals(positions, receipts) };
}
