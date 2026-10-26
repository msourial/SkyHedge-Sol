import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api } from "@/lib/api";
import { signAndSend } from "@/lib/solana";
import type { Portfolio, UnsignedTx } from "@/lib/types";
import { cityById } from "../../../../shared/peril-registry.ts";
import { CHAIN_ERROR } from "../../../../shared/ui-copy.ts";
import { matchingQuote, quoteNotOpen, windowQuoteRequest, type QuoteWindow } from "../../../../shared/ui-window-quote.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../../shared/ui-types.ts";
import { buildProtectModel } from "../../../../shared/ui-view.ts";
import { ProtectScreen, type SheetName } from "./protect-screen";

export function LineProtect(props: {
  windows: readonly QuoteWindow[];
  city: string;
  statusLoading: boolean;
  statusFailed: boolean;
  onCityChange: (cityId: string) => void;
  onWallet: () => void;
}) {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [peril, setPeril] = useState<PerilId>("rain");
  const [tenor, setTenor] = useState<"weekly" | "monthly">("weekly");
  const [cover, setCover] = useState<CoverSize>(100);
  const [selectedTrigger, setSelectedTrigger] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [signing, setSigning] = useState(false);
  const [bought, setBought] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = windowQuoteRequest({ cityId: props.city, peril, tenor, windows: props.windows, nowSeconds: Math.floor(Date.now() / 1000) });
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

  useEffect(() => { setSelectedTrigger(null); setBought(null); setSheet(null); }, [props.city, tenor, peril]);

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
  );
}
