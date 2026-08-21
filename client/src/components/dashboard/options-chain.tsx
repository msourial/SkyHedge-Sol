import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShieldCheck, X } from "lucide-react";
import type { ChainCell, ChainGrid, CityIndexState, UnsignedTx } from "@/lib/types";
import { api, mm, skytDisplay } from "@/lib/api";
import { shortAddress, signAndSend } from "@/lib/solana";
import { Card, Pill, Stat, TxStepper, type TxStep } from "@/components/sky";
import { WalletGuard } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

type Moneyness = "ITM" | "ATM" | "OTM";
type FilterMode = "all" | Moneyness;

function pct(bps: number | null): string {
  return bps === null ? "—" : `${(bps / 100).toFixed(1)}%`;
}

export function OptionsChain({ city, chain }: { city: CityIndexState; chain: ChainGrid | undefined }) {
  const [expiryIndex, setExpiryIndex] = useState(0);
  const [selected, setSelected] = useState<ChainCell | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [activeOnly, setActiveOnly] = useState(false);

  const window = chain?.windows[expiryIndex];
  const cellsForExpiry = chain?.cells.filter((c) => c.expiry === window?.end) ?? [];
  const anchor = city.cumulativeMm ?? city.windowNormalMm;

  const moneynessOf = (strike: number, side: "call" | "put"): Moneyness => {
    const strikes = chain?.strikes ?? [];
    if (!strikes.length) return "ATM";
    const closest = strikes.reduce((prev, curr) => (Math.abs(curr - anchor) < Math.abs(prev - anchor) ? curr : prev));
    if (strike === closest) return "ATM";
    return side === "call" ? (strike < anchor ? "ITM" : "OTM") : strike > anchor ? "ITM" : "OTM";
  };

  const visibleStrikes = (chain?.strikes ?? []).filter((strike) => {
    if (filterMode === "all") return true;
    const call = cellsForExpiry.find((c) => c.side === "call" && c.strikeMm === strike);
    const put = cellsForExpiry.find((c) => c.side === "put" && c.strikeMm === strike);
    return moneynessOf(strike, "call") === filterMode || moneynessOf(strike, "put") === filterMode;
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="sky-display text-lg font-semibold">Rainfall options chain</h2>
        <div className="flex flex-wrap gap-1.5">
          {(chain?.windows ?? []).map((w, i) => (
            <button
              key={w.end}
              onClick={() => { setExpiryIndex(i); setSelected(null); }}
              className={cn(
                "sky-mono rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                i === expiryIndex
                  ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--identity)]/50 hover:text-[var(--foreground)]",
              )}
            >
              {w.start.slice(5)} → {w.end.slice(5)}
              {w.isLive && <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] uppercase text-[var(--warning)]"><span className="h-1 w-1 rounded-full bg-[var(--warning)]" />live</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          <Pill tone={chain?.probabilitySource === "noaa-10yr" ? "green" : "cyan"}>
            {chain?.probabilitySource === "noaa-10yr" ? "Priced from 10yr NOAA history" : "Priced from climatology prior"}
          </Pill>
          <span className="hidden sm:inline">Premiums fixed on-chain · binary payout on the weekly total.</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--identity)]" />
            Active only
          </label>
          <select aria-label="Filter strikes" value={filterMode} onChange={(e) => setFilterMode(e.target.value as FilterMode)} className="sky-input w-auto py-1.5 text-xs">
            <option value="all">All strikes</option>
            <option value="ITM">In the money</option>
            <option value="ATM">At the money</option>
            <option value="OTM">Out of the money</option>
          </select>
          <Pill tone={city.cumulativeMm !== null ? "cyan" : "slate"}>
            Anchor {city.cumulativeMm !== null ? `live ${mm(city.cumulativeMm)}` : `normal ${mm(city.windowNormalMm)}`}
          </Pill>
        </div>
      </div>

      <Card className="min-w-0 overflow-x-auto p-0">
        {!chain && <div className="py-14 text-center text-sm text-[var(--muted-foreground)]">Building chain…</div>}
        {chain && (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-2.5 text-right sky-eyebrow text-[var(--identity)]">Calls · rain ≥ strike</th>
                <th className="border-x border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-center sky-eyebrow text-[var(--foreground)]">Strike · normal {mm(window?.normalMm)}</th>
                <th className="px-4 py-2.5 text-left sky-eyebrow text-[var(--warning)]">Puts · rain ≤ strike</th>
              </tr>
            </thead>
            <tbody>
              {visibleStrikes.map((strike) => {
                const call = cellsForExpiry.find((c) => c.side === "call" && c.strikeMm === strike);
                const put = cellsForExpiry.find((c) => c.side === "put" && c.strikeMm === strike);
                const both = call && put;
                const moneyness = moneynessOf(strike, "call");
                const atmRow = both && moneyness === "ATM";
                if (activeOnly && !call && !put) return null;
                return (
                  <tr key={strike} className={cn("border-b border-[var(--border)] transition-colors last:border-0", atmRow && "bg-[var(--identity-dim)]")}>
                    <td className="py-1 pl-2 pr-3">
                      {call ? <SideCell cell={call} selected={selected} onSelect={setSelected} tone="call" /> : <div className="flex h-14 items-center justify-end pr-3 text-[11px] text-[var(--faint)]">no contract</div>}
                    </td>
                    <td className="w-32 border-x border-[var(--border)] px-3 py-1.5 text-center">
                      <div className="sky-mono text-sm font-bold">{strike} mm</div>
                      {both ? (
                        <div className="mt-0.5"><MoneynessBadge moneyness={moneyness} /></div>
                      ) : (
                        <div className="mt-0.5 sky-mono text-[9px] uppercase tracking-wider text-[var(--faint)]">single side</div>
                      )}
                    </td>
                    <td className="py-1 pl-3 pr-2">
                      {put ? <SideCell cell={put} selected={selected} onSelect={setSelected} tone="put" /> : <div className="flex h-14 items-center pl-3 text-[11px] text-[var(--faint)]">no contract</div>}
                    </td>
                  </tr>
                );
              })}
              {visibleStrikes.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-[var(--muted-foreground)]">No contracts match this filter.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {selected && <TradeTicket city={city} cell={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function MoneynessBadge({ moneyness }: { moneyness: Moneyness }) {
  return (
    <span className={cn(
      "sky-mono rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
      moneyness === "ITM" && "bg-[var(--success-dim)] text-[var(--success)]",
      moneyness === "ATM" && "bg-[var(--identity-dim)] text-[var(--identity)]",
      moneyness === "OTM" && "bg-[rgba(148,163,184,0.12)] text-[var(--muted-foreground)]",
    )}>{moneyness}</span>
  );
}

function SideCell({ cell, selected, onSelect, tone }: { cell: ChainCell; selected: ChainCell | null; onSelect: (c: ChainCell) => void; tone: "call" | "put" }) {
  const active = selected?.marketAddress === cell.marketAddress;
  const delta = cell.quoteProbabilityBps !== null ? `${(cell.quoteProbabilityBps / 100).toFixed(1)}%` : "—";
  return (
    <button
      onClick={() => onSelect(cell)}
      className={cn(
        "flex h-14 w-full flex-col justify-center gap-0.5 rounded-lg border border-transparent px-3 transition-colors",
        tone === "call" ? "items-end text-right hover:border-[var(--identity)] hover:bg-[var(--identity-dim)]" : "items-start text-left hover:border-[var(--warning)] hover:bg-[var(--warning-dim)]",
        active && tone === "call" && "border-[var(--identity)] bg-[var(--identity-dim)]",
        active && tone === "put" && "border-[var(--warning)] bg-[var(--warning-dim)]",
      )}
    >
      <span className="sky-mono text-sm font-bold text-[var(--foreground)]">{pct(cell.premiumRateBps)}</span>
      <span className={cn("sky-mono text-[10px]", tone === "call" ? "text-[var(--identity)]" : "text-[var(--warning)]")}>Δ {delta}</span>
      <span className="sky-mono text-[10px] text-[var(--faint)]">{pct(cell.bidBps)} / {pct(cell.askBps)}</span>
    </button>
  );
}

function TradeTicket({ city, cell, onClose }: { city: CityIndexState; cell: ChainCell; onClose: () => void }) {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const navigate = useNavigate();
  const [amount, setAmount] = useState("500");
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [tx, setTx] = useState<UnsignedTx | null>(null);

  const QUICK_SIZES = ["500", "2500", "10000"];

  const premiumEstimate = useMemo(() => {
    if (!Number(amount) || cell.premiumRateBps === null) return 0n;
    const base = BigInt(Math.round(Number(amount) * 1e6));
    return (base * BigInt(cell.premiumRateBps) + 9999n) / 10000n;
  }, [amount, cell.premiumRateBps]);

  const build = async () => {
    if (!publicKey || !Number(amount) || !cell.marketAddress) return;
    setError(null); setSig(null); setStep("building");
    try {
      const u = await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: "open_position", market: cell.marketAddress, wallet: publicKey.toBase58(), amount: BigInt(Math.round(Number(amount) * 1e6)).toString(), approved: true }),
      });
      setTx(u); setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed"); setStep("error");
    }
  };

  const send = async () => {
    if (!tx || !publicKey) return;
    setError(null); setStep("sending");
    try {
      const signature = await signAndSend(tx.base64, wallet);
      setSig(signature); setStep("confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed"); setStep("error");
    }
  };

  const side = cell.side === "call" ? "rain ≥ strike" : "rain ≤ strike";
  const delta = cell.quoteProbabilityBps !== null ? `${(cell.quoteProbabilityBps / 100).toFixed(1)}%` : "—";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="sky-display text-lg font-semibold">{city.name}</h3>
              <Pill tone={cell.side === "call" ? "cyan" : "amber"}>{cell.side === "call" ? "Call" : "Put"}</Pill>
              <Pill tone={cell.quoteProbabilityBps !== null && cell.quoteProbabilityBps >= 5000 ? "amber" : "slate"} className="hidden sm:inline-flex">Δ {delta}</Pill>
            </div>
            <p className="sky-mono mt-1 text-xs text-[var(--muted-foreground)]">
              {cell.strikeMm} mm · {cell.expiry.slice(5)} · {side} · {cell.daysToExpiry !== null ? `${cell.daysToExpiry}d to expiry` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--identity)] hover:text-[var(--identity)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          <Stat label="Last premium" value={`${((cell.premiumRateBps ?? 0) / 100).toFixed(1)}%`} accent="cyan" />
          <Stat label="Payout if hit" value={skytDisplay(BigInt(Math.round(Number(amount) * 1e6)))} />
          <Stat label="Model prob." value={delta} />
        </div>

        <label className="sky-label" htmlFor="ticket-amount">Position size (SKYT)</label>
        <div className="mb-1 flex gap-2">
          {QUICK_SIZES.map((q) => (
            <button
              key={q}
              onClick={() => { setAmount(q); setStep("idle"); setTx(null); setSig(null); }}
              className={cn("sky-mono flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors", amount === q ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--identity)]/50")}
            >
              {Number(q) >= 1000 ? `${Number(q) / 1000}k` : q}
            </button>
          ))}
        </div>
        <input id="ticket-amount" className="sky-input mb-1" type="number" min="1" value={amount} onChange={(e) => { setAmount(e.target.value); setStep("idle"); setTx(null); setSig(null); }} />
        <p className="mb-4 text-[11px] text-[var(--faint)]">
          Premium ≈ <span className="sky-mono text-[var(--muted-foreground)]">{skytDisplay(premiumEstimate)}</span> — fixed payout if {side}, pool {cell.totalShares ? skytDisplay(cell.totalShares) : "—"}
        </p>

        <TxStepper step={step} description={tx?.description} error={error} signature={sig}>
          <WalletGuard>
            <button className="sky-btn-primary w-full" onClick={() => void build()} disabled={!Number(amount)}>
              {cell.side === "call" ? "Buy call" : "Buy put"}
            </button>
          </WalletGuard>
        </TxStepper>

        {step === "ready" && tx && (
          <button className="sky-btn-success mt-3 w-full" onClick={() => void send()}>Sign & send with wallet</button>
        )}

        {step === "confirmed" && sig && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3.5 py-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--success)]">
              <ShieldCheck className="h-4 w-4" />
              <span className="sky-mono">{shortAddress(sig)}</span>
            </div>
            <button onClick={() => navigate("/?tab=portfolio")} className="font-medium text-[var(--identity)] hover:underline">View portfolio →</button>
          </div>
        )}
      </div>
    </div>
  );
}