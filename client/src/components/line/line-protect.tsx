import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api } from "@/lib/api";
import { signAndSend } from "@/lib/solana";
import type { Portfolio, UnsignedTx } from "@/lib/types";
import { cityById } from "../../../../shared/peril-registry.ts";
import { CHAIN_ERROR } from "../../../../shared/ui-copy.ts";
import { rainQuoteForWindow, soonestWindow, type RainWindow } from "../../../../shared/ui-rain-quote.ts";
import type { CoverSize, PerilId } from "../../../../shared/ui-quote-types.ts";
import { upcomingWindow } from "../../../../shared/ui-ladder.ts";
import { buildProtectModel } from "../../../../shared/ui-view.ts";
import type { WindowEvidencePackage } from "../../../../shared/window-chain.ts";
import { ProtectScreen, type SheetName } from "./protect-screen";

export function LineProtect(props: {
  windows: readonly RainWindow[];
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
  const evidence = useQuery({
    queryKey: ["window-evidence", props.city, retry],
    queryFn: () => api<{ packages: WindowEvidencePackage[] }>(`/api/devnet/status?resource=window-evidence&city=${encodeURIComponent(props.city)}`),
    retry: false,
    enabled: peril === "rain",
  });
  const portfolio = useQuery({
    queryKey: ["portfolio", wallet.publicKey?.toBase58()],
    queryFn: () => api<Portfolio>(`/api/portfolio/${wallet.publicKey!.toBase58()}`),
    enabled: Boolean(wallet.publicKey),
    retry: false,
  });
  const now = Math.floor(Date.now() / 1000);
  const dates = upcomingWindow(Date.now(), tenor);
  const window = peril === "rain" ? soonestWindow(props.windows, props.city, tenor, now) : null;
  const rain = window ? rainQuoteForWindow(window, evidence.data?.packages) : { quote: null, defaultTrigger: null };
  const quote = peril === "rain" ? rain.quote : null;
  const coveredMarket = bought ?? portfolio.data?.protections.find((position) => position.market === window?.address || quote?.rungs.some((rung) => rung.marketAddress === position.market))?.market ?? null;
  const loading = props.statusLoading || (peril === "rain" && !!window && evidence.isLoading);
  const failed = props.statusFailed || (peril === "rain" && !!window && evidence.isError);
  const model = useMemo(() => buildProtectModel({
    cityId: props.city,
    peril,
    tenor,
    windowStart: quote?.windowStart ?? (window ? new Date(window.observationStart * 1000).toISOString().slice(0, 10) : dates.start),
    windowEnd: quote?.windowEnd ?? (window ? new Date(window.observationEnd * 1000).toISOString().slice(0, 10) : dates.end),
    quote,
    single: null,
    loading,
    failed,
    connected: wallet.connected,
    signing,
    cover,
    selectedTrigger,
    defaultTrigger: rain.defaultTrigger,
    coveredMarket,
    settlement: null,
    usedSkyt: 0,
    reading: null,
    running: false,
  }), [props.city, peril, tenor, quote, window, dates.start, dates.end, loading, failed, wallet.connected, signing, cover, selectedTrigger, rain.defaultTrigger, coveredMarket]);

  useEffect(() => { setSelectedTrigger(null); setBought(null); setSheet(null); }, [props.city, tenor, peril]);

  const approve = async () => {
    const market = quote?.rungs.find((rung) => rung.triggerValue === model.selected || rung.triggerMm === model.selected)?.marketAddress;
    if (!market || !wallet.publicKey) return;
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
      windowStart={model.subline ? (quote?.windowStart ?? dates.start) : dates.start}
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
      onRetry={() => { setRetry((count) => count + 1); void evidence.refetch(); }}
    />
  );
}
