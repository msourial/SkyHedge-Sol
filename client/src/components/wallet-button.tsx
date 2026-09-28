import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { WalletReadyState, type WalletError } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

type WalletUiState = "idle" | "choosing" | "selected" | "connecting" | "connected" | "rejected" | "unavailable" | "rpc_error";

interface WalletStatusContextValue {
  error: string | null;
  reportError: (error: WalletError) => void;
  clearError: () => void;
}

const WalletStatusContext = createContext<WalletStatusContextValue | null>(null);

export function WalletStatusProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const reportError = useCallback((walletError: WalletError) => {
    const rejected = /reject|declin|cancel/i.test(`${walletError.name} ${walletError.message}`);
    setError(rejected ? "Wallet connection was rejected. Nothing was submitted." : "The wallet could not connect. Confirm the extension is unlocked and try again.");
  }, []);
  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(() => ({ error, reportError, clearError }), [clearError, error, reportError]);
  return <WalletStatusContext.Provider value={value}>{children}</WalletStatusContext.Provider>;
}

export function useWalletStatus() {
  const value = useContext(WalletStatusContext);
  if (!value) throw new Error("useWalletStatus must be used inside WalletStatusProvider");
  return value;
}

export function WalletButton() {
  const { wallets, connected, connecting, publicKey, wallet } = useWallet();
  const { error, clearError } = useWalletStatus();
  const [attempted, setAttempted] = useState(false);
  const [connectionStalled, setConnectionStalled] = useState(false);
  useEffect(() => {
    if (!connecting) {
      setConnectionStalled(false);
      return;
    }
    const timeout = window.setTimeout(() => setConnectionStalled(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, [connecting]);
  const supportedInstalled = wallets.some(({ adapter, readyState }) =>
    (adapter.name === "Phantom" || adapter.name === "Solflare") && readyState === WalletReadyState.Installed,
  );
  const state: WalletUiState = connected
    ? "connected"
    : connecting
      ? "connecting"
      : error
        ? /rejected/i.test(error) ? "rejected" : "rpc_error"
        : wallet
          ? "selected"
          : attempted && !supportedInstalled
            ? "unavailable"
            : attempted
              ? "choosing"
              : "idle";

  return (
    <div
      className="relative"
      data-wallet-state={state}
      onClickCapture={() => {
        setAttempted(true);
        clearError();
      }}
    >
      <WalletMultiButton className="sky-wallet-button" />
      <span className="sr-only" aria-live="polite">
        {connected && publicKey ? `${wallet?.adapter.name ?? "Wallet"} connected: ${publicKey.toBase58()}` : connecting ? "Connecting wallet" : wallet ? `${wallet.adapter.name} selected. Activate the Connect button to continue.` : "No wallet connected"}
      </span>
      {connecting && !connected && !connectionStalled && (
        <div role="status" className="absolute right-0 z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--foreground)] shadow-2xl">
          Approve or reject the connection request in {wallet?.adapter.name ?? "your wallet"}. No transaction is being requested.
        </div>
      )}
      {connecting && !connected && connectionStalled && (
        <div role="alert" className="absolute right-0 z-[70] mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--muted-foreground)] shadow-2xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p>Wallet connection is taking longer than expected. Check {wallet?.adapter.name ?? "your wallet"} for the SkyHedge connection request. No transaction was requested.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded border border-[var(--border)] px-3 text-[var(--foreground)] hover:bg-[var(--surface-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset connection and retry
              </button>
            </div>
          </div>
        </div>
      )}
      {(error || (attempted && !supportedInstalled && !wallet)) && (
        <div role="alert" className="absolute right-0 z-[70] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--muted-foreground)] shadow-2xl">
          <div className="flex items-start gap-2">
            {connected ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />}
            <p className="flex-1">{error ?? "No Phantom or Solflare extension was detected here. Open SkyHedge in Chrome or Brave with your wallet extension installed."}</p>
            <button type="button" onClick={() => { clearError(); setAttempted(false); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]" aria-label="Dismiss wallet message"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </div>
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
