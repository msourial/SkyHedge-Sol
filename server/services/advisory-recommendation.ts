import type { DevnetStatus } from "./devnet-status.js";

/**
 * Concrete next-step recommendation appended to every guide answer (model or offline).
 * Uses only the on-chain Des Moines market read by devnet-status: trigger, window,
 * sales close and premium rate. Never invents a number; missing price -> wallet review.
 */
export type AdvisoryRecommendation = {
  market: "des-moines";
  label: string;
  text: string;
  coverageSkyt: 100;
  premiumPer100Skyt: string | null;
  action: { type: "open_protect"; market: "des-moines" } | null;
};

const fmtDate = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
const symbol = (op: string | null) => (op === "lt" || op === "lte" ? "≤" : "≥");

export function buildRecommendation(status: DevnetStatus | null, nowSec = Math.floor(Date.now() / 1000)): AdvisoryRecommendation {
  const m = status?.desMoinesMarket;
  const threshold = m?.thresholdMmX100 && /^\d+$/.test(m.thresholdMmX100) ? Number(m.thresholdMmX100) / 100 : null;
  const per100 = typeof m?.premiumRateBps === "number" && m.premiumRateBps > 0 ? trim(m.premiumRateBps / 100) : null;
  const open = m?.salesCloseAt != null ? m.salesCloseAt > nowSec : !!m?.address;
  const trigger = threshold != null ? `${symbol(m?.operator ?? null)} ${trim(threshold)} mm rain` : "rain trigger";
  const window = m?.observationStart && m?.observationEnd ? ` · window ${fmtDate(m.observationStart)}–${fmtDate(m.observationEnd)}` : "";
  const price = per100 ? `from ~${per100} SKYT premium + 1% fee` : "live price in wallet review";
  const hoursLeft = open && m?.salesCloseAt ? Math.max(0, Math.round((m.salesCloseAt - nowSec) / 3600)) : null;
  const closes = hoursLeft != null ? (hoursLeft <= 48 ? ` Sales close in about ${hoursLeft} h.` : "") : "";
  const label = `Protect Des Moines · ${trigger} · 100 SKYT coverage · ${price}`;
  const text = open
    ? `My recommendation: ${label}${window} (NOAA Des Moines Intl).${closes} Toronto Pearson (Environment Canada) opens soon. Tap Protect this window on Des Moines to review it; nothing is bought until you approve in Phantom.`
    : `Des Moines isn't open for new protection right now, and Toronto Pearson (Environment Canada) opens soon. When a window opens, my pick is: ${label}.`;
  return { market: "des-moines", label, text, coverageSkyt: 100, premiumPer100Skyt: per100, action: open ? { type: "open_protect", market: "des-moines" } : null };
}

export function withRecommendation<T extends { message: string }>(answer: T, status: DevnetStatus | null): T & { recommendation: AdvisoryRecommendation } {
  const recommendation = buildRecommendation(status);
  return { ...answer, message: `${answer.message}\n\n${recommendation.text}`, recommendation };
}
