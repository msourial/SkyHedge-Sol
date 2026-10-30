import type { CoverProgress, ForecastEdge } from "../../shared/weather-signals.ts";
import { edgeChip } from "../../shared/weather-signals.ts";
import type { ReceiptModel } from "../../shared/ui-discovery.ts";
import type { SignOutcome, SignState } from "../../shared/ui-sign.ts";

export const shortDate = (iso: string | null) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";
export function windowDates(start: string | null, end: string | null) {
  const from = shortDate(start), to = shortDate(end);
  return from !== "—" && to !== "—" ? `${from} – ${to}` : from !== "—" ? `From ${from}` : to !== "—" ? `Until ${to}` : "Window not available";
}
export function settlementDateLabel(iso: string | null | undefined): string | null {
  const date = shortDate(iso ?? null);
  return date === "—" ? null : `${date} (UTC)`;
}
export function forecastChip(edge: ForecastEdge | null | undefined) {
  return edge?.forecast ? edgeChip(edge.forecast.probability * 100, edge.historyProbability * 100) : null;
}
export type GaugeState = "not_started" | "tracking" | "hit" | "ended_waiting" | "complete" | "unavailable" | "ready" | "paid" | "expired" | "refunded";
export function coverGauge(r: ReceiptModel, progress: CoverProgress | null | undefined, now = Date.now()) {
  const start = r.windowStart ? Date.parse(r.windowStart) : NaN, end = r.windowEnd ? Date.parse(r.windowEnd) : NaN;
  const daysLeft = Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
  const duration = Number.isFinite(start) && Number.isFinite(end) ? Math.ceil((end - start) / 86400000) : null;
  // A final claim reading is deliberately not a fallback for the progress reader.
  const raw = progress?.valueNative;
  const value = raw != null && Number.isFinite(raw) ? progress?.unit === "mm" && r.unit === "cm" ? raw / 10 : progress?.unit === "cm" && r.unit === "mm" ? raw * 10 : progress?.unit === r.unit ? raw : null : null;
  const hit = value != null && r.trigger != null && value >= r.trigger && r.peril !== "cold";
  const state: GaugeState = r.kind === "paid" ? "paid" : r.kind === "dry" ? "expired" : r.kind === "refunded" ? "refunded" : r.kind === "unknown" ? "unavailable" : r.kind === "pending" ? (r.status.toLowerCase().includes("refund") ? "refunded" : "ready") : now < start || progress?.state === "not_started" ? "not_started" : value == null ? "unavailable" : now >= end && !progress?.complete ? "ended_waiting" : hit ? "hit" : progress?.complete ? "complete" : "tracking";
  const fraction = state === "paid" || state === "ready" ? 1 : state === "not_started" || value == null || r.trigger == null ? 0 : Math.min(1, Math.max(0, r.trigger === 0 ? hit ? 1 : 0 : value / r.trigger));
  const label = ({ not_started: "Not started", tracking: "Tracking", hit: "Hit", ended_waiting: "Waiting for NOAA", complete: "NOAA final", unavailable: r.status.includes("Claim window") ? r.status : "Unavailable", ready: "Payout ready", paid: "Paid out", expired: "Expired", refunded: r.kind === "pending" ? "Refund ready" : "Refunded" })[state];
  const peril = ({ rain: "Rain", snow: "Snow", wind: "Wind", heat: "Heat", cold: "Cold" })[r.peril ?? "rain"];
  const amount = value == null ? null : `${value.toFixed(1)} ${r.unit}`;
  const reading = r.kind === "unknown" ? r.status : state === "not_started" ? `Starts ${shortDate(r.windowStart)}` : state === "refunded" ? `${label}, NOAA data unavailable` : state === "paid" ? "Paid out" : value == null ? r.peril === "cold" ? "Not available yet" : `${peril} so far unavailable` : hit ? `Hit at ${amount}` : `${value.toFixed(1)} of ${r.trigger ?? "—"} ${r.unit}`;
  const timing = state === "not_started" ? duration == null ? "" : `${duration} days` : state === "hit" && now < end ? `settles after ${shortDate(r.windowEnd)}` : state === "ended_waiting" ? "waiting for NOAA final" : progress?.complete ? "NOAA final" : daysLeft == null ? "" : `${daysLeft} days left`;
  return { state, label, value, fraction, reading, timing, daysLeft, source: progress?.source ?? null, through: progress?.observedThrough ? `NOAA through ${shortDate(progress.observedThrough)}` : null, coverage: progress ? `${progress.daysReported} of ${progress.daysTotal} days reported` : null, grey: ["ended_waiting", "expired", "refunded", "complete", "unavailable", "not_started"].includes(state) };
}

export type PurchaseState = "hidden" | "pending" | "still_confirming" | "success" | "failed" | "cancelled";
export function purchaseState(state: SignState, outcome?: SignOutcome | null, hasSignature = false): PurchaseState {
  if (state.status === "success") return "success";
  if (state.status === "progress") return state.step === "wallet" ? "hidden" : "pending";
  if (state.status !== "error" || state.kind === "already-covered") return "hidden";
  if (state.kind === "declined") return "cancelled";
  // A confirmation timeout is uncertainty, never proof of a failed purchase.
  if (state.kind === "unconfirmed" && hasSignature && !(outcome?.kind === "error" ? outcome.message : null)?.match(/\(60\d\d\)|failed|custom program error/i)) return "still_confirming";
  return "failed";
}
export const MULTIPLE_TIP_KEY = "line.tip.multiple";
export type TipStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };
export async function shouldShowMultipleTip(storage: TipStorage) { try { return await storage.getItem(MULTIPLE_TIP_KEY) !== "1"; } catch { return false; } }
export async function dismissMultipleTip(storage: TipStorage) { await storage.setItem(MULTIPLE_TIP_KEY, "1"); }
export type PayoutExplanation = { station: string; peril: string; end: string | null; pay: string; payout: string };
export function payoutSteps(p: PayoutExplanation) {
  return [
    { title: `${p.station} station is the source`, body: `NOAA daily ${p.peril} observations from the ${p.station} station. Nothing else counts.` },
    { title: `Settles on its own after ${p.end?.trim() && p.end.trim() !== "—" ? p.end.trim() : "the window ends"}`, body: "When NOAA posts the final data, SkyHedge settles the market on Solana. No claims form, no proof to send." },
    { title: "Collect with one tap", body: `If it hit, approve one transaction in Phantom to move ${p.payout} SKYT to your wallet. Collect within 30 days of the data deadline; the exact deadline appears when ready.` },
    { title: "Max loss is what you pay", body: `If it doesn't hit, you lose the ${p.pay} SKYT you paid. Never more.` },
    { title: "No NOAA data, money back", body: "If NOAA data isn't available within 7 days of the window ending, your full premium is refundable." },
  ];
}
