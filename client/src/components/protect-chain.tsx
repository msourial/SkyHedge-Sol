import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
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

export function ProtectChain(props: { windows: readonly WindowRow[] }) {
  const cities = [...new Set(props.windows.map((window) => window.city))];
  const [city, setCity] = useState(cities.includes("new-york") ? "new-york" : cities[0] ?? "new-york");
  const windows = sortByExpiry(props.windows.filter((window) => window.city === city));
  const [selected, setSelected] = useState(windows[0]?.address ?? "");
  const [amount, setAmount] = useState<"50" | "100" | "250">("100");
  const [hold, setHold] = useState<string | null>(null);
  const active = windows.find((window) => window.address === selected) ?? windows[0] ?? null;
  const evidence = useQuery({
    queryKey: ["window-evidence", city],
    queryFn: () => api<{ packages: WindowEvidencePackage[] }>(`/api/window-evidence?city=${encodeURIComponent(city)}`),
    retry: false,
  });
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
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="City">
      {cities.map((slug) => <button key={slug} type="button" role="radio" aria-checked={slug === city} className="min-h-12 shrink-0 rounded-full border px-3 text-sm" style={slug === city ? selectedStyle : idleStyle} onClick={() => setCity(slug)}>{consumerCityBySlug(slug)?.city ?? slug}</button>)}
    </div>
    <div className="mt-2 flex gap-2 overflow-x-auto pb-3" role="radiogroup" aria-label="Expiry">
      {windows.map((window) => {
        const on = window.address === active?.address;
        const label = expiryChipLabel(window) ?? "Expiry";
        const days = daysToExpiryLabel(daysToExpiry(window.observationEnd, now));
        return <button key={window.address} type="button" role="radio" aria-checked={on} className="min-h-12 min-w-[7.5rem] shrink-0 rounded-2xl border px-3 py-2 text-left" style={on ? selectedStyle : idleStyle} onClick={() => { setSelected(window.address); setHold(null); }}>
          <span className="block whitespace-nowrap text-sm font-semibold">{label}</span>
          <span className="block whitespace-nowrap text-xs text-[var(--muted-foreground)]">{days}</span>
        </button>;
      })}
    </div>
    <div role="table" aria-label="Rain triggers" className="max-w-full overflow-x-auto">
      <div role="row" className="grid min-w-[36rem] grid-cols-[1.1fr_0.8fr_1.3fr_1fr] gap-2 px-2 text-xs text-[var(--muted-foreground)]" style={{ wordBreak: "keep-all" }}>
        <span>Trigger (≥ mm)</span><span>Chance</span><span>Price per 100 SKYT</span><span>Payout multiple</span>
      </div>
      {evidence.isLoading ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Checking NOAA analogue history…</p> : null}
      {evidence.isError ? <p className="mt-3 text-sm" role="alert">Not ready to price yet. A validated NOAA evidence package is not available.</p> : null}
      {!evidence.isLoading && !evidence.isError && !pkg ? <p className="mt-3 text-sm" role="alert">Not ready to price yet. A validated NOAA evidence package is not available.</p> : null}
      {rows.map((row) => {
        const live = row.onChain;
        return <button key={row.thresholdMm} type="button" role="row" disabled={!live} aria-disabled={!live} className="mt-1 grid min-h-12 min-w-[36rem] w-full grid-cols-[1.1fr_0.8fr_1.3fr_1fr] items-center gap-2 rounded-xl px-2 text-left text-sm" style={{ background: row.popular ? "var(--identity-dim)" : "transparent", border: row.popular ? "1px solid var(--identity)" : "1px solid transparent", color: live ? "var(--foreground)" : "var(--faint)" }}>
          <span className="whitespace-nowrap">{`≥ ${row.thresholdMm} mm`}</span>
          <span className="whitespace-nowrap">{chanceLabel(row.probabilityBps) ?? "—"}</span>
          <span className="whitespace-nowrap">{live ? pricePer100Label(row.premiumRateBps) ?? "—" : "Coming soon"}</span>
          <span className="whitespace-nowrap">{live ? payoutMultipleLabel(row.premiumRateBps) ?? "—" : "Coming soon"}</span>
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
