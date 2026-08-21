import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Coins, Info, Vote } from "lucide-react";
import type { GovernanceProposal, StakingPool } from "@/lib/types";
import { api, skytDisplay } from "@/lib/api";
import { Card, EmptyState, Pill, Skeleton } from "@/components/sky";
import { cn } from "@/lib/utils";

export function CommunityTab() {
  const pools = useQuery({ queryKey: ["staking-pools"], queryFn: () => api<{ pools: StakingPool[] }>("/api/staking/pools"), refetchInterval: 60_000 });
  const proposals = useQuery({ queryKey: ["governance"], queryFn: () => api<{ proposals: GovernanceProposal[] }>("/api/governance/proposals") });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="sky-display flex items-center gap-2 text-lg font-semibold"><Coins className="h-4 w-4 text-[var(--identity)]" /> Mutual aid pools</h2>
          <Link to="/staking" className="sky-btn-ghost px-3 py-1.5 text-xs">Staking page →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pools.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          {(pools.data?.pools ?? []).slice(0, 4).map((pool) => (
            <Card key={pool.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="sky-display text-sm font-semibold leading-tight">{pool.name}</div>
                <Pill tone={pool.status === "open" ? "green" : "slate"}>{pool.status}</Pill>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--faint)]">TVL</span>
                  <span className="sky-mono font-medium">{skytDisplay(pool.tvl)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--faint)]">APY</span>
                  <span className="sky-mono font-medium text-[var(--success)]">{pool.apyPct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--faint)]">Lock</span>
                  <span className="sky-mono font-medium">{pool.lockDays}d</span>
                </div>
              </div>
            </Card>
          ))}
          {!pools.isLoading && (pools.data?.pools ?? []).length === 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <EmptyState icon={<Coins className="h-8 w-8" />} title="No pools indexed yet" hint="Pools appear here once the indexer observes markets on-chain." />
            </div>
          )}
        </div>
      </section>

      <GovernanceSection proposals={proposals.data?.proposals ?? []} isLoading={proposals.isLoading} />
    </div>
  );
}

function GovernanceSection({ proposals, isLoading }: { proposals: GovernanceProposal[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openForm, setOpenForm] = useState(false);

  const vote = useMutation({
    mutationFn: (input: { proposalId: string; support: boolean }) => api(`/api/governance/vote`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["governance"] }); },
  });

  const create = useMutation({
    mutationFn: () => api(`/api/governance/proposals`, { method: "POST", body: JSON.stringify({ poolId: "generic", title, description }) }),
    onSuccess: () => { setOpenForm(false); setTitle(""); setDescription(""); void queryClient.invalidateQueries({ queryKey: ["governance"] }); },
  });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="sky-display flex items-center gap-2 text-lg font-semibold"><Vote className="h-4 w-4 text-[var(--identity)]" /> Governance</h2>
        <button className="sky-btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpenForm((v) => !v)}>{openForm ? "Close" : "Propose"}</button>
      </div>

      {openForm && (
        <Card className="mb-4">
          <label className="sky-label" htmlFor="gov-title">Title</label>
          <input id="gov-title" className="sky-input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Add a 120mm strike to the Mumbai chain" />
          <label className="sky-label" htmlFor="gov-desc">Description</label>
          <textarea id="gov-desc" className="sky-input mb-3 min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should the community decide, and why?" />
          <button className="sky-btn-primary px-4 py-2 text-sm" onClick={() => create.mutate()} disabled={create.isPending || title.trim().length < 3 || description.trim().length < 3}>
            {create.isPending ? "Submitting…" : "Submit proposal"}
          </button>
          {create.error && <p className="mt-2 text-xs text-[var(--destructive)]">{(create.error as Error).message}</p>}
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && <Skeleton className="h-24" />}
        {proposals.map((p) => {
          const total = p.yes + p.no;
          const yesPct = total ? Math.round((p.yes / total) * 100) : 0;
          const daysLeft = Math.max(0, Math.ceil((p.deadlineMs - Date.now()) / 86_400_000));
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="sky-display text-sm font-semibold">{p.title}</h3>
                    <Pill tone={p.status === "passed" ? "green" : p.status === "failed" ? "red" : "cyan"}>{p.status}</Pill>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted-foreground)]">{p.description}</p>
                  <div className="mt-1.5 text-[10px] text-[var(--faint)]">
                    pool <span className="sky-mono">{p.poolId}</span> · {p.votes} votes · {daysLeft}d left
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="sky-btn-success px-3 py-1.5 text-xs" disabled={p.status !== "active" || vote.isPending} onClick={() => vote.mutate({ proposalId: p.id, support: true })}>Yes</button>
                  <button className="sky-btn-ghost px-3 py-1.5 text-xs" disabled={p.status !== "active" || vote.isPending} onClick={() => vote.mutate({ proposalId: p.id, support: false })}>No</button>
                </div>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="bg-[var(--success)]" style={{ width: `${yesPct}%` }} />
                <div className="bg-[var(--destructive)]" style={{ width: `${100 - yesPct}%` }} />
              </div>
              <div className={cn("mt-1.5 flex justify-between text-[10px] sky-mono")}>
                <span className="text-[var(--success)]">{p.yes} yes</span>
                <span className="text-[var(--destructive)]">{p.no} no</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-5 py-3.5">
        <Info className="h-4 w-4 shrink-0 text-[var(--identity)]" />
        <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Pools are real on-chain liquidity positions; governance is an in-memory mock for this build and proposals are not yet executed on-chain.
        </p>
      </div>
    </section>
  );
}