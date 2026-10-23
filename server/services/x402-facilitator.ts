import { FacilitatorResponseError, FacilitatorTimeoutError, HTTPFacilitatorClient } from "@x402/core/server";
import { SettleError, VerifyError, type PaymentPayload, type PaymentRequirements } from "@x402/core/types";

/** x402 V2 CAIP-2 identifier for Solana Devnet. Not the full genesis hash. */
export const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;
/** Circle Devnet USDC mint. Six decimals. The exact scheme pays this asset. */
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const X402_FACILITATOR_URL = "https://x402.org/facilitator";
export const DEFAULT_QUOTE_PRICE_USDC = "0.01";
/** Access price cap. Devnet USDC has no real-world value; the cap still keeps a bad env small. */
export const MAX_QUOTE_PRICE_ATOMIC = 1_000_000n;

export interface FacilitatorVerifyResult {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
}

export interface FacilitatorSettleResult {
  success: boolean;
  transaction?: string;
  network?: string;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
}

/** Verify and settle through a facilitator. The server never signs. */
export interface QuoteFacilitator {
  feePayer(): Promise<string>;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<FacilitatorVerifyResult>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<FacilitatorSettleResult>;
}

export class FacilitatorUnavailableError extends Error {
  constructor(message = "The Solana Devnet facilitator could not be reached.") {
    super(message);
    this.name = "FacilitatorUnavailableError";
  }
}

/** Decimal USDC string to base units. Returns null when the price is empty, fractional past 6 places, or above the cap. */
export function usdcToAtomic(price: string): string | null {
  if (!/^\d+(\.\d{1,6})?$/.test(price)) return null;
  const [whole, fraction = ""] = price.split(".");
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (atomic <= 0n || atomic > MAX_QUOTE_PRICE_ATOMIC) return null;
  return atomic.toString();
}

export function createHttpQuoteFacilitator(url = X402_FACILITATOR_URL): QuoteFacilitator {
  const client = new HTTPFacilitatorClient({ url });
  let cached: { feePayer: string; expiresAt: number } | null = null;
  return {
    async feePayer() {
      if (cached && cached.expiresAt > Date.now()) return cached.feePayer;
      let supported;
      try {
        supported = await client.getSupported();
      } catch (error) {
        throw facilitatorDown(error);
      }
      const kind = supported.kinds.find((entry) => entry.x402Version === 2 && entry.scheme === "exact" && entry.network === SOLANA_DEVNET_CAIP2);
      const feePayer = kind?.extra && typeof kind.extra.feePayer === "string" ? kind.extra.feePayer : "";
      if (!feePayer) throw new FacilitatorUnavailableError("The facilitator did not advertise an exact Solana Devnet fee payer.");
      cached = { feePayer, expiresAt: Date.now() + 5 * 60_000 };
      return feePayer;
    },
    async verify(payload, requirements) {
      try {
        const result = await client.verify(payload, requirements);
        return { isValid: result.isValid, invalidReason: result.invalidReason, invalidMessage: result.invalidMessage, payer: result.payer };
      } catch (error) {
        if (error instanceof VerifyError || isVerifyFailure(error)) {
          const failure = error as VerifyError;
          return { isValid: false, invalidReason: failure.invalidReason, invalidMessage: failure.invalidMessage, payer: failure.payer };
        }
        throw facilitatorDown(error);
      }
    },
    async settle(payload, requirements) {
      try {
        const result = await client.settle(payload, requirements);
        return { success: result.success, transaction: result.transaction, network: result.network, errorReason: result.errorReason, errorMessage: result.errorMessage, payer: result.payer };
      } catch (error) {
        if (error instanceof SettleError || isSettleFailure(error)) {
          const failure = error as SettleError;
          return { success: false, transaction: failure.transaction, network: failure.network, errorReason: failure.errorReason, errorMessage: failure.errorMessage, payer: failure.payer };
        }
        if (error instanceof FacilitatorTimeoutError) {
          return { success: false, errorReason: "settlement_timeout", errorMessage: "The facilitator did not confirm settlement in time. The payment may still land." };
        }
        throw facilitatorDown(error);
      }
    },
  };
}

function isVerifyFailure(error: unknown): error is VerifyError {
  return Boolean(error && typeof error === "object" && "invalidReason" in error && (error as { isValid?: boolean }).isValid !== true);
}

function isSettleFailure(error: unknown): error is SettleError {
  return Boolean(error && typeof error === "object" && "errorReason" in error && "transaction" in error);
}

function facilitatorDown(error: unknown): FacilitatorUnavailableError {
  if (error instanceof FacilitatorUnavailableError) return error;
  if (error instanceof FacilitatorTimeoutError || error instanceof FacilitatorResponseError) return new FacilitatorUnavailableError(error.message);
  const message = error instanceof Error ? error.message : "The Solana Devnet facilitator could not be reached.";
  return new FacilitatorUnavailableError(message);
}
