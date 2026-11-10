import {pendingResiduals} from '../../shared/pm-amm/trading';
import {checkedMarket, marketArg, wallet, tokenBalances, sendOnce} from './operator';
const address = marketArg(), kp = wallet();
const {sdk, market, state} = await checkedMarket(address, kp);
if (!state.resolved) throw Error('Market must be settled');
const send = process.argv.includes('--send');
const lp = await sdk.fetchLpPosition(market, kp.publicKey);
const pending=lp?pendingResiduals(state,lp):{yes:0n,no:0n};
if (pending.yes>0n || pending.no>0n) {
  if (send) await sendOnce(`residuals:${address}`, () => sdk.send.claimLpResiduals(market));
  else console.log('Dry run: redeem LP residuals first');
}
const balances = await tokenBalances([state.yesMint, state.noMint], kp.publicKey);
const winning = state.winningSide === 1 ? balances[0] : state.winningSide === 2 ? balances[1] : 0n;
if (winning > 0n) {
  if (send) await sendOnce(`creator-winnings:${address}`, () => sdk.send.claimWinnings(market));
  else console.log('Dry run: redeem winning tokens', winning.toString());
} else console.log('No winning tokens remaining');
