import {ComputeBudgetProgram, Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {buildSwap, buildClaimWinnings, CU, PmAmmClient, PROTOCOL_DAO, type MarketAccount, type IxContext} from '@pm-amm/sdk';
import {createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync} from '@solana/spl-token';
import {MINT, PROGRAM, RPC, quote, quoteStateKey, payout} from '../../../shared/pm-amm/trading.ts';
import {assertCatalogIdentity} from '../../../shared/pm-amm/spec.ts';
import catalogJson from '../../../shared/pm-amm/markets.devnet.json';
import controlled from '../../../shared/pm-amm/controlled-wallets.json';
import {isWalletDecline} from '../covered.ts';

export type BuyDirection = 'usdcToYes' | 'usdcToNo';
export type BuyReview = {owner:string;market:string;stateKey:string;quote:ReturnType<typeof quote>};
export type PendingMarker = {market:string;kind:'buy'|'claim';createdAt:number;signature?:string};
export interface PendingStore {get(owner:string):Promise<PendingMarker|null>;set(owner:string,value:PendingMarker):Promise<void>;remove(owner:string):Promise<void>}
export type Signer = (transaction:VersionedTransaction)=>Promise<string>;
const catalog = catalogJson as Record<string, {spec:Parameters<typeof assertCatalogIdentity>[0]['spec'];name:string;creator:string}>;
export function assertDevnet(connection:Pick<Connection,'rpcEndpoint'>) {
  if (connection.rpcEndpoint !== RPC) throw Error('Only the configured Solana Devnet RPC is supported');
}
export function assertControlledWallet(owner:string, rpc:string = RPC) {
  assertDevnet({rpcEndpoint:rpc});
  if (!controlled.some(entry=>entry.publicKey===owner)) throw Error('Trader wallet is not in the controlled-wallet list');
}
function validateMarket(address:string,state:MarketAccount) {
  const entry=catalog[address];
  if (!entry) throw Error('Market is not in the Devnet catalog');
  assertCatalogIdentity(entry,state,MINT);
}
export function createBuyReview(input:{owner:string;market:string;state:MarketAccount;direction:BuyDirection;amountRaw:number;now?:number}):BuyReview {
  if (input.direction!=='usdcToYes' && input.direction!=='usdcToNo') throw Error('Choose Yes or No');
  validateMarket(input.market,input.state);
  return {owner:input.owner,market:input.market,stateKey:quoteStateKey(input.state),quote:quote(input.state,input.direction,input.amountRaw,input.now)};
}
export class QuoteChangedError extends Error {
  review:BuyReview;
  constructor(review:BuyReview) {super('Quote updated. Review the new shares and approve again.');this.name='QuoteChangedError';this.review=review;}
}
export function checkBuyReview(review:BuyReview,state:MarketAccount,owner:string,now?:number):BuyReview {
  if (review.owner!==owner) throw Error('The active wallet changed. Review again.');
  const fresh=createBuyReview({owner,market:review.market,state,direction:review.quote.direction as BuyDirection,amountRaw:review.quote.amount,now});
  if (fresh.stateKey!==review.stateKey || fresh.quote.out<review.quote.minimum || fresh.quote.fee!==review.quote.fee) throw new QuoteChangedError(fresh);
  return fresh;
}
function reader(connection:Connection) {return PmAmmClient.readOnly(connection,new PublicKey(PROGRAM),new PublicKey(MINT));}
async function requiredAtas(connection:Connection,owner:PublicKey,state:MarketAccount,fees:boolean) {
  const pairs=[{owner,mint:state.yesMint},{owner,mint:state.noMint},{owner,mint:state.collateralMint}];
  if (fees) {pairs.push({owner:PROTOCOL_DAO,mint:state.collateralMint});if (!state.authority.equals(owner)) pairs.push({owner:state.authority,mint:state.collateralMint});}
  const unique=[...new Map(pairs.map(p=>[getAssociatedTokenAddressSync(p.mint,p.owner,true).toBase58(),p])).values()];
  const addresses=unique.map(p=>getAssociatedTokenAddressSync(p.mint,p.owner,true));
  const infos=await connection.getMultipleAccountsInfo(addresses);
  return unique.flatMap((p,i)=>infos[i]?[]:[createAssociatedTokenAccountIdempotentInstruction(owner,addresses[i],p.owner,p.mint)]);
}
async function assemble(connection:Connection,owner:PublicKey,state:MarketAccount,market:PublicKey,swap?:{direction:BuyDirection;amountRaw:number;minimum:number}) {
  assertDevnet(connection);validateMarket(market.toBase58(),state);
  const client=reader(connection),ctx:IxContext={program:client.program,programId:client.programId,collateralMint:client.collateralMint,metaplexProgramId:client.metaplexProgramId};
  const pre=await requiredAtas(connection,owner,state,Boolean(swap));
  const ix=swap?await buildSwap(ctx,{signer:owner,market,direction:swap.direction,amountIn:swap.amountRaw,minOutput:swap.minimum,creatorAuthority:state.authority,collateralMint:state.collateralMint}):await buildClaimWinnings(ctx,{signer:owner,market,collateralMint:state.collateralMint});
  const block=await connection.getLatestBlockhash('confirmed');
  return new VersionedTransaction(new TransactionMessage({payerKey:owner,recentBlockhash:block.blockhash,instructions:[ComputeBudgetProgram.setComputeUnitLimit({units:CU.HEAVY}),...pre,ix]}).compileToV0Message());
}
export async function buildPmAmmBuyTransaction(input:{connection:Connection;owner:PublicKey;market:string;state:MarketAccount;direction:BuyDirection;amountRaw:number;minimum:number}) {
  if (!Number.isSafeInteger(input.minimum)||input.minimum<=0) throw Error('Invalid minimum received');
  return assemble(input.connection,input.owner,input.state,new PublicKey(input.market),input);
}
export async function buildPmAmmClaimTransaction(input:{connection:Connection;owner:PublicKey;market:string;state:MarketAccount}) {
  if (!input.state.resolved) throw Error('Settlement is not ready');
  return assemble(input.connection,input.owner,input.state,new PublicKey(input.market));
}
// Serialize concurrent attempts within this JS runtime, then use persistent storage across restarts.
const active=new Set<string>();
async function guardedSend(input:{owner:PublicKey;market:string;store:PendingStore;sign:Signer;getOwner?:()=>string|null;kind:'buy'|'claim';prepare:()=>Promise<VersionedTransaction>}) {
  const owner=input.owner.toBase58();
  if (active.has(owner)) throw Error('A transaction is already pending for this wallet');
  active.add(owner);
  try {
    if (await input.store.get(owner)) throw Error('A previous send needs checking in your wallet before another transaction');
    const tx=await input.prepare();
    if (input.getOwner && input.getOwner()!==owner) throw Error('The active wallet changed. Review again.');
    await input.store.set(owner,{market:input.market,kind:input.kind,createdAt:Date.now()});
    if (input.getOwner && input.getOwner()!==owner) {await input.store.remove(owner);throw Error('The active wallet changed. Review again.');}
    try {
      const signature=await input.sign(tx);
      await input.store.set(owner,{market:input.market,kind:input.kind,createdAt:Date.now(),signature});
      // The signer contract returns only after confirmed success. Uncertain sends throw and retain the marker.
      await input.store.remove(owner);
      return signature;
    } catch(error) {
      if (error && typeof error==='object' && 'signature' in error && typeof error.signature==='string') await input.store.set(owner,{market:input.market,kind:input.kind,createdAt:Date.now(),signature:error.signature});
      if (isWalletDecline(error instanceof Error?error.message:String(error))) await input.store.remove(owner);
      throw error;
    }
  } finally {active.delete(owner);}
}
export async function submitPmAmmBuy(input:{connection:Connection;owner:PublicKey;review:BuyReview;store:PendingStore;sign:Signer;getOwner?:()=>string|null;fetchMarket?:(market:PublicKey)=>Promise<MarketAccount|null>}) {
  assertDevnet(input.connection);
  return guardedSend({...input,market:input.review.market,kind:'buy',prepare:async()=>{
    const client=reader(input.connection);
    const state=await (input.fetchMarket??client.fetchMarket.bind(client))(new PublicKey(input.review.market));
    if (!state) throw Error('Market not found');
    checkBuyReview(input.review,state,input.owner.toBase58());
    return buildPmAmmBuyTransaction({...input,market:input.review.market,state,direction:input.review.quote.direction as BuyDirection,amountRaw:input.review.quote.amount,minimum:input.review.quote.minimum});
  }});
}
export async function submitPmAmmClaim(input:{connection:Connection;owner:PublicKey;market:string;store:PendingStore;sign:Signer;getOwner?:()=>string|null;fetchMarket?:(market:PublicKey)=>Promise<MarketAccount|null>;loadShareBalances?:()=>Promise<{yes:bigint;no:bigint}>}) {
  assertDevnet(input.connection);
  return guardedSend({...input,kind:'claim',prepare:async()=>{
    const client=reader(input.connection);
    const state=await (input.fetchMarket??client.fetchMarket.bind(client))(new PublicKey(input.market));
    if (!state) throw Error('Market not found');
    const atas=[state.yesMint,state.noMint].map(m=>getAssociatedTokenAddressSync(m,input.owner));
    const {unpackAccount}=await import('@solana/spl-token');
    const infos=await input.connection.getMultipleAccountsInfo(atas);
    const supplied=input.loadShareBalances?await input.loadShareBalances():null;
    const balances=supplied?[supplied.yes,supplied.no]:infos.map((info,i)=>info?unpackAccount(atas[i],info).amount:0n);
    if (payout(state,balances[0],balances[1])<=0n) throw Error('No winning shares to collect');
    return buildPmAmmClaimTransaction({...input,state});
  }});
}

/** Checking a prior send never broadcasts or authorizes a replacement transaction. */
export async function reconcilePendingSend(input:{connection:Connection;owner:string;store:PendingStore}):Promise<{marker:PendingMarker|null;status:'none'|'unknown'|'pending'|'finalized'|'failed'|'unavailable'}> {
  assertDevnet(input.connection);
  if (active.has(input.owner)) return {marker:await input.store.get(input.owner),status:'pending'};
  active.add(input.owner);
  try {
    const marker=await input.store.get(input.owner);
    if (!marker) return {marker:null,status:'none'};
    if (!marker.signature) return {marker,status:'unknown'};
    try {
      const result=await input.connection.getSignatureStatuses([marker.signature],{searchTransactionHistory:true});
      const chain=result.value[0];
      if (!chain) return {marker,status:'unknown'};
      if (chain.confirmationStatus!=='finalized') return {marker,status:'pending'};
      await input.store.remove(input.owner);
      return {marker:null,status:chain.err?'failed':'finalized'};
    } catch {return {marker,status:'unavailable'};}
  } finally {active.delete(input.owner);}
}
