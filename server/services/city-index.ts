import { CITY_INDEX, cityBySlug, type CityIndex } from "../../shared/cities";

export interface CitySearchResult {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  stationId: string;
  score: number;
  match: string;
}

/** Search-only aliases. The committed registry stays free of fuzzy terms; aliases are a query-surface concern. */
const ALIASES: Record<string, string[]> = {
  "new-york": ["nyc", "ny", "new york city"],
  chicago: ["chi", "chicago o'hare", "ohare"],
  miami: ["mia"],
  houston: ["iah", "houston bush"],
  london: ["uk", "britain", "england"],
  tokyo: ["tokio", "japan"],
  sydney: ["australia"],
  singapore: ["sg"],
  mumbai: ["bombay", "india"],
  "sao-paulo": ["sp", "brazil", "sao paulo", "são paulo"],
  cairo: ["egypt"],
  lagos: ["nigeria"],
};

interface IndexedCity {
  city: CityIndex;
  terms: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** Term index over the committed city registry: name, slug, country, station, and search aliases. */
function buildIndex(): IndexedCity[] {
  return CITY_INDEX.map((city) => {
    const terms = new Set<string>();
    const add = (value: string) => {
      const term = normalize(value);
      if (term.length > 0) terms.add(term);
    };
    add(city.name);
    add(city.slug);
    add(city.country);
    add(city.countryCode);
    add(city.stationName);
    add(`${city.name} ${city.country}`);
    for (const alias of ALIASES[city.slug] ?? []) add(alias);
    return { city, terms: [...terms] };
  });
}

/** Optimal-string-alignment distance: transpositions (typos like "yrok" → "york") count as a single edit. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function scoreTerm(query: string, term: string): number {
  if (term === query) return 100;
  if (term.startsWith(query)) return 80;
  if (term.includes(query)) return 60;
  if (query.includes(term) && term.length >= 3) return 40;
  if (term.length >= 4 && query.length >= 3) {
    const similarity = 1 - editDistance(query, term) / Math.max(query.length, term.length);
    if (similarity >= 0.75) return Math.round(similarity * 50);
  }
  return 0;
}

/** Ranked city search over the committed registry. Exact name/alias hits score 100; prefix 80; substring 60; fuzzy up to 50. */
export function searchCities(query: string, limit = 8): CitySearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const ranked: Array<{ city: CityIndex; score: number; match: string }> = [];
  for (const { city, terms } of buildIndex()) {
    let bestScore = 0;
    let bestMatch = "";
    for (const term of terms) {
      const score = scoreTerm(q, term);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = term;
      }
    }
    if (bestScore > 0) ranked.push({ city, score: bestScore, match: bestMatch });
  }
  ranked.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name));
  return ranked.slice(0, limit).map(({ city, score, match }) => ({
    slug: city.slug,
    name: city.name,
    country: city.country,
    countryCode: city.countryCode,
    stationId: city.noaaStationId,
    score,
    match,
  }));
}

/** Strict slug resolution used by city pages; null for unknown slugs. */
export function resolveCity(slug: string): CityIndex | undefined {
  return cityBySlug(slug);
}
