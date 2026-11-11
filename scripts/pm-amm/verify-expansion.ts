// Optional live read only. Pace new receipts; do not repeat sends or auto-retry RPC failures.
import {setTimeout as pause} from 'node:timers/promises';
import {PublicKey} from '@solana/web3.js';
import {assertCatalogIdentity} from '../../shared/pm-amm/spec';
import {MINT} from '../../shared/pm-amm/trading';
import {connection,log,logPath,saveJson,readJson,catalogPath,client} from './operator';
const catalog=readJson(catalogPath),run=log();
const entries=Object.entries(catalog).filter(([,e]:any)=>e.spec.start==='2026-12-14') as [string,any][];
const created=new Map(entries.map(([address,e])=>[e.createdTx,{address,entry:e}]));
const transactions=run.transactions.filter((t:any)=>created.has(t.signature)||t.label.startsWith('fund:mid-december:'));
for(const tx of transactions) {
  await pause(1500);
  const receipt=await connection.getTransaction(tx.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if(!receipt?.meta||receipt.meta.err)throw Error(`Receipt unavailable or unsuccessful: ${tx.label}`);
  const sum=(balances:typeof receipt.meta.preTokenBalances,owner:string)=>(balances??[]).filter(b=>b.mint===MINT&&b.owner===owner).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
  const creator=entries[0][1].creator;
  const delta=sum(receipt.meta.postTokenBalances,creator)-sum(receipt.meta.preTokenBalances,creator);
  const creation=created.get(tx.signature);
  if(creation) {
    if(delta!==-400000000n)throw Error('Creation must debit exactly 400 mUSDC');
    const vaultDelta=sum(receipt.meta.postTokenBalances,creation.address)-sum(receipt.meta.preTokenBalances,creation.address);
    if(vaultDelta!==400000000n)throw Error('Market vault must receive exactly 400 mUSDC');
    tx.verifiedSeedRaw=vaultDelta.toString();
  }else if(delta!==1000000000n)throw Error('Funding must credit exactly 1000 mUSDC');
  run.receipts=run.receipts.filter((r:any)=>r.signature!==tx.signature);
  run.receipts.push({label:tx.label,signature:tx.signature,slot:receipt.slot,blockTime:receipt.blockTime,feeLamports:receipt.meta.fee,preTokenBalances:receipt.meta.preTokenBalances,postTokenBalances:receipt.meta.postTokenBalances,creatorMusdcDeltaRaw:delta.toString()});
  saveJson(logPath,run);
  console.log('Finalized receipt verified',tx.label,tx.signature);
}
for(const [address,entry] of entries) {
  await pause(1500);
  const state=await client().fetchMarket(new PublicKey(address));
  if(!state)throw Error('New market account unavailable');
  assertCatalogIdentity(entry,state,MINT);
  run.markets[address]={authority:state.authority.toBase58(),collateralMint:state.collateralMint.toBase58(),endTs:state.endTs.toNumber(),resolved:state.resolved,winningSide:state.winningSide};
}
run.expansion.verifiedAt=new Date().toISOString();saveJson(logPath,run);
console.log('Expansion receipts and exact market identities verified',entries.length);
