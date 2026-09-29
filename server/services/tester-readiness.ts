/** SKYT uses six decimals; open testers may protect at most 500 SKYT. */
import { isValidImmutableMarketPricingTerms } from "../../shared/market-pricing.js";

export const TESTER_PROTECTION_CAP = 500_000_000n;

type Readiness = {
  program: { executable: boolean };
  idl: { status: string };
  protocol: { initialized: boolean };
  desMoinesMarket: { status: string; address: string | null; vaultBalance: string | null; onchainStatus: string | null; salesCloseAt?: number | null; observationStart?: number | null; observationEnd?: number | null; thresholdMmX100?: string | null; operator?: "gt" | "gte" | "lt" | "lte" | null; quoteProbabilityBps?: number | null; premiumRateBps?: number | null; quoteInputsHash?: string | null; evidenceStatus?: "researching_evidence" | "validated" };
  noaaEvidence: { status: string };
};

/**
 * Returns an explicit, user-safe reason when a tester transaction must not be
 * prepared. `null` means the server may build an unsigned open_position tx.
 */
export function testerProtectionUnavailableReason(status: Readiness, market: string, amount: string, nowSeconds = Math.floor(Date.now() / 1_000)): string | null {
  if (!status.program.executable) return "The Devnet program is not executable.";
  if (status.idl.status !== "ready") return "The deployed program IDL is not available.";
  if (!status.protocol.initialized) return "The Devnet protocol is not initialized.";
  const seeded = status.desMoinesMarket;
  if (seeded.evidenceStatus !== "validated") return "The immutable NOAA evidence commitment has not been verified for this market.";
  if (!seeded.address || seeded.address !== market) return "Only the finalized Des Moines test market is available to testers.";
  if (seeded.status !== "ready" || !isOpenMarket(seeded.onchainStatus)) return "The Des Moines test market is not open.";
  if (!hasValidCommittedPricing(seeded)) return "The finalized market does not contain valid, auditable pricing terms.";
  if (!seeded.salesCloseAt || nowSeconds >= seeded.salesCloseAt) return "The immutable Des Moines sales window is closed.";
  if (!seeded.vaultBalance || BigInt(seeded.vaultBalance) === 0n) return "The Des Moines market has no finalized collateral.";
  if (!/^\d+$/.test(amount) || BigInt(amount) === 0n) return "Protection amount must be a positive SKYT base-unit value.";
  if (BigInt(amount) > TESTER_PROTECTION_CAP) return "Open Devnet testers are limited to 500 SKYT of protection per wallet.";
  return null;
}

export function isOpenMarket(status: string | null): boolean {
  return Boolean(status && /\"open\"\s*:/i.test(status));
}

/**
 * Quotes for the seeded market must use the dates committed in the Market PDA.
 * The caller can display a friendly refusal rather than price a different window.
 */
export function desMoinesQuoteUnavailableReason(status: Readiness, observationStart: string, observationEnd: string, thresholdMm: number, operator: "gt" | "gte" | "lt" | "lte", nowSeconds = Math.floor(Date.now() / 1_000)): string | null {
  if (!status.program.executable) return "The Devnet program is not executable.";
  if (status.idl.status !== "ready") return "The deployed program IDL is not available.";
  if (!status.protocol.initialized) return "The Devnet protocol is not initialized.";
  const market = status.desMoinesMarket;
  if (market.evidenceStatus !== "validated") return "The immutable NOAA evidence commitment has not been verified for this market.";
  if (market.status !== "ready" || !market.address || !isOpenMarket(market.onchainStatus)) return "The Des Moines test market is not open.";
  if (!hasValidCommittedPricing(market)) return "The finalized market does not contain valid, auditable pricing terms.";
  if (!market.vaultBalance || BigInt(market.vaultBalance) === 0n) return "The Des Moines market has no finalized collateral.";
  if (!market.salesCloseAt || nowSeconds >= market.salesCloseAt) return "The immutable Des Moines sales window is closed.";
  if (!market.observationStart || !market.observationEnd) return "The finalized Des Moines observation window is unavailable.";
  if (observationStart !== utcDate(market.observationStart) || observationEnd !== utcDate(market.observationEnd)) return "Quotes must use the immutable Des Moines observation window.";
  if (!market.thresholdMmX100 || Number(market.thresholdMmX100) !== Math.round(thresholdMm * 100)) return "Quotes must use the immutable Des Moines rainfall threshold.";
  if (!market.operator || market.operator !== operator) return "Quotes must use the immutable Des Moines rainfall direction.";
  return null;
}

function hasValidCommittedPricing(market: Readiness["desMoinesMarket"]): boolean {
  return isValidImmutableMarketPricingTerms({ probabilityBps: market.quoteProbabilityBps, premiumRateBps: market.premiumRateBps, inputsHash: market.quoteInputsHash });
}

function utcDate(seconds: number): string {
  return new Date(seconds * 1_000).toISOString().slice(0, 10);
}
