import {checkedMarket, marketArg, wallet, tokenBalances, sendOnce} from './operator';
const address=marketArg(), kp=wallet('no-trader');
const {sdk:creatorSdk,market,state}=await checkedMarket(address);
// The authority identity is checked against catalog; redemption signs with the trader.
const {client}=await import('./operator');
const sdk=client(kp);
if (!state.resolved || ![1,2].includes(state.winningSide)) throw Error('Market must be settled');
const b=await tokenBalances([state.yesMint,state.noMint],kp.publicKey);
const winning=b[state.winningSide-1];
if (winning===0n) console.log('Nothing to collect');
else if (process.argv.includes('--send')) await sendOnce(`collect:${address}:${kp.publicKey.toBase58()}`,()=>sdk.send.claimWinnings(market));
else console.log('Dry run winning raw amount',winning.toString());
