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
  latitude: number;
  longitude: number;
  mapZoom?: number;
  crops: string[];
  agriculturalContext: string;
  evidenceStatus: "researching_evidence" | "validated";
  noaaStationId: string | null;
};

export type DevnetStatus = {
  network: string;
  program: { address: string; status: "ready" | "pending" | "unavailable" | "error"; executable: boolean; explorerUrl: string };
  idl: { status: "ready" | "pending" | "unavailable" | "error"; source: string; instructionCount: number; accountCount: number; supportsEmptyDraftCancellation: boolean };
  protocol: { address: string; status: "ready" | "pending" | "unavailable" | "error"; initialized: boolean; admin: string | null; settlementAuthority: string | null; collateralMint: string | null; nextMarketId: string | null };
  feeVault: { address: string; status: "ready" | "pending" | "unavailable" | "error"; exists: boolean; balance: string | null };
  skytMint: { address: string; status: "ready" | "pending" | "unavailable" | "error"; exists: boolean; decimals: number | null; supply: string | null; mintAuthority: string | null };
  desMoinesMarket: {
    status: "ready" | "pending" | "unavailable" | "error";
    address: string | null;
    marketId: string | null;
    vault: string | null;
    vaultBalance: string | null;
    onchainStatus: string | null;
    salesCloseAt: number | null;
    observationStart: number | null;
    observationEnd: number | null;
    thresholdMmX100: string | null;
    operator: "gt" | "gte" | "lt" | "lte" | null;
    quoteProbabilityBps: number | null;
    premiumRateBps: number | null;
    quoteInputsHash: string | null;
    evidenceStatus: "researching_evidence" | "validated";
    targetCityHash: string;
  };
  noaaEvidence: {
    status: "ready" | "pending" | "unavailable";
    settlementSource: "NOAA";
    message: string;
    package: null | { stationId: string };
  };
  generatedAt: string;
};

export type ProtectionQuote = {
  probabilityBps: number;
  premiumRateBps: number;
  premium: string;
  protocolFee: string;
  protectedAmount: string;
  inputsHash: string;
  modelVersion: string;
  source: "NOAA";
  explicitApprovalRequired: true;
};

export type AdvisoryIntent = {
  place: string | null;
  useCase: "farming" | "event" | "travel" | "other" | null;
  hazard: "rainfall" | "wind_gust" | "snowfall" | null;
  direction: "above" | "below" | null;
  date: string | null;
  amount: string | null;
  amountUnit: "USD" | "SKYT" | "unspecified" | null;
  requestedThresholdMm: number | null;
};

export type AdvisoryResponse = {
  status: "needs_input" | "no_match" | "matched" | "quote_ready";
  message: string;
  intent: AdvisoryIntent;
  match: null | { slug: string; location: string; useCase: string; evidenceStatus: "researching_evidence" | "validated"; marketAddress: string | null };
  unavailableReason: string | null;
  costExplanation: string;
  payoutExplanation: string;
  quote: null;
  transaction: null;
  explicitApprovalRequired: true;
};

export type UnsignedTransaction = {
  action: string;
  market: string;
  wallet: string;
  base64: string;
  description: string;
  programId: string;
  network: "devnet";
};

export type ClaimReadiness = {
  market: string;
  wallet: string;
  state: "no_position" | "pending" | "claimable" | "not_claimable" | "claimed" | "expired";
  action: "claim_payout" | "claim_premium_refund" | null;
  result: string;
  amount: string | null;
  claimDeadline: number | null;
  finalizedSlot: number;
  reason: string;
  observationSignature: string | null;
  resolutionSignature: string | null;
  observation: null | { authority: string; stationIdHash: string; methodologyHash: string; sourceHash: string; rainfallMmX100: string; windowStart: number; windowEnd: number };
};

export type Portfolio = {
  wallet: string;
  source?: "not-indexed" | "finalized-chain-indexer";
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

export type FinalizedWalletState = {
  sol: number;
  skytBaseUnits: string;
  skytDecimals: number;
  slot: number;
};

const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:5000").replace(/\/$/, "");

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && path.startsWith("/api/mobile?resource=")) {
      const resource = new URLSearchParams(path.split("?")[1] ?? "").get("resource");
      if (resource === "city") throw new Error("No NOAA index is published for that selected area. Its catalog entry remains research-only.");
      throw new Error("This API server is missing the mobile read routes. Point the app to the current SkyHedge API service.");
    }
    const reason = typeof body?.message === "string" ? body.message : `Service returned ${response.status}`;
    throw new Error(reason);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("SkyHedge returned an unreadable API response. Try again later.");
  }
  return body as T;
}

export async function postJson<T>(path: string, value: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = typeof body?.message === "string" ? body.message
      : typeof body?.error === "string" ? body.error
        : `Service returned ${response.status}`;
    throw new Error(reason);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("SkyHedge returned an unreadable API response. Try again later.");
  }
  return body as T;
}

export function getApiHost() {
  return apiBase.replace(/^https?:\/\//, "");
}
