/** FIXTURES. Imported exclusively by /preview and tests. Never live market data. */
import { NYC_RAIN_MODELLED, FIXTURE_SILHOUETTE } from "./ui-fixtures.ts";
import { cityById, perilById } from "./peril-registry.ts";
import type { PerilId, WindowQuote } from "./ui-types.ts";
import type { CoverClaim, StoredCover } from "./ui-discovery.ts";

export const PREVIEW_NOW = Date.UTC(2026, 9, 24, 12) / 1000;
export const DISCOVERY_QUOTES: WindowQuote[] = (["rain", "snow", "wind", "heat"] as const).map((peril) => {
  const cityId = peril === "rain" ? "new-york" : peril === "heat" ? "miami" : "chicago";
  const triggers = peril === "rain" ? NYC_RAIN_MODELLED.rungs.map((r) => r.triggerValue) : FIXTURE_SILHOUETTE[peril];
  return { ...NYC_RAIN_MODELLED, peril, cityId, stationId: cityById(cityId)!.stationId, unit: perilById(peril)!.unit,
    rungs: NYC_RAIN_MODELLED.rungs.map((r, i) => ({ ...r, triggerValue: triggers[i], marketAddress: i === 3 ? `fixture-${peril}` : null })) };
});
export const PREVIEW_ADDRESS = "FixtureWallet11111111111111111111111111111111";
export const PREVIEW_BALANCE = "1000000000";
export function fixturePosition(peril: PerilId = "rain"): StoredCover {
  return { address: `fixture-position-${peril}`, market: `fixture-${peril}`, premiumPaid: "24000000", protectedAmount: "100000000", potentialPayout: "100000000", statusLabel: "Active", peril };
}
export function fixtureClaim(state: string): CoverClaim | null {
  const observation = { rainfallMmX100: state === "dry" ? "5000" : "7400", windowEnd: Date.UTC(2026, 10, 2) / 1000 };
  if (state === "paid") return { state: "claimed", action: null, result: "triggered", observation };
  if (state === "dry") return { state: "not_claimable", action: null, result: "nottriggered", observation };
  if (state === "pending") return { state: "claimable", action: "claim_payout", result: "triggered", observation };
  if (state === "refunded") return { state: "claimed", action: null, result: "dataunavailable", observation: null };
  if (state === "refund-ready") return { state: "claimable", action: "claim_premium_refund", result: "dataunavailable", observation: null };
  if (state === "unknown") return null;
  return { state: "pending", action: null, result: "unset", observation: null };
}
