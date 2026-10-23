import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

function NetworkPill() {
  const network = import.meta.env.VITE_SOLANA_RPC_URL?.includes("8899") ? "Localnet" : "Devnet";
  return <span className="devnet-tag">{network}</span>;
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
    <a href="#main-content" className="sr-only z-[100] rounded-lg bg-[var(--identity)] px-4 py-3 text-[var(--action-text)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to main content</a>
    <header className="sky-app-header sticky top-0 z-30">
      <div className="sky-app-header__row">
        <NavLink to="/app" className="sky-app-header__brand" aria-label="SkyHedge app"><BrandMark size={32} /><strong>SkyHedge</strong></NavLink>
        <div className="sky-app-header__actions"><NavLink to="/" className="hidden min-h-12 items-center px-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] sm:inline-flex">Waitlist</NavLink><NetworkPill /><WalletButton /></div>
      </div>
    </header>
    <main id="main-content" className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
    <footer className="bg-[var(--surface-1)] py-2"><TechnicalFooter /></footer>
  </div>;
}
