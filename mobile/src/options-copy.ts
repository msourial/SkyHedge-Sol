import { formatSkyt } from "./protection.ts";

/** Whole days in the market's observation window (rounded up), or null when unknown. */
export function hedgeWindowDays(observationStart: number | null | undefined, observationEnd: number | null | undefined): number | null {
  if (!observationStart || !observationEnd || observationEnd <= observationStart) return null;
  return Math.ceil((observationEnd - observationStart) / 86_400);
}

export function marketHeadline(input: { place: string; open: boolean; days: number | null }): { title: string; detail: string } {
  if (!input.open) return { title: `New ${input.place} protection opens soon`, detail: "We'll show a price as soon as the next rain window opens. Pull to refresh." };
  const span = input.days ? `over the next ${input.days} ${input.days === 1 ? "day" : "days"}` : "over the next window";
  return { title: `${input.place} is open`, detail: `Protect against rain ${span}.` };
}

export function hedgeBalanceLine(skytBaseUnits: string | null | undefined, connected: boolean): string {
  if (!connected) return "Connect your wallet to see how much SKYT you can use for coverage.";
  if (!skytBaseUnits || !/^\d+$/.test(skytBaseUnits)) return "Your SKYT balance isn't available yet.";
  return `You have ${formatSkyt(skytBaseUnits)} SKYT for coverage`;
}

export function triggerPhrase(thresholdMmX100: string | null | undefined, operator: string | null | undefined): string {
  if (!thresholdMmX100 || !/^\d+$/.test(thresholdMmX100)) return "if rainfall crosses the trigger";
  const mm = (Number(thresholdMmX100) / 100).toFixed(0);
  const below = operator === "lt" || operator === "lte";
  return below ? `if rainfall stays at or below ${mm} mm` : `if rainfall reaches ${mm} mm or more`;
}

/** Option-style quote line: pay a premium, get up to the payout if the trigger hits. */
export function optionPremiumLine(premiumBase: string, payoutBase: string, thresholdMmX100: string | null | undefined, operator: string | null | undefined): string {
  return `Pay ${formatSkyt(premiumBase)} SKYT, get up to ${formatSkyt(payoutBase)} SKYT ${triggerPhrase(thresholdMmX100, operator)}.`;
}
