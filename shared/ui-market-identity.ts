/** Committed SHA-256 identities, generated from the backend's city/peril hash rule.
 * Keeping the table static lets the native account decoder stay synchronous.
 */
import identities from "./ui-market-identities.json";
import { cityById, perilById } from "./peril-registry.ts";
import type { PerilId } from "./ui-types.ts";
export function marketIdentity(hash: string): { cityId: string; peril: PerilId } | null {
  const row = identities.find((entry) => entry.hash === hash.toLowerCase());
  if (!row || !cityById(row.cityId) || !perilById(row.peril as PerilId)) return null;
  return { cityId: row.cityId, peril: row.peril as PerilId };
}
