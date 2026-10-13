import { formatSkytFixed, shortUtcDate, trimMm } from "./ticket.ts";

/** Plain-language consumer copy. No invented numbers: every figure comes from a live quote or the on-chain market. */

export const ONBOARDING_STEPS: ReadonlyArray<{ n: number; title: string; body: string }> = [
  { n: 1, title: "Pick a city", body: "Then choose what could ruin your plans: rain today, more soon." },
  { n: 2, title: "Choose an amount", body: "See exactly what you pay and what you get back." },
  { n: 3, title: "Relax", body: "If official weather data shows it rained past the limit, you're paid automatically." },
];

export const TEST_TOKEN_NOTE = "Practice mode: SkyHedge runs on Solana's test network (Devnet) with SKYT, a free test token. It has no real-money value, so nothing here costs real money.";

export type FlowStep = 1 | 2 | 3;
export const FLOW_STEP_LABELS: Record<FlowStep, string> = { 1: "Choose a city", 2: "Choose an amount", 3: "Review in wallet" };
export function stepLabel(step: FlowStep): string { return `Step ${step} of 3 · ${FLOW_STEP_LABELS[step]}`; }

function rainCondition(thresholdMmX100: string | null | undefined, operator: string | null | undefined): string | null {
  if (!thresholdMmX100 || !/^\d+$/.test(thresholdMmX100)) return null;
  const mm = trimMm(Number(thresholdMmX100) / 100);
  if (operator === "gt") return `more than ${mm} mm of rain`;
  if (operator === "lt") return `less than ${mm} mm of rain`;
  if (operator === "lte") return `${mm} mm of rain or less`;
  return `${mm} mm of rain or more`;
}

/** "You pay 3.20 SKYT. You get 100 SKYT if Des Moines gets 50 mm of rain or more between Oct 14 and Oct 20." Null unless every number is real. */
export function dealSentence(input: { place: string; premiumBase: string | null | undefined; payoutBase: string | null | undefined; thresholdMmX100: string | null | undefined; operator: string | null | undefined; start: number | null | undefined; end: number | null | undefined }): string | null {
  const cond = rainCondition(input.thresholdMmX100, input.operator);
  const from = shortUtcDate(input.start ?? null);
  const to = shortUtcDate(input.end ? input.end - 1 : null);
  if (!cond || !from || !to) return null;
  if (!input.premiumBase || !/^\d+$/.test(input.premiumBase) || !input.payoutBase || !/^\d+$/.test(input.payoutBase)) return null;
  return `You pay ${formatSkytFixed(input.premiumBase, 2)} SKYT. You get ${formatSkytFixed(input.payoutBase, 0)} SKYT if ${input.place} gets ${cond} between ${from} and ${to}.`;
}

export type PayoutStageKey = "waiting" | "triggered" | "not_triggered" | "refund" | "paid" | "refunded" | "expired";
export type PayoutStage = { key: PayoutStageKey; title: string; body: string; tone: "rain" | "mint" | "amber" | "muted"; done: number };
export const PAYOUT_STEPS = ["Protected", "Rain window ends", "Official data checked", "Result"] as const;

/** Maps on-chain claim readiness to a consumer status. Null when the wallet holds no protection. */
export function payoutStage(r: { state: string; action: string | null; result?: string } | null | undefined): PayoutStage | null {
  if (!r || r.state === "no_position") return null;
  if (r.state === "pending") return { key: "waiting", title: "Waiting for the weather", body: "Nothing to do. After the window ends, SkyHedge checks NOAA's final numbers.", tone: "rain", done: 1 };
  if (r.state === "claimable" && r.action === "claim_payout") return { key: "triggered", title: "It rained. Collect your payout.", body: "Official data crossed your limit. Collect the payout to your wallet.", tone: "mint", done: 4 };
  if (r.state === "claimable" && r.action === "claim_premium_refund") return { key: "refund", title: "Refund ready", body: "The official weather data never arrived, so you get back what you paid.", tone: "amber", done: 3 };
  if (r.state === "claimed") return /refund|unavailable/i.test(r.result ?? "") ? { key: "refunded", title: "Refunded", body: "What you paid is back in your wallet.", tone: "amber", done: 4 } : { key: "paid", title: "Payout collected", body: "The payout is in your wallet.", tone: "mint", done: 4 };
  if (r.state === "expired") return { key: "expired", title: "Claim window closed", body: "This protection can no longer be claimed.", tone: "muted", done: 4 };
  return { key: "not_triggered", title: "It stayed dry", body: "Rain stayed under your limit, so there's no payout this time.", tone: "muted", done: 4 };
}
