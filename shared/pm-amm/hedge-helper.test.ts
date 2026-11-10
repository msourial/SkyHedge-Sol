import {test} from 'node:test';
import assert from 'node:assert/strict';
import BN from 'bn.js';
import type {MarketAccount} from '@pm-amm/sdk';
import catalog from './markets.devnet.json';
import {parseHedgeRequest, suggestHedge, sizeHedge, type HedgeCatalog} from './hedge-helper';
import {quote, rawAmount} from './trading';
const now = new Date('2026-11-10T12:00:00Z'), seconds = now.getTime()/1000;
const fixed = (n: number) => new BN(BigInt(Math.round(n * 2**32)).toString()).shln(16);
const endTs = Date.parse('2026-12-13T00:00:00Z')/1000;
const state = {endTs:new BN(endTs),lastAccrualTs:new BN(seconds),lZero:fixed(400e6/0.3989422804014327/Math.sqrt(endTs-seconds)),reserveYes:fixed(400e6),reserveNo:fixed(400e6),resolved:false,winningSide:0} as MarketAccount;
const montreal: HedgeCatalog = {'fixture-montreal':{name:'fixture-total-precipitation',spec:{city:'Montréal',riskType:'total precipitation',start:'2026-12-14',end:'2026-12-16',thresholdTenths:100,endTs}}};
const prompt = "I'm in Montreal, I want to hedge against snow from Dec 14 to Dec 16, max I can pay is 20";

test('Montreal snow suggests only fixture catalog entry, Yes, with a real quote within 20', () => {
  const result = suggestHedge(prompt,montreal,{'fixture-montreal':state},now);
  assert.deepEqual(result.issues,[]);
  assert.equal(result.path,'deterministic');
  assert.equal(result.suggestion?.address,'fixture-montreal');
  assert.equal(result.suggestion?.direction,'usdcToYes');
  assert.equal(result.suggestion?.q.amount,rawAmount('20'));
  assert.deepEqual(result.suggestion?.q,quote(state,'usdcToYes',rawAmount('20'),seconds));
  assert.ok(result.suggestion!.q.amount <= 20e6);
  assert.match(result.suggestion!.reason,/rain plus melted snow/);
  assert.match(result.suggestion!.reason,/strike of ≥ 10 mm/);
});

test('current catalog returns closest real entries and explains rain-only mismatch', () => {
  const result = suggestHedge(prompt,catalog,{},now);
  assert.equal(result.suggestion,undefined);
  assert.match(result.message,/No exact match/);
  assert.equal(result.closest.length,3);
  for (const entry of result.closest) {
    assert.ok(entry.address in catalog);
    assert.match(entry.differences.join(' '),/Different city/);
    assert.match(entry.differences.join(' '),/Measures rain, not snow/);
  }
  assert.match(result.closest.find(e => e.market.spec.historicalDemo)!.status,/Not tradeable/);
});

test('location, risk, named/ISO dates and budget wording variants', () => {
  for (const city of ['I am located in Montreal','I’m in Montréal','I am in Montreal']) {
    for (const risk of ['snow','total precipitation','rain plus melted snow','rain']) {
      for (const budget of ['the maximum I can pay is 20','max loss 20','premium 20','budget: $20','the most I can pay is 20','budget 20.','budget 20,']) {
        const parsed = parseHedgeRequest(`${city}, hedge against ${risk} from Dec 14 to Dec 16, ${budget} mUSDC`,montreal,now);
        assert.deepEqual(parsed.issues,[],JSON.stringify({city,risk,budget}));
        assert.equal(parsed.request.startDate,'2026-12-14');
        assert.equal(parsed.request.endDate,'2026-12-16');
        assert.equal(parsed.request.maxPay,'20');
      }
    }
  }
  for (const dates of ['Dec 14–16','December 14 through December 16, 2026','2026-12-14 to 2026-12-16']) {
    const parsed = parseHedgeRequest(`Montreal snow ${dates} budget 1.123456 test dollars`,montreal,now);
    assert.deepEqual(parsed.issues,[]);assert.equal(parsed.request.startDate,'2026-12-14');assert.equal(parsed.request.endDate,'2026-12-16');
  }
  const week = parseHedgeRequest('Montreal snow from this week to this week, max loss 20 dollars',montreal,now);
  assert.deepEqual(week.issues,[]);assert.equal(week.request.startDate,'2026-11-09');assert.equal(week.request.endDate,'2026-11-15');
});

test('incomplete, ambiguous and invalid requests never suggest', () => {
  for (const input of ['', 'Montreal snow', prompt.replace('20','-20'),prompt.replace('20','0'),prompt.replace('20','1.1234567'),prompt.replace('20','1e3'),prompt.replace('20','9,000'),prompt.replace('Dec 14','Feb 30'),prompt.replace('Dec 14','Dec 20'),prompt+' budget 30',prompt+' Toronto',prompt.replace('snow','rain and snow'),prompt+' or Dec 20 to Dec 22',prompt+' or this week',prompt+' or Dec 18',prompt+' or 2026-12-20 to 2026-12-22']) {
    const result = suggestHedge(input,montreal,{'fixture-montreal':state},now);
    assert.ok(result.issues.length,input);assert.equal(result.suggestion,undefined,input);
  }
  const unknown = suggestHedge(prompt.replace('Montreal','Ottawa'),montreal,{'fixture-montreal':state},now);
  assert.equal(unknown.request.location,'Ottawa');assert.equal(unknown.suggestion,undefined);
});

test('snow cannot match rain; compatible risks and overlap must be disclosed', () => {
  const rain: HedgeCatalog = {rain:{...montreal['fixture-montreal'],name:'RAIN:test',spec:{...montreal['fixture-montreal'].spec,riskType:'rain'}}};
  assert.equal(suggestHedge(prompt,rain,{rain:state},now).suggestion,undefined);
  assert.ok(suggestHedge(prompt.replace('snow','rain'),montreal,{'fixture-montreal':state},now).suggestion);
  const overlap = suggestHedge(prompt.replace('Dec 14','Dec 15'),montreal,{'fixture-montreal':state},now);
  assert.match(overlap.suggestion!.reason,/not the same window/);
  const disjoint = suggestHedge(prompt.replace('Dec 14 to Dec 16','Dec 20 to Dec 22'),montreal,{'fixture-montreal':state},now);
  assert.equal(disjoint.suggestion,undefined);
  const mixed = {...rain,...montreal};
  assert.equal(suggestHedge(prompt,mixed,{rain:state,'fixture-montreal':state},now).suggestion?.address,'fixture-montreal');
});

test('only explicit absence chooses No and the quote matches that side', () => {
  for (const wording of ['no snow',"it won't snow",'lack of snow','snow will not occur','no snowfall','without rainfall','rainfall will not occur']) {
    const result = suggestHedge(prompt.replace('snow',wording),montreal,{'fixture-montreal':state},now);
    assert.equal(result.suggestion?.direction,'usdcToNo',wording);
    assert.deepEqual(result.suggestion?.q,quote(state,'usdcToNo',20e6,seconds));
  }
});

test('missing state, settled, expired, demo, zero liquidity and too-small budget never fabricate quotes', () => {
  for (const states of [{},{'fixture-montreal':{...state,resolved:true,winningSide:1}},{'fixture-montreal':{...state,endTs:new BN(seconds)}},{'fixture-montreal':{...state,lZero:new BN(0)}}]) {
    const result = suggestHedge(prompt,montreal,states,now);
    assert.equal(result.suggestion,undefined);assert.match(result.message,/no positive trade/);
  }
  assert.equal(suggestHedge(prompt,montreal,{'fixture-montreal':state},new Date(endTs*1000)).suggestion,undefined);
  const demo = {demo:{...montreal['fixture-montreal'],spec:{...montreal['fixture-montreal'].spec,historicalDemo:true}}};
  assert.equal(suggestHedge(prompt,demo,{demo:state},now).suggestion,undefined);
  assert.equal(sizeHedge(state,'usdcToYes','0.000001',seconds),null);
  const empty = suggestHedge(prompt,{}, {},now);
  assert.equal(empty.suggestion,undefined);assert.deepEqual(empty.closest,[]);assert.match(empty.message,/No markets/);
});

test('integer and decimal budgets use gross input including real fees', () => {
  for (const budget of ['20','0.000002','1.123456','9007199254']) {
    const q = sizeHedge(state,'usdcToYes',budget,seconds);
    if (q) {
      assert.ok(q.amount <= rawAmount(budget));assert.deepEqual(q,quote(state,'usdcToYes',q.amount,seconds));
      assert.equal(q.fee,Math.floor(q.amount*0.02));
    } else assert.equal(budget,'0.000002');
  }
});

test('sizing reduces unsafe output to the largest successful raw amount', () => {
  const large = {...state,reserveYes:fixed(8e15),reserveNo:fixed(8e15),lZero:fixed(8e15/0.3989422804014327/Math.sqrt(endTs-seconds))};
  const limit = rawAmount('9007199254');
  assert.throws(() => quote(large,'usdcToYes',limit,seconds));
  const q = sizeHedge(large,'usdcToYes','9007199254',seconds)!;
  assert.ok(q.amount > 0 && q.amount < limit);
  assert.deepEqual(q,quote(large,'usdcToYes',q.amount,seconds));
  assert.throws(() => quote(large,'usdcToYes',q.amount+1,seconds));
});
