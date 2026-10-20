import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
import { LIVE_CITY_SLUGS } from "../../../shared/window-ladder";
import { confirmSentence, payGet, protectCta } from "../../../shared/pay-get";
import {
  expiryChipCopy,
  expiryChipLabel,
  matchingWindowPackage,
  measuredAtLine,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
  type WindowEvidencePackage,
} from "../../../shared/window-chain";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];
const CHIPS = [50, 100, 250] as const;

function cityRank(slug: string): number {
  const index = (LIVE_CITY_SLUGS as readonly string[]).indexOf(slug);
  return index < 0 ? LIVE_CITY_SLUGS.length : index;
}

export function ProtectChain(props: { windows: readonly WindowRow[]; city?: string; connected: boolean; onCityChange?: (slug: string) => void; onCovered?: () => void }) {
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
  const [amount, setAmount] = useState<(typeof CHIPS)[number]>(100);
  const [triggerMm, setTriggerMm] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const active = windows.find((window) => window.address === selected) ?? windows[0] ?? null;
  const evidence = useQuery({
    queryKey: ["window-evidence", city],
    queryFn: () => api<{ packages: WindowEvidencePackage[] }>(`/api/devnet/status?resource=window-evidence&city=${encodeURIComponent(city)}`),
    retry: false,
  });
  useEffect(() => { setCity(requested); }, [requested]);
  useEffect(() => { setSelected(windows[0]?.address ?? ""); setTriggerMm(null); setSheet(false); }, [city]);
  const pkg = active ? matchingWindowPackage(evidence.data?.packages, city, active.observationStart, active.observationEnd) : null;
  const onChainMm = active?.thresholdMmX100 && /^\d+$/.test(active.thresholdMmX100) ? Number(active.thresholdMmX100) / 100 : null;
  const rows = pkg ? triggerRows({
    totalsMm: pkg.analogueTotalsMm,
    forecastCumulativeMm: pkg.forecastCumulativeMm,
    onChainThresholdMm: onChainMm,
    onChainProbabilityBps: active?.quoteProbabilityBps ?? null,
    onChainPremiumRateBps: active?.premiumRateBps ?? null,
  }) : [];
  const ladder = pricedTriggers(rows);
  const chosen = ladder.priced.find((row) => row.thresholdMm === triggerMm) ?? ladder.priced[0] ?? null;
  const now = Math.floor(Date.now() / 1000);
  const source = consumerCityBySlug(city)?.source ?? "NOAA station";
  const place = consumerCityBySlug(city)?.city ?? city;
  const expiryDate = active ? expiryChipLabel(active)?.split(" · ")[0] ?? "" : "";
  const quote = chosen ? payGet({ coverageSkyt: amount, premiumRateBps: chosen.premiumRateBps, probabilityBps: chosen.probabilityBps }) : null;
  const cta = protectCta({ connected: props.connected, quote, thresholdMm: chosen?.thresholdMm ?? null });
  const ready = props.connected && quote != null && chosen != null;
  const maxMm = Math.max(1, ...rows.map((row) => row.thresholdMm));
  const sentence = chosen && quote && expiryDate ? confirmSentence({ thresholdMm: chosen.thresholdMm, station: source, expiry: expiryDate, getLabel: quote.getLabel }) : null;

  return <section className="chain max-w-full min-w-0 pb-28" aria-label="Protect chain">
    <p className="text-sm font-semibold tracking-wide text-[var(--foreground)]">Rain</p>
    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{active && expiryDate ? measuredAtLine(source, expiryDate) : measuredAtLine(source, "expiry")}</p>
    <h2 className="mt-1 text-2xl font-semibold">{place}</h2>
    <p className="mt-2 text-sm text-[var(--muted-foreground)]">Wind, snow and heat coming</p>
    <div className="sky-scroll-x mt-3 flex min-w-0 gap-2 pb-2" role="radiogroup" aria-label="City">
      {cities.map((slug) => <button key={slug} type="button" role="radio" aria-checked={slug === city} className="min-h-12 shrink-0 rounded-full border px-3 text-sm" style={slug === city ? selectedStyle : idleStyle} onClick={() => { setCity(slug); props.onCityChange?.(slug); }}>{consumerCityBySlug(slug)?.city ?? slug}</button>)}
    </div>
    <div className="relative z-10 mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Coverage amount in SKYT">
      {CHIPS.map((choice) => <button key={choice} type="button" className="min-h-12 rounded-full border px-4" style={amount === choice ? selectedStyle : idleStyle} onClick={() => setAmount(choice)}>{choice} SKYT</button>)}
    </div>
    <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-3" role="radiogroup" aria-label="Expiry">
      {windows.map((window) => {
        const on = window.address === active?.address;
        const label = expiryChipCopy(window, now) ?? "Expiry";
        const days = label;
        return <button key={window.address} type="button" role="radio" aria-checked={on} className="min-h-12 shrink-0 rounded-2xl border px-3 py-2 text-left" style={on ? selectedStyle : idleStyle} onClick={() => { setSelected(window.address); setTriggerMm(null); setSheet(false); }}>
          <span className="block whitespace-nowrap text-sm font-semibold">{days}</span>
        </button>;
      })}
    </div>
    <div className="mt-2 flex items-end gap-4">
      <RainGauge
        level={chosen ? chosen.thresholdMm / maxMm : 0}
        ticks={gaugeTicks(ladder.priced.map((row) => ({ mm: row.thresholdMm, selected: row.thresholdMm === chosen?.thresholdMm })), maxMm)}
        label={chosen ? `Water at ${chosen.thresholdMm} millimetres` : "Rain gauge"}
      />
      <div className="min-w-0 flex-1" role="list" aria-label="Rain triggers">
        {evidence.isLoading ? <p className="text-sm text-[var(--muted-foreground)]">Checking NOAA analogue history…</p> : null}
        {evidence.isError || (!evidence.isLoading && !pkg) ? <p className="text-sm" role="alert">Not ready to price yet. A validated NOAA evidence package is not available.</p> : null}
        {ladder.priced.map((row) => {
          const on = row.thresholdMm === chosen?.thresholdMm;
          const rowQuote = payGet({ coverageSkyt: 100, premiumRateBps: row.premiumRateBps, probabilityBps: row.probabilityBps });
          return <button key={row.thresholdMm} type="button" aria-pressed={on} className="mt-1 flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-sm" style={on ? selectedStyle : idleStyle} onClick={() => setTriggerMm(row.thresholdMm)}>
            <span className="sky-mono whitespace-nowrap">{`≥ ${row.thresholdMm} mm`}</span>
            <span className="sky-mono whitespace-nowrap">{rowQuote ? `${rowQuote.chance} · ${rowQuote.multiple}` : "—"}</span>
          </button>;
        })}
        {ladder.soonCount > 0 ? <p className="mt-2 text-sm text-[var(--muted-foreground)]">{ladder.soonCount} more triggers open soon</p> : null}
      </div>
    </div>
    {quote && chosen && active ? <PayGetBars pay={quote.payLabel} getLabel={quote.getLabel} chance={quote.chance} multiple={quote.multiple} thresholdMm={chosen.thresholdMm} expiry={expiryDate} /> : null}
    <button type="button" className="relative z-10 mt-4 min-h-12 rounded-full bg-[var(--foreground)] px-5 font-semibold text-[var(--background)] disabled:opacity-60" disabled={!ready} onClick={() => { if (ready) setSheet(true); }}>{cta}</button>
    {sheet && sentence && quote && chosen ? <ConfirmSheet sentence={sentence} station={source} expiry={expiryDate} pay={quote.payLabel} getLabel={quote.getLabel} onClose={() => setSheet(false)} onWallet={() => { setSheet(false); props.onCovered?.(); }} /> : null}
  </section>;
}

function PayGetBars(props: { pay: string; getLabel: string; chance: string; multiple: string; thresholdMm: number; expiry: string }) {
  const pay = Number(props.pay);
  const get = Number(props.getLabel);
  const scale = get > 0 ? pay / get : 0;
  return <div className="mt-4" aria-label="Pay and payout">
    <div className="flex items-end gap-3">
      <div className="flex min-w-0 flex-1 flex-col justify-end">
        <div className="rounded-t-md bg-[var(--muted-surface,#243044)]" style={{ height: `${Math.max(12, scale * 96)}px` }} />
        <p className="mt-1 text-sm">You pay <span className="sky-mono">{props.pay} SKYT</span></p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-end">
        <div className="h-24 rounded-t-md bg-[var(--slicker)]" />
        <p className="mt-1 break-words text-sm text-[var(--slicker)]">You get <span className="sky-mono">{props.getLabel} SKYT</span> if ≥{props.thresholdMm} mm by {props.expiry}</p>
      </div>
    </div>
    <p className="sky-mono mt-2 text-sm text-[var(--muted-foreground)]">{props.chance} chance · {props.multiple}</p>
  </div>;
}

function ConfirmSheet(props: { sentence: string; station: string; expiry: string; pay: string; getLabel: string; onClose: () => void; onWallet: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Confirm protection">
    <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
      <p className="text-base font-semibold">{props.sentence}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt>Station</dt><dd>{props.station}</dd></div>
        <div className="flex justify-between gap-3"><dt>Settlement</dt><dd>{props.expiry}</dd></div>
        <div className="flex justify-between gap-3"><dt>You pay</dt><dd className="sky-mono">{props.pay} SKYT</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-[var(--slicker)]">You get</dt><dd className="sky-mono text-[var(--slicker)]">{props.getLabel} SKYT</dd></div>
      </dl>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">This sheet does not sign a transaction.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="min-h-12 flex-1 rounded-full border px-4" onClick={props.onClose}>Back</button>
        <button type="button" className="min-h-12 flex-1 rounded-full bg-[var(--foreground)] px-4 font-semibold text-[var(--background)]" onClick={props.onWallet}>Wallet</button>
      </div>
    </div>
  </div>;
}

const idleStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--foreground)" };
const selectedStyle = { borderColor: "#F2C230", background: "transparent", color: "var(--foreground)" };
