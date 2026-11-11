import BN from 'bn.js';
import type {MarketAccount} from '@pm-amm/sdk';
import {capitalPhi, phi} from '@pm-amm/sdk/math';
import {marketState, quoteSwap} from '../../shared/pm-amm/helpers';
import fs from 'node:fs';
// Symmetric 50/50 seed: reserves equal deposited raw collateral;
// L_eff = deposit / phi(0), matching the spike's fetched initial state.
export function constructed(seed: number, duration = 86400, now = 0): MarketAccount {
  const fixed = (n: number) => new BN(BigInt(Math.round(n * 2 ** 32)).toString()).shln(16);
  return {endTs:new BN(now + duration), lastAccrualTs:new BN(now), lZero:fixed(seed * 1e6 / phi(0) / Math.sqrt(duration)), reserveYes:fixed(seed * 1e6), reserveNo:fixed(seed * 1e6), resolved:false, winningSide:0} as MarketAccount;
}
const rows: string[] = [];
for (const seed of [50, 100, 250, 400]) for (const amount of [5, 10, 25]) {
  const m = constructed(seed), s = marketState(m, 0), q = quoteSwap(m, 'usdcToYes', amount * 1e6, 0);
  const net = amount * 1e6 - q.fee;
  const xAfter = s.x + net - q.out, yAfter = s.y + net;
  const after = capitalPhi((yAfter - xAfter) / s.lEff);
  rows.push(`| ${seed} | ${amount} | ${(q.out / 1e6).toFixed(6)} | ${(100 * (after - s.price)).toFixed(4)} |`);
}
fs.writeFileSync('docs/pm-amm-web/liquidity.md', `# Liquidity measurement\n\nComputed offline with the official quoteSwap helper, SDK 0.2.0, symmetric seed at 50% and at initial creation time. Formula: both reserves = seed; L_eff = seed / phi(0). NO buys are symmetric. Values are calculations, not executed receipts. Regenerate with node --import tsx scripts/pm-amm/liquidity.ts.\n\n| Seed mUSDC | Input mUSDC | YES shares quoted | YES price change (percentage points) |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\nAssumption: a typical demo trade is 10 mUSDC. Choose 400 mUSDC per upcoming market: two markets require 800 mUSDC, within the creator’s measured 994.810785 mUSDC after the spike. The table shows the initial price movement. Liquidity decays with time; this is not a promise of the same impact near expiry or after other trades. The historical mechanics demo uses 50 mUSDC to conserve funds.\n`);
