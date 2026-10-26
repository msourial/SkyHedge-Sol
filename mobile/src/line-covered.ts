import { perilById } from "../../shared/peril-registry.ts";
import * as copy from "../../shared/ui-copy.ts";
import { breakEvenLabel, formatBase, moneyParts, multipleLabel, payoffPixels, ticketFromBases } from "../../shared/ui-money.ts";
import { dayFromIso } from "../../shared/ui-ladder.ts";
import type { ProtectModel } from "../../shared/ui-view.ts";
import type { CoverSize, WindowQuote } from "../../shared/ui-types.ts";
import { positionForWindow } from "./covered.ts";
import type { ChainProtection } from "./positions.ts";

/** Follow the selected rung's address, even when the legacy active window differs. */
export function lineCoverage(input: { quote: WindowQuote | null; selectedTrigger: number | null; coveredMarket: string | null; positions?: readonly ChainProtection[] | null }) {
  const rung = input.quote?.rungs.find((rung) => rung.triggerValue === input.selectedTrigger && rung.marketAddress)
    ?? input.quote?.rungs.find((rung) => rung.marketAddress);
  const market = rung?.marketAddress;
  const position = positionForWindow(input.positions, market);
  const fallback = input.quote?.rungs.some((rung) => rung.marketAddress === input.coveredMarket) ? input.coveredMarket : null;
  const cover = position ? ([50, 100, 250] as const).find((size) => `${size}000000` === position.protectedAmount) : undefined;
  return { coveredMarket: position?.market ?? fallback, cover: cover as CoverSize | undefined, position };
}

/** Receipt money comes from the held account, including covers opened by the legacy flow. */
export function withCoveredReceipt(model: ProtectModel, position: ChainProtection | null, windowEnd: string, years?: number): ProtectModel {
  if (!position || !model.ticket || !model.hero || model.panel.kind !== "covered") return model;
  if (![position.premiumPaid, position.potentialPayout, position.protectedAmount].every((value) => /^\d+$/.test(value))) return model;
  const deal = ticketFromBases(BigInt(position.premiumPaid), BigInt(position.potentialPayout));
  const end = dayFromIso(windowEnd);
  if (!deal || !end) return model;
  const loss = moneyParts(-deal.maxLoss), gain = moneyParts(deal.maxGain);
  const payout = formatBase(deal.payout), fee = formatBase((BigInt(position.protectedAmount) + 99n) / 100n);
  const triggerLabel = `${model.hero.numeral} ${model.unit}`;
  const sentence = copy.coverSentence({ payoutLabel: payout, station: model.station, peril: model.peril, triggerLabel, dateLabel: end, premiumLabel: formatBase(deal.premium) }) ?? model.ticket.sentence;
  const pixels = payoffPixels(deal.maxLoss, deal.maxGain);
  const payoff = { ...model.ticket.payoff, description: copy.payoffDescription({ station: model.station, triggerLabel, lossLabel: formatBase(deal.maxLoss), gainLabel: formatBase(deal.maxGain), direction: perilById(model.peril)!.direction }), lossBase: deal.maxLoss.toString(), gainBase: deal.maxGain.toString(), lossPx: pixels.loss, gainPx: pixels.gain, lossLabel: `-${formatBase(deal.maxLoss)}`, gainLabel: `+${formatBase(deal.maxGain)}` };
  const breakEven = breakEvenLabel(deal.breakEvenTenths) ?? model.ticket.breakEven;
  const signRows = model.ticket.signRows.map((row) => ({ ...row, value: row.label === copy.PAYOUT ? `${payout} SKYT` : row.label === copy.BREAK_EVEN ? breakEven : row.label === copy.FEE_INCLUDED ? `${fee} SKYT` : row.value }));
  const sheet = years ? copy.ticketSheet({ feeLabel: fee, years }) : `${copy.pricingSentence(fee)} ${copy.feeLine(fee)}`;
  const multiple = multipleLabel(deal.multipleTenths) ?? model.hero.multiple;
  const ticket = { ...model.ticket, sheet, loss, gain, payout, fee, breakEven, sentence, signRows, payoff, diagram: payoff };
  return { ...model, ticket, signRows, payoff, coverSentence: sentence, hero: { ...model.hero, multiple },
    rows: model.rows.map((row) => row.yourCover ? { ...row, maxLoss: payoff.lossLabel, multiple, name: copy.openRowName({ trigger: row.triggerLabel, chance: row.chance, multiple, maxLoss: formatBase(deal.maxLoss) }) } : row), panel: { ...model.panel, loss, gain } };
}
