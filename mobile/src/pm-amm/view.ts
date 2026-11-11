import type { MarketAccount } from '@pm-amm/sdk';
import type { MarketSpec } from '../../../shared/pm-amm/spec.ts';
import { marketState, quote } from '../../../shared/pm-amm/trading.ts';
import { units } from '../../../shared/pm-amm/client.ts';
import { missingDataNote, sourceLabel, strikeSentence, trustParagraph } from '../../../shared/pm-amm/copy.ts';
import type { MoneyFigure, PayoffModel, TicketModel } from '../../../shared/ui-view.ts';
import type { SignReview } from '../line/SignSheet.tsx';
import { dayFromIso } from '../../../shared/ui-ladder.ts';
/** App-style window label, e.g. "Dec 14 – Dec 16" (same style as the purchase receipt). */
export const pmWindowLabel = (spec: Pick<MarketSpec,'start'|'end'>) => {
  const a = dayFromIso(spec.start) ?? spec.start, b = dayFromIso(spec.end) ?? spec.end;
  if (a === b) return a;
  const [am, ad] = a.split(' '), [bm, bd] = b.split(' ');
  return am === bm && ad && bd ? `${am} ${ad}–${bd}` : `${a} – ${b}`;
};
/** Station names arrive upper-case from the source catalog; the app shows them in title case. */
export const stationTitle = (name: string) => name.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
export const chance = (state: MarketAccount, direction: 'usdcToYes'|'usdcToNo' = 'usdcToYes', now?:number) => {const price=marketState(state,now).price;return `${((direction==='usdcToNo'?1-price:price)*100).toFixed(2)}%`;};
export function pmTicket(input: {owner: string; market: string; spec: MarketSpec; state: MarketAccount; direction: 'usdcToYes'|'usdcToNo'; amountRaw: number; now?:number}): SignReview {
  const {spec, state, direction, amountRaw} = input, q = quote(state, direction, amountRaw,input.now);
  const side = direction === 'usdcToYes' ? 'Yes' : 'No';
  const figure = (raw: number, negative = false): MoneyFigure => {
    const [whole, fraction] = (Math.abs(raw) / 1e6).toFixed(2).split('.');
    return {sign: negative || raw < 0 ? '-' : '+', whole, fraction};
  };
  const gain = q.out - amountRaw, trigger = spec.thresholdTenths / 10;
  const payoff: PayoffModel = {domain: {loss: amountRaw / 1e6, gain: Math.max(0,gain) / 1e6}, maximum: trigger, openTriggers: [trigger], lossBase: String(amountRaw), gainBase: String(gain), lossPx: 0, gainPx: 0, step: 0, ticks: [trigger], lossLabel: units(amountRaw), gainLabel: units(gain), triggerLabel: `${trigger} mm`, description: `${side} shares win ${direction === 'usdcToYes' ? 'at or above' : 'below'} ${trigger} mm.`};
  const ticket: TicketModel = {loss: figure(amountRaw,true), gain: figure(gain), payout: units(q.out), chance: chance(state,direction,input.now), breakEven: '', fee: units(q.fee), note: missingDataNote(spec), sentence: `Each winning share pays 1 mUSDC. ${side === 'Yes' ? strikeSentence(spec) : `No shares win if ${spec.source === 'eccc' ? 'total precipitation' : 'rainfall'} is below ${trigger} mm at ${spec.stationName} between ${spec.start} and ${spec.end}, inclusive.`}`, salesClose: `Trading closes ${new Date(spec.endTs * 1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}.`, refund: trustParagraph(spec), honesty: null, sheet: null, readOnly: false, payoff, diagram: payoff, signRows: [
    {label:'You pay',value:`${units(amountRaw)} mUSDC`},
    {label:'You get (estimate)',value:`${units(q.out)} ${side} shares`},
    {label:'Minimum received',value:`${units(q.minimum)} shares`},
    {label:'Fee (included)',value:`${units(q.fee)} mUSDC`},
    {label:'Station',value:spec.stationName},
    {label:'Window',value:pmWindowLabel(spec)},
    {label:'Settlement source',value:sourceLabel(spec)},
  ]};
  return {wallet:input.owner, target:{market:input.market,amount:String(amountRaw),premiumBase:String(amountRaw),salesCloseAt:new Date(spec.endTs*1000).toISOString()},context:{premiumBase:String(amountRaw),balanceBase:null,cityName:spec.city,peril:'rain',triggerLabel:side === 'Yes' ? `${trigger} mm or more` : `Less than ${trigger} mm`,windowLabel:`${spec.start} – ${spec.end}`},ticket,pmAmm:{side,shares:units(q.out),minimum:units(q.minimum),fee:units(q.fee),token:'mUSDC'}};
}
