import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import type { ClaimReadiness, DevnetStatus, Portfolio } from "@/lib/types";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
import { COVERED_TITLE, EXPLORER_LINK_LABEL, ONE_PROTECTION_NOTE, coveredPlaceLine, coveredReceiptRows, devnetExplorerUrl, formatQuoteSkyt, stationDisplayName, windowStamp } from "../../../shared/protect-copy";
import { committedWindowLabel, windowStartLabel } from "../../../shared/window-chain";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];

/** One indexed protection, shown as a gauge receipt. Figures come from the position and its window. */
export function ProtectionGauges({ protections, windows }: { protections: Portfolio["protections"]; windows: readonly WindowRow[] }) {
  if (!protections.length) return null;
  return <div className="space-y-4">
    <h2 className="text-sm font-semibold text-[var(--fg-2)]">Active</h2>
    <ul className="space-y-4">{protections.map((protection) => <li key={protection.address}><ProtectionGauge protection={protection} window={windows.find((row) => row.address === protection.market)} /></li>)}</ul>
    <p className="text-xs text-[var(--fg-3)]">{ONE_PROTECTION_NOTE}</p>
  </div>;
}

function ProtectionGauge({ protection, window }: { protection: Portfolio["protections"][number]; window?: WindowRow }) {
  const { publicKey } = useWallet();
  const claim = useQuery({
    queryKey: ["claim-readiness", protection.market, publicKey?.toBase58()],
    queryFn: () => api<ClaimReadiness>(`/api/markets/${protection.market}/positions/${publicKey!.toBase58()}/claim-readiness`),
    enabled: Boolean(publicKey),
    retry: false,
  });
  const state = claim.data?.state;
  const settled = state === "claimed" || state === "not_claimable" || state === "expired";
  const trigger = millimetres(window?.thresholdMmX100);
  const observed = millimetres(claim.data?.observation?.rainfallMmX100);
  const maxMm = trigger ? trigger * 1.25 : 1;
  const level = trigger != null && observed != null ? Math.min(1, observed / maxMm) : 0;
  const refund = state === "claimed" && (claim.data?.action === "claim_premium_refund" || /refund/i.test(claim.data?.result ?? ""));
  const payoutLabel = formatQuoteSkyt(protection.protectedAmount, 0);
  const stamp = windowStamp({
    closed: settled,
    paidOut: state === "claimed" && !refund,
    payoutLabel,
    observedMm: observed,
    triggerMm: trigger,
    monthly: window?.tenor === "monthly",
  });
  const triggerLabel = trigger != null ? `≥ ${Number.isInteger(trigger) ? String(trigger) : trigger.toFixed(1)} mm` : null;
  const windowLabel = window ? committedWindowLabel(window) : null;
  const rows = coveredReceiptRows({
    premiumPaid: protection.premiumPaid,
    coverAmount: protection.protectedAmount,
    trigger: triggerLabel,
    windowLabel,
    observedMm: observed,
    windowStart: window ? windowStartLabel(window) : null,
  });
  const city = window ? consumerCityBySlug(window.city) : null;
  const place = coveredPlaceLine({ city: city?.city, station: stationDisplayName(city?.source), windowLabel });
  const explorer = devnetExplorerUrl({ address: protection.address });
  return <article className="flex min-w-0 items-start gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--surface-1)] p-4">
    <RainGauge level={level} ticks={trigger != null ? gaugeTicks([{ mm: trigger, selected: true }], maxMm) : []} label={trigger != null ? `Trigger line at ${trigger} mm` : "Rain gauge"} />
    <div className="min-w-0 flex-1">
      {stamp ? <p className={`receipt-stamp receipt-stamp--${stamp.tone}`}>{stamp.title}<span className="mt-1 block font-sans text-[0.7rem] font-normal">{stamp.subline}</span></p> : null}
      <h3 className="text-base font-semibold">{COVERED_TITLE}</h3>
      {place ? <p className="mt-1 text-sm text-[var(--fg-2)]">{place}</p> : null}
      <dl className="mt-2 space-y-1 font-mono text-sm">
        {rows.map((row) => <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--fg-3)]">{row.label}</dt>
          <dd className={row.payout ? "text-[var(--slicker)]" : "text-[var(--fg)]"}>{row.value}</dd>
        </div>)}
      </dl>
      {settled ? <p className="mt-2 text-sm font-semibold text-[var(--fg-2)]">Settled</p> : <p className="mt-2 text-sm font-semibold text-[var(--glacier)]">Active</p>}
      {explorer ? <a href={explorer} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-12 items-center text-sm font-medium text-[var(--glacier)]">{EXPLORER_LINK_LABEL}</a> : null}
    </div>
  </article>;
}

function millimetres(raw: string | null | undefined): number | null {
  if (raw == null || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw) / 100;
  return Number.isFinite(value) ? value : null;
}
