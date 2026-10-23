import { CONSUMER_CITIES } from "../../../shared/consumer-cities";

/** NOAA stations in place of the map. New York leads. No invented rainfall. */
export function StationStrip({ selected, onSelect }: { selected: string; onSelect: (slug: string) => void }) {
  const stations = CONSUMER_CITIES.filter((city) => city.stationId);
  const current = stations.some((city) => city.slug === selected) ? selected : "new-york";
  return (
    <div data-testid="market-explorer-map" data-map-state="station-strip" className="station-strip" role="region" aria-label="NOAA stations">
      <p className="text-sm text-[var(--muted-foreground)]">NOAA stations for the cities you can protect.</p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {stations.map((city) => (
          <li key={city.slug}>
            <button type="button" aria-pressed={city.slug === current} className="min-h-12 whitespace-nowrap rounded-[10px] border px-3 text-left text-sm" style={city.slug === current ? { borderColor: "var(--glacier)", background: "var(--glacier-dim)" } : { borderColor: "var(--line)" }} onClick={() => onSelect(city.slug)}>
              <span className="block font-semibold">{city.city}</span>
              <span className="sky-mono block text-xs text-[var(--muted-foreground)]">{city.stationId?.replace(/^GHCND:/, "")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
