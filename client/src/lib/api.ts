export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  const body = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
  return body;
}

export function mm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} mm`;
}

export function skytDisplay(base: string | number | bigint | null | undefined): string {
  if (base === null || base === undefined) return "—";
  const value = typeof base === "bigint" ? base : BigInt(String(base));
  return `${(Number(value) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} SKYT`;
}