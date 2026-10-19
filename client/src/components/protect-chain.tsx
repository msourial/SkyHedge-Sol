import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
import { LIVE_CITY_SLUGS } from "../../../shared/window-ladder";
import {
  chanceLabel,
  daysToExpiry,
  daysToExpiryLabel,
  expiryChipLabel,
  matchingWindowPackage,
  payoutMultipleLabel,
  pricePer100Label,
  settlementLine,
  sortByExpiry,
  triggerRows,
  type WindowEvidencePackage,
} from "../../../shared/window-chain";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];

function cityRank(slug: string): number {
  const index = (LIVE_CITY_SLUGS as readonly string[]).indexOf(slug);
  return index < 0 ? LIVE_CITY_SLUGS.length : index;
}

export function ProtectChain(props: { windows: readonly WindowRow[]; city?: string; onCityChange?: (slug: string) => void }) {
  const cities = useMemo(
    () => [...new Set(props.windows.map((window) => window.city))].sort((left, right) => cityRank(left) - cityRank(right)),
    [props.windows],
  );
  const requested = props.city && (cities.includes(props.city) || consumerCityBySlug(props.city))
    ? props.city
    : cities.includes("new-york") ? "new-york" : cities[0] ?? "new-york";
  const [city, setCity] = useState(requested);
  const windows = sortByExpiry(props.windows.filter((window) => window.city === city));
  const [selected, setSelected] = useState(windows[0]?.address ?? "");
  const [amount, setAmount] = useState<"50" | "100" | "250">("100");
  const [hold, setHold] = useState<string | null>(null);
  const active = windows.find((window) => window.address === selected) ?? windows[0] ?? null;
  const evidence = useQuery({
    queryKey: ["window-evidence", city],
    queryFn: () => api<{ packages: WindowEvidencePackage[] }>(`/api/devnet/status?resource=window-evidence&city=${encodeURIComponent(city)}`),
    retry: false,
  });
  useEffect(() => { setCity(requested); }, [requested]);
  useEffect(() => { setSelected(windows[0]?.address ?? ""); setHold(null); }, [city]);
  const pkg = active ? matchingWindowPackage(evidence.data?.packages, city, active.observationStart, active.observationEnd) : null;
  const onChainMm = active?.thresholdMmX100 && /^\d+$/.test(active.thresholdMmX100) ? Number(active.thresholdMmX100) / 100 : null;
  const rows = pkg ? triggerRows({
    totalsMm: pkg.analogueTotalsMm,
    forecastCumulativeMm: pkg.forecastCumulativeMm,
    onChainThresholdMm: onChainMm,
    onChainProbabilityBps: active?.quoteProbabilityBps ?? null,
    onChainPremiumRateBps: active?.premiumRateBps ?? null,
  }) : [];
  const now = Math.floor(Date.now() / 1000);
  const source = consumerCityBySlug(city)?.source ?? "NOAA station";
  const place = consumerCityBySlug(city)?.city ?? city;

  return <section className="chain max-w-full min-w-0" aria-label="Protect chain" style={{ hyphens: "none", wordBreak: "keep-all", overflowWrap: "normal" }}>
    <p className="text-sm text-[var(--muted-foreground)]">{settlementLine(source)}</p>
    <h2 className="mt-1 text-2xl font-semibold">{place}</h2>
    <div className="sky-scroll-x -mx-4 mt-3 flex gap-2 px-4 pe-6 pb-2" role="radiogroup" aria-label="City">
      {cities.map((slug) => <button key={slug} type="button" role="radio" aria-checked={slug === city} className="min-h-12 shrink-0 rounded-full border px-3 text-sm" style={slug === city ? selectedStyle : idleStyle} onClick={() => { setCity(slug); props.onCityChange?.(slug); }}>{consumerCityBySlug(slug)?.city ?? slug}</button>)}
    </div>
    <div className="pr-4">
    <div className="sky-scroll-x mt-2 flex gap-2 pe-8 pb-3" role="radiogroup" aria-label="Expiry">
      {windows.map((window) => {
        const on = window.address === active?.address;
        const label = expiryChipLabel(window) ?? "Expiry";
        const days = daysToExpiryLabel(daysToExpiry(window.observationEnd, now));
        return <button key={window.address} type="button" role="radio" aria-checked={on} className="min-h-12 shrink-0 rounded-2xl border px-2.5 py-2 text-left" style={on ? selectedStyle : idleStyle} onClick={() => { setSelected(window.address); setHold(null); }}>
          <span className="block whitespace-nowrap text-sm font-semibold">{label}</span>
          <span className="block whitespace-nowrap text-xs text-[var(--muted-foreground)]">{days}</span>
        </button>;
      })}
    </div>
    </div>
    <div role="table" aria-label="Rain triggers" className="max-w-full">
      <div role="row" className="grid grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.35fr)_minmax(0,1.15fr)] gap-x-2 px-1 text-[11px] leading-tight text-[var(--muted-foreground)]" style={{ wordBreak: "keep-all" }}>
        <span>Trigger</span><span>Chance</span><span className="text-right">Per 100 SKYT</span><span className="text-right">Payout</span>
      </div>
      {evidence.isLoading ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Checking NOAA analogue history…</p> : null}
      {evidence.isError ? <p className="mt-3 text-sm" role="alert">Not ready to price yet. A validated NOAA evidence package is not available.</p> : null}
      {!evidence.isLoading && !evidence.isError && !pkg ? <p className="mt-3 text-sm" role="alert">Not ready to price yet. A validated NOAA evidence package is not available.</p> : null}
      {rows.map((row) => {
        const live = row.onChain;
        return <button key={row.thresholdMm} type="button" role="row" disabled={!live} aria-disabled={!live} className="mt-1 grid min-h-12 w-full grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.35fr)_minmax(0,1.15fr)] items-center gap-x-2 rounded-xl px-1 text-left text-[13px]" style={{ background: row.popular ? "var(--identity-dim)" : "transparent", border: row.popular ? "1px solid var(--identity)" : "1px solid transparent", color: live ? "var(--foreground)" : "var(--faint)" }}>
          <span className="whitespace-nowrap">{`≥ ${row.thresholdMm} mm`}</span>
          <span className="whitespace-nowrap">{chanceLabel(row.probabilityBps) ?? "—"}</span>
          <span className="text-right whitespace-nowrap">{live ? pricePer100Label(row.premiumRateBps) ?? "—" : "Coming soon"}</span>
          <span className="text-right whitespace-nowrap">{live ? payoutMultipleLabel(row.premiumRateBps) ?? "—" : "—"}</span>
        </button>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Coverage amount in SKYT">
      {(["50", "100", "250"] as const).map((choice) => <button key={choice} type="button" className="min-h-12 rounded-full border px-4" style={amount === choice ? selectedStyle : idleStyle} onClick={() => setAmount(choice)}>{choice} SKYT</button>)}
    </div>
    <button type="button" className="mt-4 min-h-12 rounded-full bg-[var(--identity)] px-5 font-semibold text-[var(--action-text)]" onClick={() => setHold(`One Phantom approval: unsigned Devnet open_position for ${amount} test SKYT on ${place} ${active ? expiryChipLabel(active) : "this expiry"}. Nothing is signed or sent from this screen.`)}>Protect</button>
    {hold ? <p className="mt-3 text-sm" role="status">{hold}</p> : null}
  </section>;
}

const idleStyle = { borderColor: "var(--border)", background: "var(--surface-1)" };
const selectedStyle = { borderColor: "var(--identity)", background: "var(--identity-dim)", color: "var(--identity-deep)" };
