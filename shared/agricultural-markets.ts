export type ExpiryCadence = "weekly" | "monthly";
export type EvidenceStatus = "researching_evidence" | "validated";

export interface AgriculturalMarket {
  slug: string;
  name: string;
  region: "North America" | "South America" | "Emerging markets";
  country: string;
  /** State, province, department, county, or regional equivalent. */
  administrativeArea: string;
  crops: string[];
  agriculturalContext: string;
  timezone: string;
  latitude: number;
  longitude: number;
  /** Optional presentation metadata; coordinates never imply evidence validation. */
  mapZoom?: number;
  stationCoordinates?: { latitude: number; longitude: number };
  coverageLabel?: string;
  metric: "cumulative_rainfall_mm";
  displayUnit: "mm";
  displayConversion: "inches";
  expiryCadences: ExpiryCadence[];
  rainfallDirection: "excess_rainfall";
  evidenceStatus: EvidenceStatus;
  /** Deliberately null until a NOAA final-observation station has passed release validation. */
  noaaStationId: null;
}

export const AGRICULTURAL_MARKETS: readonly AgriculturalMarket[] = [
  { slug: "des-moines", name: "Des Moines crop belt", region: "North America", country: "United States", administrativeArea: "Iowa", crops: ["corn", "soybeans"], agriculturalContext: "Midwest planting and growing rainfall", timezone: "America/Chicago", latitude: 41.59, longitude: -93.62, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "fresno", name: "Fresno Valley crops", region: "North America", country: "United States", administrativeArea: "California", crops: ["fruit", "vegetables", "almonds"], agriculturalContext: "Central Valley field and orchard rainfall", timezone: "America/Los_Angeles", latitude: 36.74, longitude: -119.78, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "lubbock", name: "Lubbock cotton plains", region: "North America", country: "United States", administrativeArea: "Texas", crops: ["cotton", "sorghum"], agriculturalContext: "High Plains rainfall exposure", timezone: "America/Chicago", latitude: 33.58, longitude: -101.85, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "winnipeg", name: "Winnipeg prairie grains", region: "North America", country: "Canada", administrativeArea: "Manitoba", crops: ["wheat", "canola"], agriculturalContext: "Prairie growing-region rainfall", timezone: "America/Winnipeg", latitude: 49.9, longitude: -97.14, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "cordoba", name: "Córdoba grain belt", region: "South America", country: "Argentina", administrativeArea: "Córdoba Province", crops: ["soybeans", "corn", "wheat"], agriculturalContext: "Pampas rainfall exposure", timezone: "America/Argentina/Cordoba", latitude: -31.42, longitude: -64.19, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "sorriso", name: "Sorriso soy frontier", region: "South America", country: "Brazil", administrativeArea: "Mato Grosso", crops: ["soybeans", "corn"], agriculturalContext: "Mato Grosso crop-cycle rainfall", timezone: "America/Cuiaba", latitude: -12.54, longitude: -55.72, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "asuncion", name: "Asunción soybean region", region: "South America", country: "Paraguay", administrativeArea: "Capital District", crops: ["soybeans", "corn"], agriculturalContext: "Paraná basin crop rainfall", timezone: "America/Asuncion", latitude: -25.29, longitude: -57.65, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "santa-cruz", name: "Santa Cruz lowlands", region: "South America", country: "Bolivia", administrativeArea: "Santa Cruz Department", crops: ["soybeans", "sugarcane", "maize"], agriculturalContext: "Lowland agricultural rainfall", timezone: "America/La_Paz", latitude: -17.78, longitude: -63.18, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "ludhiana", name: "Ludhiana grain basin", region: "Emerging markets", country: "India", administrativeArea: "Punjab", crops: ["wheat", "rice"], agriculturalContext: "Punjab monsoon and crop rainfall", timezone: "Asia/Kolkata", latitude: 30.9, longitude: 75.86, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "nagpur", name: "Nagpur cotton region", region: "Emerging markets", country: "India", administrativeArea: "Maharashtra", crops: ["cotton", "soybeans", "pulses"], agriculturalContext: "Central India monsoon rainfall", timezone: "Asia/Kolkata", latitude: 21.15, longitude: 79.09, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "eldoret", name: "Eldoret maize highlands", region: "Emerging markets", country: "Kenya", administrativeArea: "Uasin Gishu County", crops: ["maize", "wheat"], agriculturalContext: "Highland growing-season rainfall", timezone: "Africa/Nairobi", latitude: 0.51, longitude: 35.27, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
  { slug: "arusha", name: "Arusha horticulture belt", region: "Emerging markets", country: "Tanzania", administrativeArea: "Arusha Region", crops: ["coffee", "horticulture", "maize"], agriculturalContext: "Northern Tanzania crop rainfall", timezone: "Africa/Dar_es_Salaam", latitude: -3.37, longitude: 36.68, metric: "cumulative_rainfall_mm", displayUnit: "mm", displayConversion: "inches", expiryCadences: ["weekly", "monthly"], rainfallDirection: "excess_rainfall", evidenceStatus: "researching_evidence", noaaStationId: null },
] as const;

export type AgriculturalMarketSlug = (typeof AGRICULTURAL_MARKETS)[number]["slug"];
export const agriculturalMarketBySlug = (slug: string) => AGRICULTURAL_MARKETS.find((market) => market.slug === slug);
export const agriculturalMarketLocation = (market: AgriculturalMarket) => `${market.name.replace(/ (crop belt|Valley crops|cotton plains|prairie grains|grain belt|soy frontier|soybean region|lowlands|grain basin|cotton region|maize highlands|horticulture belt)$/u, "")}, ${market.administrativeArea}, ${market.country}`;
export const SUGGESTED_AGRICULTURAL_MARKET_SLUGS = ["des-moines", "cordoba", "ludhiana"] as const satisfies readonly AgriculturalMarketSlug[];

/** Normalizes customer-entered places and crops without changing market metadata. */
export function normalizeAgriculturalMarketSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

/** Searches the release-gated catalog only; it never discovers or activates new areas. */
export function searchAgriculturalMarkets(query: string): readonly AgriculturalMarket[] {
  const terms = normalizeAgriculturalMarketSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return AGRICULTURAL_MARKETS;

  return AGRICULTURAL_MARKETS.filter((market) => {
    const searchable = normalizeAgriculturalMarketSearch([
      market.slug.replaceAll("-", " "),
      market.name,
      market.region,
      market.country,
      market.administrativeArea,
      market.crops.join(" "),
      market.agriculturalContext,
    ].join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}
export const millimetersToInches = (mm: number) => Math.round((mm / 25.4) * 100) / 100;

/** Friday 23:59:59 UTC is the standardized weekly index cut-off. */
export function weeklyFridayWindow(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const untilFriday = (5 - start.getUTCDay() + 7) % 7;
  start.setUTCDate(start.getUTCDate() + (untilFriday === 0 ? 7 : untilFriday));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function calendarMonthlyWindow(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
