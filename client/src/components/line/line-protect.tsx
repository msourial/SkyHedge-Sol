import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api } from "@/lib/api";
import { signAndSend } from "@/lib/solana";
import type { Portfolio, UnsignedTx } from "@/lib/types";
import { PERILS, cityById } from "../../../../shared/peril-registry.ts";
import { CHAIN_ERROR } from "../../../../shared/ui-copy.ts";
import { matchingQuote, quoteNotOpen, windowQuoteRequest, type QuoteWindow } from "../../../../shared/ui-window-quote.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../../shared/ui-types.ts";
import { buildProtectModel } from "../../../../shared/ui-view.ts";
import { FIRST_RUN_KEY } from "../../../../shared/ui-copy.ts";
import { FirstRun } from "./discovery";
import type { MarketSelection } from "../../../../shared/ui-discovery.ts";
import { ProtectScreen, type SheetName } from "./protect-screen";

export function LineProtect(props: {
  initialSelection?: MarketSelection | null;
  windows: readonly QuoteWindow[];
  city: string;
  statusLoading: boolean;
  statusFailed: boolean;
  onCityChange: (cityId: string) => void;
  onWallet: () => void;
}) {
  const params = new URLSearchParams(location.search);
  const queryPeril = PERILS.find((p) => p.id === params.get("peril"))?.id ?? PERILS[0].id;
  const wallet = useWallet();
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem(FIRST_RUN_KEY) !== "1"; } catch { return true; } });
  const modal = useWalletModal();
  const [peril, setPeril] = useState<PerilId>(props.initialSelection?.peril ?? queryPeril);
  const [tenor, setTenor] = useState<"weekly" | "monthly">(props.initialSelection?.tenor ?? (params.get("tenor") === "monthly" ? "monthly" : "weekly"));
  const [cover, setCover] = useState<CoverSize>(100);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(props.initialSelection?.trigger ?? (params.has("trigger") && Number.isFinite(Number(params.get("trigger"))) ? Number(params.get("trigger")) : null));
  const [sheet, setSheet] = useState<SheetName>(null);
  const [signing, setSigning] = useState(false);
  const [bought, setBought] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const firstRender = useRef(true);
  const [selectedWindow, setSelectedWindow] = useState(() => props.initialSelection?.windowStart && props.initialSelection.windowEnd ? { start: props.initialSelection.windowStart, end: props.initialSelection.windowEnd } : params.get("start")?.match(/^\d{4}-\d{2}-\d{2}$/) && params.get("end")?.match(/^\d{4}-\d{2}-\d{2}$/) ? { start: params.get("start")!, end: params.get("end")! } : null);
  const request = windowQuoteRequest({ selectedWindow, cityId: props.city, peril, tenor, windows: props.windows, nowSeconds: Math.floor(Date.now() / 1000) });
  const quotes = useQuery({
    queryKey: ["window-quote", request.path, retry],
    queryFn: async () => {
      try { return await api<WindowQuote>(request.path!); }
      catch (error) { if (quoteNotOpen(error)) return null; throw error; }
    },
    retry: false,
    enabled: request.path != null,
  });
  const portfolio = useQuery({
    queryKey: ["portfolio", wallet.publicKey?.toBase58()],
    queryFn: () => api<Portfolio>(`/api/portfolio/${wallet.publicKey!.toBase58()}`),
    enabled: Boolean(wallet.publicKey),
    retry: false,
  });
  const quote = matchingQuote(quotes.data, { cityId: props.city, peril, ...request });
  const coveredMarket = quote?.rungs.find((rung) => rung.marketAddress && (rung.marketAddress === bought || portfolio.data?.protections.some((position) => position.market === rung.marketAddress)))?.marketAddress ?? null;
  const loading = props.statusLoading || (request.path != null && quotes.isPending);
  const failed = request.path != null && quotes.isError;
  const model = useMemo(() => buildProtectModel({
    cityId: props.city,
    peril,
    tenor,
    windowStart: request.start,
    windowEnd: request.end,
    quote,
    single: null,
    loading,
    failed,
    connected: wallet.connected,
    signing,
    cover,
    selectedTrigger,
    defaultTrigger: null,
    coveredMarket,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
  }), [props.city, peril, tenor, quote, request.start, request.end, loading, failed, wallet.connected, signing, cover, selectedTrigger, coveredMarket]);

  useEffect(() => { if (firstRender.current) { firstRender.current = false; return; } setSelectedTrigger(null); setSelectedWindow(null); setBought(null); setSheet(null); }, [props.city, tenor, peril]);

  const approve = async () => {
    const market = quote?.rungs.find((rung) => rung.triggerValue === model.selected)?.marketAddress;
    if (model.panel.kind !== "ready" || model.blocked || model.chips.some((chip) => chip.selected && chip.disabled) || !market || !wallet.publicKey) return;
    setSignError(null);
    setSigning(true);
    try {
      const unsigned = await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: "open_position", market, wallet: wallet.publicKey.toBase58(), amount: `${cover}000000`, approved: true }),
      });
      await signAndSend(unsigned.base64, wallet);
      setBought(market);
      setSheet(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      if (!/reject|cancel|declin/i.test(message)) setSignError(CHAIN_ERROR);
    } finally {
      setSigning(false);
    }
  };

  return (
    <>
    {intro ? <div className="ln ln-intro-wrap"><FirstRun onDismiss={() => { setIntro(false); try { localStorage.setItem(FIRST_RUN_KEY, "1"); } catch { /* In-memory dismissal still works. */ } }}/></div> : null}
    <ProtectScreen
      model={model}
      cityId={props.city}
      windowStart={request.start}
      sheet={sheet}
      motion="run"
      signError={signError}
      onSheet={setSheet}
      onPeril={setPeril}
      onTenor={setTenor}
      onCity={(cityId) => { if (cityById(cityId)) props.onCityChange(cityId); }}
      onSelect={setSelectedTrigger}
      onCover={setCover}
      onConnect={() => modal.setVisible(true)}
      onApprove={() => { void approve(); }}
      onWallet={props.onWallet}
      onRetry={() => { setRetry((count) => count + 1); void quotes.refetch(); }}
    />
    </>
  );
}
