import { formatBaseGrouped } from "../../shared/ui-money.ts";

export function fundingReason(premium: string | null | undefined, balance: string | null, sol?: number | null): string | null {
  const feeHelp = sol === 0 ? "Devnet SOL is needed for fees. Get Devnet SOL at https://faucet.solana.com/." : null;
  if (premium && /^\d+$/.test(premium) && balance != null && /^\d+$/.test(balance) && BigInt(balance) < BigInt(premium)) {
    return `You need ${formatBaseGrouped(BigInt(premium), 6)} SKYT to buy this cover. You have ${formatBaseGrouped(BigInt(balance), 6)}. Open Wallet for funding help.${feeHelp ? " " + feeHelp : ""}`;
  }
  return feeHelp;
}
