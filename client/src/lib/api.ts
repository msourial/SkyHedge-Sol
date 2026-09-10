const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("SkyHedge data services are unavailable for this deployment.");
  }

  let body: (T & { error?: string; message?: string }) | undefined;
  try { body = (await res.json()) as T & { error?: string; message?: string }; } catch { /* non-JSON failure */ }
  if (!res.ok) throw new ApiError(body?.error ?? body?.message ?? `HTTP ${res.status}`, res.status);
  if (!body) throw new ApiError("SkyHedge returned an invalid response.", res.status);
  return body;
}

export function apiUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === undefined || error.status >= 500 || error.status === 404);
}

export function mm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} mm`;
}

export function usdcDisplay(base: string | number | bigint | null | undefined): string {
  if (base === null || base === undefined) return "—";
  const value = typeof base === "bigint" ? base : BigInt(String(base));
  return `${(Number(value) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
}
