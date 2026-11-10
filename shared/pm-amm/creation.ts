import type {PublicKey} from '@solana/web3.js';
import type {MarketSpec} from './spec';
import {marketName} from './spec';
/** Thresholds coexist; close-time drift cannot accidentally recreate an existing strike. */
export function sameStrike(a:MarketSpec,b:MarketSpec):boolean {
  return a.station===b.station&&a.start===b.start&&a.end===b.end&&a.thresholdTenths===b.thresholdTenths&&!!a.historicalDemo===!!b.historicalDemo;
}
/** Explicit expiry bypasses the SDK send wrapper's relative wall-clock conversion. */
export function creationParameters(spec:MarketSpec,marketId:number,authority:PublicKey) {
  return {authority,marketId,endTs:spec.endTs,name:marketName(spec),initialPriceBps:5000};
}

/** A changed close cannot bypass an ambiguous send for the same station/window/threshold. */
export function findStrikeAttempt(attempts:Record<string,{spec?:MarketSpec}>,spec:MarketSpec) {
  return Object.entries(attempts).find(([,attempt])=>attempt.spec&&sameStrike(attempt.spec,spec))?.[0];
}
