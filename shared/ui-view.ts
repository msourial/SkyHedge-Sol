/**
 * Protect view model. Web and Seeker render this and do not recompute money.
 * A position on the window locks every rung: the current app allows one
 * position per window, which is stricter than one position per market.
 */
import {
  ALREADY_COVERED,
  BREAK_EVEN,
  SALES_CLOSED,
  CHAIN_ERROR,
  CHANCE,
  COVER,
  COVERED_WORD,
  FEE_INCLUDED,
  GETTING_QUOTE,
  MAX_GAIN,
  MAX_LOSS,
  PAYOUT,
  SO_FAR,
  TRIGGER,
  WAITING_WALLET,
  WINDOW_WORD,
  capLine,
  chanceNote,
  coverSentence,
  feeLine,
  gainCaption,
  goThereLine,
  highestInYears,
  lossCaption,
  modelledRowName,
  notOpenLine,
  oddsLine,
  openRowName,
  payoffDescription,
  pricingSentence,
  protectCta,
  resultLine,
  salesCloseLine,
  sinceLine,
  startsLine,
  subline,
  ticketSheet,
} from "./ui-copy.ts";
import { chainFigures, dayFromIso, fractionOnScale, payoffPixels, scaleFor, stationFor } from "./ui-ladder.ts";
import {
  breakEvenLabel,
  chanceLabel,
  chipExceedsCap,
  formatBase,
  moneyParts,
  multipleLabel,
  protocolFeeBase,
  rungEconomics,
  ticketFromBases,
  COVER_SIZES,
} from "./ui-money.ts";
import { cityById, openCityFor, perilById, perilOpen } from "./peril-registry.ts";
import { rungTrigger, type CoverSize, type PerilId, type RungQuote, type WindowQuote } from "./ui-types.ts";
import type { InstrumentState } from "./ui-instrument.ts";

export type MoneyFigure = { sign: "-" | "+"; whole: string; fraction: string };

export type ChainRowModel = {
  trigger: number;
  triggerLabel: string;
  chance: string;
  multiple: string;
  maxLoss: string | null;
  open: boolean;
  selected: boolean;
  inert: boolean;
  topTag: string | null;
  yourCover: boolean;
  name: string;
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
  honesty: string | null;
  sheet: string | null;
  diagram: {
    lossPx: number;
    gainPx: number;
    step: number;
    ticks: number[];
    lossLabel: string;
    gainLabel: string;
    triggerLabel: string;
    description: string;
  };
  signRows: Array<{ label: string; value: string; payout?: boolean }>;
};

export type PanelModel =
  | { kind: "loading"; cta: string }
  | { kind: "error"; message: string }
  | { kind: "not-open"; line: string; go: { label: string; cityId: string } | null }
  | { kind: "closed"; line: string }
  | { kind: "connect"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "ready"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "signing"; loss: MoneyFigure; gain: MoneyFigure; cta: string }
  | { kind: "covered"; loss: MoneyFigure; gain: MoneyFigure; title: string }
  | { kind: "paid"; result: string; payout: string }
  | { kind: "dry"; result: string };

export type ProtectModel = {
  cityName: string;
  station: string;
  peril: PerilId;
  unit: string;
  tenor: "weekly" | "monthly";
  subline: string | null;
  odds: string | null;
  soFarLabel: string;
  soFarValue: string;
  soFarSince: string | null;
  reading: number | null;
  instrument: InstrumentState;
  rungs: number[];
  selected: number | null;
  rows: ChainRowModel[];
  showChain: boolean;
  footnote: string | null;
  chips: Array<{ cover: CoverSize; selected: boolean; disabled: boolean }>;
  capMessage: string | null;
  blocked: string | null;
  ticket: TicketModel | null;
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
  /** User's choice. Null until they tap a row. */
  selectedTrigger: number | null;
  /** Pinned rung when the user has not chosen. Rank 8 on the current rain markets. */
  defaultTrigger: number | null;
  coveredMarket: string | null;
  settlement: null | { kind: "paid" | "dry" };
  usedSkyt: number;
  reading: number | null;
  running: boolean;
};

export function buildProtectModel(input: ProtectBuildInput): ProtectModel {
  const city = cityById(input.cityId);
  const peril = perilById(input.peril);
  const cityName = city?.name ?? "This city";
  const station = city?.station ?? stationFor(input.cityId);
  const unit = input.quote?.unit || input.single?.unit || peril?.unit || "";
  const open = input.peril !== "cold" && (input.quote != null || perilOpen({ cityId: input.cityId, peril: input.peril, windowStart: input.windowStart, tenor: input.tenor }));
  const start = dayFromIso(input.windowStart);
  const end = dayFromIso(input.windowEnd);
  const years = input.quote?.analogueYears ?? null;
  const footnote = years ? chanceNote(years) : null;
  const chips = COVER_SIZES.map((cover) => ({
    cover,
    selected: cover === input.cover,
    disabled: chipExceedsCap(cover, input.usedSkyt),
  }));
  const capMessage = chips.some((chip) => chip.disabled) ? capLine() : null;
  const base = {
    cityName,
    station,
    peril: input.peril,
    unit,
    tenor: input.tenor,
    subline: start && end ? subline({ station, start, end, salesClose: dayFromIso(input.quote?.salesCloseAt ?? input.windowStart) ?? start }) : null,
    chips,
    capMessage,
    soFarLabel: SO_FAR,
  };

  if (!open) {
    const other = openCityFor(input.peril, input.cityId, input.windowStart, input.tenor);
    return {
      ...base,
      odds: null,
      soFarValue: start ? startsLine(start) : "",
      soFarSince: null,
      reading: null,
      instrument: "ghost",
      rungs: [],
      selected: null,
      rows: [],
      showChain: false,
      footnote: null,
      blocked: null,
      ticket: null,
      panel: {
        kind: "not-open",
        line: notOpenLine(input.peril, cityName),
        go: other ? { label: goThereLine(input.peril, other.name), cityId: other.id } : null,
      },
    };
  }

  if (input.failed && !input.quote && !input.single) {
    return empty(base, start, { kind: "error", message: CHAIN_ERROR }, "ghost");
  }
  if (input.loading && !input.quote && !input.single) {
    return empty(base, start, { kind: "loading", cta: GETTING_QUOTE }, "loading");
  }
  if (!input.quote && !input.single) {
    if (input.peril === "rain") return empty(base, start, { kind: "closed", line: SALES_CLOSED }, "ghost");
    const elsewhere = openCityFor(input.peril, input.cityId, input.windowStart, input.tenor);
    return {
      ...empty(base, start, {
        kind: "not-open",
        line: notOpenLine(input.peril, cityName),
        go: elsewhere ? { label: goThereLine(input.peril, elsewhere.name), cityId: elsewhere.id } : null,
      }, "ghost"),
    };
  }

  const quote = input.quote;
  const figures = quote ? chainFigures(quote, input.cover) : [];
  const rows = figures.length > 1 ? chainRows(quote!, input) : [];
  const showChain = rows.length > 1;
  const chosen = pickTrigger(figures, input);
  const ticket = buildTicket(input, station, unit, end, years, chosen);
  const reading = input.running ? input.reading : null;
  const instrument = instrumentState(input, Boolean(ticket));
  const soFarValue = reading != null && unit ? `${formatMeasure(reading)} ${unit}` : start ? startsLine(start) : "";
  const odds = ticket && input.settlement?.kind !== "dry" && !input.failed
    ? oddsLine(input.peril, chanceBps(quote, input, chosen))
    : null;

  let panel: PanelModel;
  if (!ticket) {
    panel = input.loading ? { kind: "loading", cta: GETTING_QUOTE } : { kind: "not-open", line: notOpenLine(input.peril, cityName), go: null };
  } else if (input.settlement?.kind === "paid") {
    panel = { kind: "paid", result: resultLine("+", formatBase(ticketGain(ticket), 2)), payout: ticket.payout };
  } else if (input.settlement?.kind === "dry") {
    panel = { kind: "dry", result: resultLine("-", `${ticket.loss.whole}.${ticket.loss.fraction}`) };
  } else if (input.coveredMarket) {
    panel = { kind: "covered", loss: ticket.loss, gain: ticket.gain, title: COVERED_WORD };
  } else if (input.signing) {
    panel = { kind: "signing", loss: ticket.loss, gain: ticket.gain, cta: WAITING_WALLET };
  } else if (!input.connected) {
    panel = { kind: "connect", loss: ticket.loss, gain: ticket.gain, cta: "Connect wallet" };
  } else if (chips.find((chip) => chip.cover === input.cover)?.disabled) {
    panel = { kind: "ready", loss: ticket.loss, gain: ticket.gain, cta: protectCta(`${ticket.loss.whole}.${ticket.loss.fraction}`) };
  } else {
    panel = { kind: "ready", loss: ticket.loss, gain: ticket.gain, cta: protectCta(`${ticket.loss.whole}.${ticket.loss.fraction}`) };
  }

  return {
    ...base,
    odds,
    soFarValue,
    soFarSince: reading != null && start ? sinceLine(start) : null,
    reading,
    instrument,
    rungs: rows.length ? rows.map((row) => row.trigger) : chosen == null ? [] : [chosen],
    selected: chosen,
    rows,
    showChain,
    footnote: showChain || ticket ? footnote : null,
    blocked: input.coveredMarket ? ALREADY_COVERED : null,
    ticket,
    panel,
  };
}

function empty(
  base: Omit<ProtectModel, "odds" | "soFarValue" | "soFarSince" | "reading" | "instrument" | "rungs" | "selected" | "rows" | "showChain" | "footnote" | "blocked" | "ticket" | "panel">,
  start: string | null,
  panel: PanelModel,
  instrument: InstrumentState,
): ProtectModel {
  return {
    ...base,
    odds: null,
    soFarValue: start ? startsLine(start) : "",
    soFarSince: null,
    reading: null,
    instrument,
    rungs: [],
    selected: null,
    rows: [],
    showChain: false,
    footnote: null,
    blocked: null,
    ticket: null,
    panel,
  };
}

function pickTrigger(rows: Array<{ trigger: number; open: boolean }>, input: ProtectBuildInput): number | null {
  const live = rows.filter((row) => row.open);
  if (input.selectedTrigger != null && live.some((row) => row.trigger === input.selectedTrigger)) return input.selectedTrigger;
  if (input.defaultTrigger != null && live.some((row) => row.trigger === input.defaultTrigger)) return input.defaultTrigger;
  if (!rows.length && input.single) return input.single.triggerValue;
  return live[0]?.trigger ?? input.single?.triggerValue ?? null;
}

function chainRows(quote: WindowQuote, input: ProtectBuildInput): ChainRowModel[] {
  const locked = !!input.coveredMarket;
  const figures = chainFigures(quote, input.cover);
  const selected = pickTrigger(figures, input);
  return figures.map((row) => {
    const rung = quote.rungs.find((item) => rungTrigger(item) === row.trigger);
    const yourCover = !!rung?.marketAddress && rung.marketAddress === input.coveredMarket;
    const inert = locked || !row.open;
    const topTag = row.top && quote.analogueYears ? highestInYears(quote.analogueYears) : null;
    const name = row.open && row.maxLoss
      ? openRowName({ trigger: row.triggerLabel, chance: row.chance, multiple: row.multiple, maxLoss: row.maxLoss.replace("-", "") })
      : modelledRowName({ trigger: row.triggerLabel, chance: row.chance, multiple: row.multiple });
    return {
      ...row,
      selected: yourCover || (!locked && row.open && row.trigger === selected),
      inert,
      topTag,
      yourCover,
      name,
    };
  });
}

function buildTicket(
  input: ProtectBuildInput,
  station: string,
  unit: string,
  end: string | null,
  years: number | null,
  chosen: number | null,
): TicketModel | null {
  const peril = perilById(input.peril);
  if (!peril || !end || chosen == null) return null;
  const deal = dealFor(input, chosen);
  if (!deal) return null;
  const loss = moneyParts(-deal.maxLoss);
  const gain = moneyParts(deal.maxGain);
  const fee = protocolFeeBase(input.cover);
  const feeLabel = fee == null ? null : formatBase(fee, 2);
  const chance = chanceLabel(chanceBps(input.quote, input, chosen));
  const breakEven = breakEvenLabel(deal.breakEvenTenths);
  const multiple = multipleLabel(deal.multipleTenths);
  const measure = formatMeasure(chosen);
  if (!feeLabel || !chance || !breakEven || !multiple || !measure) return null;
  const triggerLabel = `${measure} ${unit}`;
  const payoutLabel = formatBase(deal.payout, 0);
  const premiumLabel = formatBase(deal.premium, 2);
  const sentence = coverSentence({
    payoutLabel,
    station,
    peril: input.peril,
    triggerLabel,
    dateLabel: end,
    premiumLabel,
  });
  if (!sentence) return null;
  const triggers = input.quote ? input.quote.rungs.map((rung) => rungTrigger(rung)).filter((value): value is number => value != null) : [chosen];
  const scale = scaleFor(input.peril, triggers);
  const pixels = payoffPixels(deal.maxLoss, deal.maxGain);
  const start = dayFromIso(input.windowStart);
  return {
    loss,
    gain,
    payout: payoutLabel,
    chance,
    breakEven,
    fee: feeLabel,
    note: years ? chanceNote(years) : null,
    sentence,
    salesClose: salesCloseLine(dayFromIso(input.quote?.salesCloseAt ?? input.windowStart) ?? ""),
    honesty: peril.honesty(station),
    sheet: years ? ticketSheet({ feeLabel, years }) : `${pricingSentence(feeLabel)} ${feeLine(feeLabel)}`,
    diagram: {
      lossPx: pixels.loss,
      gainPx: pixels.gain,
      step: fractionOnScale(chosen, scale),
      ticks: triggers.map((value) => fractionOnScale(value, scale)),
      lossLabel: `-${formatBase(deal.maxLoss, 2)} SKYT`,
      gainLabel: `+${formatBase(deal.maxGain, 2)} SKYT`,
      triggerLabel,
      description: payoffDescription({
        station,
        triggerLabel,
        lossLabel: formatBase(deal.maxLoss, 2),
        gainLabel: formatBase(deal.maxGain, 2),
        direction: peril.direction,
      }),
    },
    signRows: [
      { label: MAX_LOSS, value: `-${formatBase(deal.maxLoss, 2)} SKYT` },
      { label: MAX_GAIN, value: `+${formatBase(deal.maxGain, 2)} SKYT` },
      { label: PAYOUT, value: `${payoutLabel} SKYT`, payout: true },
      { label: TRIGGER, value: triggerLabel },
      { label: WINDOW_WORD, value: start ? `${start} – ${end}` : end },
      { label: FEE_INCLUDED, value: `${feeLabel} SKYT` },
      { label: CHANCE, value: chance },
      { label: BREAK_EVEN, value: breakEven },
      { label: COVER, value: `${input.cover} SKYT` },
    ],
  };
}

function dealFor(input: ProtectBuildInput, chosen: number) {
  const rung = input.quote?.rungs.find((item) => rungTrigger(item) === chosen && item.marketAddress);
  if (rung) {
    const economics = rungEconomics(rung, input.cover);
    return economics ? ticketFromBases(economics.premium, economics.payout) : null;
  }
  if (!input.single || input.single.triggerValue !== chosen) return null;
  const economics = rungEconomics(input.single, input.cover);
  return economics ? ticketFromBases(economics.premium, economics.payout) : null;
}

function chanceBps(quote: WindowQuote | null, input: ProtectBuildInput, chosen: number | null): number {
  const rung = quote?.rungs.find((item) => rungTrigger(item) === chosen);
  if (rung) return rung.chanceBps;
  return input.single?.chanceBps ?? -1;
}

function instrumentState(input: ProtectBuildInput, hasTicket: boolean): InstrumentState {
  if (input.settlement?.kind === "paid") return "paid";
  if (input.settlement?.kind === "dry") return "dry";
  if (input.coveredMarket) return "covered";
  if (input.loading && !hasTicket) return "loading";
  return "idle";
}

function ticketGain(ticket: TicketModel): bigint {
  return BigInt(ticket.gain.whole) * 1_000_000n + BigInt(ticket.gain.fraction.padEnd(6, "0"));
}

function formatMeasure(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export const TICKET_LABELS = { MAX_LOSS, MAX_GAIN, PAYOUT, CHANCE, BREAK_EVEN, FEE_INCLUDED };
