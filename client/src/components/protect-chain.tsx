import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
import { LIVE_CITY_SLUGS } from "../../../shared/window-ladder";
import { payGet } from "../../../shared/pay-get";
import { COVER_CHIPS, ladderTicks, protectButtonLabel, stakeSheetForCover, stationDisplayName } from "../../../shared/protect-copy";
import { committedWindowLabel } from "../../../shared/window-chain";
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
import { buyCtaVisible, coverageChipOn, gaugeMode, nextWeeklyOpenCopy, openCityPrompt, protectSurface } from "../../../shared/protect-surface";

type WindowRow = NonNullable<DevnetStatus["cityWindows"]>[number];
const CHIPS = COVER_CHIPS;

function cityRank(slug: string): number {
  const index = (LIVE_CITY_SLUGS as readonly string[]).indexOf(slug);
  return index < 0 ? LIVE_CITY_SLUGS.length : index;
}

export function ProtectChain(props: { windows: readonly WindowRow[]; city?: string; connected: boolean; onCityChange?: (slug: string) => void; onCovered?: () => void; statusLoading?: boolean; statusFailed?: boolean; onRetry?: () => void }) {
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
  const station = stationDisplayName(source);
  const expiryDate = active ? expiryChipLabel(active)?.split(" · ")[0] ?? "" : "";
  const windowLabel = active ? committedWindowLabel(active) : null;
  const quote = chosen ? payGet({ coverageSkyt: amount, premiumRateBps: chosen.premiumRateBps, probabilityBps: chosen.probabilityBps }) : null;
  const button = protectButtonLabel({ connected: props.connected, premiumLabel: quote?.payLabel ?? null, triggerChosen: chosen != null });
  const ready = button.action === "protect";
  const maxMm = Math.max(1, ...rows.map((row) => row.thresholdMm), 1);
  const terms = chosen && windowLabel && station ? stakeSheetForCover({
    coverSkyt: amount,
    probabilityBps: chosen.probabilityBps,
    premiumRateBps: chosen.premiumRateBps,
    inputsHash: active?.quoteInputsHash ?? null,
    station,
    triggerMm: chosen.thresholdMm,
    windowLabel,
  }) : null;
  const ladderMarks = ladderTicks(rows, chosen?.thresholdMm ?? null);
  const ticks = gaugeTicks(ladderMarks.map((tick) => ({ mm: tick.thresholdMm, selected: tick.state === "selected" })), maxMm);
  const surface = protectSurface({
    loading: !!props.statusLoading || (windows.length > 0 && evidence.isLoading),
    failed: !!props.statusFailed || (windows.length > 0 && evidence.isError),
    openWindowCount: windows.length,
  });
  const mode = gaugeMode({ surface, evidenceLoading: evidence.isLoading, pricedRowCount: ladder.priced.length });
  const priced = surface === "ready" && ladder.priced.length > 0;
  const showCta = buyCtaVisible(surface, priced);
  const otherCity = openCityPrompt(props.windows, city);
  const retry = () => { void evidence.refetch(); props.onRetry?.(); };

  return <section className="protect-layout" aria-label="Protect chain">
    <div className="protect-main">
      <p className="protect-eyebrow">Rain</p>
      <h2 className="protect-city">{place}</h2>
      <p className="protect-station">{active && expiryDate ? measuredAtLine(source, expiryDate) : measuredAtLine(source, "expiry")}</p>
      <div className="relative mt-3">
        <div className="sky-scroll-x flex min-w-0 gap-2 pb-2" role="radiogroup" aria-label="City, scroll for more">
          {LIVE_CITY_SLUGS.map((slug) => <button key={slug} type="button" role="radio" aria-checked={slug === city} className="min-h-12 shrink-0 rounded-full border px-3 text-sm" style={slug === city ? selectedStyle : idleStyle} onClick={() => { setCity(slug); props.onCityChange?.(slug); }}>{consumerCityBySlug(slug)?.city ?? slug}</button>)}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-gradient-to-r from-transparent from-20% to-[var(--background)] pr-1 text-xs font-semibold text-[var(--muted-foreground)]" aria-hidden="true">More</div>
      </div>
      {windows.length ? <div className="relative mt-2"><div className="flex min-w-0 gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Expiry">
        {windows.map((window) => {
          const on = window.address === active?.address;
          const label = expiryChipCopy(window, now) ?? "Expiry";
          return <button key={window.address} type="button" role="radio" aria-checked={on} className="min-h-12 shrink-0 rounded-2xl border px-3 py-2 text-left" style={on ? selectedStyle : idleStyle} onClick={() => { setSelected(window.address); setTriggerMm(null); setSheet(false); }}>
            <span className="block whitespace-nowrap text-sm font-semibold">{label}</span>
          </button>;
        })}
      </div><div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-[var(--background)]" aria-hidden="true" /></div> : null}
      {priced ? <div className="protect-amounts mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Coverage amount in SKYT">
        {CHIPS.map((choice) => {
          const on = coverageChipOn(priced, String(choice), String(amount));
          return <button key={choice} type="button" aria-checked={on} className="min-h-12 rounded-full border px-4" style={on ? selectedStyle : idleStyle} onClick={() => setAmount(choice)}>{choice} SKYT</button>;
        })}
      </div> : null}
      {mode === "skeleton" ? <div className="protect-ladder" aria-busy="true" aria-label="Loading prices">
        <div className="relative h-44 w-14 overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="sky-shimmer absolute inset-0" />
          <span className="absolute right-1 top-8 h-0.5 w-4 bg-[var(--muted-foreground)]" />
          <span className="absolute right-1 top-16 h-0.5 w-4 bg-[var(--muted-foreground)]" />
          <span className="absolute right-1 top-24 h-0.5 w-4 bg-[var(--muted-foreground)]" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="sky-shimmer h-8 w-full" />
          <div className="sky-shimmer h-8 w-full" />
          <div className="sky-shimmer h-8 w-3/4" />
        </div>
      </div> : null}
      {mode === "gauge" ? <div className="protect-ladder">
        <RainGauge labelled level={chosen ? chosen.thresholdMm / maxMm : 0} ticks={ticks} label={chosen ? `Water at ${chosen.thresholdMm} millimetres` : "Rain gauge"} />
        <div className="protect-rows" role="list" aria-label="Rain triggers">
          {ladderMarks.map((tick) => tick.tappable ? <button key={tick.thresholdMm} type="button" aria-pressed={tick.state === "selected"} className={tick.state === "selected" ? "protect-row protect-row--selected" : "protect-row"} onClick={() => setTriggerMm(tick.thresholdMm)}>
            <span className="sky-mono">{tick.label}</span>
          </button> : <p key={tick.thresholdMm} className="protect-row protect-row--soon"><span className="sky-mono">{tick.label}</span></p>)}
          {ladder.soonCount > 0 ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{ladder.soonCount} more triggers open soon</p> : null}
        </div>
      </div> : null}
      {surface === "closed" ? <CalmCard title={nextWeeklyOpenCopy(city, now) ?? "The next weekly window is not on the schedule yet."} action="Refresh" onAction={retry} link={otherCity} onLink={otherCity ? () => { setCity(otherCity.slug); props.onCityChange?.(otherCity.slug); } : undefined} /> : null}
      {surface === "error" ? <CalmCard title="Couldn't load prices" action="Retry" onAction={retry} /> : null}
      {surface === "ready" && mode === "hidden" ? <CalmCard title="Not ready to price yet. A validated NOAA evidence package is not available." action="Refresh" onAction={retry} /> : null}
      <p className="protect-footnote">Wind, snow and heat coming</p>
    </div>
    {showCta ? <aside className="protect-ticket" aria-label="Pay and payout">
      {quote && chosen && active ? <PayGetBars pay={quote.payLabel} getLabel={quote.getLabel} chance={quote.chance} multiple={quote.multiple} thresholdMm={chosen.thresholdMm} expiry={expiryDate} /> : null}
      <button type="button" className="mt-3 min-h-12 w-full rounded-full bg-[var(--foreground)] px-5 font-semibold text-[var(--background)] disabled:opacity-60" disabled={!ready} onClick={() => { if (ready) setSheet(true); }}>{button.label}</button>
    </aside> : null}
    {sheet && terms ? <ConfirmSheet terms={terms} amount={amount} onAmount={setAmount} onClose={() => setSheet(false)} onWallet={() => { setSheet(false); props.onCovered?.(); }} /> : null}
  </section>;
}

function CalmCard(props: { title: string; action: string; onAction: () => void; link?: { slug: string; label: string } | null; onLink?: () => void }) {
  return <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--muted-surface,#243044)] p-4">
    <p className="text-sm text-[var(--foreground)]">{props.title}</p>
    <button type="button" className="mt-3 min-h-12 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-4 text-sm font-semibold" onClick={props.onAction}>{props.action}</button>
    {props.link && props.onLink ? <button type="button" className="mt-2 block min-h-12 text-sm font-semibold text-[var(--identity)]" onClick={props.onLink}>{props.link.label}</button> : null}
  </div>;
}

function PayGetBars(props: { pay: string; getLabel: string; chance: string; multiple: string; thresholdMm: number; expiry: string }) {
  const pay = Number(props.pay);
  const get = Number(props.getLabel);
  const scale = get > 0 ? pay / get : 0;
  return <div aria-label="Pay and payout">
    <div className="flex items-end gap-3">
      <div className="flex min-w-0 flex-1 flex-col justify-end">
        <div className="rounded-t-md bg-[var(--muted-surface,#243044)]" style={{ height: `${Math.max(8, scale * 48)}px` }} />
        <p className="mt-1 text-sm">You pay <span className="sky-mono">{props.pay} SKYT</span></p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-end">
        <div className="h-12 rounded-t-md bg-[var(--slicker)]" />
        <p className="mt-1 break-words text-sm text-[var(--slicker)]">You get <span className="sky-mono">{props.getLabel} SKYT</span> if ≥{props.thresholdMm} mm by {props.expiry}</p>
      </div>
    </div>
    <p className="sky-mono mt-2 text-sm text-[var(--muted-foreground)]">{props.chance} chance · {props.multiple}</p>
  </div>;
}

function ConfirmSheet(props: { terms: NonNullable<ReturnType<typeof stakeSheetForCover>>; amount: (typeof CHIPS)[number]; onAmount: (amount: (typeof CHIPS)[number]) => void; onClose: () => void; onWallet: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Confirm protection">
    <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
      <div className="flex gap-2" role="radiogroup" aria-label="Coverage amount in SKYT">
        {CHIPS.map((choice) => <button key={choice} type="button" aria-checked={choice === props.amount} className="min-h-12 flex-1 rounded-full border px-3" style={choice === props.amount ? selectedStyle : idleStyle} onClick={() => props.onAmount(choice)}>{choice}</button>)}
      </div>
      <p className="sky-mono mt-4 text-sm text-[var(--foreground)]">{props.terms.payLine}</p>
      <p className="mt-1 text-sm text-[var(--slicker)]">{props.terms.getLine}</p>
      <p className="sky-mono mt-1 text-sm text-[var(--muted-foreground)]">{props.terms.multiple}</p>
      {props.terms.feeLine ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{props.terms.feeLine}</p> : null}
      <p className="mt-4 text-sm text-[var(--foreground)]">{props.terms.preSign}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="min-h-12 flex-1 rounded-full border px-4" onClick={props.onClose}>Back</button>
        <button type="button" className="min-h-12 flex-1 rounded-full bg-[var(--foreground)] px-4 font-semibold text-[var(--background)]" onClick={props.onWallet}>Wallet</button>
      </div>
    </div>
  </div>;
}

const idleStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--foreground)" };
const selectedStyle = { borderColor: "#F2C230", background: "transparent", color: "var(--foreground)" };
