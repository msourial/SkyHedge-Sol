import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestDevnetFunds, PMAMM_FAUCET_URL} from './faucet';
const res=(status:number,body:unknown,headers:Record<string,string>={})=>({ok:status<300,status,headers:{get:(k:string)=>headers[k]??null},json:async()=>body}) as unknown as Response;
test('faucet posts a player request for the wallet', async () => {
  let seen:any;
  const r=await requestDevnetFunds('Wallet111',(async(url:string,init:any)=>{seen={url,init};return res(200,{signature:'sig',amount:1000,sol:0.05});}) as any);
  assert.equal(seen.url,PMAMM_FAUCET_URL);assert.deepEqual(JSON.parse(seen.init.body),{wallet:'Wallet111',role:'player'});
  assert.deepEqual(r,{funded:true,signature:'sig',usdc:1000,sol:0.05});
});
test('faucet refusals and network errors never throw', async () => {
  assert.deepEqual(await requestDevnetFunds('W',(async()=>res(429,{error:'1 claim per hour'},{'Retry-After':'60'})) as any),{funded:false,reason:'1 claim per hour',retryAfterSecs:60});
  const down=await requestDevnetFunds('W',(async()=>{throw Error('offline');}) as any);
  assert.equal(down.funded,false);
});
