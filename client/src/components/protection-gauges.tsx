import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import type { ClaimReadiness, DevnetStatus, Portfolio } from "@/lib/types";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";
import { notTriggeredLine } from "../../../shared/pay-get.ts";
import { daysToExpiry, daysToExpiryLabel, expiryChipLabel } from "../../../shared/window-chain.ts";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];

/** One indexed protection. Water and the trigger come only from claim and window records. */
export function ProtectionGauges({ protections, windows }: { protections: Portfolio["protections"]; windows: readonly WindowRow[] }) {
  if (!protections.length) return null;
  return <ul className="space-y-4">{protections.map((protection) => <li key={protection.address}><ProtectionGauge protection={protection} window={windows.find((row) => row.address === protection.market)} /></li>)}</ul>;
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
  const date = window ? expiryChipLabel(window)?.split(" · ")[0] ?? null : null;
  const days = window ? daysToExpiry(window.observationEnd, Math.floor(Date.now() / 1000)) : null;
  const settledMiss = claim.data?.state === "not_claimable" || claim.data?.state === "expired";
  return <article className="flex min-w-0 items-end gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
    <RainGauge level={level} ticks={trigger != null ? gaugeTicks([{ mm: trigger, selected: true }], maxMm) : []} label={window ? `${window.city} rain gauge` : "Rain gauge"} />
    <div className="min-w-0">
      <h3 className="text-base font-semibold">{window?.city ?? "Protection"}</h3>
      {missed && settledMiss ? <p className="sky-mono mt-1 text-sm text-[var(--payout)]">{missed}</p> : date && !settledMiss ? <p className="mt-1 text-sm">You're covered through {date}</p> : null}
      <p className="sky-mono mt-1 text-sm text-[var(--muted-foreground)]">{observed != null && trigger != null && !missed ? `${observed} of ${trigger} mm` : observed == null ? "Rainfall to date is not in this record." : null}</p>
      {days != null ? <p className="sky-mono mt-1 text-sm text-[var(--muted-foreground)]">{daysToExpiryLabel(days)}</p> : null}
      <a href="/app?tab=wallet" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium">Wallet</a>
    </div>
  </article>;
}

function millimetres(raw: string | null | undefined): number | null {
  if (raw == null || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw) / 100;
  return Number.isFinite(value) ? value : null;
}
