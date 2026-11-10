import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey,type ParsedTransactionWithMeta} from '@solana/web3.js';
import bs58 from 'bs58';
import {aggregateTrades,statsUnits,excludedWallets,explorerAccount,explorerTransaction,tradesFromTransaction,loadMarketTrades,type HistoryRpc} from './stats';
import {MINT,PROGRAM} from './trading';
const market='CHHaCqtcqe8i6NUM7WZdB2pfxn5fqEUx2b4DTq1RL3hS';
const publicWallet='11111111111111111111111111111111';
export function fixtureSwap(direction=0) {
 const a=[publicWallet,market,MINT,...Array.from({length:9},(_,i)=>new PublicKey(new Uint8Array(32).fill(i+1)).toBase58())];
 const data=new Uint8Array(25);data.set([248,198,158,145,225,117,135,200,direction]);new DataView(data.buffer).setBigUint64(9,5000000n,true);
 const transfer=(source:string,destination:string,amount:string)=>({program:'spl-token',programId:new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),parsed:{type:'transferChecked',info:{source,destination,mint:MINT,tokenAmount:{amount}}}});
 const transfers=direction<2?[transfer(a[6],a[5],'4900000'),transfer(a[6],a[9],'50000'),transfer(a[6],a[10],'50000')]:direction<4?[transfer(a[5],a[6],'4900000'),transfer(a[5],a[9],'50000'),transfer(a[5],a[10],'50000')]:[];
 return {meta:{err:null,innerInstructions:[{index:0,instructions:transfers}]},transaction:{message:{accountKeys:a.map(k=>({pubkey:new PublicKey(k),signer:true,writable:true})),instructions:[{programId:new PublicKey(PROGRAM),accounts:a.map(k=>new PublicKey(k)),data:bs58.encode(data)}]}}} as unknown as ParsedTransactionWithMeta;
}
test('exclusions, unique wallets across markets, exact sums, deduplication and zero',()=>{
 assert.equal(excludedWallets.size,3);
 const r={signature:'a',instruction:0,market,wallet:publicWallet,volume:5000000n,fee:100000n};
 const records=[r,r,{...r,signature:'b',market:'another'},{...r,signature:'c',wallet:[...excludedWallets][0]}];
 assert.deepEqual(aggregateTrades(records),{wallets:[publicWallet],trades:2,volume:10000000n,fee:200000n});
 assert.deepEqual(aggregateTrades([]),{wallets:[],trades:0,volume:0n,fee:0n});
 assert.equal(aggregateTrades([{...r,wallet:'future burner'}]).trades,1);
});
test('working devnet Explorer routes and escaping',()=>{
 assert.equal(explorerAccount(market),`https://explorer.solana.com/address/${market}?cluster=devnet`);
 assert.equal(explorerTransaction('a/b'),'https://explorer.solana.com/tx/a%2Fb?cluster=devnet');
});
test('observed buys, sells, outcome swaps, failed swaps and deposits',()=>{
 for(const direction of [0,1,2,3,4,5]) {
  const [r]=tradesFromTransaction(fixtureSwap(direction),'sig',market);
  assert.equal(r.volume,direction<4?5000000n:0n);assert.equal(r.fee,direction<4?100000n:0n);
 }
 const tx=fixtureSwap();tx.meta!.err={InstructionError:[0,'InvalidArgument']};assert.deepEqual(tradesFromTransaction(tx,'sig',market),[]);
 const deposit=fixtureSwap();(deposit.transaction.message.instructions[0] as any).data=bs58.encode(new Uint8Array(25));assert.deepEqual(tradesFromTransaction(deposit,'sig',market),[]);
 assert.deepEqual(tradesFromTransaction(fixtureSwap(),'sig',publicWallet),[]);
});
test('missing transfers fail rather than inventing zero',()=>{
 const tx=fixtureSwap();tx.meta!.innerInstructions=[];
 assert.throws(()=>tradesFromTransaction(tx,'sig',market),/mismatch/);
});
test('history pagination, creation boundary, failed signatures and missing history',async()=>{
 let calls=0;
 const rpc={getSignaturesForAddress:async(_:unknown,options:any)=>{calls++;return options.before?[{signature:'creation',err:null}]:[{signature:'swap',err:null},{signature:'failed',err:{}}];},getParsedTransaction:async()=>fixtureSwap()} as unknown as HistoryRpc;
 assert.equal((await loadMarketTrades(rpc,market,'creation')).length,1);assert.equal(calls,2);
 await assert.rejects(loadMarketTrades({...rpc,getSignaturesForAddress:async()=>[]},market,'creation'),/incomplete/);
 await assert.rejects(loadMarketTrades({...rpc,getParsedTransaction:async()=>null},market,'creation'),/unavailable/);
});
test('CPI subtree excludes sibling transfers; missing stack metadata refuses',()=>{
 const tx=fixtureSwap(2), swapIx=tx.transaction.message.instructions[0];
 const transfers=tx.meta!.innerInstructions![0].instructions;
 const sibling={...transfers[0],parsed:structuredClone((transfers[0] as any).parsed)} as any;sibling.parsed.info.tokenAmount.amount='9000000';sibling.stackHeight=2;
 tx.transaction.message.instructions=[{programId:new PublicKey(publicWallet),accounts:[],data:''}];
 tx.meta!.innerInstructions![0].instructions=[{...swapIx,stackHeight:2} as any,...transfers.map(ix=>({...ix,stackHeight:3})),sibling];
 const [r]=tradesFromTransaction(tx,'sig',market);assert.equal(r.volume,5000000n);assert.equal(r.fee,100000n);
 delete (tx.meta!.innerInstructions![0].instructions[1] as any).stackHeight;
 assert.throws(()=>tradesFromTransaction(tx,'sig',market),/stack attribution/);
});
test('incomplete sell fee instructions refuse rather than understating gross amounts',()=>{
 const tx=fixtureSwap(2);tx.meta!.innerInstructions![0].instructions[1]={programId:new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),accounts:[],data:'1'};
 assert.throws(()=>tradesFromTransaction(tx,'sig',market),/Unparsed token/);
});

test('stats formatting preserves exact raw precision above Number safe range',()=>{assert.equal(statsUnits(9007199254740993n),'9,007,199,254.740993');assert.equal(statsUnits(0n),'0');});
