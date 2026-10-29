/**
 * Peril availability is data in this registry, not a branch in a screen.
 * Cold is registered and open nowhere: the program rejects negative values.
 * Wind is Chicago only (peak wind). Heat is Miami (TMAX). Snow is Chicago
 * from the Nov 9 week through December, and New York in December only.
 */
import { consumerCityBySlug } from "./consumer-cities.js";
import { lineTokens } from "./ui-tokens.js";
import { LIVE_CITY_SLUGS } from "./window-ladder.js";
import type { PerilId } from "./ui-types.js";

export type PerilDefinition = {
  id: PerilId;
  label: string;
  unit: "mm" | "m/s" | "C";
  direction: "up" | "down";
  tint: string;
  /** Phrase after the station name. The trigger label already includes its unit. */
  verb: (triggerLabel: string) => string;
  honesty: (station: string) => string | null;
};

export const PERILS: readonly PerilDefinition[] = [
  {
    id: "rain",
    label: "Rain",
    unit: "mm",
    direction: "up",
    tint: lineTokens.rain,
    verb: (trigger) => `records ${trigger} or more`,
    honesty: () => null,
  },
  {
    id: "snow",
    label: "Snow",
    unit: "mm",
    direction: "up",
    tint: lineTokens.snow,
    verb: (trigger) => `records ${trigger} or more`,
    honesty: () => null,
  },
  {
    id: "wind",
    label: "Wind",
    unit: "m/s",
    direction: "up",
    tint: lineTokens.wind,
    verb: (trigger) => `records a peak wind of ${trigger} or more`,
    honesty: (station) => `Measured as the strongest wind NOAA records at ${station} that day.`,
  },
  {
    id: "heat",
    label: "Heat",
    unit: "C",
    direction: "up",
    tint: lineTokens.heat,
    verb: (trigger) => `reaches a high of ${trigger} or more`,
    honesty: (station) => `Measured as the day's highest temperature at ${station}.`,
  },
  {
    id: "cold",
    label: "Cold",
    unit: "C",
    direction: "down",
    tint: lineTokens.cold,
    verb: (trigger) => `falls to a low of ${trigger} or less`,
    honesty: () => null,
  },
];

export type CityRecord = {
  id: string;
  name: string;
  stationId: string;
  station: string;
};

function stationLabel(source: string | undefined): string {
  if (!source) return "Station";
  return source.replace(/^NOAA\s+/i, "").trim() || "Station";
}

export const CITIES: readonly CityRecord[] = LIVE_CITY_SLUGS.map((slug) => {
  const city = consumerCityBySlug(slug);
  return {
    id: slug,
    name: city?.city ?? slug,
    stationId: city?.stationId ?? "",
    station: stationLabel(city?.source),
  };
});

/**
 * One row of availability. `open: false` is an explicit closed record.
 * `months` is 1–12 UTC. `weeklyNotBefore` skips weekly windows that start
 * earlier than that UTC date (Chicago snow before the Nov 9 week).
 */
export type AvailabilityRecord = {
  peril: PerilId;
  cityId: string;
  open: boolean;
  months?: readonly number[];
  weeklyNotBefore?: string;
};

const RAIN_RECORDS: AvailabilityRecord[] = LIVE_CITY_SLUGS.map((cityId) => ({ peril: "rain", cityId, open: true }));

export const PERIL_AVAILABILITY: readonly AvailabilityRecord[] = [
  ...RAIN_RECORDS,
  { peril: "snow", cityId: "chicago", open: true, months: [11, 12], weeklyNotBefore: "2026-11-09" },
  { peril: "snow", cityId: "new-york", open: true, months: [12] },
  { peril: "wind", cityId: "chicago", open: true },
  { peril: "heat", cityId: "miami", open: true },
  { peril: "cold", cityId: "*", open: false },
];

export function perilById(id: PerilId, perils: readonly PerilDefinition[] = PERILS): PerilDefinition | undefined {
  return perils.find((peril) => peril.id === id);
}

export function cityById(id: string, cities: readonly CityRecord[] = CITIES): CityRecord | undefined {
  return cities.find((city) => city.id === id);
}

function utcParts(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function perilOpen(input: {
  cityId: string;
  peril: PerilId;
  windowStart: string;
  tenor: "weekly" | "monthly";
}, records: readonly AvailabilityRecord[] = PERIL_AVAILABILITY): boolean {
  const when = utcParts(input.windowStart);
  if (!when) return false;
  const matches = records.filter((record) => {
    if (record.peril !== input.peril) return false;
    if (record.cityId !== "*" && record.cityId !== input.cityId) return false;
    if (record.months && !record.months.includes(when.month)) return false;
    if (input.tenor === "weekly" && record.weeklyNotBefore && input.windowStart.slice(0, 10) < record.weeklyNotBefore) return false;
    return true;
  });
  return matches.some((record) => record.open);
}

export function openCityFor(
  peril: PerilId,
  exceptCityId: string,
  windowStart: string,
  tenor: "weekly" | "monthly",
  cities: readonly CityRecord[] = CITIES,
): CityRecord | null {
  return cities.find((city) => city.id !== exceptCityId && perilOpen({ cityId: city.id, peril, windowStart, tenor })) ?? null;
}

/** First open (city, peril) pair. The screen starts here. */
export function firstOpenPair(
  windowStart: string,
  tenor: "weekly" | "monthly",
  cities: readonly CityRecord[] = CITIES,
  perils: readonly PerilDefinition[] = PERILS,
): { cityId: string; peril: PerilId } | null {
  for (const city of cities) {
    for (const peril of perils) {
      if (perilOpen({ cityId: city.id, peril: peril.id, windowStart, tenor })) return { cityId: city.id, peril: peril.id };
    }
  }
  return null;
}
