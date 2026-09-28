/** State for the initial Devnet SKYT allocation flow. */
export type InitialSkytMintState = "checking" | "unavailable" | "available" | "already-issued";

/**
 * The initial allocation is offered only while finalized mint supply is zero.
 * A recipient balance is not a reliable issuance guard because tokens can move.
 */
export function initialSkytMintState(supplyBaseUnits: string | undefined, readFailed = false): InitialSkytMintState {
  if (readFailed) return "unavailable";
  if (supplyBaseUnits === undefined) return "checking";
  if (!/^\d+$/.test(supplyBaseUnits)) return "unavailable";
  return BigInt(supplyBaseUnits) > 0n ? "already-issued" : "available";
}
