import {createRequire} from 'node:module';
import BN from 'bn.js';
import {PublicKey} from '@solana/web3.js';
import {getAssociatedTokenAddressSync, AccountLayout, MintLayout, TOKEN_PROGRAM_ID} from '@solana/spl-token';
const require=createRequire(import.meta.url);
const catalog=require('../../shared/pm-amm/markets.devnet.json') as Record<string,any>;
const {PmAmmClient}=require('@pm-amm/sdk') as typeof import('@pm-amm/sdk');
const {Connection}=require('@solana/web3.js') as typeof import('@solana/web3.js');
const program=new PublicKey('GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y'),mint=new PublicKey('3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ');
const sdk=PmAmmClient.readOnly(new Connection('https://api.devnet.solana.com'),program,mint);
const fixed=(n:number)=>new BN(BigInt(Math.round(n*2**32)).toString()).shln(16);
export const owner=new PublicKey('7HPLfNgikVpUso9ST3KPkorgq1eW8xrhFTLD3fUEunap');
export async function rpcAccounts(now=Date.parse('2026-11-11T00:00:00Z')/1000,priceMove=0) {
 const accounts:Record<string,any>={};
 for(const [address,e] of Object.entries(catalog)) {
  const key=new PublicKey(address),duration=e.spec.endTs-now, demo='historicalDemo' in e.spec;
  const state={authority:new PublicKey(e.creator),marketId:new BN(e.marketId),collateralMint:mint,yesMint:sdk.yesMint(key),noMint:sdk.noMint(key),vault:sdk.marketVault(key),startTs:new BN(now-100),endTs:new BN(e.spec.endTs),lZero:fixed(400e6/0.3989422804/Math.sqrt(Math.max(duration,1))),reserveYes:fixed(400e6),reserveNo:fixed((400+priceMove)*1e6),lastAccrualTs:new BN(now),cumYesPerShare:new BN(0),cumNoPerShare:new BN(0),totalYesDistributed:new BN(0),totalNoDistributed:new BN(0),totalLpShares:new BN(0),resolved:demo,winningSide:demo?2:0,bump:0,name:Array.from(Buffer.from(e.name.padEnd(64,'\0'))),initialPriceBps:5000,group:PublicKey.default,unclaimedExcessYes:new BN(0),unclaimedExcessNo:new BN(0)};
  const encoded=await sdk.program.coder.accounts.encode('market',state);
  accounts[address]={data:[encoded.toString('base64'),'base64'],executable:false,lamports:1,owner:program.toBase58(),rentEpoch:0};
 }
 const token=(mint:PublicKey,amount:bigint,tokenOwner=owner)=> {
  const data=Buffer.alloc(AccountLayout.span);AccountLayout.encode({mint,owner:tokenOwner,amount,delegateOption:0,delegate:PublicKey.default,state:1,isNativeOption:0,isNative:0n,delegatedAmount:0n,closeAuthorityOption:0,closeAuthority:PublicKey.default},data);
  accounts[getAssociatedTokenAddressSync(mint,tokenOwner,true).toBase58()]={data:[data.toString('base64'),'base64'],executable:false,lamports:2039280,owner:TOKEN_PROGRAM_ID.toBase58(),rentEpoch:0};
 };
 token(mint,1000000000n);
 token(mint,0n,new PublicKey('4qXyczAr5DuBVaHUwmZT5Xt6hgQ6RwqBYcFGtrv8QEph'));
 for(const address of Object.keys(catalog)){token(sdk.yesMint(new PublicKey(address)),10000000n);token(sdk.noMint(new PublicKey(address)),5000000n);}
 const mintData=Buffer.alloc(MintLayout.span);MintLayout.encode({mintAuthorityOption:0,mintAuthority:PublicKey.default,supply:1000000000000n,decimals:6,isInitialized:true,freezeAuthorityOption:0,freezeAuthority:PublicKey.default},mintData);
 accounts[mint.toBase58()]={data:[mintData.toString('base64'),'base64'],executable:false,lamports:1461600,owner:TOKEN_PROGRAM_ID.toBase58(),rentEpoch:0};
 return accounts;
}
