/**
 * Consumer-facing rainfall cities. Payout copy names the NOAA station
 * and never invents a rainfall total. Toronto stays closed.
 */
export interface ConsumerCity {
  code: "NYC" | "ORD" | "MIA" | "DFW" | "LAX" | "SEA" | "BOS" | "AUS" | "DSM" | "YYZ";
  slug: "new-york" | "chicago" | "miami" | "dallas" | "los-angeles" | "seattle" | "boston" | "austin" | "des-moines" | "toronto";
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
    code: "ORD",
    slug: "chicago",
    city: "Chicago",
    region: "IL",
    moment: "Lollapalooza weekend?",
    source: "NOAA O'Hare",
    stationId: "GHCND:USW00094846",
    payout: "Payout if O'Hare rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "MIA",
    slug: "miami",
    city: "Miami",
    region: "FL",
    moment: "Beach day?",
    source: "NOAA Miami Intl",
    stationId: "GHCND:USW00012839",
    payout: "Payout if Miami Intl rain reaches that window's NOAA threshold.",
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
    code: "LAX",
    slug: "los-angeles",
    city: "Los Angeles",
    region: "CA",
    moment: "Evening on the pier?",
    source: "NOAA Los Angeles Intl",
    stationId: "GHCND:USW00023174",
    payout: "Payout if Los Angeles Intl rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "SEA",
    slug: "seattle",
    city: "Seattle",
    region: "WA",
    moment: "Rooftop party?",
    source: "NOAA Seattle-Tacoma",
    stationId: "GHCND:USW00024233",
    payout: "Payout if Seattle-Tacoma rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "BOS",
    slug: "boston",
    city: "Boston",
    region: "MA",
    moment: "Afternoon on the Common?",
    source: "NOAA Boston Logan",
    stationId: "GHCND:USW00014739",
    payout: "Payout if Boston Logan rain reaches that window's NOAA threshold.",
    status: "live",
  },
  {
    code: "AUS",
    slug: "austin",
    city: "Austin",
    region: "TX",
    moment: "Show on the lawn?",
    source: "NOAA Austin Bergstrom",
    stationId: "GHCND:USW00013904",
    payout: "Payout if Austin Bergstrom rain reaches that window's NOAA threshold.",
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

export const CONSUMER_LEAD_CODES = ["NYC", "ORD", "MIA", "DFW", "LAX", "SEA", "BOS", "AUS", "DSM", "YYZ"] as const;

/** Hero phone shows five plans. The full ladder is the markets list. */
export const HERO_PHONE_CODES = ["NYC", "ORD", "MIA", "DFW", "SEA"] as const;

export function consumerCityByCode(code: string): ConsumerCity | undefined {
  return CONSUMER_CITIES.find((city) => city.code === code);
}

export function heroPhoneCities(): ConsumerCity[] {
  return HERO_PHONE_CODES.map((code) => consumerCityByCode(code)!);
}
