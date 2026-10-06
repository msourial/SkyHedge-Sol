import type { DevnetStatus } from "./api";

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

export function buildCommittedQuoteRequest(status: DevnetStatus, amountBase: string): {
  city: "des-moines";
  observationStart: string;
  observationEnd: string;
  thresholdMm: number;
  operator: "gt" | "gte" | "lt" | "lte";
  protectedAmount: string;
} | null {
  const market = status.desMoinesMarket;
  if (!market.observationStart || !market.observationEnd || !market.thresholdMmX100 || !market.operator) return null;
  return {
    city: "des-moines",
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
  if (citySlug !== "des-moines") return "Only the Des Moines Devnet pilot is enabled; other areas remain research-only.";
  const market = status.desMoinesMarket;
  if (market.status !== "ready" || !market.address || !market.vault) return "The Des Moines market and its vault are not finalized on Devnet.";
  if (!isOnchainMarketOpen(market.onchainStatus)) return "The Des Moines market is not open for protection positions.";
  if (market.evidenceStatus !== "validated" || market.targetCityHash.length === 0) return "The market does not have its pinned NOAA evidence commitment.";
  if (status.noaaEvidence.status !== "ready" || status.noaaEvidence.settlementSource !== "NOAA" || !status.noaaEvidence.package?.stationId) return "A validated NOAA evidence package is not available.";
  if (!market.vaultBalance || !/^\d+$/.test(market.vaultBalance) || BigInt(market.vaultBalance) === 0n) return "The market vault has no finalized SKYT collateral.";
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (!market.salesCloseAt || market.salesCloseAt <= now) return "The market’s sales window has ended.";
  if (!market.observationStart || !market.observationEnd || market.observationEnd <= market.observationStart) return "The market’s immutable observation window is unavailable.";
  if (!market.thresholdMmX100 || !market.operator || market.quoteProbabilityBps === null || market.premiumRateBps === null || !market.quoteInputsHash || /^0+$/.test(market.quoteInputsHash)) return "The market’s committed NOAA pricing terms are incomplete.";
  if (!walletConnected) return "Connect your Devnet wallet before requesting a quote.";
  if (!input.walletSkytBalanceBase || !/^\d+$/.test(input.walletSkytBalanceBase)) return "A finalized SKYT wallet balance is not available yet.";
  if (!amountBase || !/^\d+$/.test(amountBase) || BigInt(amountBase) <= 0n) return "Enter a valid protection amount greater than zero.";
  if (BigInt(amountBase) > TESTER_LIMIT_BASE_UNITS) return "The Devnet tester limit is 500 SKYT per wallet.";
  return null;
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
