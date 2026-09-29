import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Check, ChevronDown, CloudRain, Copy } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

function DevnetTesterNotice() {
  return <details className="border-b border-[var(--border)] bg-[var(--warning-dim)]">
    <summary className="mx-auto flex min-h-11 max-w-[92rem] list-none items-center justify-between gap-3 px-4 py-2 text-sm text-[var(--foreground)] sm:px-6">
      <span><strong>Test environment</strong><span className="hidden text-[var(--muted-foreground)] sm:inline"> — Devnet assets and positions have no real-world value.</span></span>
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
    </summary>
    <div className="mx-auto max-w-[92rem] px-4 pb-3 text-sm leading-relaxed text-[var(--muted-foreground)] sm:px-6">SKYT, Devnet SOL, quotes, and test positions are not redeemable. Tester limits are 500 SKYT protection per wallet and 10,000 SKYT liquidity per seeded market. Actions unlock only after every required on-chain and evidence check is finalized.</div>
  </details>;
}

function NetworkPill() {
  const network = import.meta.env.VITE_SOLANA_RPC_URL?.includes("8899") ? "Localnet" : "Devnet";
  return <span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] sm:flex"><span className={cn("h-2 w-2 rounded-full", network === "Localnet" ? "bg-[var(--identity)]" : "bg-[var(--warning)]")} />{network}</span>;
}

const PROGRAM_ID = import.meta.env.VITE_SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";

function TechnicalFooter() {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(PROGRAM_ID); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* unavailable */ } };
  return <details className="mx-auto max-w-[92rem] px-4 text-center text-xs text-[var(--muted-foreground)] sm:px-6">
    <summary className="inline-flex min-h-11 items-center">Technical details</summary>
    <div className="sky-mono flex flex-wrap items-center justify-center gap-2 pb-2"><span>NOAA settlement · Solana Devnet</span><span aria-hidden>·</span><button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:bg-[var(--surface-2)]" title="Copy program ID">Program {PROGRAM_ID.slice(0, 4)}…{PROGRAM_ID.slice(-4)}{copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
  </details>;
}

export default function Layout() {
  return <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
    <a href="#main-content" className="sr-only z-[100] rounded-lg bg-[var(--identity)] px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to main content</a>
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[92rem] items-center justify-between gap-3 px-4 sm:px-6">
        <NavLink to="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label="SkyHedge home"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--identity)] text-white"><CloudRain className="h-5 w-5" /></span><span className="min-w-0 leading-tight"><span className="block text-base font-semibold tracking-tight">SkyHedge</span><span className="hidden text-xs text-[var(--muted-foreground)] sm:block">Weather protection</span></span></NavLink>
        <div className="flex items-center gap-2"><NetworkPill /><WalletButton /></div>
      </div>
    </header>
    <DevnetTesterNotice />
    <main id="main-content" className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-5 sm:px-6 sm:py-7"><Outlet /></main>
    <footer className="border-t border-[var(--border)] bg-[var(--surface-1)] py-2"><TechnicalFooter /></footer>
  </div>;
}
