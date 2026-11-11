import {PublicKey} from '@solana/web3.js';
import {connection, readJson, saveJson, catalogPath} from './operator';
import {assertCatalogIdentity} from '../../shared/pm-amm/spec';
import {MINT,rawAmount} from '../../shared/pm-amm/trading';
const file='docs/pm-amm-web/browser.devnet.json',run=readJson(file);
const owner=new PublicKey(run.wallet).toBase58(),catalog=readJson(catalogPath);
const {client}=await import('./operator');
run.fundingReceipts=[];
for(const funding of run.funding) {
  if(!funding.signature)continue;
  const r=await connection.getTransaction(funding.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if(!r?.meta||r.meta.err)throw Error('Browser funding not finalized successfully');
  run.fundingReceipts.push({signature:funding.signature,slot:r.slot,feeLamports:r.meta.fee});
}
run.receipts=[];
for(const t of run.transactions) {
  const signature=new URL(t.explorer).pathname.split('/').at(-1)!;
  const receipt=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if(!receipt?.meta||receipt.meta.err)throw Error('Browser trade not finalized successfully');
  const pre=receipt.meta.preTokenBalances??[],post=receipt.meta.postTokenBalances??[];
  const sum=(items:typeof pre,mint:string)=>items.filter(b=>b.owner===owner&&b.mint===mint).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
  const spent=sum(pre,MINT)-sum(post,MINT);
  const entry=catalog[t.market];
  if(!entry||!['usdcToYes','usdcToNo'].includes(t.direction)||!Number.isSafeInteger(t.inputRaw)||t.inputRaw<=0)throw Error('Missing or invalid expected trade identity');
  const state=await client().fetchMarket(new PublicKey(t.market));if(!state)throw Error('Missing expected trade market');
  assertCatalogIdentity(entry,state,MINT);
  const mint=(t.direction==='usdcToYes'?state.yesMint:state.noMint).toBase58();
  const receivedRaw=sum(post,mint)-sum(pre,mint);
  const review=t.review;
  const min=typeof review==='string'?review.match(/Minimum received\n([\d,.]+) shares/):null;
  if(spent!==BigInt(t.inputRaw)||receivedRaw<=0n||!min||receivedRaw<BigInt(rawAmount(min[1].replaceAll(',',''))))throw Error('Browser input/output/minimum receipt mismatch');
  run.receipts.push({signature,slot:receipt.slot,feeLamports:receipt.meta.fee,musdcSpentRaw:spent.toString(),market:t.market,direction:t.direction,received:[{mint,raw:receivedRaw.toString()}],minimumRaw:rawAmount(min[1].replaceAll(',','')).toString()});
}
run.verifiedAt=new Date().toISOString();saveJson(file,run);
console.log('Verified browser trades',run.receipts.length);
