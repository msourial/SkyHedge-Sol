import type {MarketAccount, SwapDirection} from '@pm-amm/sdk';
import {marketState, quoteSwap, minOutput} from './helpers';
export {marketState, fetchMarkets} from './helpers';
export const RPC = 'https://api.devnet.solana.com';
export const PROGRAM = 'GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y';
export const MINT = '3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ';
export function rawAmount(text: string): number {
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw Error('Enter an amount with up to six decimal places');
  const [whole, fraction = ''] = text.split('.');
  const raw = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (raw <= 0n || raw > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Amount outside supported range');
  return Number(raw);
}
export function quote(m: MarketAccount, direction: SwapDirection, amount: number, now?: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('Invalid raw amount');
  const q = quoteSwap(m, direction, amount, now);
  const minimum = minOutput(q, 100);
  if (!Number.isSafeInteger(q.out) || minimum <= 0) throw Error('Trade too small or outside supported range');
  return {...q, minimum, amount, direction};
}
export function payout(m: MarketAccount, yesRaw: bigint, noRaw: bigint): bigint {
  if (!m.resolved) return 0n;
  if (m.winningSide === 1) return yesRaw;
  if (m.winningSide === 2) return noRaw;
  throw Error('Invalid settled winner');
}
export function positionValue(m: MarketAccount, yes: number, no: number, now?: number) {
  const s = marketState(m, now);
  if (s.resolved) return {raw:Number(payout(m, BigInt(yes), BigInt(no))), estimate:false};
  return {raw:yes * s.price + no * (1 - s.price), estimate:true};
}

/** LP shares and per-share accumulators use the program's I80F48 scale. */
export function pendingResiduals(m: Pick<MarketAccount,'cumYesPerShare'|'cumNoPerShare'>, lp: {shares:{toString():string};yesPerShareCheckpoint:{toString():string};noPerShareCheckpoint:{toString():string};excessYes?:{toString():string};excessNo?:{toString():string}}) {
  const pending=(cum:{toString():string}, checkpoint:{toString():string}, excess?:{toString():string})=> {
    const delta=BigInt(cum.toString())-BigInt(checkpoint.toString());
    if(delta<0n)throw Error('LP checkpoint exceeds accumulator');
    return (BigInt(lp.shares.toString())*delta >> 96n)+BigInt(excess?.toString()??'0');
  };
  return {yes:pending(m.cumYesPerShare,lp.yesPerShareCheckpoint,lp.excessYes),no:pending(m.cumNoPerShare,lp.noPerShareCheckpoint,lp.excessNo)};
}

/** Quote identity excludes wall-clock accrual; changed chain reserves require review. */
export function quoteStateKey(m: MarketAccount): string {
  return [m.lZero,m.reserveYes,m.reserveNo,m.lastAccrualTs,m.endTs,m.resolved,m.winningSide].map(String).join(':');
}
