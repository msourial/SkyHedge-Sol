/** Shared Protect data. Renderers never reconstruct a premium or payout. */
import * as copy from "./ui-copy.ts";
import { chainFigures, dayFromIso, fractionOnScale, payoffPixels, scaleFor, stationFor, isoFromSeconds } from "./ui-ladder.ts";
import { displayUnit, breakEvenLabel, chanceLabel, chipExceedsCap, formatBaseGrouped, moneyParts, multipleLabel, protocolFeeBase, rungEconomics, ticketFromBases, COVER_SIZES } from "./ui-money.ts";
import { PROTECT_BAR_HEIGHT } from "./ui-tokens.ts";
import { CITIES, cityById, perilById, perilOpen } from "./peril-registry.ts";
import { openQuoteWindows, pickDefaultWindow, type QuoteWindow, type TenorAvailability } from "./ui-window-quote.ts";
import { rungTrigger, type CoverSize, type PerilId, type RungQuote, type WindowQuote } from "./ui-types.ts";
import type { InstrumentState } from "./ui-instrument.ts";

export type MoneyFigure = { sign: "-" | "+"; whole: string; fraction: string };
export type SignRow = { label: string; value: string; payout?: boolean };
export type ChainRowModel = {
  trigger: number;
  triggerLabel: string;
  chance: string;
  multiple: string;
  maxLoss: string;
  kind: "open" | "modelled";
  open: boolean;
  selected: boolean;
  inert: boolean;
  topTag: string | null;
  yourCover: boolean;
  tag: string | null;
  name: string;
};
export type PayoffModel = {
  /** Fixed across the open strikes at this cover size, in SKYT. */
  domain: { loss: number; gain: number };
  maximum: number;
  openTriggers: number[];
  /** Exact base units, safe to freeze for the sign flow. */
  lossBase: string;
  gainBase: string;
  lossPx: number;
  gainPx: number;
  step: number;
  ticks: number[];
  lossLabel: string;
  gainLabel: string;
  triggerLabel: string;
  description: string;
};
export type TicketModel = {
  loss: MoneyFigure;
  gain: MoneyFigure;
  payout: string;
  chance: string;
  breakEven: string;
  fee: string;
  note: string | null;
  sentence: string;
  salesClose: string;
  refund: string;
  honesty: string | null;
  sheet: string | null;
  readOnly: boolean;
  payoff: PayoffModel;
  /** @deprecated Use payoff. Kept for the existing renderers. */
  diagram: PayoffModel;
  signRows: SignRow[];
};
export type NotOpenLink = { label: string; cityId: string; tenor?: "weekly" | "monthly"; windowStart?: string; windowEnd?: string };
export type PanelModel =
  | { kind: "loading"; cta: string }
  | { kind: "error"; message: string }
  | { kind: "not-open"; line: string; go: NotOpenLink | null }
  | { kind: "closed"; line: string }
  | { kind: "connect"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "ready"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "signing"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "covered"; loss: MoneyFigure; gain: MoneyFigure; title: string }
  | { kind: "paid"; result: string; payout: string }
  | { kind: "dry"; result: string };
export type ProtectHero = {
  label: string;
  numeral: string;
  unit: string;
  chance: string;
  multiple: string;
  soFar: { label: string; value: string } | null;
};
export type ProtectModel = {
  /** Structured observation-end timestamp for payout copy, formatted in UTC by the renderer. */
  settlementDate: string | null;
  cityName: string;
  station: string;
  peril: PerilId;
  unit: string;
  tenor: "weekly" | "monthly";
  tenorOpen: TenorAvailability;
  subline: string | null;
  hero: ProtectHero | null;
  /** @deprecated Use hero.soFar. These aliases never contain a start date. */
  soFarLabel: string;
  soFarValue: string;
  soFarSince: string | null;
  reading: number | null;
  instrument: InstrumentState;
  rungs: number[];
  selected: number | null;
  header: [string, string, string, string];
  rows: ChainRowModel[];
  showChain: boolean;
  readOnly: boolean;
  coveredRow: { label: string; action: string } | null;
  showBar: boolean;
  /** @deprecated The selected chain row owns the only cover tag. Always null. */
  yourCover: string | null;
  footnote: string | null;
  optionAFootnote: string | null;
  footnotes: string[];
  chips: Array<{ cover: CoverSize; selected: boolean; disabled: boolean }>;
  capMessage: string | null;
  blocked: string | null;
  ticket: TicketModel | null;
  payoff: PayoffModel | null;
  coverSentence: string | null;
  signRows: SignRow[];
  panel: PanelModel;
};
export type ProtectBuildInput = {
  cityId: string;
  peril: PerilId;
  tenor: "weekly" | "monthly";
  windowStart: string;
  windowEnd: string;
  quote: WindowQuote | null;
  single: (RungQuote & { unit: string }) | null;
  loading: boolean;
  failed: boolean;
  connected: boolean;
  signing: boolean;
  cover: CoverSize;
  selectedTrigger: number | null;
  defaultTrigger: number | null;
  coveredMarket: string | null;
  settlement: null | { kind: "paid" | "dry" };
  usedSkyt: number;
  reading: number | null;
  running: boolean;
  windows?: readonly QuoteWindow[];
  nowSeconds?: number;
  tenorOpen?: TenorAvailability;
};

export function buildProtectModel(input: ProtectBuildInput): ProtectModel {
  const cityName = cityById(input.cityId)?.name ?? copy.THIS_CITY;
  const station = cityById(input.cityId)?.station ?? stationFor(input.cityId);
  const unit = displayUnit(input.quote?.unit || input.single?.unit || perilById(input.peril)?.unit || "");
  const eligible = input.peril !== "cold" && perilOpen({ ...input, windowStart: input.windowStart });
  const salesOpen = input.nowSeconds == null || Date.parse(input.quote?.salesCloseAt ?? input.windowStart) > input.nowSeconds * 1000;
  const currentOpen = eligible && salesOpen && !!(input.quote?.rungs.some((rung) => rungEconomics(rung, input.cover)) || (input.single && rungEconomics(input.single, input.cover)));
  const tenorOpen = input.tenorOpen ?? (input.windows ? pickDefaultWindow({ ...input, windows: input.windows, nowSeconds: input.nowSeconds ?? 0 }).tenorAvailability
    : { weekly: input.tenor === "weekly" && currentOpen, monthly: input.tenor === "monthly" && currentOpen });
  const start = dayFromIso(input.windowStart), end = dayFromIso(input.windowEnd);
  const chips = input.coveredMarket ? [] : COVER_SIZES.map((cover) => ({ cover, selected: cover === input.cover, disabled: chipExceedsCap(cover, input.usedSkyt) }));
  const base: ProtectModel = {
    settlementDate: Number.isFinite(Date.parse(input.quote?.windowEnd ?? input.windowEnd)) ? input.quote?.windowEnd ?? input.windowEnd : null,
    cityName, station, peril: input.peril, unit, tenor: input.tenor, tenorOpen,
    subline: start && end ? copy.subline({ station, start, end, salesClose: dayFromIso(input.quote?.salesCloseAt ?? input.windowStart) ?? start }) : null,
    hero: null, soFarLabel: copy.SO_FAR, soFarValue: "", soFarSince: null, reading: null,
    instrument: "ghost", rungs: [], selected: null, header: [copy.triggerHeader(unit), copy.CHANCE, copy.MULTIPLE, copy.MAX_LOSS],
    rows: [], showChain: false, readOnly: !!input.coveredMarket, yourCover: null, coveredRow: null, showBar: false,
    footnote: null, optionAFootnote: null, footnotes: [], chips: [], capMessage: null,
    blocked: null, ticket: null, payoff: null, coverSentence: null, signRows: [], panel: notOpenPanel(input, cityName),
  };
  if (!eligible) return base;
  if (input.failed && !input.quote && !input.single) return { ...base, showBar: true, panel: { kind: "error", message: copy.CHAIN_ERROR } };
  if (input.loading && !input.quote && !input.single) return { ...base, showBar: true, instrument: "loading", panel: { kind: "loading", cta: copy.GETTING_QUOTE } };
  if (!currentOpen && salesOpen && !input.coveredMarket && !input.settlement) return base;

  const figures = input.quote ? chainFigures(input.quote, input.cover) : [];
  const chosen = pickTrigger(figures, input);
  const ticket = buildTicket(input, station, unit, end, chosen);
  if (!ticket || chosen == null) return base;
  const rows = figures.length > 1 ? chainRows(input.quote!, input, chosen) : [];
  const showChain = rows.length > 1;
  const reading = input.running && input.reading != null && Number.isFinite(input.reading) ? input.reading : null;
  const soFarValue = reading == null ? "" : `${formatMeasure(reading)} ${unit}`;
  const footnote = input.quote ? copy.chanceNote(input.quote.analogueYears) : null;
  let panel: PanelModel;
  if (input.settlement?.kind === "paid") panel = { kind: "paid", result: copy.resultLine("+", `${ticket.gain.whole}.${ticket.gain.fraction}`), payout: ticket.payout };
  else if (input.settlement?.kind === "dry") panel = { kind: "dry", result: copy.resultLine("-", `${ticket.loss.whole}.${ticket.loss.fraction}`) };
  else if (input.coveredMarket) panel = { kind: "covered", loss: ticket.loss, gain: ticket.gain, title: copy.COVERED_WORD };
  else if (!salesOpen) panel = { kind: "closed", line: `Sales closed ${dayFromIso(input.quote?.salesCloseAt ?? input.windowStart) ?? ""}` };
  else if (input.signing) panel = { kind: "signing", loss: ticket.loss, gain: ticket.gain, cta: copy.WAITING_WALLET };
  else if (!input.connected) panel = { kind: "connect", loss: ticket.loss, gain: ticket.gain, cta: copy.CONNECT_WALLET };
  else panel = { kind: "ready", loss: ticket.loss, gain: ticket.gain, cta: copy.protectCta(`${ticket.loss.whole}.${ticket.loss.fraction}`) };
  const optionAFootnote = panel.kind !== "covered" && showChain && rows.filter((row) => row.open).length === 1 ? copy.CHAIN_OPTION_A : null;
  const deal = dealFor(input, chosen)!;
  return {
    ...base, hero: { label: copy.TRIGGER, numeral: formatMeasure(chosen), unit, chance: ticket.chance,
      multiple: multipleLabel(deal.multipleTenths)!, soFar: reading == null ? null : { label: copy.SO_FAR, value: soFarValue } },
    soFarValue, soFarSince: reading != null && start ? copy.sinceLine(start) : null, reading,
    instrument: input.settlement?.kind ?? (input.coveredMarket ? "covered" : "idle"),
    rungs: figures.length ? figures.map((row) => row.trigger) : [chosen], selected: chosen, rows, showChain, footnote, optionAFootnote,
    footnotes: [optionAFootnote, footnote].filter((line): line is string => line != null), chips,
    capMessage: chips.some((chip) => chip.disabled) ? copy.capLine() : null,
    blocked: input.coveredMarket ? copy.ALREADY_COVERED : null, ticket, payoff: ticket.payoff, coverSentence: ticket.sentence, signRows: ticket.signRows, panel,
    showBar: panelShowsBar(panel.kind), coveredRow: panel.kind === "covered" ? { label: copy.COVERED_WORD, action: copy.VIEW_WALLET } : null,
  };
}

/** Not-open stays inline; every other non-covered panel already occupies the bar. */
function panelShowsBar(state: PanelModel["kind"]): boolean {
  return state !== "covered" && state !== "not-open";
}

/** Safe-area insets are added by the renderer, once. */
export function scrollBottomPadding(model: Pick<ProtectModel, "showBar"> | PanelModel["kind"]): number {
  const showBar = typeof model === "string" ? panelShowsBar(model) : model.showBar;
  return (showBar ? PROTECT_BAR_HEIGHT : 0) + 16;
}

function notOpenPanel(input: ProtectBuildInput, cityName: string): Extract<PanelModel, { kind: "not-open" }> {
  let go: NotOpenLink | null = null;
  if (input.peril !== "cold") {
    const otherWindow = input.windows && openQuoteWindows({ ...input, windows: input.windows, nowSeconds: input.nowSeconds ?? 0 })
      .find((window) => isoFromSeconds(window.observationStart) !== input.windowStart || window.tenor !== input.tenor);
    if (otherWindow) {
      const windowStart = isoFromSeconds(otherWindow.observationStart)!, windowEnd = isoFromSeconds(otherWindow.observationEnd)!;
      go = { label: copy.openWindowInstead(dayFromIso(windowStart)!, dayFromIso(windowEnd)!), cityId: input.cityId, tenor: otherWindow.tenor, windowStart, windowEnd };
    } else if (input.windows) {
      for (const city of CITIES.filter((city) => city.id !== input.cityId)) {
        const other = pickDefaultWindow({ cityId: city.id, peril: input.peril, windows: input.windows, nowSeconds: input.nowSeconds ?? 0 });
        if (!other.window || !other.tenor) continue;
        go = { label: copy.goThereLine(input.peril, city.name), cityId: city.id, tenor: other.tenor,
          windowStart: isoFromSeconds(other.window.observationStart)!, windowEnd: isoFromSeconds(other.window.observationEnd)! };
        break;
      }
    }
  }
  return { kind: "not-open", line: copy.notOpenLine(input.peril, cityName, undefined, input.tenor), go };
}

function pickTrigger(rows: Array<{ trigger: number; open: boolean }>, input: ProtectBuildInput): number | null {
  if (input.coveredMarket) {
    const covered = input.quote?.rungs.find((rung) => rung.marketAddress === input.coveredMarket);
    if (covered) return covered.triggerValue;
    if (input.single?.marketAddress === input.coveredMarket) return input.single.triggerValue;
    return null;
  }
  const live = rows.filter((row) => row.open);
  if (input.selectedTrigger != null && live.some((row) => row.trigger === input.selectedTrigger)) return input.selectedTrigger;
  if (input.defaultTrigger != null && live.some((row) => row.trigger === input.defaultTrigger)) return input.defaultTrigger;
  return live[0]?.trigger ?? (input.single?.marketAddress ? input.single.triggerValue : null);
}

function chainRows(quote: WindowQuote, input: ProtectBuildInput, selected: number): ChainRowModel[] {
  const figures = chainFigures(quote, input.cover);
  return figures.map((row, index) => {
    const rung = quote.rungs.find((rung) => rungTrigger(rung) === row.trigger);
    const yourCover = !!rung?.marketAddress && rung.marketAddress === input.coveredMarket;
    return { ...row, kind: row.open ? "open" : "modelled", maxLoss: row.maxLoss ?? copy.NOT_OPEN_WORD,
      selected: row.trigger === selected, inert: !!input.coveredMarket || !row.open, yourCover, tag: yourCover ? copy.YOUR_COVER : null,
      topTag: index === figures.length - 1 && row.top ? copy.highInYears(quote.analogueYears) : null,
      name: row.open && row.maxLoss ? copy.openRowName({ trigger: row.triggerLabel, chance: row.chance, multiple: row.multiple, maxLoss: row.maxLoss.replace("-", "") })
        : copy.modelledRowName({ trigger: row.triggerLabel, chance: row.chance, multiple: row.multiple }) };
  });
}

function buildTicket(input: ProtectBuildInput, station: string, unit: string, end: string | null, chosen: number | null): TicketModel | null {
  const peril = perilById(input.peril);
  const deal = chosen == null ? null : dealFor(input, chosen);
  if (!peril || !end || chosen == null || !deal) return null;
  const fee = protocolFeeBase(input.cover), chance = chanceLabel(chanceBps(input, chosen));
  const breakEven = breakEvenLabel(deal.breakEvenTenths);
  if (fee == null || !chance || !breakEven) return null;
  const feeLabel = formatBaseGrouped(fee), triggerLabel = `${formatMeasure(chosen)} ${unit}`, payoutLabel = formatBaseGrouped(deal.payout);
  const sentence = copy.coverSentence({ payoutLabel, station, peril: input.peril, triggerLabel, dateLabel: end, premiumLabel: formatBaseGrouped(deal.premium) });
  if (!sentence) return null;
  const triggers = input.quote?.rungs.map((rung) => rung.triggerValue) ?? [chosen];
  const scale = scaleFor(input.peril, triggers), pixels = payoffPixels(deal.maxLoss, deal.maxGain), start = dayFromIso(input.windowStart);
  const years = input.quote?.analogueYears;
  const openDeals = (input.quote?.rungs ?? (input.single ? [input.single] : [])).flatMap(rung => { const e = rungEconomics(rung, input.cover); const t = e && ticketFromBases(e.premium, e.payout); return t ? [{ trigger: rung.triggerValue, loss: Number(t.maxLoss) / 1e6, gain: Number(t.maxGain) / 1e6 }] : []; });
  const payoff: PayoffModel = {
    domain: { loss: Math.max(Number(deal.maxLoss) / 1e6, ...openDeals.map(d => d.loss)), gain: Math.max(Number(deal.maxGain) / 1e6, ...openDeals.map(d => d.gain)) },
    maximum: Math.max(...triggers), openTriggers: openDeals.map(d => d.trigger),
    lossBase: deal.maxLoss.toString(), gainBase: deal.maxGain.toString(), lossPx: pixels.loss, gainPx: pixels.gain,
    step: fractionOnScale(chosen, scale), ticks: triggers.map((value) => fractionOnScale(value, scale)),
    lossLabel: `-${formatBaseGrouped(deal.maxLoss)}`, gainLabel: `+${formatBaseGrouped(deal.maxGain)}`, triggerLabel,
    description: copy.payoffDescription({ station, triggerLabel, lossLabel: formatBaseGrouped(deal.maxLoss), gainLabel: formatBaseGrouped(deal.maxGain), direction: peril.direction }),
  };
  return {
    loss: moneyParts(-deal.maxLoss), gain: moneyParts(deal.maxGain), payout: payoutLabel, chance, breakEven, fee: feeLabel,
    note: years ? copy.chanceNote(years) : null, sentence, salesClose: copy.salesCloseSentence(dayFromIso(input.quote?.salesCloseAt ?? input.windowStart) ?? ""),
    refund: copy.refundSentence(), honesty: peril.honesty(station),
    sheet: years ? copy.ticketSheet({ feeLabel, years }) : `${copy.pricingSentence(feeLabel)} ${copy.feeLine(feeLabel)}`,
    readOnly: !!input.coveredMarket, payoff, diagram: payoff,
    signRows: [
      { label: copy.TRIGGER, value: copy.triggerCondition(triggerLabel, peril.direction) },
      { label: copy.WINDOW_WORD, value: start ? copy.windowLabel(start, end) : end },
      { label: copy.STATION, value: station },
      { label: copy.PAYOUT, value: `${payoutLabel} SKYT`, payout: true },
      { label: copy.CHANCE, value: chance },
      { label: copy.BREAK_EVEN, value: breakEven },
      { label: copy.FEE_INCLUDED, value: `${feeLabel} SKYT` },
    ],
  };
}
function dealFor(input: ProtectBuildInput, chosen: number) {
  const rung = input.quote?.rungs.find((rung) => rung.triggerValue === chosen && rung.marketAddress)
    ?? (input.single?.triggerValue === chosen ? input.single : null);
  const economics = rung && rungEconomics(rung, input.cover);
  return economics ? ticketFromBases(economics.premium, economics.payout) : null;
}
function chanceBps(input: ProtectBuildInput, chosen: number): number {
  return input.quote?.rungs.find((rung) => rung.triggerValue === chosen)?.chanceBps ?? input.single?.chanceBps ?? -1;
}
function formatMeasure(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
export const TICKET_LABELS = { MAX_LOSS: copy.MAX_LOSS, MAX_GAIN: copy.MAX_GAIN, PAYOUT: copy.PAYOUT, CHANCE: copy.CHANCE, BREAK_EVEN: copy.BREAK_EVEN, FEE_INCLUDED: copy.FEE_INCLUDED };
