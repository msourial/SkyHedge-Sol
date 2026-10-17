import { CONSUMER_CITIES } from "../../../shared/consumer-cities";
import { chipClass, useSalesChips } from "@/lib/sales-chips";

/** Rainfall cities on the web Markets tab. New York leads. Chips follow on-chain windows. */
export function PlanCities() {
  const chips = useSalesChips();
  return (
    <section className="plan-cities" aria-label="Rainfall cities">
      <div className="plan-cities__head">
        <h2 className="sky-display text-2xl font-semibold">Where are your plans?</h2>
        <p>New York through Des Moines sit on the same NOAA weekly and monthly ladder. Toronto opens when Environment Canada data is in.</p>
      </div>
      <ul className="plan-cities__grid">
        {CONSUMER_CITIES.map((city) => {
          const chip = chips[city.code] ?? { label: city.status === "soon" ? "Opens soon" : "Opening shortly", tone: "soon" as const };
          return (
            <li key={city.code} className="plan-cities__card">
              <div className="plan-cities__top">
                <p className="plan-cities__moment">{city.moment}</p>
                <span className={chipClass(chip, city.code === "NYC" && chip.tone === "live")}>{chip.label}</span>
              </div>
              <p className="plan-cities__place">{city.city}, {city.region}</p>
              <p className="plan-cities__payout">{city.payout}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
