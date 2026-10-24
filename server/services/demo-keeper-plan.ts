import { readFileSync } from "node:fs";
import { DES_MOINES_SEED_LIQUIDITY_BASE } from "../../shared/des-moines-seed-plan.js";
import { PERILS, type PerilId } from "../../shared/perils.js";
import {
  ceilWholeTenths,
  planMissingRungs,
  premiumBaseMap,
  priceFromHitCount,
  selectRungThresholds,
  type ExistingRung,
  type PlannedRungStep,
} from "../../shared/rung-plan.js";
import {
  LIVE_CITY_SLUGS,
  openLadder,
  tenorOf,
  type LadderWindow,
  type LiveCitySlug,
} from "../../shared/window-ladder.js";

/** Saturday 24 Oct 2026, 15:00 UTC. Next weekly rungs start 26 Oct and 2 Nov. */
export const DEMO_NOW_SECONDS = Date.UTC(2026, 9, 24, 15, 0, 0) / 1_000;
/** scripts/sign-ladder-phantom.ts submits create, fund, and open separately. */
export const PHANTOM_APPROVALS_PER_MARKET = 3;
export const FUND_SKYT_PER_MARKET = Number(DES_MOINES_SEED_LIQUIDITY_BASE / 1_000_000n);

interface AnalogueSeries {
  city: LiveCitySlug;
  peril: PerilId;
  element: string;
  windowStart: string;
  windowEnd: string;
  years: number[];
  totalTenths?: number[];
  error?: string;
}

export interface DemoPlanLine {
  city: LiveCitySlug;
  peril: PerilId;
  windowStart: string;
  windowEnd: string;
  rank: number;
  triggerValue: number;
  unit: string;
  scaledX100: number;
  hits: number;
  probabilityBps: number;
  premiumRateBps: number;
  premiumFor100: string;
  action: PlannedRungStep["action"];
  approvals: number;
  fundSkyt: number;
  address: string | null;
}

export interface DemoPlanNote {
  city: string;
  peril: PerilId;
  windowStart: string;
  windowEnd: string;
  reason: string;
}

export interface DemoPlan {
  nowSeconds: number;
  creates: DemoPlanLine[];
  kept: DemoPlanLine[];
  steps: PlannedRungStep[];
  skipped: DemoPlanNote[];
  /** Ranks inside a window that were collapsed or non-positive while other rungs remain. */
  notes: DemoPlanNote[];
  untouched: Array<{ city: string; peril: PerilId; windowStart: string; windowEnd: string; triggerValue: number; state: string; address?: string }>;
  approvals: number;
  fundSkyt: number;
}

export function loadAnalogueSeries(): AnalogueSeries[] {
  const doc = JSON.parse(readFileSync(new URL("../fixtures/ghcnd/analogue-totals.json", import.meta.url), "utf8")) as { series: AnalogueSeries[] };
  return doc.series;
}

export function demoRequests(nowSeconds = DEMO_NOW_SECONDS): Array<{ city: LiveCitySlug; peril: PerilId; window: LadderWindow }> {
  const ladder = openLadder(nowSeconds);
  const rain = LIVE_CITY_SLUGS.flatMap((city) => ladder.map((window) => ({ city, peril: "rain" as const, window })));
  const month = (city: LiveCitySlug, start: string) => {
    const window = ladder.find((item) => item.tenor === "monthly" && iso(item.observationStart) === start);
    if (!window) throw new Error(`Monthly window ${start} is not on the ${iso(nowSeconds)} ladder`);
    return { city, peril: "snow" as const, window };
  };
  const snow = [
    { city: "chicago" as const, peril: "snow" as const, window: week("2026-11-09", "2026-11-16") },
    month("chicago", "2026-11-01"),
    month("chicago", "2026-12-01"),
    month("new-york", "2026-12-01"),
  ];
  const wind = ladder.map((window) => ({ city: "chicago" as const, peril: "wind" as const, window }));
  const heat = ladder.map((window) => ({ city: "miami" as const, peril: "heat" as const, window }));
  return [...rain, ...snow, ...wind, ...heat];
}

interface ObservedMarketFile {
  readAt: string;
  rpc: string;
  network: string;
  nextMarketId: string;
  markets: ExistingRung[];
}

export function loadObservedDevnetMarkets(): ObservedMarketFile {
  return JSON.parse(readFileSync(new URL("../fixtures/ghcnd/devnet-open-markets.json", import.meta.url), "utf8")) as ObservedMarketFile;
}

/** Devnet markets read on 2026-10-24. The signer reads the chain again before it builds instructions. */
export function observedDevnetRungs(): ExistingRung[] {
  return loadObservedDevnetMarkets().markets;
}

export function buildDemoPlan(series = loadAnalogueSeries(), existing = observedDevnetRungs(), nowSeconds = DEMO_NOW_SECONDS, city?: LiveCitySlug): DemoPlan {
  const creates: DemoPlanLine[] = [];
  const kept: DemoPlanLine[] = [];
  const steps: PlannedRungStep[] = [];
  const skipped: DemoPlan["skipped"] = [];
  const notes: DemoPlan["notes"] = [];
  for (const request of demoRequests(nowSeconds).filter((item) => !city || item.city === city)) {
    const row = findSeries(series, request.city, request.peril, request.window);
    const label = { city: request.city, peril: request.peril, windowStart: iso(request.window.observationStart), windowEnd: iso(request.window.observationEnd) };
    if (!row) {
      skipped.push({ ...label, reason: "No analogue series was loaded for this window." });
      continue;
    }
    if (row.error || !row.totalTenths) {
      skipped.push({ ...label, reason: row.error ?? "Analogue years are incomplete." });
      continue;
    }
    const rungs = selectRungThresholds(row.totalTenths, PERILS[request.peril].strikeRounding);
    const dropped = droppedRanks(row.totalTenths, PERILS[request.peril].strikeRounding);
    if (rungs.length === 0) {
      skipped.push({ ...label, reason: dropped ?? "Every chosen rank rounded to a non-positive strike." });
      continue;
    }
    if (dropped) notes.push({ ...label, reason: dropped });
    for (const step of planMissingRungs(existing, request.city, request.peril, request.window, rungs)) {
      steps.push(step);
      const line = lineFromStep(step);
      if (!line) {
        skipped.push({ ...label, reason: `Rank ${step.rank} could not be priced.` });
        continue;
      }
      if (step.action === "create-fund-open") creates.push(line);
      else kept.push(line);
    }
  }
  return {
    nowSeconds,
    creates,
    kept,
    steps,
    skipped,
    notes,
    untouched: untouchedMarkets(existing, steps),
    approvals: creates.length * PHANTOM_APPROVALS_PER_MARKET,
    fundSkyt: creates.length * FUND_SKYT_PER_MARKET,
  };
}

export function renderDemoPlan(plan = buildDemoPlan()): string {
  const series = loadAnalogueSeries();
  const lines = [
    "# Devnet keeper plan: multi-peril rungs",
    "",
    `As of ${new Date(plan.nowSeconds * 1000).toISOString()} (Solana Devnet only).`,
    "This is a dry run. It does not sign, and it does not submit a transaction.",
    "Miro approves each Phantom signature himself. No admin key is read here.",
    "",
    "## What would be created",
    "",
    `New markets: **${plan.creates.length}**.`,
    `Phantom approvals: **${plan.approvals}** (${PHANTOM_APPROVALS_PER_MARKET} per market: create_market, fund_pool, open_market; the signer does not batch).`,
    `SKYT to fund: **${plan.fundSkyt.toLocaleString("en-US")}** (${FUND_SKYT_PER_MARKET.toLocaleString("en-US")} SKYT each, from the existing pool-fund constant).`,
    "Prices below use history only (no forecast term). The Phantom signer uses these same committed GHCN totals and the same history-only premium, and it re-reads Devnet before it builds an instruction.",
    "Many rank-10 rain strikes have 0 analogue hits. A whole-millimetre ceil can sit above the wettest of the ten years, so those markets price at the 1% floor (215 bps).",
    chainReadSentence(),
    "",
    "| City | Peril | Window (UTC, end exclusive) | Rank | Trigger | Hits / 10 | Chance | Premium bps | Premium for 100 SKYT | Approvals | SKYT |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...plan.creates.map((line) => `| ${line.city} | ${line.peril} | ${line.windowStart} → ${line.windowEnd} | ${line.rank} | ${formatTrigger(line)} | ${line.hits} | ${(line.probabilityBps / 100).toFixed(1)}% | ${line.premiumRateBps} | ${skyt(line.premiumFor100)} | ${line.approvals} | ${line.fundSkyt} |`),
    "",
    "## Already open at this strike, not created",
    "",
    "| City | Peril | Window (UTC, end exclusive) | Trigger | Hits / 10 | Market |",
    "| --- | --- | --- | --- | --- | --- |",
    ...plan.kept.map((line) => `| ${line.city} | ${line.peril} | ${line.windowStart} → ${line.windowEnd} | ${formatTrigger(line)} | ${line.hits} | ${line.address ?? ""} |`),
    "",
    "## Already on Devnet, outside this rung set",
    "",
    "These accounts stay as they are. They are not repriced and not duplicated.",
    "",
    ...plan.untouched.map((line) => `- ${line.city} ${line.peril} ${line.state} ${line.windowStart} → ${line.windowEnd} at ${line.triggerValue} ${PERILS[line.peril].unit} (${line.address ?? ""})`),
    "",
    "## Skipped",
    "",
    ...plan.skipped.map((line) => `- ${line.city} ${line.peril} ${line.windowStart} → ${line.windowEnd}: ${line.reason}`),
    "",
    ...(plan.notes.length ? [
      "## Ranks that did not become their own market",
      "",
      ...plan.notes.map((line) => `- ${line.city} ${line.peril} ${line.windowStart} → ${line.windowEnd}: ${line.reason}`),
      "",
    ] : []),
    "## How the strikes were chosen",
    "",
    windChoice(series),
    heatChoice(series),
    snowChoice(series),
    "",
    "Cold is not open. The program requires a positive strike and a non-negative observation, so a negative temperature cannot be stored without a program change. This plan does not change or redeploy the program.",
    "",
    "Wind uses WSF2 (fastest 2-minute wind), not WSF5 and not WSFG. WSFG at Chicago ends in 1996. WSF2 is complete for Chicago across 2016–2025 on these windows. New York WSF2, WSF5, and AWND each miss days in the same decade, so New York wind is not open. The measurement-flag allow-list adds K (converted from knots) for wind. None of the nine pinned stations contain a K flag in their GHCN-Daily history; rain still rejects K.",
    "",
    "Other stations also have complete series that this demo does not open: snow at Dallas, Seattle, Boston, Austin, and Des Moines; WSF2 at Miami, Seattle, Boston, Austin, and Des Moines; TMAX at every pinned city. Quotes for those city/peril pairs stay unavailable until they are added to the registry.",
    "",
    "Account rent is not included. It was not simulated. Each new market still needs the 2,000 SKYT pool fund above, plus whatever Devnet rent create_market charges for the market and vault accounts.",
    "",
  ];
  return lines.join("\n");
}

function lineFromStep(step: PlannedRungStep): DemoPlanLine | null {
  const price = priceFromHitCount(step.hits, null, step.triggerValue);
  const premium = price ? premiumBaseMap(price.premiumRateBps) : null;
  if (!price || !premium) return null;
  const creating = step.action === "create-fund-open";
  return {
    city: step.city,
    peril: step.peril,
    windowStart: iso(step.window.observationStart),
    windowEnd: iso(step.window.observationEnd),
    rank: step.rank,
    triggerValue: step.triggerValue,
    unit: PERILS[step.peril].unit,
    scaledX100: step.scaledX100,
    hits: step.hits,
    probabilityBps: price.probabilityBps,
    premiumRateBps: price.premiumRateBps,
    premiumFor100: premium["100"],
    action: step.action,
    approvals: creating ? PHANTOM_APPROVALS_PER_MARKET : step.action === "fund-open" ? 2 : step.action === "open" ? 1 : 0,
    fundSkyt: creating || step.action === "fund-open" ? FUND_SKYT_PER_MARKET : 0,
    address: step.existing?.address ?? null,
  };
}

function untouchedMarkets(existing: readonly ExistingRung[], steps: readonly PlannedRungStep[]): DemoPlan["untouched"] {
  const used = new Set(steps.flatMap((step) => step.existing?.address ? [step.existing.address] : []));
  return existing.filter((market) => market.address && !used.has(market.address)).map((market) => ({
    city: market.city,
    peril: market.peril,
    windowStart: iso(market.observationStart),
    windowEnd: iso(market.observationEnd),
    triggerValue: market.scaledX100 / 100,
    state: market.state,
    address: market.address,
  }));
}

function chainReadSentence(): string {
  const doc = loadObservedDevnetMarkets();
  return `Devnet was read at ${doc.readAt} from ${doc.rpc} (${doc.network}, next market id ${doc.nextMarketId}). A rung is kept only when an open account has the same city, peril, window, threshold, and operator. Chicago, Miami, Dallas, Los Angeles, Seattle, Boston, and Austin had no market in that read, so their rank 8 is created.`;
}

function droppedRanks(totalTenths: readonly number[], rounding: "whole" | "tenth"): string | null {
  const sorted = [...totalTenths].sort((left, right) => left - right);
  const notes: string[] = [];
  const seen = new Set<number>();
  for (const rank of [6, 8, 10]) {
    const raw = sorted[rank - 1] ?? 0;
    const tenths = rounding === "whole" ? ceilWholeTenths(raw) : raw;
    if (tenths <= 0) notes.push(`rank ${rank} rounded to a non-positive strike`);
    else if (seen.has(tenths)) notes.push(`rank ${rank} collapsed into ${tenths / 10}`);
    else seen.add(tenths);
  }
  return notes.length ? notes.join("; ") + "." : null;
}

function findSeries(series: readonly AnalogueSeries[], city: string, peril: PerilId, window: LadderWindow): AnalogueSeries | undefined {
  return series.find((row) => row.city === city && row.peril === peril && row.windowStart === iso(window.observationStart) && row.windowEnd === iso(window.observationEnd));
}

function week(start: string, end: string): LadderWindow {
  const observationStart = Date.parse(`${start}T00:00:00.000Z`) / 1_000;
  const observationEnd = Date.parse(`${end}T00:00:00.000Z`) / 1_000;
  const tenor = tenorOf(observationStart, observationEnd);
  if (tenor !== "weekly") throw new Error(`${start} is not a weekly rung`);
  return { tenor, salesCloseAt: observationStart, observationStart, observationEnd };
}

function iso(seconds: number): string {
  return new Date(seconds * 1_000).toISOString().slice(0, 10);
}

function formatTrigger(line: DemoPlanLine): string {
  const text = Number.isInteger(line.triggerValue) ? String(line.triggerValue) : line.triggerValue.toFixed(1);
  return `${text} ${line.unit}`;
}

function skyt(base: string): string {
  const value = BigInt(base);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} SKYT` : `${whole} SKYT`;
}

function eighth(series: readonly AnalogueSeries[], city: string, peril: PerilId, start: string): { tenth: number; whole: number; hitsTenth: number } | null {
  const row = series.find((item) => item.city === city && item.peril === peril && item.windowStart === start && item.totalTenths);
  if (!row?.totalTenths) return null;
  const sorted = [...row.totalTenths].sort((left, right) => left - right);
  const raw = sorted[7] ?? 0;
  const wholeTenths = ceilWholeTenths(raw);
  const hitsTenth = row.totalTenths.filter((value) => value >= raw).length;
  return { tenth: raw / 10, whole: wholeTenths / 10, hitsTenth };
}

function windChoice(series: readonly AnalogueSeries[]): string {
  const oct = eighth(series, "chicago", "wind", "2026-10-26");
  const nov = eighth(series, "chicago", "wind", "2026-11-01");
  if (!oct || !nov) return "Chicago wind series failed to load.";
  return `Chicago WSF2 rank 8 is ${oct.tenth.toFixed(1)} m/s for the week of 26 Oct (${oct.hitsTenth} of 10 years at or above it; a whole-unit ceil of that same value is ${oct.whole} m/s) and ${nov.tenth.toFixed(1)} m/s for November (whole-unit ceil ${nov.whole} m/s). Markets use the tenth, because a whole m/s sits above every analogue year often enough to force the 1% floor.`;
}

function heatChoice(series: readonly AnalogueSeries[]): string {
  const oct = eighth(series, "miami", "heat", "2026-10-26");
  const nov = eighth(series, "miami", "heat", "2026-11-01");
  if (!oct || !nov) return "Miami temperature series failed to load.";
  return `Miami warm-spell rank 8 (TMAX, the window maximum) is ${oct.tenth.toFixed(1)} C for the week of 26 Oct and ${nov.tenth.toFixed(1)} C for November. Whole-unit ceils of those same values are ${oct.whole} C and ${nov.whole} C. The label is warm spell.`;
}

function snowChoice(series: readonly AnalogueSeries[]): string {
  const week = eighth(series, "chicago", "snow", "2026-11-09");
  const month = eighth(series, "chicago", "snow", "2026-11-01");
  const dec = eighth(series, "chicago", "snow", "2026-12-01");
  const ny = eighth(series, "new-york", "snow", "2026-12-01");
  if (!week || !month || !dec || !ny) return "Snow series failed to load.";
  return `Chicago snow rank 8 is ${week.tenth} mm for the week of 9 Nov (the week ending 16 Nov, not the week ending 9 Nov), ${month.tenth} mm for November, and ${dec.tenth} mm for December. New York December rank 8 is ${ny.tenth} mm with ${ny.hitsTenth} of 10 years at or above it. New York's late October and early November snow ranks are not positive and are not opened.`;
}
