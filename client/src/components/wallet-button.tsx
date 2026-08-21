import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { CheckCircle2, ChevronDown, CloudRain, ExternalLink, WalletCards } from "lucide-react";
import { shortAddress } from "@/lib/solana";
import { cn } from "@/lib/utils";

const EXTENSION_NAMES = new Set(["Phantom", "Solflare"]);

export function WalletButton() {
  const { wallets, select, disconnect, connected, publicKey, connecting, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState<WalletName<string> | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);

  useEffect(() => {
    if (!pendingConnect || !wallet || wallet.adapter.name !== pendingConnect) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          await wallet.adapter.connect();
          if (!cancelled) setConnectError(null);
        } catch (e) {
          if (!cancelled) {
            const msg = e instanceof Error && e.message ? e.message : "Connection rejected or wallet not responding.";
            setConnectError(msg.length > 90 ? `${msg.slice(0, 90)}…` : msg);
          }
        } finally {
          if (!cancelled) setPendingConnect(null);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pendingConnect, wallet]);

  // Installed only — Solflare starts in "Loadable" in every browser (it upgrades
  // to Installed when window.solflare exists), so Loadable would fake detection.
  const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed);
  const soleUsable = detected.length === 1 ? detected[0] : null;

  const autoConnect =
    soleUsable && !EXTENSION_NAMES.has(soleUsable.adapter.name)
      ? soleUsable.adapter.name
      : null;

  useEffect(() => {
    if (autoConnect && !connected && !pendingConnect && !autoAttempted) {
      setAutoAttempted(true);
      setPendingConnect(autoConnect);
      select(autoConnect);
    }
  }, [autoConnect, connected, pendingConnect, autoAttempted, select]);

  const toggleMenu = () => {
    if (soleUsable && EXTENSION_NAMES.has(soleUsable.adapter.name)) {
      const name = soleUsable.adapter.name;
      select(name);
      setPendingConnect(name);
      return;
    }
    setOpen((v) => !v);
    setConnectError(null);
  };

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-[var(--success)]/40 bg-[var(--success-dim)] px-3 py-1.5 text-xs font-medium text-[var(--success)] sm:flex">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {wallet?.adapter.name ?? "Wallet"}
          <span className="text-[var(--success)]/70">·</span>
          {shortAddress(publicKey.toBase58())}
        </span>
        <button onClick={() => void disconnect()} className="sky-btn-ghost px-3 py-1.5 text-xs">Disconnect</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        disabled={connecting}
        aria-haspopup="menu"
        aria-expanded={open}
        className="sky-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <WalletCards className="h-4 w-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConnectError(null); }} />
          <div role="menu" aria-label="Available wallets" className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)] shadow-xl">
            <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Select a wallet</div>
            {connectError && (
              <div className="mx-3 mb-1 mt-1 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive-dim)] px-3 py-2 text-xs text-[var(--destructive-foreground)]">{connectError}</div>
            )}
            {wallets.map((w) => {
              const usable = w.readyState === WalletReadyState.Installed;
              const isDemo = w.adapter.name.includes("Demo");
              const installUrl = w.adapter.url;
              return (
                <div key={w.adapter.name} role="menuitem" className="flex items-center gap-3 px-4 py-2.5">
                  {w.adapter.icon ? (
                    <img src={w.adapter.icon} alt="" className="h-7 w-7 shrink-0 rounded-lg" />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--identity-dim)] text-[var(--identity)]">
                      <CloudRain className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{w.adapter.name.replace(/ \(Localnet\)$/, "")}</div>
                    {!usable && (
                      <div className="text-[11px] text-[var(--faint)]">
                        {isDemo ? "Not configured in this build" : "Not detected in this browser"}
                      </div>
                    )}
                  </div>
                  {usable ? (
                    <button
                      onClick={() => { setOpen(false); select(w.adapter.name); setPendingConnect(w.adapter.name); }}
                      className="sky-btn-ghost px-3 py-1.5 text-xs"
                    >
                      Connect
                    </button>
                  ) : installUrl && !isDemo ? (
                    <a
                      href={installUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--identity)] transition-colors hover:text-[var(--identity-deep)]"
                    >
                      Install <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--faint)]">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function WalletGuard({ children, className }: { children: React.ReactNode; className?: string }) {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-8 text-center text-sm text-[var(--muted-foreground)]", className)}>
        Connect a wallet to continue. No transaction is simulated.
      </div>
    );
  }
  return <>{children}</>;
}