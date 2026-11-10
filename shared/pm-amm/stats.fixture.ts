import {PublicKey,type ParsedTransactionWithMeta} from '@solana/web3.js';
import bs58 from 'bs58';
import {MINT,PROGRAM} from './trading';
export const fixtureMarket='CHHaCqtcqe8i6NUM7WZdB2pfxn5fqEUx2b4DTq1RL3hS';
export const fixtureWallet='11111111111111111111111111111111';
export function fixtureSwap(direction=0,marketAddress=fixtureMarket) {
 const a=[fixtureWallet,marketAddress,MINT,...Array.from({length:9},(_,i)=>new PublicKey(new Uint8Array(32).fill(i+1)).toBase58())];
 const data=new Uint8Array(25);data.set([248,198,158,145,225,117,135,200,direction]);new DataView(data.buffer).setBigUint64(9,5000000n,true);
 const transfer=(source:string,destination:string,amount:string)=>({program:'spl-token',programId:new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),parsed:{type:'transferChecked',info:{source,destination,mint:MINT,tokenAmount:{amount}}}});
 const transfers=direction<2?[transfer(a[6],a[5],'4900000'),transfer(a[6],a[9],'50000'),transfer(a[6],a[10],'50000')]:direction<4?[transfer(a[5],a[6],'4900000'),transfer(a[5],a[9],'50000'),transfer(a[5],a[10],'50000')]:[];
 return {meta:{err:null,innerInstructions:[{index:0,instructions:transfers}]},transaction:{message:{accountKeys:a.map(k=>({pubkey:new PublicKey(k),signer:true,writable:true})),instructions:[{programId:new PublicKey(PROGRAM),accounts:a.map(k=>new PublicKey(k)),data:bs58.encode(data)}]}}} as unknown as ParsedTransactionWithMeta;
}
