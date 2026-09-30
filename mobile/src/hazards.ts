export type HazardId = "rainfall" | "wind-gust" | "snowfall";

export type HazardPresentation = {
  id: HazardId;
  label: string;
  metric: string;
  unit: string;
  status: string;
  note: string;
  quoteable: boolean;
};

const HAZARDS: Record<HazardId, HazardPresentation> = {
  rainfall: {
    id: "rainfall",
    label: "Rainfall",
    metric: "Cumulative liquid rainfall",
    unit: "mm / in",
    status: "Research catalog",
    note: "Rainfall is the only hazard connected to the current Devnet readiness checks. Checkout still requires every on-chain and evidence gate.",
    quoteable: false,
  },
  "wind-gust": {
    id: "wind-gust",
    label: "Wind gust",
    metric: "Highest daily peak gust",
    unit: "mph / km/h",
    status: "Researching NOAA evidence",
    note: "Proposed index only. Station coverage, units, quality rules, and pricing are not validated. No quotes or transactions are available.",
    quoteable: false,
  },
  snowfall: {
    id: "snowfall",
    label: "Snowfall",
    metric: "New snowfall accumulation",
    unit: "in / mm",
    status: "Researching NOAA evidence",
    note: "Proposed new snowfall only—not snow depth. Station coverage, units, quality rules, and pricing are not validated. No quotes or transactions are available.",
    quoteable: false,
  },
};

export function hazardPresentation(id: HazardId): HazardPresentation {
  return HAZARDS[id];
}

export function listHazards(): HazardPresentation[] {
  return Object.values(HAZARDS);
}
