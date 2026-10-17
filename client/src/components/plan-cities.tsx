import { CONSUMER_CITIES } from "../../../shared/consumer-cities";

/** Rainfall cities on the web Markets tab. New York leads. No invented rainfall totals. */
export function PlanCities() {
  return (
    <section className="plan-cities" aria-label="Rainfall cities">
      <div className="plan-cities__head">
        <h2 className="sky-display text-2xl font-semibold">Where are your plans?</h2>
        <p>New York first. Dallas and Des Moines use the same weekly and monthly rain ladder. Toronto opens later.</p>
      </div>
      <ul className="plan-cities__grid">
        {CONSUMER_CITIES.map((city) => {
          const open = city.code === "NYC" || city.code === "DSM";
          const soon = city.status === "soon";
          const label = open ? "Weekly · Monthly open" : soon ? "Opens soon" : "Next window opening shortly";
          return (
            <li key={city.code} className="plan-cities__card">
              <div className="plan-cities__top">
                <p className="plan-cities__moment">{city.moment}</p>
                <span className={open ? "wl-markets__status wl-markets__status--live" : "wl-markets__status wl-markets__status--soon"}>{label}</span>
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
