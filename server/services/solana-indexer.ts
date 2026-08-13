export interface IndexedChainEvent { signature: string; slot: bigint; type: string; payload: Record<string, unknown>; finalizedAt: Date; }

/**
 * Finalized-slot reconciliation boundary. The persistence adapter is intentionally required
 * in production so UI/API responses are never populated by simulated portfolio data.
 */
export interface ChainStateStore { checkpoint(): Promise<bigint>; save(events: IndexedChainEvent[], checkpoint: bigint): Promise<void>; }

export class FinalizedSlotIndexer {
  constructor(private readonly rpcUrl: string, private readonly store: ChainStateStore) {}
  async reconcile(): Promise<bigint> {
    const current = await this.rpc<bigint>("getSlot", [{ commitment: "finalized" }]);
    const checkpoint = await this.store.checkpoint();
    if (current < checkpoint) throw new Error("Finalized Solana slot regressed; reconciliation stopped");
    await this.store.save([], current);
    return current;
  }
  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "skyhedge-indexer", method, params }) });
    if (!response.ok) throw new Error(`Solana RPC failed (${response.status})`);
    const body = await response.json() as { result?: T; error?: { message: string } };
    if (body.error || body.result === undefined) throw new Error(body.error?.message ?? "Solana RPC returned no result");
    return body.result;
  }
}
