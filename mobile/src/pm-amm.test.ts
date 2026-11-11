import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import BN from 'bn.js';
import {Connection,PublicKey,ComputeBudgetProgram,TransactionMessage} from '@solana/web3.js';
import {ASSOCIATED_TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {deriveYesMint,deriveNoMint,type MarketAccount} from '@pm-amm/sdk';
import catalog from '../../shared/pm-amm/markets.devnet.json';
import {PROGRAM,MINT,RPC} from '../../shared/pm-amm/trading.ts';
import {assertControlledWallet,createBuyReview,checkBuyReview,QuoteChangedError,buildPmAmmBuyTransaction,submitPmAmmBuy,buildPmAmmClaimTransaction,submitPmAmmClaim,reconcilePendingSend,type PendingStore,type PendingMarker} from './pm-amm/transactions.ts';
const address=Object.keys(catalog)[0],entry=Object.values(catalog)[0],owner=new PublicKey(entry.creator);
const fixed=(n:number)=>new BN(BigInt(Math.round(n*2**32)).toString()).shln(16);
function state():MarketAccount {
  const now=Math.floor(Date.now()/1000),end=entry.spec.endTs;
  return {name:[...new TextEncoder().encode(entry.name)],authority:owner,collateralMint:new PublicKey(MINT),yesMint:deriveYesMint(new PublicKey(PROGRAM),new PublicKey(address)),noMint:deriveNoMint(new PublicKey(PROGRAM),new PublicKey(address)),endTs:new BN(end),lastAccrualTs:new BN(now),lZero:fixed(100e6/.3989422804014327/Math.sqrt(end-now)),reserveYes:fixed(100e6),reserveNo:fixed(100e6),resolved:false,winningSide:0} as MarketAccount;
}
function mockConnection() {
  const connection=new Connection(RPC,'confirmed');
  connection.getMultipleAccountsInfo=async addresses=>addresses.map(()=>null);
  connection.getLatestBlockhash=async()=>({blockhash:'11111111111111111111111111111111',lastValidBlockHeight:1});
  return connection;
}
function store() {let marker:PendingMarker|null=null;return {get:async()=>marker,set:async(_owner:string,value:PendingMarker)=>{marker=value;},remove:async()=>{marker=null;}} satisfies PendingStore;}
const review=(s=state())=>createBuyReview({owner:owner.toBase58(),market:address,state:s,direction:'usdcToYes',amountRaw:1e6});
test('review detects state, fee and output changes and wallet switches',()=>{
  const s=state(),r=review(s);assert.ok(checkBuyReview(r,s,owner.toBase58()));
  assert.throws(()=>checkBuyReview(r,{...s,reserveYes:s.reserveYes.addn(1)},owner.toBase58()),QuoteChangedError);
  assert.throws(()=>checkBuyReview({...r,quote:{...r.quote,fee:r.quote.fee+1}},s,owner.toBase58()),QuoteChangedError);
  assert.throws(()=>checkBuyReview({...r,quote:{...r.quote,minimum:Number.MAX_SAFE_INTEGER}},s,owner.toBase58()),QuoteChangedError);
  assert.throws(()=>checkBuyReview(r,s,MINT),/wallet changed/);
});
test('buy uses SDK program, owner, compute budget and missing token ATAs',async()=>{
  const s=state(),r=review(s),connection=mockConnection();
  const tx=await buildPmAmmBuyTransaction({connection,owner,market:address,state:s,direction:'usdcToYes',amountRaw:r.quote.amount,minimum:r.quote.minimum});
  const instructions=TransactionMessage.decompile(tx.message).instructions;
  assert.ok(instructions[0].programId.equals(ComputeBudgetProgram.programId));
  assert.ok(instructions.filter(ix=>ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).length>=4);
  const swap=instructions.at(-1)!;assert.equal(swap.programId.toBase58(),PROGRAM);assert.ok(swap.keys.some(k=>k.pubkey.equals(owner)&&k.isSigner));
});
test('pending marker precedes signer, uncertain failure persists, decline clears and success clears',async()=>{
  const s=state(),r=review(s),connection=mockConnection(),pending=store();
  const base={connection,owner,review:r,store:pending,fetchMarket:async()=>s};
  await assert.rejects(submitPmAmmBuy({...base,sign:async()=>{assert.ok(await pending.get());throw Error('RPC timeout');}}),/timeout/);
  await assert.rejects(submitPmAmmBuy({...base,sign:async()=>{throw Error('must not sign');}}),/previous send/);
  await pending.remove();
  await assert.rejects(submitPmAmmBuy({...base,sign:async()=>{throw Error('User rejected');}}),/rejected/);assert.equal(await pending.get(),null);
  assert.equal(await submitPmAmmBuy({...base,sign:async()=> 'confirmed-signature'}),'confirmed-signature');assert.equal(await pending.get(),null);
});
test('wallet change during durable write clears unsent marker',async()=>{
  const s=state(),pending=store();let current=owner.toBase58();const original=pending.set;
  pending.set=async(a,v)=>{await original(a,v);current=MINT;};
  await assert.rejects(submitPmAmmBuy({connection:mockConnection(),owner,review:review(s),store:pending,fetchMarket:async()=>s,getOwner:()=>current,sign:async()=>{throw Error('must not sign');}}),/wallet changed/);
  assert.equal(await pending.get(),null);
});
test('harness rejects unknown wallet and other networks',()=>{
  assert.doesNotThrow(()=>assertControlledWallet(entry.creator));
  assert.throws(()=>assertControlledWallet(MINT),/controlled-wallet/);
  assert.throws(()=>assertControlledWallet(entry.creator,'https://api.mainnet-beta.solana.com'),/Devnet/);
});

test('claim uses SDK instruction, creates missing accounts and refuses zero winning balance',async()=>{
  const s={...state(),resolved:true,winningSide:1} as MarketAccount,connection=mockConnection();
  const tx=await buildPmAmmClaimTransaction({connection,owner,market:address,state:s});
  const instructions=TransactionMessage.decompile(tx.message).instructions,claim=instructions.at(-1)!;
  assert.ok(instructions[0].programId.equals(ComputeBudgetProgram.programId));
  assert.equal(instructions.filter(ix=>ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).length,3);
  assert.equal(claim.programId.toBase58(),PROGRAM);
  assert.deepEqual(claim.data.subarray(0,8),createHash('sha256').update('global:claim_winnings').digest().subarray(0,8));
  assert.ok(claim.keys.some(k=>k.pubkey.equals(owner)&&k.isSigner));
  const base={connection,owner,market:address,store:store(),fetchMarket:async()=>s,sign:async()=> 'claim-confirmed'};
  await assert.rejects(submitPmAmmClaim({...base,loadShareBalances:async()=>({yes:0n,no:100n})}),/No winning shares/);
  assert.equal(await submitPmAmmClaim({...base,loadShareBalances:async()=>({yes:100n,no:0n})}),'claim-confirmed');
});
test('uncertain confirmation retains signature for later chain checks',async()=>{
  const s=state(),pending=store();
  await assert.rejects(submitPmAmmBuy({connection:mockConnection(),owner,review:review(s),store:pending,fetchMarket:async()=>s,sign:async()=>{throw Object.assign(Error('Confirmation timed out'),{signature:'sent-signature'});}}),/timed out/);
  assert.equal((await pending.get())?.signature,'sent-signature');
});
test('same-wallet concurrent calls cannot both reach signer',async()=>{
  const s=state(),pending=store();let release:()=>void=()=>{};const wait=new Promise<void>(resolve=>{release=resolve;});let entered:()=>void=()=>{};const reached=new Promise<void>(resolve=>{entered=resolve;});
  const base={connection:mockConnection(),owner,review:review(s),store:pending,fetchMarket:async()=>s};
  const first=submitPmAmmBuy({...base,sign:async()=>{entered();await wait;return 'confirmed';}});await reached;
  await assert.rejects(submitPmAmmBuy({...base,sign:async()=> 'must-not-sign'}),/already pending/);release();await first;
});

test('reconciliation clears only finalized outcomes and retains uncertain markers',async()=>{
  const connection=mockConnection(),pending=store(),marker={market:address,kind:'buy' as const,createdAt:1,signature:'sent'};
  for (const stage of ['processed','confirmed','finalized'] as const) {
    await pending.set(owner.toBase58(),marker);
    connection.getSignatureStatuses=async()=>({context:{slot:1},value:[{slot:1,confirmations:stage==='finalized'?null:1,err:null,confirmationStatus:stage}]});
    const result=await reconcilePendingSend({connection,owner:owner.toBase58(),store:pending});
    assert.equal(result.status,stage==='finalized'?'finalized':'pending');
    assert.equal(await pending.get(),stage==='finalized'?null:marker);
  }
  await pending.set(owner.toBase58(),marker);
  connection.getSignatureStatuses=async()=>({context:{slot:1},value:[{slot:1,confirmations:null,err:{InstructionError:[0,'Custom']},confirmationStatus:'finalized'}]});
  assert.equal((await reconcilePendingSend({connection,owner:owner.toBase58(),store:pending})).status,'failed');assert.equal(await pending.get(),null);
  await pending.set(owner.toBase58(),marker);
  connection.getSignatureStatuses=async()=>({context:{slot:1},value:[null]});
  assert.equal((await reconcilePendingSend({connection,owner:owner.toBase58(),store:pending})).status,'unknown');assert.ok(await pending.get());
  connection.getSignatureStatuses=async()=>{throw Error('offline');};
  assert.equal((await reconcilePendingSend({connection,owner:owner.toBase58(),store:pending})).status,'unavailable');assert.ok(await pending.get());
  await pending.set(owner.toBase58(),{...marker,signature:undefined});
  assert.equal((await reconcilePendingSend({connection,owner:owner.toBase58(),store:pending})).status,'unknown');assert.ok(await pending.get());
});
test('harness file markers use wallet identity and atomic acquisition across processes',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
  const {createFilePendingStore}=await import('../tools/pm-amm-pending-store.ts');
  const directory=await mkdtemp(join(tmpdir(),'seeker-pending-test-'));
  try {
    const first=createFilePendingStore(directory),second=createFilePendingStore(directory),wallet=owner.toBase58(),marker={market:address,kind:'buy' as const,createdAt:1};
    await first.set(wallet,marker);assert.deepEqual(await second.get(wallet),marker);
    await assert.rejects(second.set(wallet,marker),{code:'EEXIST'});
    await assert.rejects(second.remove(wallet),/another process/);
    await first.set(wallet,{...marker,signature:'sent'});assert.equal((await second.get(wallet))?.signature,'sent');
    await first.remove(wallet);assert.equal(await second.get(wallet),null);
    await second.set(wallet,marker);await second.remove(wallet);
  } finally {await rm(directory,{recursive:true,force:true});}
});
