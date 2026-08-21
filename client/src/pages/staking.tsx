import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, Coins, Loader2, Lock, WalletCards } from "lucide-react";
import type { StakingPool, StakingUserState, UnsignedTx } from "@/lib/types";
import { api, skytDisplay } from "@/lib/api";
import { Card, EmptyState, Pill, Skeleton, Stat } from "@/components/sky";
import { WalletGuard } from "@/components/wallet-button";

export default function StakingPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const [pendingPool, setPendingPool] = useState<string | null>(null);
  const [donePool, setDonePool] = useState<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);

  const supply = async (pool: StakingPool) => {
    if (!publicKey) return;
    setPendingPool(pool.id); setDonePool(null); setPoolError(null);
    try {
      await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: "fund_pool", market: pool.id, wallet: publicKey.toBase58(), amount: pool.minStake, approved: true }),
      });
      setDonePool(pool.id);
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : "Failed to build transaction");
    } finally {
      setPendingPool(null);
    }
  };

  const pools = useQuery({ queryKey: ["staking-pools"], queryFn: () => api<{ pools: StakingPool[] }>("/api/staking/pools"), refetchInterval: 60_000 });
  const user = useQuery({
    queryKey: ["staking-user", publicKey?.toBase58()],
    queryFn: () => api<StakingUserState>(`/api/staking/user/${publicKey!.toBase58()}`),
    enabled: !!publicKey,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sky-display text-2xl font-bold tracking-tight sm:text-3xl">Community staking</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
            Supply SKYT to weather-index pools. Each pool's liquidity backs binary payouts and earns the fixed on-chain premium — annualized below.
          </p>
        </div>
      </div>

      {connected && publicKey ? (
        user.data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total staked" value={skytDisplay(user.data.totalStaked)} accent="cyan" />
            <Stat label="Accrued rewards" value={skytDisplay(user.data.totalRewards)} accent="green" />
            <Stat label="Pools" value={user.data.poolCount} />
            <Stat label="Lock" value="until expiry" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        )
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4 text-sm text-[var(--muted-foreground)]">
          <WalletCards className="h-4 w-4 shrink-0 text-[var(--identity)]" />
          <span className="flex-1">Connect a wallet to see your stakes.</span>
          <WalletGuard><span className="text-xs font-medium">Connect wallet</span></WalletGuard>
        </div>
      )}

      <section>
        <h2 className="sky-section-label flex items-center gap-2"><Coins className="h-4 w-4 text-[var(--identity)]" /> Pools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pools.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
          {(pools.data?.pools ?? []).map((pool) => (
            <Card key={pool.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="sky-display text-sm font-semibold leading-tight">{pool.name}</div>
                <Pill tone={pool.status === "open" ? "green" : "slate"}>{pool.status}</Pill>
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--faint)]">{pool.city ? pool.city.replace(/-/g, " ") : ""} · {pool.side} · {pool.strikeMm}mm strike</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Stat label="TVL" value={skytDisplay(pool.tvl)} accent="cyan" />
                <Stat label="APY" value={`${pool.apyPct.toFixed(1)}%`} accent="green" />
                <Stat label="Shares" value={skytDisplay(pool.totalShares)} />
                <Stat label="Lock" value={`${pool.lockDays}d`} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-[10px] text-[var(--faint)]">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> min {skytDisplay(pool.minStake)}</span>
                <span className="sky-mono">{pool.premiumRateBps !== null ? `${(pool.premiumRateBps / 100).toFixed(1)}%` : "—"} fixed premium</span>
              </div>

              {donePool === pool.id ? (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success-dim)] px-3 py-2.5 text-xs text-[var(--success)]">
                  <CheckCircle2 className="h-4 w-4" />
                  Unsigned tx built — approve in your wallet extension
                </div>
              ) : (
                <button
                  className="sky-btn-primary mt-4 w-full py-2 text-sm"
                  disabled={!connected || pendingPool !== null}
                  onClick={() => void supply(pool)}
                >
                  {pendingPool === pool.id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Supply liquidity"}
                </button>
              )}
              {poolError && <p className="mt-2 text-xs text-[var(--destructive)]">{poolError}</p>}
            </Card>
          ))}
          {!pools.isLoading && (pools.data?.pools ?? []).length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState icon={<Coins className="h-8 w-8" />} title="No pools indexed yet" hint="Pools appear once the indexer observes markets on-chain." />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}