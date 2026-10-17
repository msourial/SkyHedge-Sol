/**
 * Consumer-facing rainfall cities. Payout copy names the NOAA station threshold
 * and never invents a rainfall total.
 */
export interface ConsumerCity {
  code: "NYC" | "DFW" | "DSM" | "YYZ";
  slug: "new-york" | "dallas" | "des-moines" | "toronto";
  city: string;
  region: string;
  moment: string;
  source: string;
  stationId: string | null;
  payout: string;
  status: "live" | "soon";
}

export const CONSUMER_CITIES: readonly ConsumerCity[] = [
  {
    code: "NYC",
    slug: "new-york",
    city: "New York",
    region: "NY",
    moment: "Wedding in Central Park this Saturday?",
    source: "NOAA Central Park",
    stationId: "GHCND:USW00094728",
    payout: "Payout if Central Park rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "DFW",
    slug: "dallas",
    city: "Dallas",
    region: "TX",
    moment: "Rained-out game day?",
    source: "NOAA DFW",
    stationId: "GHCND:USW00003927",
    payout: "Payout if DFW rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "DSM",
    slug: "des-moines",
    city: "Des Moines",
    region: "IA",
    moment: "Outdoor concert this weekend?",
    source: "NOAA Des Moines Intl",
    stationId: "GHCND:USW00014933",
    payout: "Payout if Des Moines Intl rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "YYZ",
    slug: "toronto",
    city: "Toronto",
    region: "ON",
    moment: "Patio season, when the data is in.",
    source: "Environment Canada",
    stationId: null,
    payout: "Opens when Environment Canada rainfall is wired in. No price yet.",
    status: "soon",
  },
];

export const CONSUMER_LEAD_CODES = ["NYC", "DFW", "DSM", "YYZ"] as const;

export function consumerCityByCode(code: string): ConsumerCity | undefined {
  return CONSUMER_CITIES.find((city) => city.code === code);
}
