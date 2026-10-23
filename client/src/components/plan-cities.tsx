import { CONSUMER_CITIES, type ConsumerCity } from "../../../shared/consumer-cities";
import { marketStatus, payGet } from "../../../shared/pay-get";
import { marketRowModel, MARKETS_FOOTER, MARKETS_SUB, MARKETS_TITLE } from "../../../shared/protect-copy";
import { expiryChipLabel } from "../../../shared/window-chain";
import { tenorOf } from "../../../shared/window-ladder";
import { MixedCopy } from "@/components/figure";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";

type WindowRow = { city: string; observationEnd: number; observationStart: number; thresholdMmX100: string | null; quoteProbabilityBps: number | null; premiumRateBps: number | null; salesCloseAt: number | null };

/** Rainfall cities. Figures and the forecaster line come from the quoted window only. */
export function PlanCities({ onOpen, windows = [] }: { onOpen: (slug: ConsumerCity["slug"]) => void; windows?: readonly WindowRow[] }) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <section className="plan-cities" aria-label="Rainfall cities">
      <div className="plan-cities__head">
        <h2 className="sky-display text-[2rem] font-semibold leading-9">{MARKETS_TITLE}</h2>
        <p>{MARKETS_SUB}</p>
      </div>
      <ul className="plan-cities__grid">
        {CONSUMER_CITIES.map((city) => {
          const cityWindows = windows.filter((window) => window.city === city.slug);
          const status = marketStatus(cityWindows, now);
          const next = [...cityWindows].sort((left, right) => left.observationEnd - right.observationEnd)[0];
          const mm = next?.thresholdMmX100 && /^\d+$/.test(next.thresholdMmX100) ? Number(next.thresholdMmX100) / 100 : null;
          const quote = next && mm != null && next.premiumRateBps && next.quoteProbabilityBps
            ? payGet({ coverageSkyt: 100, premiumRateBps: next.premiumRateBps, probabilityBps: next.quoteProbabilityBps })
            : null;
          const expiry = next ? expiryChipLabel(next)?.split(" · ")[0] ?? null : null;
          const tenor = next ? tenorOf(next.observationStart, next.observationEnd) : null;
          const row = marketRowModel({
            slug: city.slug,
            stationSource: city.source,
            open: status?.tone === "open" && quote != null,
            closed: status?.tone === "closed",
            tenor,
            expiry,
            triggerMm: mm,
            multiple: quote?.multiple ?? null,
            probabilityBps: next?.quoteProbabilityBps ?? null,
          });
          const maxMm = mm && mm > 0 ? mm : 1;
          return (
            <li key={city.code}>
              <button type="button" className="plan-cities__card" onClick={() => onOpen(city.slug)}>
                <RainGauge level={0} ticks={row.ink === "glacier" && mm ? gaugeTicks([{ mm, selected: true, labelled: false }], maxMm) : []} label={`${city.city} gauge`} />
                <div className="plan-cities__copy">
                  <p className="plan-cities__place font-semibold">{city.city}</p>
                  <p className="plan-cities__payout">{row.stationLine}</p>
                  {row.figures ? <p className="plan-cities__figures"><MixedCopy text={row.figures} /></p> : null}
                  {row.forecaster ? <p className="plan-cities__fore">{row.forecaster.band} {row.forecaster.detail}</p> : null}
                </div>
                <span className={`status-word status-word--${row.ink}`}>{row.status}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-[var(--fg-2)]">{MARKETS_FOOTER}</p>
    </section>
  );
}

export function FirstRunSteps() {
  return null;
}
