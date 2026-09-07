import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Coins, Loader2, Lock, WalletCards } from "lucide-react";
import type { StakingPool, StakingUserState, UnsignedTx } from "@/lib/types";
import { api, usdcDisplay } from "@/lib/api";
import { signAndSend } from "@/lib/solana";
import { Card, EmptyState, Pill, Skeleton, Stat, TxStepper, type TxStep } from "@/components/sky";
import { WalletGuard } from "@/components/wallet-button";

const INITIAL_POOLS = 9;

export default function StakingPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const [pendingPool, setPendingPool] = useState<string | null>(null);
  const [readyPool, setReadyPool] = useState<string | null>(null);
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [ready, setReady] = useState<UnsignedTx | null>(null);
  const [showAll, setShowAll] = useState(false);

  const build = async (pool: StakingPool) => {
    if (!publicKey) return;
    setPendingPool(pool.id); setError(null); setSig(null); setReady(null); setReadyPool(null); setStep("building");
    try {
      const u = await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: "fund_pool", market: pool.id, wallet: publicKey.toBase58(), amount: pool.minStake, approved: true }),
      });
      setReady(u); setReadyPool(pool.id); setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build transaction"); setStep("error");
    } finally {
      setPendingPool(null);
    }
  };

  const send = async () => {
    if (!ready || !publicKey) return;
    setError(null); setStep("sending");
    try {
      const s = await signAndSend(ready.base64, wallet);
      setSig(s); setReady(null); setReadyPool(null); setStep("confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed"); setStep("error");
    }
  };

  const pools = useQuery({ queryKey: ["staking-pools"], queryFn: () => api<{ pools: StakingPool[] }>("/api/staking/pools"), refetchInterval: 60_000 });
  const user = useQuery({
    queryKey: ["staking-user", publicKey?.toBase58()],
    queryFn: () => api<StakingUserState>(`/api/staking/user/${publicKey!.toBase58()}`),
    enabled: !!publicKey,
    refetchInterval: 30_000,
  });

  const sorted = useMemo(() => {
    const list = pools.data?.pools ?? [];
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return b.apyPct - a.apyPct;
    });
  }, [pools.data]);
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_POOLS);
  const hiddenCount = sorted.length - INITIAL_POOLS;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sky-display text-2xl font-bold tracking-tight sm:text-3xl">Community staking</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
            Supply USDC to weather-index pools. Each pool's liquidity backs binary payouts and earns the fixed on-chain premium — annualized below.
          </p>
        </div>
      </div>

      {connected && publicKey ? (
        user.data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total staked" value={usdcDisplay(user.data.totalStaked)} accent="cyan" />
            <Stat label="Accrued rewards" value={usdcDisplay(user.data.totalRewards)} accent="green" />
            <Stat label="Pools" value={user.data.poolCount} />
            <Stat label="Lock" value="until expiry" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4 text-sm text-[var(--muted-foreground)]">
          <WalletCards className="h-4 w-4 shrink-0 text-[var(--identity)]" />
          <span className="flex-1">Connect a wallet to see your stakes.</span>
          <WalletGuard><span className="text-xs font-medium">Connect wallet</span></WalletGuard>
        </div>
      )}

      <TxStepper step={step} description={ready?.description} error={error} signature={sig} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="sky-section-label flex items-center gap-2"><Coins className="h-4 w-4 text-[var(--identity)]" /> Pools</h2>
          {sorted.length > 0 && (
            <span className="sky-mono text-[11px] text-[var(--faint)]">
              {showAll ? sorted.length : Math.min(INITIAL_POOLS, sorted.length)} of {sorted.length} · sorted by yield
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pools.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
          {visible.map((pool) => (
            <Card key={pool.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="sky-display text-sm font-semibold leading-tight">{pool.name}</div>
                <Pill tone={pool.status === "open" ? "green" : "slate"}>{pool.status}</Pill>
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--faint)]">{pool.city ? pool.city.replace(/-/g, " ") : ""} · {pool.side} · {pool.strikeMm}mm strike</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Stat label="TVL" value={usdcDisplay(pool.tvl)} accent="cyan" />
                <Stat label="APY" value={`${pool.apyPct.toFixed(1)}%`} accent="green" />
                <Stat label="Shares" value={usdcDisplay(pool.totalShares)} />
                <Stat label="Lock" value={`${pool.lockDays}d`} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-[10px] text-[var(--faint)]">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> min {usdcDisplay(pool.minStake)}</span>
                <span className="sky-mono">{pool.premiumRateBps !== null ? `${(pool.premiumRateBps / 100).toFixed(1)}%` : "—"} fixed premium</span>
              </div>

              <div className="mt-auto pt-4">
                {step === "ready" && ready && readyPool === pool.id ? (
                  <button
                    className="sky-btn-success w-full py-2 text-sm"
                    onClick={() => void send()}
                  >
                    Sign & send with wallet
                  </button>
                ) : (
                  <button
                    className="sky-btn-primary w-full py-2 text-sm"
                    disabled={!connected || pendingPool !== null || step === "sending"}
                    onClick={() => void build(pool)}
                  >
                    {pendingPool === pool.id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Supply liquidity"}
                  </button>
                )}
              </div>
            </Card>
          ))}
          {!pools.isLoading && sorted.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState icon={<Coins className="h-8 w-8" />} title="No pools indexed yet" hint="Pools appear once the indexer observes markets on-chain." />
            </div>
          )}
        </div>
        {!pools.isLoading && hiddenCount > 0 && (
          <div className="mt-4 text-center">
            <button className="sky-btn-ghost min-h-10 px-5 text-sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer pools" : `Show ${hiddenCount} more pool${hiddenCount === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
