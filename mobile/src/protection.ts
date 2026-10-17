import type { DevnetStatus } from "./api";
import { consumerCityName } from "../../shared/consumer-cities.ts";
import { matchingWindowPackage, type WindowEvidencePackage } from "../../shared/window-chain.ts";
import { LIVE_CITY_SLUGS, type LiveCitySlug } from "../../shared/window-ladder.ts";

const TESTER_LIMIT_BASE_UNITS = 500_000_000n;
const TOKEN_DECIMALS = 6;

/** Parse a human SKYT amount without floating-point rounding. */
export function parseSkytAmount(input: string): string | null {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  try {
    const baseUnits = BigInt(whole) * 10n ** BigInt(TOKEN_DECIMALS)
      + BigInt((fraction + "0".repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS));
    if (baseUnits <= 0n || baseUnits > TESTER_LIMIT_BASE_UNITS) return null;
    return baseUnits.toString();
  } catch {
    return null;
  }
}

export function formatSkyt(baseUnits: string | null | undefined): string {
  if (!baseUnits || !/^\d+$/.test(baseUnits)) return "—";
  const value = BigInt(baseUnits);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function buildCommittedQuoteRequest(status: DevnetStatus, amountBase: string, market: {
  observationStart: number | null;
  observationEnd: number | null;
  thresholdMmX100: string | null;
  operator: "gt" | "gte" | "lt" | "lte" | null;
} = status.desMoinesMarket, city: LiveCitySlug = "des-moines"): {
  city: LiveCitySlug;
  observationStart: string;
  observationEnd: string;
  thresholdMm: number;
  operator: "gt" | "gte" | "lt" | "lte";
  protectedAmount: string;
} | null {
  if (!market.observationStart || !market.observationEnd || !market.thresholdMmX100 || !market.operator) return null;
  return {
    city,
    observationStart: new Date(market.observationStart * 1_000).toISOString().slice(0, 10),
    observationEnd: new Date(market.observationEnd * 1_000).toISOString().slice(0, 10),
    thresholdMm: Number(market.thresholdMmX100) / 100,
    operator: market.operator,
    protectedAmount: amountBase,
  };
}

export function getProtectionUnavailableReason(input: {
  status: DevnetStatus | null;
  citySlug: string;
  walletConnected: boolean;
  walletSkytBalanceBase: string | null;
  amountBase: string | null;
  nowSeconds?: number;
  /** When present, this expiry must have its own validated analogue package. */
  windowEvidence?: readonly WindowEvidencePackage[] | null;
  market?: {
    status: string;
    address: string | null;
    vault?: string | null;
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
  } | null;
}): string | null {
  const { status, citySlug, walletConnected, amountBase } = input;
  if (!status) return "Finalized Devnet status is still loading.";
  if (status.network.toLowerCase() !== "devnet") return "Protection testing is available only on Solana Devnet.";
  if (!status.program.executable || status.program.status !== "ready") return "The SkyHedge protection program is not verified as executable on Devnet.";
  if (status.idl.status !== "ready" || status.idl.instructionCount === 0) return "The committed program instructions are not available for this deployment.";
  if (!status.protocol.initialized || status.protocol.status !== "ready") return "The on-chain protocol has not been initialized.";
  if (!status.skytMint.exists) return "The SKYT test collateral mint is not available on Devnet.";
  if (status.skytMint.decimals !== TOKEN_DECIMALS) return "The configured test collateral does not use six-decimal SKYT units.";
  if (!status.protocol.collateralMint || status.protocol.collateralMint !== status.skytMint.address) return "The initialized protocol collateral does not match the verified SKYT mint.";
  if (!(LIVE_CITY_SLUGS as readonly string[]).includes(citySlug)) return "Only the live Devnet rainfall cities are open; other areas remain research-only.";
  const cityName = consumerCityName(citySlug);
  const market = input.market === undefined ? status.desMoinesMarket : input.market;
  if (!market) return "Next window opening shortly.";
  if (market.status !== "ready" || !market.address || !market.vault) return `The ${cityName} market and its vault are not finalized on Devnet.`;
  if (!isOnchainMarketOpen(market.onchainStatus)) return `The ${cityName} market is not open for protection positions.`;
  if (market.evidenceStatus !== "validated") return "The market does not have its pinned NOAA evidence commitment.";
  if ("targetCityHash" in market && typeof market.targetCityHash === "string" && market.targetCityHash.length === 0) return "The market does not have its pinned NOAA evidence commitment.";
  if (input.windowEvidence) {
    if (!matchingWindowPackage(input.windowEvidence, citySlug, market.observationStart, market.observationEnd)) return "A validated NOAA evidence package is not available.";
  } else if (status.noaaEvidence.status !== "ready" || status.noaaEvidence.settlementSource !== "NOAA" || !status.noaaEvidence.package?.stationId) return "A validated NOAA evidence package is not available.";
  if (!market.vaultBalance || !/^\d+$/.test(market.vaultBalance) || BigInt(market.vaultBalance) === 0n) return "The market vault has no finalized SKYT collateral.";
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (!market.salesCloseAt || market.salesCloseAt <= now) return "The market’s sales window has ended.";
  if (!market.observationStart || !market.observationEnd || market.observationEnd <= market.observationStart) return "The market’s immutable observation window is unavailable.";
  if (!market.thresholdMmX100 || !market.operator || market.quoteProbabilityBps === null || market.premiumRateBps === null || !market.quoteInputsHash || /^0+$/.test(market.quoteInputsHash)) return "The market’s committed NOAA pricing terms are incomplete.";
  if (!walletConnected) return "Connect your Devnet wallet before requesting a quote.";
  // Balance is intentionally not required for pricing; the wallet/program enforce funds at review.
  if (!amountBase || !/^\d+$/.test(amountBase) || BigInt(amountBase) <= 0n) return "Enter a valid protection amount greater than zero.";
  if (BigInt(amountBase) > TESTER_LIMIT_BASE_UNITS) return "The Devnet tester limit is 500 SKYT per wallet.";
  return null;
}

/** Blocks a second position on the selected window only. A position in another city does not match. */
export function duplicatePositionReason(cityName: string, state: string | null | undefined): string | null {
  if (!state || state === "no_position") return null;
  return `This wallet already has a ${cityName} position or a pending outcome on this window. A second position on the same window is not available.`;
}

export function isOnchainMarketOpen(onchainStatus: string | null): boolean {
  if (!onchainStatus) return false;
  try {
    const parsed: unknown = JSON.parse(onchainStatus);
    if (typeof parsed !== "object" || parsed === null) return false;
    const states = Object.keys(parsed);
    return states.length === 1 && states[0].toLowerCase() === "open";
  } catch {
    return onchainStatus.toLowerCase() === "open";
  }
}
