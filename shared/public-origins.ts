/** Canonical public site for docs, OpenRouter referer, and MWA identity. */
export const PUBLIC_SITE_ORIGIN = "https://skyhedge.app";

/**
 * Browser origins allowed for CORS.
 * Keep the legacy Vercel alias so existing bookmarks and MapTiler allowlists keep working.
 */
export const ALLOWED_WEB_ORIGINS = [
  PUBLIC_SITE_ORIGIN,
  "https://www.skyhedge.app",
  "https://skyhedge.vercel.app",
] as const;

export type AllowedWebOrigin = (typeof ALLOWED_WEB_ORIGINS)[number];

export function isAllowedWebOrigin(origin: string | null | undefined): origin is AllowedWebOrigin {
  return !!origin && (ALLOWED_WEB_ORIGINS as readonly string[]).includes(origin);
}
