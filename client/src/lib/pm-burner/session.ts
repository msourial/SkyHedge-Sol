import {useCallback, useEffect, useMemo, useState} from 'react';
import bs58 from 'bs58';
import {Keypair} from '@solana/web3.js';
import {getAssociatedTokenAddressSync, unpackAccount} from '@solana/spl-token';
import {connection} from '../pm-amm';
import {createBurnerClient, DEVNET, ensureFunded, exportBurner, loadOrCreateBurner, LOW, importBurner, type Balances} from './burner';
const STORAGE='skyhedge-pm-devnet-wallet';
/** Guarded lifecycle around the unmodified official kit; never retries funding automatically. */
export function useBurnerSession() {
  const [kp,setKp]=useState<Keypair|null>(null),[balances,setBalances]=useState<Balances|null>(null);
  const [status,setStatus]=useState<'loading'|'funding'|'ready'|'error'>('loading'),[error,setError]=useState('');
  useEffect(()=>{try{setKp(loadOrCreateBurner(STORAGE));}catch{setStatus('error');setError('Browser storage is unavailable. Allow local storage or use Phantom.');}},[]);
  const publicKey=useMemo(()=>kp?.publicKey??null,[kp]);
  const client=useMemo(()=>kp?createBurnerClient(connection,kp):null,[kp]);
  const read=useCallback(async()=> {
    if(!publicKey)return null;
    // Distinguish an absent ATA from an RPC failure before kit's absent-account fallback.
    const ata=getAssociatedTokenAddressSync(DEVNET.usdcMint,publicKey);
    const [[info],lamports]=await Promise.all([connection.getMultipleAccountsInfo([ata]),connection.getBalance(publicKey)]);
    return {sol:lamports/1e9,usdc:info?Number(unpackAccount(ata,info).amount)/1e6:0};
  },[publicKey]);
  useEffect(()=> {
    if(!publicKey)return;let cancelled=false;
    setStatus('funding');setError('');setBalances(null);
    (async()=> {
      let b=await read();if(!b)return;
      if(b.sol<LOW.sol||b.usdc<LOW.usdc) {
        const key='skyhedge-pm-faucet:'+publicKey.toBase58(),previous=Number(localStorage.getItem(key));
        if(previous && Date.now()-previous<3600000) {
          if(!cancelled){setBalances(b);setStatus(b.sol>0&&b.usdc>0?'ready':'error');setError('The faucet was already requested for this wallet. Wait until its hourly limit resets; no automatic retry will run.');}return;
        }
        localStorage.setItem(key,String(Date.now()));
        const funded=await ensureFunded(connection,publicKey);b=await read();if(!b)return;
        if(funded.fund&&!funded.fund.funded) {
          if(!cancelled){setBalances(b);setStatus(b.sol>0&&b.usdc>0?'ready':'error');setError(`Devnet faucet: ${funded.fund.reason}. Wait before trying again; no automatic retry will run.`);}return;
        }
      }
      if(!cancelled){setBalances(b);setStatus('ready');}
    })().catch(e=>{if(!cancelled){setStatus('error');setError(`Wallet setup unavailable: ${e instanceof Error?e.message:String(e)}. Refresh later or use Phantom.`);}});
    return()=>{cancelled=true;};
  },[publicKey,read]);
  const refresh=useCallback(async()=>{try{const b=await read();if(b)setBalances(b);}catch(e){setError(`Balance unavailable: ${e instanceof Error?e.message:String(e)}`);setBalances(null);}},[read]);
  return {publicKey,client,balances,status,error,refresh,exportKey:()=>{try{return exportBurner(STORAGE);}catch{setError('Cannot export: browser storage is unavailable. Keep this page open and restore storage access.');return null;}},reset:()=>{try{const next=importBurner(bs58.encode(Keypair.generate().secretKey),STORAGE);setKp(next);return true;}catch{setError('Cannot replace this wallet: browser storage is unavailable. Your previous wallet is still active.');return false;}}};
}
