export type City = "new-york" | "miami" | "chicago";

export type Health = {
  name: "SkyHedge";
  network: "devnet";
  programId: string;
  settlementSource: "NOAA";
  generatedData: false;
};

export type Market = {
  id: City;
  city: string;
  stationId: string;
  latitude: number;
  longitude: number;
  metric: "cumulative_rainfall_mm";
  collateral: "SKYT";
  decimals: 6;
  status: "INDEXER_PENDING" | string;
  maxLiquidity: string;
  maxExposure: string;
  perWalletMax: string;
  programId: string;
};

export type Advisory = {
  sessionId: string;
  structuredParameters: { city: City; risk: "excess-rain" | "low-rain"; thresholdMm: number; protectedAmount: string; operator: "gt" | "gte" | "lt" | "lte" };
  recommendation: { city: City; stationId: string; methodology: string };
  reasoning: string;
  explicitApprovalRequired: true;
};

export type Quote = {
  probabilityBps: number;
  premiumRateBps: number;
  premium: string;
  protocolFee: string;
  protectedAmount: string;
  historicalWindows: number;
  forecastWeight: number;
  modelVersion: string;
  inputsHash: string;
  source: "NOAA";
  explicitApprovalRequired: true;
};

export type Portfolio = { wallet: string; source: "finalized-chain-indexer"; indexed: boolean; positions: unknown[]; message: string };
export type WeatherEvidence = { source: "NOAA"; city: City; stationId: string; start: string; end: string; records: unknown[]; cumulativeMm: number; sourceHash: string };
export type ApiFailure = { error: string; message?: string; settlementAction?: string };

export class SkyHedgeApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiFailure) { super(body.message ?? body.error); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = await response.json().catch(() => ({ error: "NETWORK_RESPONSE_INVALID", message: "SkyHedge could not read the service response." }));
  if (!response.ok) throw new SkyHedgeApiError(response.status, body as ApiFailure);
  return body as T;
}

export const skyHedgeApi = {
  health: () => request<Health>("/api/health"),
  markets: () => request<Market[]>("/api/markets"),
  portfolio: (wallet: string) => request<Portfolio>(`/api/portfolio/${wallet}`),
  advisory: (input: { city: City; risk: "excess-rain" | "low-rain"; thresholdMm: number; protectedAmount: string }) => request<Advisory>("/api/advisory", { method: "POST", body: JSON.stringify(input) }),
  quote: (input: { city: City; observationStart: string; observationEnd: string; thresholdMm: number; operator: "gt" | "gte" | "lt" | "lte"; protectedAmount: string }) => request<Quote>("/api/quotes", { method: "POST", body: JSON.stringify(input) }),
  evidence: (city: City, start: string, end: string) => request<WeatherEvidence>(`/api/weather/${city}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
};

export function parseSkyt(value: string): string | undefined {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,6})?$/.test(normalized)) return undefined;
  const [whole, fraction = ""] = normalized.split(".");
  return `${whole}${fraction.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "") || "0";
}

export function formatSkyt(value?: string | bigint | number) {
  if (value === undefined) return "—";
  const raw = BigInt(value);
  const whole = raw / 1_000_000n;
  const fraction = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} SKYT`;
}

export const shortAddress = (address?: string) => address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "";
export const explorerUrl = (signature: string, network = "devnet") => `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
