import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { finalizedWalletState } from "@/lib/solana";
import { consumerCityBySlug } from "../../../shared/consumer-cities";
import { LIVE_CITY_SLUGS } from "../../../shared/window-ladder";
import { payGet } from "../../../shared/pay-get";
import {
  COVER_AMOUNT_TITLE,
  COVER_CHIPS,
  MARKETS_FOOTER,
  gaugeWaterLevel,
  PRE_SIGN_CTA,
  PRE_SIGN_TITLE,
  balanceSkytLine,
  coverExceedsBalance,
  formatQuoteSkyt,
  gaugeMarkPlan,
  gaugeStateLine,
  ladderTicks,
  moreTriggersSoon,
  notEnoughSkyt,
  protectButtonLabel,
  protectHeader,
  stakeSheetForCover,
  stationDisplayName,
  type StakeSheetModel,
} from "../../../shared/protect-copy";
import {
  committedWindowLabel,
  expiryChipCopy,
  expiryChipLabel,
  matchingWindowPackage,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
  windowEndLabel,
  windowStartLabel,
  type WindowEvidencePackage,
} from "../../../shared/window-chain";
import { MixedCopy, QuoteAmount } from "@/components/figure";
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
  const [sheet, setSheet] = useState<false | "amount" | "sign">(false);
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
  const terms = chosen && windowLabel && station ? stakeSheetForCover({
    coverSkyt: amount,
    probabilityBps: chosen.probabilityBps,
    premiumRateBps: chosen.premiumRateBps,
    inputsHash: active?.quoteInputsHash ?? null,
    city: place,
    station,
    triggerMm: chosen.thresholdMm,
    windowLabel,
  }) : null;
  const ladderMarks = ladderTicks(rows, chosen?.thresholdMm ?? null);
  const plan = gaugeMarkPlan(rows.map((row) => ({ mm: row.thresholdMm, priced: row.onChain })), chosen?.thresholdMm ?? null);
  const maxMm = Math.max(1, ...plan.map((mark) => mark.mm));
  const ticks = gaugeTicks(plan.map((mark) => ({ mm: mark.mm, selected: mark.selected, labelled: mark.labelled })), maxMm);
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
  const header = protectHeader({ station: source, windowStart: active ? windowStartLabel(active) : null, windowEnd: active ? windowEndLabel(active) : null });
  const gaugeNote = gaugeStateLine({ observedMm: null, updated: null, windowStart: active ? windowStartLabel(active) : null });
  const soonLine = moreTriggersSoon(ladder.soonCount);
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;
  useEffect(() => {
    if ((preview === "stake" || preview === "sign") && terms) setSheet(preview === "sign" ? "sign" : "amount");
  }, [preview, terms]);

  return <section className="protect-layout" aria-label="Protect chain">
    <div className="protect-main">
      <h2 className="protect-city">{place}</h2>
      <p className="protect-station">{header.stationLine}</p>
      <p className="protect-station">{header.settleLine}</p>
      <div className="sky-scroll-x mt-3 flex min-w-0 gap-2 pb-2 pr-2" role="radiogroup" aria-label="City">
        {LIVE_CITY_SLUGS.map((slug) => <button key={slug} type="button" role="radio" aria-checked={slug === city} className={slug === city ? "gauge-chip gauge-chip--on shrink-0" : "gauge-chip shrink-0"} onClick={() => { setCity(slug); props.onCityChange?.(slug); }}>{consumerCityBySlug(slug)?.city ?? slug}</button>)}
      </div>
      {windows.length ? <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-2 pr-2" role="radiogroup" aria-label="Expiry">
        {windows.map((window) => {
          const on = window.address === active?.address;
          const label = expiryChipCopy(window, now) ?? "Expiry";
          return <button key={window.address} type="button" role="radio" aria-checked={on} className={on ? "gauge-chip gauge-chip--on shrink-0" : "gauge-chip shrink-0"} onClick={() => { setSelected(window.address); setTriggerMm(null); setSheet(false); }}>
            <span className="block whitespace-nowrap text-sm font-semibold">{label}</span>
          </button>;
        })}
      </div> : null}
      {priced ? <div className="protect-amounts mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Coverage amount in SKYT">
        {CHIPS.map((choice) => {
          const on = coverageChipOn(priced, String(choice), String(amount));
          return <button key={choice} type="button" role="radio" aria-checked={on} className={on ? "gauge-chip gauge-chip--on" : "gauge-chip"} onClick={() => setAmount(choice)}>{choice} SKYT</button>;
        })}
      </div> : null}
      {mode === "skeleton" ? <div className="protect-ladder" aria-busy="true" aria-label="Loading prices">
        <div className="relative h-44 w-14 overflow-hidden rounded-[999px] border border-[var(--tick)] bg-[var(--dry-fill)]">
          <div className="sky-shimmer absolute inset-0" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="sky-shimmer h-12 w-full" />
          <div className="sky-shimmer h-12 w-full" />
        </div>
      </div> : null}
      {mode === "gauge" ? <div className="protect-ladder">
        <div>
          <RainGauge labelled level={gaugeWaterLevel({ observedMm: null, maxMm, triggerMm: chosen?.thresholdMm ?? null })} ticks={ticks} label={chosen ? `Trigger line at ${chosen.thresholdMm} millimetres` : "Rain gauge"} />
          <p className="protect-gauge-note">{gaugeNote}</p>
        </div>
        <div className="protect-rows" role="list" aria-label="Rain triggers">
          {ladderMarks.filter((tick) => tick.tappable).map((tick) => <button key={tick.thresholdMm} type="button" aria-pressed={tick.state === "selected"} className={tick.state === "selected" ? "protect-row protect-row--selected" : "protect-row"} onClick={() => setTriggerMm(tick.thresholdMm)}>
            <span className="sky-mono">{tick.label}</span>
          </button>)}
          {soonLine ? <p className="mt-1 text-sm text-[var(--fg-2)]">{soonLine}</p> : null}
        </div>
      </div> : null}
      {surface === "closed" ? <CalmCard title={nextWeeklyOpenCopy(city, now) ?? "The next weekly window is not on the schedule yet."} action="Refresh" onAction={retry} link={otherCity} onLink={otherCity ? () => { setCity(otherCity.slug); props.onCityChange?.(otherCity.slug); } : undefined} /> : null}
      {surface === "error" ? <CalmCard title="Couldn't load prices" action="Retry" onAction={retry} /> : null}
      {surface === "ready" && mode === "hidden" ? <CalmCard title="Not ready to price yet. A validated NOAA evidence package is not available." action="Refresh" onAction={retry} /> : null}
      <p className="protect-footnote">{MARKETS_FOOTER}</p>
    </div>
    {showCta && terms ? <aside className="protect-ticket" aria-label="Pay and payout">
      <div className="protect-ledger">
        <p className="protect-ledger__pay"><span className="t-label">You pay</span> <QuoteAmount amount={terms.premiumLabel} /></p>
        <p className="protect-ledger__get"><span className="t-small">You get </span><QuoteAmount amount={terms.coverLabel} slicker /><span className="t-small">{terms.ledgerGetLine.slice(terms.getLine.length)}</span></p>
        <p className="protect-ledger__meta"><MixedCopy text={terms.ledgerMeta} /></p>
      </div>
      <button type="button" className="gauge-cta mt-3" disabled={!ready} onClick={() => { if (ready) setSheet("amount"); }}>{button.label}</button>
    </aside> : null}
    {sheet && terms ? <StakeSheet step={sheet} terms={terms} amount={amount} onAmount={setAmount} onClose={() => setSheet(false)} onSign={() => setSheet("sign")} onApprove={() => { setSheet(false); props.onCovered?.(); }} /> : null}
  </section>;
}

function CalmCard(props: { title: string; action: string; onAction: () => void; link?: { slug: string; label: string } | null; onLink?: () => void }) {
  return <div className="mt-3 rounded-[14px] bg-[var(--surface-1)] p-4">
    <p className="text-sm text-[var(--fg)]">{props.title}</p>
    <button type="button" className="gauge-chip mt-3" onClick={props.onAction}>{props.action}</button>
    {props.link && props.onLink ? <button type="button" className="mt-2 block min-h-12 text-sm font-semibold text-[var(--glacier)]" onClick={props.onLink}>{props.link.label}</button> : null}
  </div>;
}

function StakeSheet(props: { step: "amount" | "sign"; terms: StakeSheetModel; amount: (typeof CHIPS)[number]; onAmount: (amount: (typeof CHIPS)[number]) => void; onClose: () => void; onSign: () => void; onApprove: () => void }) {
  const { publicKey } = useWallet();
  const balances = useQuery({
    queryKey: ["finalized-wallet", publicKey?.toBase58()],
    queryFn: () => finalizedWalletState(publicKey!),
    enabled: Boolean(publicKey),
    retry: false,
  });
  const balanceBase = balances.data?.skytBaseUnits ?? null;
  const balanceLabel = balanceBase ? formatQuoteSkyt(balanceBase, 2) : null;
  const short = coverExceedsBalance(props.terms.payBase, balanceBase);
  const balance = balanceSkytLine(balanceLabel);
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(props.onClose, 200);
  };
  return <div className="stake-sheet" role="dialog" aria-modal="true" aria-label={props.step === "sign" ? PRE_SIGN_TITLE : COVER_AMOUNT_TITLE}>
    <div className={leaving ? "stake-sheet__panel stake-sheet__panel--out" : "stake-sheet__panel"}>
      <div className="stake-sheet__ticks" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <span key={index} />)}</div>
      {props.step === "amount" ? <>
        <h3 className="text-lg font-semibold">{COVER_AMOUNT_TITLE}</h3>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Cover amount">
          {CHIPS.map((choice) => <button key={choice} type="button" role="radio" aria-checked={choice === props.amount} className={choice === props.amount ? "gauge-chip gauge-chip--on flex-1" : "gauge-chip flex-1"} onClick={() => props.onAmount(choice)}>{choice}</button>)}
        </div>
        <p className="mt-4"><span className="t-label">You pay</span> <QuoteAmount amount={props.terms.premiumLabel} /></p>
        <p className="stake-get"><span className="t-label">You get</span><QuoteAmount amount={props.terms.coverLabel} slicker hero /></p>
        <p className="mt-1 text-sm text-[var(--fg-2)]">{props.terms.conditionLine}</p>
        {props.terms.feeLine ? <p className="mt-2 text-xs text-[var(--fg-2)]">{props.terms.feeLine}</p> : null}
        {balance ? <p className="sky-mono mt-3 text-sm text-[var(--fg-2)]">{balance}</p> : null}
        {short && balanceLabel ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{notEnoughSkyt(balanceLabel)}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="gauge-chip flex-1" onClick={close}>Back</button>
          <button type="button" className="gauge-cta flex-1" disabled={short} onClick={props.onSign}>{`Protect for ${props.terms.premiumLabel} SKYT`}</button>
        </div>
      </> : <>
        <h3 className="text-lg font-semibold">{PRE_SIGN_TITLE}</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="t-label">Pay</dt><dd><QuoteAmount amount={props.terms.premiumLabel} /></dd></div>
          <div className="flex justify-between gap-3"><dt className="t-label">Cover</dt><dd><QuoteAmount amount={props.terms.coverLabel} slicker /></dd></div>
          <div className="t-small text-[var(--fg)]">{props.terms.placeLine}</div>
          <div className="t-small"><MixedCopy text={props.terms.triggerLine} /></div>
        </dl>
        <div className="mt-4 flex gap-2">
          <button type="button" className="gauge-chip flex-1" onClick={close}>Back</button>
          <button type="button" className="gauge-cta flex-1" onClick={props.onApprove}>{PRE_SIGN_CTA}</button>
        </div>
      </>}
    </div>
  </div>;
}
