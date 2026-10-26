import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api, ApiError } from "@/lib/api";
import { finalizedWalletState, signAndSend } from "@/lib/solana";
import type { Portfolio, UnsignedTx } from "@/lib/types";
import { PERILS, cityById } from "../../../../shared/peril-registry.ts";
import { matchingQuote, pickDefaultWindow, quoteNotOpen, windowQuoteRequest, type QuoteWindow, type Tenor } from "../../../../shared/ui-window-quote.ts";
import { classifySignError, transitionSign, type SignAction, type SignState } from "../../../../shared/ui-sign.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../../shared/ui-types.ts";
import { buildProtectModel, type NotOpenLink } from "../../../../shared/ui-view.ts";
import type { MarketSelection } from "../../../../shared/ui-discovery.ts";
import type { SignSheetData } from "./pay-bar";
import { ProtectScreen, type SheetName } from "./protect-screen";

export function LineProtect(props: {
  initialSelection?: MarketSelection | null; windows: readonly QuoteWindow[]; city: string;
  statusLoading: boolean; statusFailed: boolean; onCityChange: (cityId: string) => void;
  onWallet: () => void; onMarkets: () => void;
}) {
  const params = new URLSearchParams(location.search);
  const wallet = useWallet();
  const modal = useWalletModal();
  const [peril, setPeril] = useState<PerilId>(props.initialSelection?.peril ?? PERILS.find((p) => p.id === params.get("peril"))?.id ?? "rain");
  const [tenorChoice, setTenorChoice] = useState<{ city: string; peril: PerilId; tenor: Tenor } | null>(() => {
    const explicit = props.initialSelection?.tenor ?? (params.get("tenor") === "monthly" ? "monthly" : params.get("tenor") === "weekly" ? "weekly" : null);
    return explicit ? { city: props.city, peril, tenor: explicit } : null;
  });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const defaultWindow = pickDefaultWindow({ cityId: props.city, peril, windows: props.windows, nowSeconds });
  const tenor = tenorChoice?.city === props.city && tenorChoice.peril === peril ? tenorChoice.tenor : defaultWindow.tenor ?? "weekly";
  const [cover, setCover] = useState<CoverSize>(100);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(props.initialSelection?.trigger ?? (params.has("trigger") && Number.isFinite(Number(params.get("trigger"))) ? Number(params.get("trigger")) : null));
  const [sheet, setSheet] = useState<SheetName>(null);
  const [sign, setSign] = useState<SignSheetData | null>(null);
  const frozen = useRef<{ market: string; cover: CoverSize; wallet: string } | null>(null);
  const submitting = useRef(false);
  const [bought, setBought] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState(() => props.initialSelection?.windowStart && props.initialSelection.windowEnd ? { start: props.initialSelection.windowStart, end: props.initialSelection.windowEnd } : params.get("start")?.match(/^\d{4}-\d{2}-\d{2}$/) && params.get("end")?.match(/^\d{4}-\d{2}-\d{2}$/) ? { start: params.get("start")!, end: params.get("end")! } : null);
  const request = windowQuoteRequest({ selectedWindow, cityId: props.city, peril, tenor, windows: props.windows, nowSeconds });
  const quotes = useQuery({ queryKey: ["window-quote", request.path], queryFn: async () => {
    try { return await api<WindowQuote>(request.path!); } catch (error) { if (quoteNotOpen(error)) return null; throw error; }
  }, retry: false, enabled: request.path != null });
  const portfolio = useQuery({ queryKey: ["portfolio", wallet.publicKey?.toBase58()],
    queryFn: () => api<Portfolio>(`/api/portfolio/${wallet.publicKey!.toBase58()}`), enabled: Boolean(wallet.publicKey), retry: false });
  const balances = useQuery({ queryKey: ["finalized-wallet", wallet.publicKey?.toBase58()],
    queryFn: () => finalizedWalletState(wallet.publicKey!), enabled: Boolean(wallet.publicKey), retry: false });
  const quote = matchingQuote(quotes.data, { cityId: props.city, peril, ...request });
  const heldPosition = portfolio.data?.protections.find((position) => quote?.rungs.some((rung) => rung.marketAddress === position.market));
  const coveredMarket = heldPosition?.market ?? (quote?.rungs.some((rung) => rung.marketAddress === bought) ? bought : null);
  const heldCover = heldPosition && [50, 100, 250].find((size) => BigInt(size) * 1_000_000n === BigInt(heldPosition.protectedAmount)) as CoverSize | undefined;
  const loading = props.statusLoading || (request.path != null && quotes.isPending);
  const failed = props.statusFailed || (request.path != null && quotes.isError);
  const model = useMemo(() => buildProtectModel({ cityId: props.city, peril, tenor, windowStart: request.start, windowEnd: request.end,
    quote, single: null, loading, failed, connected: wallet.connected, signing: false, cover: heldCover ?? cover, selectedTrigger,
    defaultTrigger: null, coveredMarket, settlement: null, usedSkyt: 0, reading: null, running: false,
    windows: props.windows, nowSeconds }), [props.city, peril, tenor, request.start, request.end, quote, loading, failed, wallet.connected, cover, heldCover, selectedTrigger, coveredMarket, props.windows, nowSeconds]);

  const choose = () => { setSelectedTrigger(null); setSelectedWindow(null); setSheet(null); };
  const go = (link: NotOpenLink) => {
    choose();
    if (link.tenor) setTenorChoice({ city: link.cityId, peril, tenor: link.tenor });
    if (link.windowStart && link.windowEnd) setSelectedWindow({ start: link.windowStart, end: link.windowEnd });
    if (link.cityId !== props.city) props.onCityChange(link.cityId);
  };
  const openSheet = (next: SheetName) => {
    if (next === "sign") {
      const market = quote?.rungs.find((rung) => rung.triggerValue === model.selected)?.marketAddress;
      if (!model.ticket || model.panel.kind !== "ready" || model.chips.some((chip) => chip.selected && chip.disabled) || !market || !wallet.publicKey) return;
      frozen.current = { market, cover, wallet: wallet.publicKey.toBase58() };
      setSign({ ticket: model.ticket, state: { status: "review" }, context: {
        premiumBase: model.ticket.payoff.lossBase, balanceBase: balances.data?.skytBaseUnits ?? null,
        cityName: model.cityName, peril, triggerLabel: model.signRows[0].value, windowLabel: model.signRows[1].value,
      } });
    }
    setSheet(next);
  };
  const setSignState = (state: SignState) => setSign((current) => current ? { ...current, state } : current);
  const approve = async () => {
    if (submitting.current || !frozen.current || !sign || sign.state.status !== "review") return;
    const attempt = frozen.current;
    if (portfolio.data?.protections.some((position) => position.market === attempt.market)) { setSignState({ status: "error", kind: "already-covered" }); return; }
    if (wallet.publicKey?.toBase58() !== attempt.wallet || !wallet.connected) { setSignState({ status: "error", kind: "other" }); return; }
    submitting.current = true;
    let reachedWallet = false;
    setSignState(transitionSign(sign.state, { type: "approve" }));
    try {
      const unsigned = await api<UnsignedTx>("/api/transactions/unsigned", { method: "POST", body: JSON.stringify({
        action: "open_position", market: attempt.market, wallet: attempt.wallet, amount: (BigInt(attempt.cover) * 1_000_000n).toString(), approved: true,
      }) });
      reachedWallet = true;
      await signAndSend(unsigned.base64, wallet, (step) => setSignState({ status: "progress", step }));
      setBought(attempt.market);
      setSignState({ status: "success" });
      void portfolio.refetch();
    } catch (reason) {
      console.error("Cover submission failed", reason);
      setSignState({ status: "error", kind: reason instanceof ApiError && (reason.status == null || reason.status >= 500) ? "unconfirmed" : classifySignError({ message: reason instanceof Error ? reason.message : "", reachedWallet, duplicate: false }) });
    } finally { submitting.current = false; }
  };
  const signAction = (action: SignAction) => {
    if (action === "approve") { void approve(); return; }
    if (action === "retry") { setSignState({ status: "review" }); return; }
    if (action === "wait") return;
    setSheet(null);
    if (action === "wallet") props.onWallet();
    if (action === "markets") props.onMarkets();
  };
  return <ProtectScreen model={model} cityId={props.city} windowStart={request.start} sheet={sheet} motion="run"
    sign={sign} onSignAction={signAction} onSheet={openSheet}
    onPeril={(value) => { choose(); setPeril(value); setTenorChoice(null); }}
    onTenor={(value) => { choose(); setTenorChoice({ city: props.city, peril, tenor: value }); }}
    onCity={(cityId) => { if (cityById(cityId)) { choose(); setTenorChoice(null); props.onCityChange(cityId); } }}
    onGo={go} onSelect={setSelectedTrigger} onCover={setCover} onConnect={() => modal.setVisible(true)}
    onWallet={props.onWallet} onRetry={() => { void quotes.refetch(); }} />;
}
