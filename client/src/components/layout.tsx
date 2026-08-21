import { NavLink, Outlet } from "react-router-dom";
import { CloudRain, LayoutDashboard, Sparkles, Coins } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staking", label: "Staking", icon: Coins },
  { to: "/flow-ai", label: "Flow AI", icon: Sparkles },
];

function NetworkPill() {
  const network = import.meta.env.VITE_SOLANA_RPC_URL?.includes("8899") ? "localnet" : "devnet";
  return (
    <span className="sky-mono hidden items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] lg:flex">
      <span className={cn("h-1.5 w-1.5 rounded-full", network === "localnet" ? "bg-[var(--identity)]" : "bg-[var(--warning)]")} />
      {network}
    </span>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--identity)] to-[var(--identity-deep)] text-[#052033] shadow-[0_4px_12px_-4px_rgba(56,189,248,0.5)]">
              <CloudRain className="h-5 w-5" />
            </div>
            <div className="hidden leading-tight min-[420px]:block">
              <div className="sky-display text-sm font-bold tracking-[0.18em] text-[var(--foreground)]">SKYHEDGE</div>
              <div className="sky-eyebrow hidden sm:block">Weather indices, on-chain</div>
            </div>
          </NavLink>
          <nav className="flex min-w-0 items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3",
                    isActive ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NetworkPill />
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="sky-atmosphere mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="sky-mono truncate text-center text-[11px] text-[var(--faint)]">
            SKYHEDGE · PROGRAM {import.meta.env.VITE_SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr"} · NOAA FINAL / WXM VERIFIES · TX SIGNED BY YOUR WALLET
          </p>
        </div>
      </footer>
    </div>
  );
}
