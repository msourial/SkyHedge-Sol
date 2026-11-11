import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalog from './markets.devnet.json';
import {excludedWallets,type TradeRecord} from './stats';
import {boldBonus,firstCalls,isHiddenEntry,isLeaderboardMarket,loadLeaderboard,scoreLeaderboard,settledWinner,shortenWallet,visibleCatalog,type HistoryRpc} from './leaderboard';
import {fixtureSwap} from './stats.fixture';

const toronto='6VhJRjXtLVwPL5L2zMbsSPTsbvzYzekfcHNEdZgsNWA2';
const montreal='HMN86GTepwSTUdLfKTUvk93V9hpph562EXHeoo6vPYqu';
const publicWallet='11111111111111111111111111111111';
const other='22222222222222222222222222222222';
function trade(partial:Partial<TradeRecord>):TradeRecord {
  return {signature:'sig',instruction:0,market:toronto,wallet:publicWallet,volume:5000000n,fee:100000n,direction:0,shares:20000000n,slot:10,...partial};
}

test('Seattle and Miami are hidden; NY and Chicago mid-December stay visible',()=>{
  const hidden=Object.values(catalog).filter(isHiddenEntry);
  assert.deepEqual(new Set(hidden.map(e=>`${e.spec.city}:${e.spec.thresholdTenths}`)),new Set(['Seattle:50','Seattle:250','Miami:100']));
  const visible=Object.values(visibleCatalog(catalog)).map(e=>`${e.spec.city}:${e.spec.thresholdTenths}:${e.spec.start}`);
  assert.ok(visible.includes('New York:250:2026-12-14'));
  assert.ok(visible.includes('Chicago:50:2026-12-14'));
  assert.ok(visible.includes('Toronto:100:2026-12-14'));
  assert.ok(visible.includes('Montreal:100:2026-12-14'));
  assert.equal(visible.some(v=>v.startsWith('Seattle:')||v.startsWith('Miami:')),false);
  for(const entry of hidden)assert.ok(catalog[Object.keys(catalog).find(k=>catalog[k]===entry)!]);
});

test('only Montreal and Toronto markets are scored',()=>{
  assert.equal(isLeaderboardMarket({city:'Toronto'}),true);
  assert.equal(isLeaderboardMarket({city:'Montreal'}),true);
  assert.equal(isLeaderboardMarket({city:'New York'}),false);
  assert.equal(isLeaderboardMarket({city:'Chicago'}),false);
});

test('empty until a Montreal or Toronto market settles',()=>{
  const calls=firstCalls([trade({}),trade({market:montreal,wallet:other,direction:1})]);
  assert.deepEqual(scoreLeaderboard(calls,{[toronto]:null,[montreal]:null}),{settled:false,rows:[]});
  assert.equal(settledWinner({resolved:false,winningSide:0}),null);
  assert.equal(settledWinner({resolved:true,winningSide:1}),'yes');
  assert.equal(settledWinner({resolved:true,winningSide:2}),'no');
  assert.throws(()=>settledWinner({resolved:true,winningSide:0}),/Invalid settled winner/);
});

test('first Yes or No buy per wallet per market scores 10, with +5 under 0.30',()=>{
  const laterWrong=trade({signature:'later',direction:1,slot:20,shares:1000000n,volume:5000000n});
  const firstCheapYes=trade({signature:'first',direction:0,slot:5,volume:5000000n,shares:20000000n}); // 0.25
  const rows=scoreLeaderboard(firstCalls([laterWrong,firstCheapYes]),{[toronto]:'yes'});
  assert.deepEqual(rows,{settled:true,rows:[{rank:1,wallet:publicWallet,points:15,correctCalls:1,explorer:'https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet'}]});
  assert.equal(boldBonus(3000000n,10000000n),false); // exactly 0.30
  assert.equal(boldBonus(2999999n,10000000n),true);
  assert.equal(boldBonus(5000000n,0n),false);
});

test('wrong first call, later trades and non-Canadian markets do not score',()=>{
  const calls=firstCalls([
    trade({direction:1,shares:20000000n}), // first call NO, YES wins
    trade({signature:'b',direction:0,slot:20}),
    trade({signature:'c',market:'isZb8kZ7LCrXj5sLgZwhGLFN3iSDrxD81xrTHp7ZnNs',direction:0,shares:20000000n}),
  ]);
  assert.deepEqual(scoreLeaderboard(calls,{[toronto]:'yes'}),{settled:true,rows:[]});
});

test('operator wallets are excluded and ranks follow points',()=>{
  const operator=[...excludedWallets][0];
  const board=scoreLeaderboard([
    {wallet:other,market:toronto,side:'yes',volume:5000000n,shares:10000000n,signature:'a',instruction:0,slot:1}, // 10, no bonus at 0.50
    {wallet:publicWallet,market:toronto,side:'yes',volume:5000000n,shares:20000000n,signature:'b',instruction:0,slot:1}, // 15
    {wallet:publicWallet,market:montreal,side:'no',volume:5000000n,shares:20000000n,signature:'c',instruction:0,slot:2}, // +15
    {wallet:operator,market:toronto,side:'yes',volume:5000000n,shares:20000000n,signature:'d',instruction:0,slot:1},
  ],{[toronto]:'yes',[montreal]:'no'});
  assert.deepEqual(board.rows.map(r=>[r.rank,r.wallet,r.points,r.correctCalls]),[
    [1,publicWallet,30,2],
    [2,other,10,1],
  ]);
  assert.equal(shortenWallet(publicWallet),'1111…1111');
});

test('loadLeaderboard uses on-chain trades and settlements without a database',async()=>{
  let parsed=0;
  const tx=fixtureSwap(0,toronto);
  tx.meta!.innerInstructions![0].instructions.push({program:'spl-token',programId:tx.meta!.innerInstructions![0].instructions[0].programId,parsed:{type:'mintToChecked',info:{mint:tx.transaction.message.accountKeys[3].pubkey.toBase58(),account:tx.transaction.message.accountKeys[7].pubkey.toBase58(),tokenAmount:{amount:'20000000'}}}} as any);
  const rpc={getSignaturesForAddress:async(_:unknown,options:any)=>{
    if(options.before)return [{signature:'creation',err:null}];
    return [{signature:'swap',err:null},{signature:'failed',err:{}}];
  },getParsedTransaction:async()=>{parsed++;return tx;}} as unknown as HistoryRpc;
  const states={[toronto]:{resolved:true,winningSide:1},[montreal]:{resolved:false,winningSide:0}};
  const catalogSlice={[toronto]:{spec:{city:'Toronto'},createdTx:'creation'},[montreal]:{spec:{city:'Montreal'},createdTx:'creation'}};
  const board=await loadLeaderboard(rpc,catalogSlice,states);
  assert.equal(board.settled,true);
  assert.deepEqual(board.rows,[{rank:1,wallet:publicWallet,points:15,correctCalls:1,explorer:'https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet'}]);
  assert.ok(parsed>=1);
  await assert.rejects(loadLeaderboard(rpc,{[toronto]:{spec:{city:'Toronto'},createdTx:'creation'}},{}),/state unavailable/);
});
