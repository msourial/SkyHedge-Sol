import { isAllowedWebOrigin } from "../../shared/public-origins.js";

type HeaderReader = { headers?: { origin?: string | string[] | undefined } };
type HeaderWriter = { setHeader: (name: string, value: string) => unknown };

function requestOrigin(req: HeaderReader): string | undefined {
  const value = req.headers?.origin;
  return typeof value === "string" ? value : undefined;
}

/** Reflect an allowed Origin for browser clients. No-op when Origin is absent or not allowlisted. */
export function applyCorsHeaders(req: HeaderReader, res: HeaderWriter): void {
  const origin = requestOrigin(req);
  if (!isAllowedWebOrigin(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function isCorsPreflight(req: { method?: string | undefined }): boolean {
  return (req.method ?? "").toUpperCase() === "OPTIONS";
}
