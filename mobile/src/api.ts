export type CityIndex = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  stationName: string;
  coverageTier: "A" | "B" | "C";
  currentWindow: {
    start: string;
    end: string;
    daysElapsed: number;
    daysTotal: number;
    progressPct: number;
  };
  cumulativeMm: number | null;
  observedThrough: string | null;
  windowNormalMm: number;
  probabilitySource: "noaa-10yr" | "climatology-prior" | "none";
  weeklyHistoryMm: Array<{ week: string; mm: number | null }> | null;
};

export type AgriculturalMarket = {
  slug: string;
  name: string;
  locality: string;
  region: string;
  country: string;
  administrativeArea: string;
  crops: string[];
  agriculturalContext: string;
  evidenceStatus: "researching_evidence" | "validated";
  noaaStationId: string | null;
};

export type DevnetStatus = {
  network: string;
  desMoinesMarket: {
    status: "ready" | "pending" | "unavailable" | "error";
    address: string | null;
    onchainStatus: string | null;
    evidenceStatus: "researching_evidence" | "validated";
  };
  noaaEvidence: {
    status: "ready" | "pending" | "unavailable";
    message: string;
  };
};

export type Portfolio = {
  wallet: string;
  indexed: boolean;
  protections: Array<{
    market: string;
    address: string;
    protectedAmount: string;
    premiumPaid: string;
  }>;
  liquidity: Array<{ market: string; address: string; shares: string }>;
  message?: string;
};

const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:5000").replace(/\/$/, "");

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = typeof body?.message === "string" ? body.message : `Service returned ${response.status}`;
    throw new Error(reason);
  }
  return body as T;
}

export function getApiHost() {
  return apiBase.replace(/^https?:\/\//, "");
}
