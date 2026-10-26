import type { LiveCitySlug } from "../../shared/window-ladder.ts";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";

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
  ladderMarkets?: Array<{
    city: LiveCitySlug;
    state: "draft" | "open" | "cancelled" | "other";
    salesCloseAt: number | null;
  }>;
  cityWindows?: Array<{
    city: LiveCitySlug;
    tenor: "weekly" | "monthly";
    status: "ready";
    address: string;
    marketId: string;
    vault: string;
    vaultBalance: string | null;
    onchainStatus: string | null;
    salesCloseAt: number | null;
    observationStart: number;
    observationEnd: number;
    thresholdMmX100: string | null;
    operator: "gt" | "gte" | "lt" | "lte" | null;
    quoteProbabilityBps: number | null;
    premiumRateBps: number | null;
    quoteInputsHash: string | null;
    evidenceStatus: "researching_evidence" | "validated";
  }>;
  windowEvidence?: WindowEvidencePackage[];
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
  /** Present when the server answered from deterministic offline guide text. */
  mode?: "offline";
  modeLabel?: string;
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
  source?: "finalized-solana-rpc" | "finalized-chain-indexer";
  indexed: boolean;
  protections: Array<{
    market: string;
    address: string;
    protectedAmount: string;
    premiumPaid: string;
    potentialPayout?: string;
    city?: string;
    windowLabel?: string;
    triggerLabel?: string;
    statusLabel?: string;
    explorerUrl?: string;
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

const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://skyhedge.app").replace(/\/$/, "");

/** Thrown when a deployment answers a JSON route with HTML (e.g. an SPA rewrite). Treat as "not available yet". */
export class NotAvailableYetError extends Error {
  constructor() { super("Not available yet on this deployment."); this.name = "NotAvailableYetError"; }
}

export function isNonJsonReply(contentType: string | null, text: string): boolean {
  if (contentType && /html/i.test(contentType)) return true;
  return /^\s*</.test(text);
}

export function claimReadinessPath(market: string, wallet: string): string {
  return `/api/mobile?resource=claim-readiness&market=${encodeURIComponent(market)}&wallet=${encodeURIComponent(wallet)}`;
}

/** GET with a per-attempt timeout and retries on transport errors only (DNS/UnknownHost, offline, timeout). */
export async function fetchWithRetry(url: string, init: RequestInit, opts: { attempts?: number; timeoutMs?: number; fetcher?: typeof fetch; delayMs?: number } = {}): Promise<Response> {
  const attempts = opts.attempts ?? 3; const timeoutMs = opts.timeoutMs ?? 10_000; const f = opts.fetcher ?? fetch;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
        f(url, init).then((r) => { clearTimeout(timer); resolve(r); }, (e) => { clearTimeout(timer); reject(e); });
      });
    } catch (error) {
      last = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, (opts.delayMs ?? 800) * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Network request failed");
}

export class ApiReadError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "ApiReadError"; }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetchWithRetry(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text().catch(() => "");
  if (isNonJsonReply(response.headers?.get?.("content-type") ?? null, text)) throw new NotAvailableYetError();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    if (response.status === 404 && path.startsWith("/api/mobile?resource=")) {
      const resource = new URLSearchParams(path.split("?")[1] ?? "").get("resource");
      if (resource === "city") throw new Error("No NOAA index is published for that selected area. Its catalog entry remains research-only.");
      throw new Error("This API server is missing the mobile read routes. Point the app to the current SkyHedge API service.");
    }
    const reason = typeof body?.message === "string" ? body.message : `Service returned ${response.status}`;
    throw new ApiReadError(reason, response.status);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("SkyHedge returned an unreadable API response. Try again later.");
  }
  return body as T;
}

export class ApiError extends Error {
  readonly detail: string | null;
  constructor(message: string, detail: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.detail = detail;
  }
}

export async function postJson<T>(path: string, value: unknown, opts: { timeoutMs?: number; attempts?: number; signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<T> {
  const attempts = opts.attempts ?? 1;
  const f = opts.fetcher ?? fetch;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (opts.signal?.aborted) throw new Error("The request was cancelled.");
    const controller = new AbortController();
    const timer = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onParentAbort);
    try {
      const response = await f(`${apiBase}${path}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(value),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const reason = typeof body?.message === "string" ? body.message
          : typeof body?.error === "string" ? body.error
            : `Service returned ${response.status}`;
        throw new ApiError(reason, typeof body?.detail === "string" ? body.detail : null);
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("SkyHedge returned an unreadable API response. Try again later.");
      }
      return body as T;
    } catch (error) {
      last = controller.signal.aborted && !opts.signal?.aborted
        ? new Error("The price request timed out.")
        : error;
      if (attempt + 1 >= attempts) break;
    } finally {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onParentAbort);
    }
  }
  throw last instanceof Error ? last : new Error("Network request failed");
}

export function getApiHost() {
  return apiBase.replace(/^https?:\/\//, "");
}
