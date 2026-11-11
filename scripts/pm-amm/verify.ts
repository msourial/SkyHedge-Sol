import {assertCatalogIdentity} from '../../shared/pm-amm/spec';
import {MINT} from '../../shared/pm-amm/trading';
import {PublicKey} from '@solana/web3.js';
import {connection, readJson, saveJson, catalogPath, log, logPath, client} from './operator';
const run=log();
run.receipts=[];
for (const tx of run.transactions) {
  const receipt=await connection.getTransaction(tx.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if (!receipt || !receipt.meta || receipt.meta.err) throw Error(`Transaction not finalized successfully: ${tx.label}`);
  if (tx.label.startsWith('collect:') || tx.label.startsWith('creator-winnings:')) {
    const address=tx.label.split(':')[1], m=await client().fetchMarket(new PublicKey(address));
    if (!m || !m.resolved) throw Error('Redemption market must be resolved');
    const payer=receipt.transaction.message.getAccountKeys().staticAccountKeys[0].toBase58();
    const winner=(m.winningSide===1?m.yesMint:m.noMint).toBase58();
    const sum=(items: typeof receipt.meta.preTokenBalances, mint: string)=> (items??[]).filter(b=>b.owner===payer && b.mint===mint).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
    const burned=sum(receipt.meta.preTokenBalances,winner)-sum(receipt.meta.postTokenBalances,winner);
    const paid=sum(receipt.meta.postTokenBalances,MINT)-sum(receipt.meta.preTokenBalances,MINT);
    if (burned<=0n || paid!==burned) throw Error(`Winning token burn/payout mismatch: ${tx.label}`);
    tx.verifiedPayoutRaw=paid.toString();
  }
  run.receipts.push({label:tx.label,signature:tx.signature,slot:receipt.slot,blockTime:receipt.blockTime,feeLamports:receipt.meta.fee,preTokenBalances:receipt.meta.preTokenBalances,postTokenBalances:receipt.meta.postTokenBalances});
}
run.markets={};
for (const [address,entry] of Object.entries(readJson(catalogPath)) as [string,any][]) {
  const m=await client().fetchMarket(new PublicKey(address));
  if (!m) throw Error(`Missing market: ${address}`);
  assertCatalogIdentity(entry,m,MINT);
  run.markets[address]={authority:m.authority.toBase58(),collateralMint:m.collateralMint.toBase58(),endTs:m.endTs.toNumber(),resolved:m.resolved,winningSide:m.winningSide};
}
run.verifiedAt=new Date().toISOString();saveJson(logPath,run);
console.log('Finalized receipts verified',run.receipts.length);
