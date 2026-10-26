/**
 * Every customer sentence for web and Seeker. Screens do not write their own.
 * Figures are passed in. This module does not invent a price or a year count.
 */
import { MARKET_CAP_SKYT } from "./ui-tokens.ts";
import { perilById, type PerilDefinition } from "./peril-registry.ts";
import type { PerilId } from "./ui-types.ts";

export const DEVNET_TAG = "Devnet";
export const SALES_CLOSED = "Sales are closed for this window.";
export const CHAIN_ERROR = "Can't read Devnet right now. Nothing is shown until it's back. Try again in a minute.";
export const ALREADY_COVERED = "You already have cover for this window.";
export const HOW_IT_SETTLES = "NOAA's final daily records alone decide payouts. Other weather data is context only.";
export const SETTLED_UNITS = "Settled in NOAA units: mm, m/s, C.";
export const WIND_ELEMENT = "Peak wind at the station (NOAA WSF2 or WSF5).";
export const HEAT_ELEMENT = "NOAA daily maximum temperature.";
export const CONNECT_WALLET = "Connect wallet";
export const TRY_AGAIN = "Try again";
export const GETTING_QUOTE = "Getting your quote";
export const WAITING_WALLET = "Waiting for your wallet";
export const APPROVE_WALLET = "Approve in your wallet";
export const COVERED_WORD = "Covered";
export const VIEW_WALLET = "View in Wallet";
export const YOUR_COVER = "Your cover";
export const NOT_OPEN_WORD = "Not open";
export const PAID_OUT = "Paid out";
export const DRY_WINDOW = "Dry window";
export const GOT_IT = "Got it";
export const DONE = "Done";
export const COVER_THIS = "Cover this";
export const OPEN_APP = "Open app";
export const FIRST_RUN = "Pick weather and a trigger. Your max loss is the price. NOAA settles it.";
export const LANDING_TITLE = "Weather on your plans? Get paid.";
export const LANDING_SUB = "Pick a kind of weather and a city. Set the line. If NOAA's record crosses it, you're paid in SKYT.";
export const HOW_IT_WORKS = ["Pick a city and a kind of weather.", "Choose your cover.", "Approve in your wallet."] as const;
export const PROTECT_TITLE = "Protect";
export const MARKETS_TITLE = "Markets";
export const WALLET_TITLE = "Wallet";
export const YOUR_COVERS = "Your covers";
export const OPEN_NOW = "Open now";
export const TECHNICAL_DETAILS = "Technical details";
export const SKYT_BALANCE = "SKYT balance";
export const MAX_LOSS = "Max loss";
export const MAX_GAIN = "Max gain";
export const PAYOUT = "Payout";
export const CHANCE = "Chance";
export const BREAK_EVEN = "Break-even chance";
export const MULTIPLE = "Multiple";
export const TRIGGER = "Trigger";
export const COVER = "Cover";
export const FEE_INCLUDED = "Fee included";
export const SO_FAR = "So far";
export const WEEK = "Week";
export const MONTH = "Month";
export const WINDOW_WORD = "Window";

export const ALL = "All";
export const WEATHER_WORD = "Weather";
export const BY = "by";
export const OPEN_WORD = "Open";
export const NOT_OPEN_YET = "Not open yet";
export const EMPTY_MARKETS = "No markets are open for this selection.";
export const EMPTY_COVERS = "No covers in this wallet yet.";
export const WALLET_INTRO = "Connect your Devnet wallet to read your balance and covers.";
export const READING_WALLET = "Reading finalized balances and covers…";
export const STATE_UNAVAILABLE = "State unavailable";
export const UNKNOWN_CITY = "Unknown city";
export const PAYOUT_READY = "Payout ready to collect";
export const REFUND_READY = "Refund ready";
export const REFUNDED = "Refunded";
export const LOSS_OPEN = "Max loss across open covers";
export const GAIN_OPEN = "Max gain across open covers";
export const COPY_ADDRESS = "Copy wallet address";
export const COPIED = "Copied";
export const COPY_FAILED = "Couldn't copy. Select the address to copy it.";
export const DISCONNECT = "Disconnect wallet";
export const RECEIPT = "Cover receipt";
export const FINAL_READING_UNAVAILABLE = "Final NOAA reading unavailable.";
export const RECEIPT_DATA_UNAVAILABLE = "Trigger details unavailable for this stored cover.";
export const NOAA_WINDOW_ENDED = "NOAA window ended";
export const REFERENCE_ONLY = "Reference point only";
export const CLAIM_EXPIRED = "Claim window ended";
export const RESULT = "Result";
export const HOW_SETTLES_TITLE = "How it settles";
export const FIXTURE_BANNER = "Fixture — preview data";
export const TECH_CONTEXT = "WeatherXM and x402 observations are context only. NOAA alone settles covers.";
export const CONTRACT_LABEL = "Contract · Solana Devnet";
export const PARTIAL_MARKETS = "Some quotes could not be read. Only verified open markets are shown.";
export const FIRST_RUN_KEY = "skyhedge.line-intro-dismissed";
export const DISCOVERY_COPY = [ALL, WEATHER_WORD, BY, OPEN_WORD, NOT_OPEN_YET, EMPTY_MARKETS, EMPTY_COVERS, WALLET_INTRO, READING_WALLET, STATE_UNAVAILABLE, UNKNOWN_CITY, PAYOUT_READY, REFUND_READY, REFUNDED, LOSS_OPEN, GAIN_OPEN, COPY_ADDRESS, COPIED, COPY_FAILED, DISCONNECT, REFERENCE_ONLY, CLAIM_EXPIRED, RECEIPT, FINAL_READING_UNAVAILABLE, RECEIPT_DATA_UNAVAILABLE, NOAA_WINDOW_ENDED, RESULT, HOW_SETTLES_TITLE, FIXTURE_BANNER, TECH_CONTEXT, CONTRACT_LABEL, PARTIAL_MARKETS];

export function pricingSentence(feeLabel: string): string {
  return `Includes a 15% margin on the odds and a 1% protocol fee (${feeLabel} SKYT).`;
}

/** Task fact: the whole premium comes back if NOAA has not published within 7 days. */
export function refundSentence(): string {
  return "If NOAA data isn't available within 7 days of the window ending, your full premium is refundable.";
}

export function chanceNote(years: number): string | null {
  if (!Number.isInteger(years) || years <= 0) return null;
  return `Chance is from ${years} years of NOAA history, not a forecast.`;
}

export function highestInYears(years: number): string | null {
  if (!Number.isInteger(years) || years <= 0) return null;
  return `Highest in ${years} years`;
}

export function feeLine(feeLabel: string): string {
  return `${feeLabel} SKYT fee, included in what you pay.`;
}

export function capLine(capSkyt = MARKET_CAP_SKYT): string {
  return `Cover limit reached: ${capSkyt} SKYT per market.`;
}

export function protectCta(premiumLabel: string): string {
  return `Protect for ${premiumLabel} SKYT`;
}

export function salesCloseLine(day: string): string {
  return `Sales close ${day}`;
}

export function startsLine(day: string): string {
  return `Starts ${day}`;
}

export function sinceLine(day: string): string {
  return `since ${day}`;
}

export function notOpenLine(peril: PerilId, cityName: string, perils?: readonly PerilDefinition[]): string {
  if (peril === "cold") return "Cold isn't open yet.";
  const label = perilById(peril, perils)?.label ?? "This";
  return `${label} isn't open for ${cityName} yet.`;
}

export function goThereLine(peril: PerilId, cityName: string, perils?: readonly PerilDefinition[]): string {
  const label = perilById(peril, perils)?.label ?? "It";
  return `View ${label.toLowerCase()} in ${cityName}. Go there`;
}

export function oddsLine(peril: PerilId, chanceBps: number, perils?: readonly PerilDefinition[]): string | null {
  const definition = perilById(peril, perils);
  if (!definition?.odds || !Number.isSafeInteger(chanceBps)) return null;
  const percentTimesTen = Math.floor(chanceBps / 10);
  if (percentTimesTen < 150) return definition.odds.under15;
  if (percentTimesTen <= 350) return definition.odds.mid;
  return definition.odds.over35;
}

export function coverSentence(input: {
  payoutLabel: string;
  station: string;
  peril: PerilId;
  triggerLabel: string;
  dateLabel: string;
  premiumLabel: string;
}): string | null {
  const definition = perilById(input.peril);
  if (!definition) return null;
  const verb = definition.verb(input.triggerLabel);
  return `You get ${input.payoutLabel} SKYT if ${input.station} ${verb} by ${input.dateLabel}. If not, you lose the ${input.premiumLabel} SKYT you paid.`;
}

export function payoffDescription(input: { station: string; triggerLabel: string; lossLabel: string; gainLabel: string; direction: "up" | "down" }): string {
  const verb = input.direction === "down" ? "falls to" : "reaches";
  return `Lose ${input.lossLabel} SKYT unless ${input.station} ${verb} ${input.triggerLabel}; then gain ${input.gainLabel} SKYT.`;
}

export function subline(input: { station: string; start: string; end: string; salesClose: string }): string {
  return `${input.station} · ${input.start} – ${input.end} · ${salesCloseLine(input.salesClose)}`;
}

export function triggerHeader(unit: string): string {
  return `Trigger (${unit})`;
}

export function openRowName(input: { trigger: string; chance: string; multiple: string; maxLoss: string }): string {
  return `Trigger ${input.trigger}, chance ${input.chance.replace("%", " percent")}, multiple ${input.multiple.replace("x", " times")}, max loss ${input.maxLoss} SKYT`;
}

export function modelledRowName(input: { trigger: string; chance: string; multiple: string }): string {
  return `Trigger ${input.trigger}, chance ${input.chance.replace("%", " percent")}, multiple ${input.multiple.replace("x", " times")}, not open`;
}

export function resultLine(sign: "+" | "-" | "", amount: string): string {
  return `Result ${sign}${amount} SKYT`;
}

export function lossCaption(): string {
  return "if the trigger isn't reached";
}

export function gainCaption(): string {
  return "if it is reached";
}

export function notOpenMarkets(count: number): string {
  return `Not open yet · ${count} markets`;
}

export function ticketSheet(input: { feeLabel: string; years: number }): string | null {
  const note = chanceNote(input.years);
  if (!note) return null;
  return [
    "Max loss is what you pay.",
    "Max gain is the payout minus what you pay.",
    "Break-even chance is what you pay divided by the payout.",
    "Multiple is the payout divided by what you pay, rounded down.",
    pricingSentence(input.feeLabel),
    refundSentence(),
    note,
    HOW_IT_SETTLES,
  ].join(" ");
}

export function infoSheetTitle(): string {
  return "How the ticket works";
}

/** Rendered samples for the forbidden-word gate. Not shown in the product. */
export function copySamples(): string[] {
  const years = chanceNote(10) ?? "";
  return [
    ...DISCOVERY_COPY, DEVNET_TAG, SALES_CLOSED, CHAIN_ERROR, ALREADY_COVERED, HOW_IT_SETTLES, SETTLED_UNITS,
    WIND_ELEMENT, HEAT_ELEMENT, CONNECT_WALLET, TRY_AGAIN, GETTING_QUOTE, WAITING_WALLET, APPROVE_WALLET,
    COVERED_WORD, VIEW_WALLET, YOUR_COVER, NOT_OPEN_WORD, PAID_OUT, DRY_WINDOW, GOT_IT, DONE,
    COVER_THIS, OPEN_APP, FIRST_RUN, LANDING_TITLE, LANDING_SUB, ...HOW_IT_WORKS, PROTECT_TITLE, MARKETS_TITLE,
    WALLET_TITLE, YOUR_COVERS, OPEN_NOW, TECHNICAL_DETAILS, SKYT_BALANCE, MAX_LOSS, MAX_GAIN,
    PAYOUT, CHANCE, BREAK_EVEN, MULTIPLE, TRIGGER, COVER, FEE_INCLUDED, SO_FAR, WEEK, MONTH, WINDOW_WORD,
    pricingSentence("1.00"), refundSentence(), years, highestInYears(10) ?? "", feeLine("1.00"),
    capLine(), protectCta("24.00"), salesCloseLine("Oct 26"), startsLine("Oct 26"), sinceLine("Oct 26"),
    notOpenLine("wind", "New York"), notOpenLine("cold", "Miami"), goThereLine("wind", "Chicago"),
    oddsLine("rain", 2_000) ?? "", oddsLine("heat", 4_000) ?? "", oddsLine("wind", 1_000) ?? "",
    coverSentence({ payoutLabel: "100", station: "Central Park", peril: "rain", triggerLabel: "69 mm", dateLabel: "Nov 2", premiumLabel: "24.00" }) ?? "",
    coverSentence({ payoutLabel: "100", station: "O'Hare", peril: "wind", triggerLabel: "14 m/s", dateLabel: "Nov 2", premiumLabel: "24.00" }) ?? "",
    coverSentence({ payoutLabel: "100", station: "Miami Intl", peril: "heat", triggerLabel: "31 C", dateLabel: "Nov 2", premiumLabel: "24.00" }) ?? "",
    coverSentence({ payoutLabel: "100", station: "Central Park", peril: "cold", triggerLabel: "0 C", dateLabel: "Nov 2", premiumLabel: "24.00" }) ?? "",
    payoffDescription({ station: "Central Park", triggerLabel: "69 mm", lossLabel: "24.00", gainLabel: "76.00", direction: "up" }),
    subline({ station: "Central Park", start: "Oct 26", end: "Nov 2", salesClose: "Oct 26" }),
    triggerHeader("mm"), openRowName({ trigger: "69 mm", chance: "20.0%", multiple: "4.1x", maxLoss: "24.00" }),
    modelledRowName({ trigger: "47 mm", chance: "60.0%", multiple: "1.4x" }),
    resultLine("+", "76.00"), resultLine("-", "24.00"), lossCaption(), gainCaption(),
    notOpenMarkets(3), ticketSheet({ feeLabel: "1.00", years: 10 }) ?? "", infoSheetTitle(),
    perilById("wind")?.honesty("O'Hare") ?? "", perilById("heat")?.honesty("Miami Intl") ?? "",
  ];
}

const FORBIDDEN = [
  /\binsurance\b/i,
  /RainHedge/i,
  /heatwave/i,
  /extreme heat/i,
  /\bguaranteed\b/i,
  /risk-free/i,
  /risk free/i,
  /\bprofit\b/i,
  /expected value/i,
  /expected profit/i,
  /\bedge\b/i,
  /can't lose/i,
  /cant lose/i,
  /sure thing/i,
  /safe bet/i,
  /free money/i,
  /lock in/i,
];

export function forbiddenHits(text: string): string[] {
  return FORBIDDEN.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}
