/**
 * SkyHedge market catalogue for the Seeker app.
 * - Des Moines (DSM) is the only Live market and the only one with pricing or on-chain actions.
 * - Toronto Pearson (YYZ) is "Opens soon".
 * - Everything else is a non-tradable Concept pin: real airport coordinates + the national met service
 *   that would supply the data. No prices, triggers or rainfall figures exist for concepts and none are shown.
 * Map positions are pre-projected by tools/gen_geo.py (see geo-paths.ts).
 */
export type MarketStatus = "live" | "soon" | "concept";
export type MarketGroup = "North America" | "Latin America" | "Africa" | "Middle East" | "South Asia" | "Southeast Asia";
export type CatalogMarket = {
  code: string; name: string; region: string; country: string; group: MarketGroup;
  lat: number; lon: number; source: string; status: MarketStatus;
  /** Position in REGION_VIEW (Lambert conformal conic); only meaningful for North America. */
  regionXY: [number, number];
  /** Position in GLOBAL_VIEW (Equal Earth). */
  globalXY: [number, number];
};

export const MARKETS: readonly CatalogMarket[] = [
  { code: "DSM", name: "Des Moines", region: "Iowa", country: "US", group: "North America", lat: 41.534, lon: -93.663, source: "NOAA", status: "live", regionXY: [490.0, 340.8], globalXY: [298.6, 151.5] },
  { code: "YYZ", name: "Toronto Pearson", region: "Ontario", country: "CA", group: "North America", lat: 43.677, lon: -79.631, source: "Environment Canada", status: "soon", regionXY: [703.3, 272.9], globalXY: [336.9, 144.4] },
  { code: "MSP", name: "Minneapolis–St Paul", region: "Minnesota", country: "US", group: "North America", lat: 44.882, lon: -93.222, source: "NOAA", status: "concept", regionXY: [495.4, 269.5], globalXY: [304.3, 140.5] },
  { code: "ORD", name: "Chicago O'Hare", region: "Illinois", country: "US", group: "North America", lat: 41.979, lon: -87.905, source: "NOAA", status: "concept", regionXY: [580.7, 326.5], globalXY: [313.9, 150.1] },
  { code: "STL", name: "St. Louis", region: "Missouri", country: "US", group: "North America", lat: 38.749, lon: -90.37, source: "NOAA", status: "concept", regionXY: [545.8, 398.1], globalXY: [303.7, 161.0] },
  { code: "SDF", name: "Louisville", region: "Kentucky", country: "US", group: "North America", lat: 38.174, lon: -85.736, source: "NOAA", status: "concept", regionXY: [624.1, 403.6], globalXY: [315.1, 163.0] },
  { code: "DTW", name: "Detroit", region: "Michigan", country: "US", group: "North America", lat: 42.212, lon: -83.353, source: "NOAA", status: "concept", regionXY: [651.4, 313.3], globalXY: [325.8, 149.3] },
  { code: "DEN", name: "Denver", region: "Colorado", country: "US", group: "North America", lat: 39.856, lon: -104.674, source: "NOAA", status: "concept", regionXY: [310.7, 367.2], globalXY: [268.0, 157.2] },
  { code: "DFW", name: "Dallas–Fort Worth", region: "Texas", country: "US", group: "North America", lat: 32.9, lon: -97.04, source: "NOAA", status: "concept", regionXY: [431.5, 525.7], globalXY: [279.3, 181.5] },
  { code: "ATL", name: "Atlanta", region: "Georgia", country: "US", group: "North America", lat: 33.641, lon: -84.428, source: "NOAA", status: "concept", regionXY: [658.7, 497.6], globalXY: [313.9, 178.9] },
  { code: "YOW", name: "Ottawa", region: "Ontario", country: "CA", group: "North America", lat: 45.322, lon: -75.667, source: "Environment Canada", status: "concept", regionXY: [754.5, 226.0], globalXY: [348.7, 139.1] },
  { code: "YUL", name: "Montréal", region: "Québec", country: "CA", group: "North America", lat: 45.47, lon: -73.741, source: "Environment Canada", status: "concept", regionXY: [781.5, 215.8], globalXY: [353.7, 138.6] },
  { code: "YHZ", name: "Halifax", region: "Nova Scotia", country: "CA", group: "North America", lat: 44.881, lon: -63.509, source: "Environment Canada", status: "concept", regionXY: [930.4, 178.5], globalXY: [378.6, 140.5] },
  { code: "YVR", name: "Vancouver", region: "British Columbia", country: "CA", group: "North America", lat: 49.195, lon: -123.184, source: "Environment Canada", status: "concept", regionXY: [84.6, 110.3], globalXY: [238.0, 126.8] },
  { code: "YYC", name: "Calgary", region: "Alberta", country: "CA", group: "North America", lat: 51.131, lon: -114.01, source: "Environment Canada", status: "concept", regionXY: [216.4, 107.0], globalXY: [264.0, 120.9] },
  { code: "YEG", name: "Edmonton", region: "Alberta", country: "CA", group: "North America", lat: 53.31, lon: -113.58, source: "Environment Canada", status: "concept", regionXY: [232.6, 63.0], globalXY: [269.4, 114.4] },
  { code: "YXE", name: "Saskatoon", region: "Saskatchewan", country: "CA", group: "North America", lat: 52.171, lon: -106.7, source: "Environment Canada", status: "concept", regionXY: [315.7, 103.6], globalXY: [283.3, 117.8] },
  { code: "YQR", name: "Regina", region: "Saskatchewan", country: "CA", group: "North America", lat: 50.432, lon: -104.666, source: "Environment Canada", status: "concept", regionXY: [337.7, 144.0], globalXY: [285.0, 123.0] },
  { code: "YWG", name: "Winnipeg", region: "Manitoba", country: "CA", group: "North America", lat: 49.91, lon: -97.24, source: "Environment Canada", status: "concept", regionXY: [437.9, 162.5], globalXY: [302.0, 124.6] },
  { code: "MEX", name: "Mexico City", region: "CDMX", country: "MX", group: "Latin America", lat: 19.436, lon: -99.072, source: "SMN \u00b7 CONAGUA", status: "concept", regionXY: [379.3, 825.5], globalXY: [261.5, 231.4] },
  { code: "BOG", name: "Bogotá", region: "Cundinamarca", country: "CO", group: "Latin America", lat: 4.702, lon: -74.147, source: "IDEAM", status: "concept", regionXY: [1015.0, 1121.8], globalXY: [327.8, 288.5] },
  { code: "LIM", name: "Lima", region: "Lima", country: "PE", group: "Latin America", lat: -12.022, lon: -77.114, source: "SENAMHI", status: "concept", regionXY: [1047.7, 1623.9], globalXY: [320.7, 354.0] },
  { code: "EZE", name: "Buenos Aires", region: "Buenos Aires", country: "AR", group: "Latin America", lat: -34.822, lon: -58.536, source: "SMN Argentina", status: "concept", regionXY: [2038.4, 2287.3], globalXY: [384.0, 439.3] },
  { code: "GRU", name: "São Paulo", region: "São Paulo", country: "BR", group: "Latin America", lat: -23.435, lon: -46.473, source: "INMET", status: "concept", regionXY: [2198.0, 1574.1], globalXY: [411.8, 397.7] },
  { code: "GIG", name: "Rio de Janeiro", region: "Rio de Janeiro", country: "BR", group: "Latin America", lat: -22.81, lon: -43.251, source: "INMET", status: "concept", regionXY: [2281.8, 1482.5], globalXY: [420.7, 395.4] },
  { code: "BSB", name: "Brasília", region: "Distrito Federal", country: "BR", group: "Latin America", lat: -15.871, lon: -47.918, source: "INMET", status: "concept", regionXY: [1992.8, 1362.9], globalXY: [405.7, 368.9] },
  { code: "LOS", name: "Lagos", region: "Lagos", country: "NG", group: "Africa", lat: 6.577, lon: 3.321, source: "NiMet", status: "concept", regionXY: [2427.8, -225.3], globalXY: [553.3, 281.2] },
  { code: "ACC", name: "Accra", region: "Greater Accra", country: "GH", group: "Africa", lat: 5.605, lon: -0.167, source: "Ghana Meteorological Agency", status: "concept", regionXY: [2418.4, -131.5], globalXY: [543.2, 285.0] },
  { code: "NBO", name: "Nairobi", region: "Nairobi", country: "KE", group: "Africa", lat: -1.319, lon: 36.928, source: "Kenya Meteorological Department", status: "concept", regionXY: [2765.2, -1094.2], globalXY: [651.4, 312.2] },
  { code: "JNB", name: "Johannesburg", region: "Gauteng", country: "ZA", group: "Africa", lat: -26.139, lon: 28.246, source: "South African Weather Service", status: "concept", regionXY: [3634.7, -810.2], globalXY: [619.9, 407.8] },
  { code: "DXB", name: "Dubai", region: "Dubai", country: "AE", group: "Middle East", lat: 25.253, lon: 55.364, source: "UAE NCM", status: "concept", regionXY: [2035.8, -1418.3], globalXY: [695.8, 209.4] },
  { code: "RUH", name: "Riyadh", region: "Riyadh", country: "SA", group: "Middle East", lat: 24.958, lon: 46.699, source: "Saudi NCM", status: "concept", regionXY: [2084.3, -1248.6], globalXY: [671.9, 210.5] },
  { code: "BOM", name: "Mumbai", region: "Maharashtra", country: "IN", group: "South Asia", lat: 19.089, lon: 72.866, source: "IMD", status: "concept", regionXY: [2019.6, -1813.8], globalXY: [749.5, 232.7] },
  { code: "DEL", name: "Delhi", region: "Delhi", country: "IN", group: "South Asia", lat: 28.556, lon: 77.1, source: "IMD", status: "concept", regionXY: [1790.4, -1779.2], globalXY: [752.9, 197.2] },
  { code: "BLR", name: "Bengaluru", region: "Karnataka", country: "IN", group: "South Asia", lat: 13.199, lon: 77.706, source: "IMD", status: "concept", regionXY: [2082.9, -1981.4], globalXY: [767.0, 255.3] },
  { code: "DAC", name: "Dhaka", region: "Dhaka", country: "BD", group: "South Asia", lat: 23.843, lon: 90.398, source: "BMD", status: "concept", regionXY: [1713.7, -2055.1], globalXY: [794.8, 214.7] },
  { code: "SGN", name: "Ho Chi Minh City", region: "Ho Chi Minh City", country: "VN", group: "Southeast Asia", lat: 10.819, lon: 106.652, source: "NCHMF", status: "concept", regionXY: [1650.1, -2529.6], globalXY: [851.8, 264.6] },
  { code: "MNL", name: "Manila", region: "Metro Manila", country: "PH", group: "Southeast Asia", lat: 14.509, lon: 121.02, source: "PAGASA", status: "concept", regionXY: [1309.7, -2632.7], globalXY: [890.7, 250.3] },
  { code: "CGK", name: "Jakarta", region: "Banten", country: "ID", group: "Southeast Asia", lat: -6.126, lon: 106.656, source: "BMKG", status: "concept", regionXY: [1927.8, -2902.7], globalXY: [853.9, 331.0] },
];

export const GROUP_ORDER: readonly MarketGroup[] = ["North America", "Latin America", "Africa", "Middle East", "South Asia", "Southeast Asia"];

export function marketByCode(code: string): CatalogMarket | undefined {
  return MARKETS.find((m) => m.code === code);
}

export function isTradable(m: CatalogMarket): boolean {
  return m.status === "live";
}

function norm(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Case/accent-insensitive search across name, code, region and source. Live first, then soon, then concept. */
export function searchMarkets(query: string, scope: "region" | "global" | "all" = "all"): CatalogMarket[] {
  const q = norm(query);
  const rank = { live: 0, soon: 1, concept: 2 } as const;
  return MARKETS
    .filter((m) => scope === "all" || (scope === "region" ? m.group === "North America" : true))
    .filter((m) => !q || [m.name, m.code, m.region, m.source].some((f) => norm(f).includes(q)))
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

export function groupCounts(): Array<{ group: MarketGroup; count: number; sources: string[] }> {
  return GROUP_ORDER.map((group) => {
    const ms = MARKETS.filter((m) => m.group === group);
    return { group, count: ms.length, sources: [...new Set(ms.map((m) => m.source))] };
  });
}

/** Splits a name around the first match so search hits can be bolded. */
export function highlightParts(name: string, query: string): [string, string, string] {
  const q = norm(query);
  const i = q ? norm(name).indexOf(q) : -1;
  if (i < 0) return [name, "", ""];
  return [name.slice(0, i), name.slice(i, i + q.length), name.slice(i + q.length)];
}
