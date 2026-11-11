import {test} from 'node:test';
import assert from 'node:assert/strict';
import BN from 'bn.js';
import type {MarketAccount} from '@pm-amm/sdk';
import {pmTicket,chance} from './pm-amm/view.ts';
import {catalog,mobileListedMarkets,units} from '../../shared/pm-amm/client.ts';
import {quote} from '../../shared/pm-amm/trading.ts';
const fixed=(n:number)=>new BN(BigInt(Math.round(n*2**32)).toString()).shln(16);
test('native review uses shared quote shares, minimum, fee and Canadian source copy for both sides',t=>{
  const now=1794330000;t.mock.method(Date,'now',()=>now*1000);
  const address=Object.keys(mobileListedMarkets)[0],entry=catalog[address];
  const state={endTs:new BN(entry.spec.endTs),lastAccrualTs:new BN(now),lZero:fixed(100e6/.3989422804014327/Math.sqrt(entry.spec.endTs-now)),reserveYes:fixed(100e6),reserveNo:fixed(100e6),resolved:false,winningSide:0} as MarketAccount;
  for(const direction of ['usdcToYes','usdcToNo'] as const){
    const input={owner:entry.creator,market:address,spec:entry.spec,state,direction,amountRaw:1e6,now};
    const review=pmTicket(input),q=quote(state,direction,1e6,now);
    assert.equal(review.target.premiumBase,'1000000');
    assert.equal(review.pmAmm?.shares,units(q.out));
    assert.equal(review.pmAmm?.minimum,units(q.minimum));
    assert.equal(review.pmAmm?.fee,units(q.fee));
    assert.ok(review.ticket.signRows.some(r=>r.label==='Settlement source'&&r.value==='Environment Canada'));
    assert.match(review.ticket.sentence,/Each winning share pays 1 mUSDC/);
    assert.match(review.ticket.sentence,/total precipitation/);
    assert.doesNotMatch(review.ticket.sentence,/SKYT/);
    if(direction==='usdcToNo'){assert.match(review.ticket.sentence,/No shares win if total precipitation is below/);assert.equal(review.context.triggerLabel,`Less than ${entry.spec.thresholdTenths/10} mm`);}
    else assert.equal(review.context.triggerLabel,`${entry.spec.thresholdTenths/10} mm or more`);
  }
});

test('No share chance is the complement of the chain Yes price',t=>{
  const now=1794330000;t.mock.method(Date,'now',()=>now*1000);
  const address=Object.keys(mobileListedMarkets)[0],entry=catalog[address];
  const state={endTs:new BN(entry.spec.endTs),lastAccrualTs:new BN(now),lZero:fixed(100e6/.3989422804014327/Math.sqrt(entry.spec.endTs-now)),reserveYes:fixed(70e6),reserveNo:fixed(120e6),resolved:false,winningSide:0} as MarketAccount;
  const yes=Number(chance(state,'usdcToYes').replace('%','')),no=Number(chance(state,'usdcToNo').replace('%',''));
  assert.equal(yes+no,100);assert.notEqual(yes,no);
});
