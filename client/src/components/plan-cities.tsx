import { CONSUMER_CITIES, type ConsumerCity } from "../../../shared/consumer-cities";
import { marketStatus, payGet } from "../../../shared/pay-get";
import { expiryChipLabel } from "../../../shared/window-chain";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";

type WindowRow = { city: string; observationEnd: number; observationStart: number; thresholdMmX100: string | null; quoteProbabilityBps: number | null; premiumRateBps: number | null; salesCloseAt: number | null };

/** Rainfall cities. New York leads. Status and the data line use real windows only. */
export function PlanCities({ onOpen, windows = [] }: { onOpen: (slug: ConsumerCity["slug"]) => void; windows?: readonly WindowRow[] }) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <section className="plan-cities" aria-label="Rainfall cities">
      <div className="plan-cities__head">
        <h2 className="sky-display text-2xl font-semibold">Where are your plans?</h2>
        <p>New York through Des Moines. Toronto opens when Environment Canada data is in.</p>
      </div>
      <ul className="plan-cities__grid">
        {CONSUMER_CITIES.map((city) => {
          const cityWindows = windows.filter((window) => window.city === city.slug);
          const status = marketStatus(cityWindows, now);
          const next = [...cityWindows].sort((left, right) => left.observationEnd - right.observationEnd)[0];
          const mm = next?.thresholdMmX100 && /^\d+$/.test(next.thresholdMmX100) ? Number(next.thresholdMmX100) / 100 : null;
          const quote = next && mm && next.premiumRateBps && next.quoteProbabilityBps
            ? payGet({ coverageSkyt: 100, premiumRateBps: next.premiumRateBps, probabilityBps: next.quoteProbabilityBps })
            : null;
          const expiry = next ? expiryChipLabel(next)?.split(" · ")[0] : null;
          const line = quote && expiry && mm ? `Next: ${expiry} · ≥${mm} mm · ${quote.chance} · ${quote.multiple}` : null;
          return (
            <li key={city.code}>
              <button type="button" className="plan-cities__card" onClick={() => onOpen(city.slug)}>
                <RainGauge level={0} ticks={mm ? gaugeTicks([{ mm, selected: true }], mm) : []} label={`${city.city} gauge`} />
                <div className="plan-cities__copy">
                  <p className="plan-cities__place">{city.city}</p>
                  {line ? <p className="sky-mono plan-cities__payout">{line}</p> : <p className="plan-cities__payout">{city.payout}</p>}
                </div>
                {status ? <span className={`wl-markets__status wl-markets__status--${status.tone}`}>{status.label}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FirstRunSteps() {
  if (typeof window !== "undefined" && window.localStorage.getItem("skyhedge-guide") === "done") return null;
  return <p className="text-sm text-[var(--muted-foreground)]">Step 1 of 3 · Choose a city</p>;
}
