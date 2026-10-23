import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import type { ClaimReadiness, DevnetStatus, Portfolio } from "@/lib/types";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";
import { notTriggeredLine } from "../../../shared/pay-get.ts";
import { committedWindowLabel, daysToExpiry, daysToExpiryLabel } from "../../../shared/window-chain.ts";
import { EXPLORER_LINK_LABEL, ONE_PROTECTION_NOTE, coveredReceiptRows, devnetExplorerUrl } from "../../../shared/protect-copy.ts";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];

/** One indexed protection, shown as a gauge receipt. Figures come from the position and its window. */
export function ProtectionGauges({ protections, windows }: { protections: Portfolio["protections"]; windows: readonly WindowRow[] }) {
  if (!protections.length) return null;
  return <div className="space-y-3">
    <ul className="space-y-4">{protections.map((protection) => <li key={protection.address}><ProtectionGauge protection={protection} window={windows.find((row) => row.address === protection.market)} /></li>)}</ul>
    <p className="text-xs text-[var(--muted-foreground)]">{ONE_PROTECTION_NOTE}</p>
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
  const trigger = millimetres(window?.thresholdMmX100);
  const observed = millimetres(claim.data?.observation?.rainfallMmX100);
  const maxMm = trigger ? trigger * 1.25 : 1;
  const level = trigger != null && observed != null ? Math.min(1, observed / maxMm) : 0;
  const missed = observed != null && trigger != null ? notTriggeredLine(observed, trigger) : null;
  const settledMiss = claim.data?.state === "not_claimable" || claim.data?.state === "expired";
  const triggerLabel = trigger != null ? `≥ ${Number.isInteger(trigger) ? String(trigger) : trigger.toFixed(1)} mm` : null;
  const windowLabel = window ? committedWindowLabel(window) : null;
  const rows = coveredReceiptRows({ premiumPaid: protection.premiumPaid, coverAmount: protection.protectedAmount, trigger: triggerLabel, windowLabel });
  const explorer = devnetExplorerUrl({ address: protection.address });
  const days = window ? daysToExpiry(window.observationEnd, Math.floor(Date.now() / 1000)) : null;
  return <article className="flex min-w-0 items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
    <RainGauge level={level} ticks={trigger != null ? gaugeTicks([{ mm: trigger, selected: true }], maxMm) : []} label={trigger != null ? `Trigger line at ${trigger} mm` : "Rain gauge"} />
    <div className="min-w-0 flex-1">
      <h3 className="text-base font-semibold">You're covered</h3>
      <dl className="sky-mono mt-2 space-y-1 text-sm">
        {rows.map((row) => <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">{row.label}</dt>
          <dd className={row.payout ? "text-[var(--slicker)]" : "text-[var(--foreground)]"}>{row.value}</dd>
        </div>)}
      </dl>
      {missed && settledMiss ? <p className="sky-mono mt-2 text-sm text-[var(--slicker)]">{missed}</p> : null}
      {days != null ? <p className="sky-mono mt-1 text-xs text-[var(--muted-foreground)]">{daysToExpiryLabel(days)}</p> : null}
      {explorer ? <a href={explorer} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-[var(--identity)]">{EXPLORER_LINK_LABEL}</a> : null}
    </div>
  </article>;
}

function millimetres(raw: string | null | undefined): number | null {
  if (raw == null || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw) / 100;
  return Number.isFinite(value) ? value : null;
}
