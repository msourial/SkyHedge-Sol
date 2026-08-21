import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, ShieldAlert, ShieldCheck, WalletCards } from "lucide-react";
import type { PortfolioStats, UnsignedTx } from "@/lib/types";
import { api, skytDisplay } from "@/lib/api";
import { signAndSend } from "@/lib/solana";
import { Card, EmptyState, Stat, TxStepper, type TxStep } from "@/components/sky";
import { WalletGuard } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

export function PortfolioTab() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const [action, setAction] = useState<string | null>(null);
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [ready, setReady] = useState<UnsignedTx | null>(null);

  const stats = useQuery({
    queryKey: ["portfolio-stats", publicKey?.toBase58()],
    queryFn: () => api<PortfolioStats>(`/api/portfolio/stats?wallet=${publicKey!.toBase58()}`),
    enabled: !!publicKey,
    refetchInterval: 30_000,
  });

  const build = async (txAction: string, market: string, address: string) => {
    if (!publicKey) return;
    setAction(txAction); setError(null); setSig(null); setReady(null); setStep("building");
    try {
      const u = await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: txAction, market, wallet: publicKey.toBase58(), positionAddress: address, approved: true }),
      });
      setReady(u); setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed"); setStep("error");
    }
  };

  const send = async () => {
    if (!ready || !publicKey) return;
    setError(null); setStep("sending");
    try {
      const s = await signAndSend(ready.base64, wallet);
      setSig(s); setAction(null); setReady(null); setStep("confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed"); setStep("error");
    }
  };

  if (!connected || !publicKey) {
    return (
      <EmptyState
        icon={<WalletCards className="h-8 w-8" />}
        title="Connect a wallet to view your positions"
        cta={<WalletGuard className="mt-3 w-full max-w-[320px]"><span className="font-medium">Connect wallet</span></WalletGuard>}
      />
    );
  }

  const busy = step === "building" || step === "sending";
  const showingReady = step === "ready" && !!ready;
  const data = stats.data;

  return (
    <div className="space-y-5">
      {stats.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Stat key={i} label="…" value="—" />)}
        </div>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Portfolio value" value={skytDisplay(data.totalValue)} accent="cyan" />
          <Stat label="Unrealized P&L" value={`${Number(data.totalPnl) >= 0 ? "+" : ""}${skytDisplay(data.totalPnl)}`} accent={Number(data.totalPnl) >= 0 ? "green" : "red"} />
          <Stat label="Today (θ decay)" value={`${Number(data.dayChange) >= 0 ? "+" : ""}${skytDisplay(data.dayChange)}`} accent={Number(data.dayChange) >= 0 ? "green" : "amber"} />
          <Stat label="Open positions" value={data.openPositions} />
        </div>
      )}

      <TxStepper step={step} error={error} signature={sig} className="mb-4" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="sky-section-label mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--identity)]" /> Contracts</h2>
          <div className="space-y-3">
            {(data?.protections ?? []).length === 0 && (
              <EmptyState
                icon={<ShieldCheck className="h-8 w-8" />}
                title="No open positions"
                hint="Pick a city on the Trading tab and buy a contract."
                cta={<Link to="/?tab=trading" className="sky-btn-primary mt-3 px-4 py-2 text-sm">Open trading</Link>}
              />
            )}
            {data?.protections.map((p) => (
              <Card key={p.address}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {p.city ? (
                      <Link to={`/?tab=trading&city=${p.city}`} className="sky-display text-sm font-semibold text-[var(--identity)] hover:underline">
                        {p.city.replace(/-/g, " ")} {p.side === "call" ? "CALL" : "PUT"} {p.strikeMm}mm
                      </Link>
                    ) : (
                      <div className="sky-mono break-all text-sm font-semibold">{p.market}</div>
                    )}
                    <div className="mt-0.5 text-xs text-[var(--faint)]">{p.address.slice(0, 4)}…{p.address.slice(-4)} · {p.daysToExpiry !== null ? `${p.daysToExpiry}d to expiry` : ""}</div>
                  </div>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--identity)]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Stat label="Protected" value={skytDisplay(p.protectedAmount)} />
                  <Stat label="Premium paid" value={skytDisplay(p.premiumPaid)} />
                  <Stat label="Mark" value={skytDisplay(p.fairValue)} accent="cyan" />
                  <Stat label="P&L" value={`${Number(p.pnl) >= 0 ? "+" : ""}${skytDisplay(p.pnl)}`} accent={Number(p.pnl) >= 0 ? "green" : "red"} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="sky-btn-ghost flex-1 px-3 py-2 text-xs" onClick={() => void build("claim_payout", p.market, p.address)} disabled={busy}>
                    {action === "claim_payout" && step === "building" ? <Spinner /> : "Claim payout"}
                  </button>
                  <button className="sky-btn-ghost flex-1 px-3 py-2 text-xs" onClick={() => void build("claim_premium_refund", p.market, p.address)} disabled={busy}>
                    {action === "claim_premium_refund" && step === "building" ? <Spinner /> : "Refund premium"}
                  </button>
                </div>
                {showingReady && ready && (
                  <button className="sky-btn-success mt-2 w-full py-2 text-sm" onClick={() => void send()} disabled={busy}>
                    {busy ? <Spinner /> : "Sign & send with wallet"}
                  </button>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="sky-section-label mb-3 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-[var(--warning)]" /> Liquidity</h2>
          <div className="space-y-3">
            {(data?.liquidity ?? []).length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No liquidity positions — supply a pool on the Staking page.</p>}
            {data?.liquidity.map((l) => (
              <Card key={l.address}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="sky-mono break-all text-sm font-semibold">{l.market}</div>
                    <div className="mt-0.5 text-xs text-[var(--faint)]">{l.address.slice(0, 4)}…{l.address.slice(-4)}</div>
                  </div>
                  <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--warning)]" />
                </div>
                <div className="mt-3"><Stat label="Shares" value={skytDisplay(l.shares)} /></div>
                <div className="mt-3 flex gap-2">
                  <button className="sky-btn-ghost flex-1 px-3 py-2 text-xs" onClick={() => void build("withdraw_liquidity", l.market, l.address)} disabled={busy}>
                    {action === "withdraw_liquidity" && step === "building" ? <Spinner /> : "Withdraw"}
                  </button>
                  <button className="sky-btn-ghost flex-1 px-3 py-2 text-xs" onClick={() => void build("redeem_closed_liquidity", l.market, l.address)} disabled={busy}>
                    {action === "redeem_closed_liquidity" && step === "building" ? <Spinner /> : "Redeem closed"}
                  </button>
                </div>
                {showingReady && ready && (
                  <button className="sky-btn-success mt-2 w-full py-2 text-sm" onClick={() => void send()} disabled={busy}>
                    {busy ? <Spinner /> : "Sign & send with wallet"}
                  </button>
                )}
              </Card>
            ))}
          </div>
          <p className={cn("mt-4 text-xs text-[var(--faint)]")}>Indexed from finalized on-chain events; nothing is simulated.</p>
        </section>
      </div>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="mx-auto h-4 w-4 animate-spin" />;
}