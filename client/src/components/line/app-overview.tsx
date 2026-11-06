import { overviewMetricsFromStatus, type OverviewStatusSlice } from "../../../../shared/app-overview.ts";
import { consumerCityBySlug } from "../../../../shared/consumer-cities.ts";

const STEPS = [
  {
    n: "1",
    title: "Pick place and trigger",
    body: "Choose a city and a weather threshold for a set window.",
  },
  {
    n: "2",
    title: "Pay a fixed amount",
    body: "Your max loss is the premium. No open-ended risk.",
  },
  {
    n: "3",
    title: "Settles on NOAA records",
    body: "If the trigger hits, collect. Settlement uses NOAA — the National Oceanic and Atmospheric Administration.",
  },
] as const;

type Props = {
  status?: OverviewStatusSlice | null;
  loading?: boolean;
  onBrowse: () => void;
};

function cityLabel(slug: string): string {
  return consumerCityBySlug(slug)?.city ?? slug.replace(/-/g, " ");
}

export function AppOverview({ status, loading = false, onBrowse }: Props) {
  const { metrics } = overviewMetricsFromStatus(status ?? null);
  const citiesMetric = metrics.find((m) => m.id === "cities");
  const openLadder = (status?.ladderMarkets ?? []).filter((row) => row.state === "open");
  const cityNames = [...new Set(openLadder.map((row) => row.city))]
    .map(cityLabel)
    .sort()
    .slice(0, 6);

  return (
    <section className="ao" aria-label="SkyHedge overview">
      <header className="ao-hero">
        <p className="ao-kicker">Weather hedging · Solana Devnet</p>
        <h1 className="ao-title">Weather hedging for anyone</h1>
        <p className="ao-lede">
          Fixed-payout cover when rain, snow, or wind hits a threshold you choose — for farmers, street vendors, events, and aviation. Not insurance.
        </p>
      </header>

      <div className="ao-stats" role="group" aria-label="Live protocol state" aria-busy={loading || undefined}>
        {loading && metrics.length === 0 ? (
          <p className="ao-stats-empty">Reading live Devnet state…</p>
        ) : metrics.length === 0 ? (
          <p className="ao-stats-empty">Live market totals unavailable right now.</p>
        ) : (
          metrics.map((metric) => (
            <div key={metric.id} className="ao-stat">
              <p className="ao-stat-label">{metric.label}</p>
              <p className="ao-stat-value">
                {metric.value}
                {"unit" in metric ? <span className="ao-stat-unit"> {metric.unit}</span> : null}
              </p>
            </div>
          ))
        )}
      </div>
      {citiesMetric && cityNames.length > 0 ? (
        <p className="ao-cities">{cityNames.join(" · ")}</p>
      ) : null}

      <ol className="ao-steps">
        {STEPS.map((step) => (
          <li key={step.n} className="ao-step">
            <span className="ao-step-n" aria-hidden="true">{step.n}</span>
            <div>
              <h2 className="ao-step-title">{step.title}</h2>
              <p className="ao-step-body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="ao-trust">
        Settlement rules are fixed on-chain. NOAA data is checkable. This build uses Devnet test tokens — no real money.
      </p>

      <button type="button" className="ln-cta ao-cta" onClick={onBrowse}>
        Browse markets
      </button>
    </section>
  );
}
