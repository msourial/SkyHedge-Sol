/**
 * Official PREDICT pm-AMM Devnet faucet, same endpoint and "player" request the
 * upstream burner kit uses (client/src/lib/pm-burner/burner.ts, kept verbatim).
 * Wallet apps (e.g. the Seeker app over MWA) call this for the connected wallet.
 * Never throws; refusals such as the per-wallet hourly limit come back as text.
 */
export const PMAMM_FAUCET_URL = 'https://pm-amm-devnet.vercel.app/api/faucet';
export type FaucetResult = {funded:true;signature:string;usdc?:number;sol?:number}|{funded:false;reason:string;retryAfterSecs?:number};
export async function requestDevnetFunds(wallet:string, fetchImpl:typeof fetch=fetch):Promise<FaucetResult> {
  try {
    const res=await fetchImpl(PMAMM_FAUCET_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet,role:'player'})});
    let body:{error?:string;signature?:string;amount?:number;sol?:number}={};
    try {body=await res.json();} catch {/* non-JSON refusal */}
    if (!res.ok || !body.signature) {
      const retry=Number(res.headers.get('Retry-After'))||undefined;
      return {funded:false,reason:body.error??`Faucet refused the request (${res.status})`,retryAfterSecs:retry};
    }
    return {funded:true,signature:body.signature,usdc:body.amount,sol:body.sol};
  } catch {
    return {funded:false,reason:'Faucet unreachable. Check your connection and try again.'};
  }
}
