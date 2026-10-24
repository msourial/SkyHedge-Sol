import { createHash } from "node:crypto";
import { LIVE_CITY_SLUGS, type LiveCitySlug } from "./window-ladder.js";

/**
 * Priced perils. The on-chain account has no peril field: the metric lives in
 * the methodology hash, and rain keeps sha256(city slug) so existing markets
 * still resolve. Other open perils use sha256(`${city}:${peril}`).
 * Cold is registered and not open: a negative temperature cannot be stored.
 */
export const PERIL_IDS = ["rain", "snow", "wind", "heat", "cold"] as const;
export type PerilId = (typeof PERIL_IDS)[number];
export type StrikeRounding = "whole" | "tenth";
export type PerilAggregator = "sum" | "max";
export type GhcndElement = "PRCP" | "SNOW" | "WSF2" | "TMAX";

export interface PerilSpec {
  id: PerilId;
  open: boolean;
  /** Set when the peril cannot be sold. */
  closedReason: string | null;
  ghcndElement: GhcndElement | null;
  /** GHCN-Daily integer divisor. CDO `units=metric` values are already native. */
  ghcnDivisor: number;
  aggregator: PerilAggregator;
  unit: string;
  /** Non-blank quality flags always fail. These measurement flags are allowed. */
  measurementFlags: readonly string[];
  /** Heat may see a sub-zero daily maximum. The committed value is the window maximum. */
  allowNegativeDaily: boolean;
  methodologyVersion: string | null;
  /** Quote-engine model id. Rain stays noaa-rain-v1. */
  modelVersion: "noaa-rain-v1" | "noaa-snow-v1" | "noaa-wind-v1" | "noaa-heat-v1" | null;
  strikeRounding: StrikeRounding;
  direction: "up";
  /** Cities whose pinned station covers this peril for the analogue decade. */
  cities: readonly LiveCitySlug[];
  /** Buyer-facing name. Heat is a warm spell. */
  label: string;
}

const RAIN_CITIES = LIVE_CITY_SLUGS;

export const PERILS: Record<PerilId, PerilSpec> = {
  rain: {
    id: "rain",
    open: true,
    closedReason: null,
    ghcndElement: "PRCP",
    ghcnDivisor: 10,
    aggregator: "sum",
    unit: "mm",
    measurementFlags: ["B", "D", "T"],
    allowNegativeDaily: false,
    methodologyVersion: "methodology-v1",
    modelVersion: "noaa-rain-v1",
    strikeRounding: "whole",
    direction: "up",
    cities: RAIN_CITIES,
    label: "rain",
  },
  snow: {
    id: "snow",
    open: true,
    closedReason: null,
    ghcndElement: "SNOW",
    ghcnDivisor: 1,
    aggregator: "sum",
    unit: "mm",
    measurementFlags: ["B", "D", "T"],
    allowNegativeDaily: false,
    methodologyVersion: "methodology-snow-v1",
    modelVersion: "noaa-snow-v1",
    strikeRounding: "whole",
    direction: "up",
    cities: ["chicago", "new-york"],
    label: "snow",
  },
  wind: {
    id: "wind",
    open: true,
    closedReason: null,
    // WSF2 is the fastest 2-minute wind. WSFG stopped in the mid-1990s.
    // WSF5 is the 5-second gust. Chicago WSF2 is complete for 2016–2025;
    // New York's WSF2/WSF5/AWND series is not.
    ghcndElement: "WSF2",
    ghcnDivisor: 10,
    aggregator: "max",
    unit: "m/s",
    measurementFlags: ["K"],
    allowNegativeDaily: false,
    methodologyVersion: "methodology-wind-v1",
    modelVersion: "noaa-wind-v1",
    strikeRounding: "tenth",
    direction: "up",
    cities: ["chicago"],
    label: "wind",
  },
  heat: {
    id: "heat",
    open: true,
    closedReason: null,
    ghcndElement: "TMAX",
    ghcnDivisor: 10,
    aggregator: "max",
    unit: "C",
    measurementFlags: [],
    allowNegativeDaily: true,
    methodologyVersion: "methodology-heat-v1",
    modelVersion: "noaa-heat-v1",
    strikeRounding: "tenth",
    direction: "up",
    cities: ["miami"],
    label: "warm spell",
  },
  cold: {
    id: "cold",
    open: false,
    closedReason: "Cold is not open. The program stores a non-negative observation, so a negative temperature cannot be committed.",
    ghcndElement: null,
    ghcnDivisor: 10,
    aggregator: "max",
    unit: "C",
    measurementFlags: [],
    allowNegativeDaily: true,
    methodologyVersion: null,
    modelVersion: null,
    strikeRounding: "tenth",
    direction: "up",
    cities: [],
    label: "cold",
  },
};

export function perilSpec(id: PerilId): PerilSpec {
  return PERILS[id];
}

export function isPerilId(value: string): value is PerilId {
  return (PERIL_IDS as readonly string[]).includes(value);
}

export function perilOpenForCity(id: PerilId, city: string): boolean {
  const spec = PERILS[id];
  return spec.open && (spec.cities as readonly string[]).includes(city);
}

/** Rain hashes the city slug alone. Other perils hash `city:peril`. */
export function perilCityHashInput(city: string, peril: PerilId): string {
  return peril === "rain" ? city : `${city}:${peril}`;
}

export function perilCityHashHex(city: string, peril: PerilId): string {
  return createHash("sha256").update(perilCityHashInput(city, peril)).digest("hex");
}

export function resolveCityPeril(hashHex: string): { city: LiveCitySlug; peril: PerilId } | null {
  const hash = hashHex.toLowerCase();
  for (const city of LIVE_CITY_SLUGS) {
    if (perilCityHashHex(city, "rain") === hash) return { city, peril: "rain" };
    for (const peril of ["snow", "wind", "heat"] as const) {
      if (perilCityHashHex(city, peril) === hash) return { city, peril };
    }
  }
  if (createHash("sha256").update("Des Moines").digest("hex") === hash) return { city: "des-moines", peril: "rain" };
  return null;
}
