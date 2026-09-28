import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity, AlertTriangle, Code2, Database, Droplets, ExternalLink, FileCheck2, Globe2, MapPin, Menu, Search, ShieldCheck, ShieldPlus, WalletCards, X } from "lucide-react";
import type { ClaimReadiness, DevnetStatus, EvidenceRow, HealthResponse, Portfolio, Quote, UnsignedTx } from "@/lib/types";
import { api, apiUnavailable, mm, skytDisplay } from "@/lib/api";
import { Card, EmptyState, Pill, SectionLabel, Stat } from "@/components/sky";
import { AgriculturalAreaMap } from "@/components/sky/agricultural-area-map";
import { AgriculturalMarketExplorerMap } from "@/components/sky/agricultural-market-explorer-map";
import { cn } from "@/lib/utils";
import { approveAndConfirm, approveAndConfirmDesMoinesSeed, desMoinesSeedTransactions, explorerTx, initializeProtocolTransaction, isProtocolAdmin, issueSkytTransaction, protocolExists, SKYT_ISSUANCE } from "@/lib/admin";
import { finalizedSkytMintSupply, finalizedWalletState, PROTOCOL_ADMIN, signAndSend } from "@/lib/solana";
import { initialSkytMintState } from "../../../shared/mint-issuance";
import { isValidImmutableMarketPricingTerms } from "../../../shared/market-pricing";
import { AGRICULTURAL_MARKETS, agriculturalMarketBySlug, agriculturalMarketLocation, millimetersToInches, searchAgriculturalMarkets, type AgriculturalMarketSlug } from "../../../shared/agricultural-markets";

const MARKETS = AGRICULTURAL_MARKETS.map((market) => ({ id: market.slug, city: market.name, location: agriculturalMarketLocation(market), station: market.evidenceStatus === "validated" ? market.noaaStationId : "NOAA station validation in progress", crops: market.crops, region: market.region, context: market.agriculturalContext, evidenceStatus: market.evidenceStatus })) as Array<{ id: AgriculturalMarketSlug; city: string; location: string; station: string | null; crops: readonly string[]; region: string; context: string; evidenceStatus: "researching_evidence" | "validated" }>;
const TABS = [
  { id: "markets", label: "Markets", icon: Activity },
  { id: "protect", label: "Protect", icon: ShieldPlus },
  { id: "liquidity", label: "Liquidity", icon: Droplets },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "builders", label: "Builder", icon: Code2 },
] as const;
type Tab = (typeof TABS)[number]["id"];
type MarketId = AgriculturalMarketSlug;
const MARKET_REGIONS = ["North America", "South America", "Emerging markets"] as const;
const TESTER_PROTECTION_CAP_BASE = 500_000_000n;
const today = new Date().toISOString().slice(0, 10);
const weekFromToday = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const PAGE_COPY: Record<Tab, { title: string; description: string }> = {
  markets: { title: "Agricultural rainfall protection", description: "Explore researched crop regions and understand each index before protection becomes available." },
  protect: { title: "Create a protection plan", description: "Choose an amount, rainfall threshold, and observation window for the selected agricultural area." },
  liquidity: { title: "Provide test liquidity", description: "Review collateral safeguards and market constraints before contributing to a Devnet pool." },
  portfolio: { title: "Your protection portfolio", description: "View finalized wallet balances and positions directly from Solana Devnet." },
  evidence: { title: "Weather evidence", description: "Review the NOAA-only evidence path used for deterministic settlement." },
  builders: { title: "Builder mode", description: "Administer and verify the SkyHedge Devnet protocol using finalized on-chain state." },
};

function validTab(value: string | null): Tab { return TABS.some((tab) => tab.id === value) ? value as Tab : "markets"; }
function validMarket(value: string | null): MarketId { return MARKETS.some((market) => market.id === value) ? value as MarketId : "des-moines"; }
function baseUnits(value: string): string | null {
  if (!/^\d+(\.\d{0,6})?$/.test(value) || Number(value) <= 0) return null;
  const [whole, fractional = ""] = value.split(".");
  return `${whole}${fractional.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
}
function isOpenDesMoinesMarket(status: DevnetStatus | undefined): boolean {
  const market = status?.desMoinesMarket;
  return Boolean(market?.status === "ready" && market.address && market.vaultBalance && BigInt(market.vaultBalance) > 0n && /"open"\s*:/i.test(market.onchainStatus ?? ""));
}
function evidenceValidated(id: MarketId, status: DevnetStatus | undefined): boolean {
  return id === "des-moines" && status?.desMoinesMarket.evidenceStatus === "validated";
}
function utcDateFromSeconds(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1_000).toISOString().slice(0, 10) : null;
}
function immutableDesMoinesWindow(status: DevnetStatus | undefined) {
  const market = status?.desMoinesMarket;
  const start = utcDateFromSeconds(market?.observationStart);
  const end = utcDateFromSeconds(market?.observationEnd);
  const thresholdMm = market?.thresholdMmX100 ? Number(market.thresholdMmX100) / 100 : null;
  return start && end && thresholdMm && market?.operator ? { start, end, thresholdMm, operator: market.operator, salesCloseAt: market?.salesCloseAt ?? null } : null;
}

export default function DashboardPage() {
  const query = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<Tab>(() => validTab(query.get("tab")));
  const [marketId, setMarketId] = useState<MarketId>(() => validMarket(query.get("city")));
  const [amount, setAmount] = useState("100");
  const [threshold, setThreshold] = useState("50");
  const [operator, setOperator] = useState<"gte" | "lte">("gte");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(weekFromToday);
  const [quoteRequest, setQuoteRequest] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const amountBase = baseUnits(amount);
  const selectedMarket = agriculturalMarketBySlug(marketId)!;
  const devnetStatus = useQuery({ queryKey: ["devnet-status"], queryFn: () => api<DevnetStatus>("/api/devnet/status"), retry: false, refetchInterval: 30_000 });
  const testerMarketReady = marketId === "des-moines" && isOpenDesMoinesMarket(devnetStatus.data);
  const testerEvidenceReady = evidenceValidated(marketId, devnetStatus.data);
  const onchainWindow = immutableDesMoinesWindow(devnetStatus.data);
  const usingImmutableWindow = marketId === "des-moines" && Boolean(onchainWindow);
  const quoteQuery = useQuery({
    queryKey: ["quote", quoteRequest, marketId, amountBase, start, end, Number(threshold), operator],
    queryFn: () => api<Quote>("/api/quotes", { method: "POST", body: JSON.stringify({ city: marketId, observationStart: start, observationEnd: end, thresholdMm: Number(threshold), operator, protectedAmount: amountBase }) }),
    enabled: quoteRequest > 0 && testerMarketReady && testerEvidenceReady && Boolean(amountBase) && Boolean(threshold) && start < end,
    retry: false,
  });
  const currentQuote = quoteQuery.data
    && amountBase === quoteQuery.data.protectedAmount
    && devnetStatus.data?.desMoinesMarket.quoteProbabilityBps === quoteQuery.data.probabilityBps
    && devnetStatus.data.desMoinesMarket.premiumRateBps === quoteQuery.data.premiumRateBps
    ? quoteQuery.data
    : undefined;
  const switchTab = (next: Tab, selectedMarket: MarketId = marketId) => { setTab(next); window.history.replaceState(null, "", `/?tab=${next}&city=${selectedMarket}`); };
  const selectMarket = (id: MarketId) => { setMarketId(id); setQuoteRequest(0); switchTab("protect", id); };

  useEffect(() => {
    if (marketId !== "des-moines" || !onchainWindow) return;
    setStart(onchainWindow.start);
    setEnd(onchainWindow.end);
    setThreshold(String(onchainWindow.thresholdMm));
    if (onchainWindow.operator === "gte" || onchainWindow.operator === "lte") setOperator(onchainWindow.operator);
    setQuoteRequest(0);
  }, [marketId, onchainWindow?.start, onchainWindow?.end, onchainWindow?.thresholdMm, onchainWindow?.operator]);

  useEffect(() => {
    document.documentElement.dataset.uiMode = tab === "builders" ? "builder" : "customer";
    return () => { document.documentElement.dataset.uiMode = "customer"; };
  }, [tab]);

  useEffect(() => {
    if (!moreOpen) return;
    document.querySelector<HTMLButtonElement>('[aria-label="Close more menu"]')?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const page = PAGE_COPY[tab];
  return <div className="grid min-w-0 gap-7 lg:grid-cols-[224px_minmax(0,1fr)]">
    <aside className="hidden lg:block"><nav aria-label="Product sections" className="sticky top-24 flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-2 shadow-[var(--shadow-card)]">{TABS.map(({ id, label, icon: Icon }, index) => <button key={id} onClick={() => switchTab(id)} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors", index === TABS.length - 1 && "mt-3 border-t border-[var(--border)] pt-3", tab === id ? "bg-[var(--identity-dim)] text-[var(--identity-deep)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]")}><Icon className="h-5 w-5" />{label}</button>)}</nav></aside>
    <div className="min-w-0 space-y-6">
      <header className="border-b border-[var(--border)] pb-5"><Pill tone={tab === "builders" ? "slate" : "cyan"}>{tab === "builders" ? "Technical workspace" : "NOAA-settled protection"}</Pill><h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{page.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">{page.description}</p></header>
      {tab === "markets" && <Markets onSelect={selectMarket} selectedSlug={marketId} status={devnetStatus.data} />}
      {tab === "protect" && <Protect marketId={marketId} amount={amount} amountBase={amountBase} setAmount={setAmount} threshold={threshold} setThreshold={setThreshold} operator={operator} setOperator={setOperator} start={start} setStart={setStart} end={end} setEnd={setEnd} status={devnetStatus.data} windowLocked={usingImmutableWindow} salesCloseAt={onchainWindow?.salesCloseAt ?? null} valid={testerMarketReady && testerEvidenceReady && Boolean(amountBase) && start < end && (!onchainWindow || (start === onchainWindow.start && end === onchainWindow.end && Number(threshold) === onchainWindow.thresholdMm && operator === onchainWindow.operator)) && Number(threshold) > 0 && BigInt(amountBase ?? "0") <= TESTER_PROTECTION_CAP_BASE} requestQuote={() => setQuoteRequest((count) => count + 1)} quote={currentQuote} loading={quoteQuery.isFetching} error={quoteQuery.error} />}
      {tab === "liquidity" && <Liquidity />}
      {tab === "portfolio" && <PortfolioView />}
      {tab === "evidence" && <Evidence />}
      {tab === "builders" && <div className="space-y-6"><OwnerConsole status={devnetStatus.data} /><BuilderProof /></div>}
    </div>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface-1)] px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {TABS.filter(({ id }) => ["markets", "protect", "portfolio", "evidence"].includes(id)).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setMoreOpen(false); switchTab(id); }} className={cn("flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium", tab === id ? "text-[var(--identity)]" : "text-[var(--muted-foreground)]")}><Icon className="h-5 w-5" />{label}</button>)}
      <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)} className={cn("flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium", moreOpen || tab === "liquidity" || tab === "builders" ? "text-[var(--identity)]" : "text-[var(--muted-foreground)]")}><Menu className="h-5 w-5" />More</button>
    </nav>
    {moreOpen && <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setMoreOpen(false)}><section role="dialog" aria-modal="true" aria-label="More sections" className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold">More</h2><button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--surface-2)]" onClick={() => setMoreOpen(false)} aria-label="Close more menu"><X className="h-5 w-5" /></button></div>{TABS.filter(({ id }) => id === "liquidity" || id === "builders").map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setMoreOpen(false); switchTab(id); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-[var(--surface-2)]"><Icon className="h-5 w-5" />{label}</button>)}</section></div>}
  </div>;
}

function BuilderProof() {
  const status = useQuery({ queryKey: ["devnet-status"], queryFn: () => api<DevnetStatus>("/api/devnet/status"), retry: false, refetchInterval: 30_000 });
  const health = useQuery({ queryKey: ["health"], queryFn: () => api<HealthResponse>("/api/health"), retry: false, refetchInterval: 30_000 });
  const data = status.data;
  const worker = health.data?.checks?.settlement;
  const missingWorkerConfig = worker ? [!worker.signerConfigured && "settlement signer", !worker.noaaConfigured && "NOAA credential", !worker.cronAuthConfigured && "cron authentication"].filter(Boolean).join(", ") : "health endpoint unavailable";
  const rows = data ? [
    ["Program executable", data.program.status, data.program.executable ? "Executable account verified on Devnet." : "Program account is not executable yet.", data.program.explorerUrl],
    ["IDL available", data.idl.status, `${data.idl.instructionCount} instructions and ${data.idl.accountCount} account types loaded from the committed IDL.`, null],
    ["Protocol initialized", data.protocol.status, data.protocol.initialized ? `Next market id ${data.protocol.nextMarketId ?? "0"}.` : "Protocol PDA has not been initialized.", null],
    ["SKYT mint ready", data.skytMint.status, data.skytMint.exists ? `Supply ${skytDisplay(data.skytMint.supply ?? "0")} with ${data.skytMint.decimals ?? 0} decimals.` : "Configured SKYT mint is not found.", null],
    ["Des Moines market", data.desMoinesMarket.status, data.desMoinesMarket.address ? `Market ${data.desMoinesMarket.marketId} found; vault balance ${skytDisplay(data.desMoinesMarket.vaultBalance ?? "0")}.` : "Not seeded yet; Des Moines remains the first activation target.", null],
    ["NOAA station validation", data.noaaEvidence.status === "ready" ? "sample only" : data.noaaEvidence.status, data.noaaEvidence.message, null],
    ["Market pricing terms", data.noaaEvidence.package?.quoteTerms ? "ready" : "unavailable", data.noaaEvidence.package?.quoteTerms ? "Complete NOAA QPF and ten historical windows produced immutable terms for the exact five-day schedule." : data.noaaEvidence.status === "ready" ? "Historical station validation succeeded, but exact-window NOAA QPF or historical quote inputs are incomplete. Market seeding and checkout stay locked." : "NOAA station evidence is unavailable; no market pricing package can be prepared.", null],
    ["Oracle settlement worker", health.isLoading ? "pending" : health.isError || !worker || worker.status !== "configured" ? "unavailable" : "ready", worker?.status === "configured" ? "NOAA settlement signer, NOAA credential, and scheduled-cron authentication are configured." : `Automatic NOAA settlement is not ready; missing or unavailable: ${missingWorkerConfig}.`, null],
  ] as const : [];
  return <section className="space-y-6"><header className="border-b border-[var(--border)] pb-6"><p className="sky-section-label text-[var(--identity)]">SOLANA BUILDER PROOF</p><h2 className="sky-display mt-2 max-w-3xl text-2xl font-semibold sm:text-3xl">Climate protection, with verifiable settlement.</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">SkyHedge is building a consumer-friendly climate-risk product with Solana used as the transparent settlement rail—not as a requirement for customers to understand or use crypto.</p></header><div className="grid gap-4 md:grid-cols-3"><Stat label="Protocol model" value="Fixed payout" accent="cyan" /><Stat label="Settlement source" value="NOAA only" accent="green" /><Stat label="Public collateral" value="USDC planned" accent="amber" /></div><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card className="p-5"><SectionLabel>Live Devnet status</SectionLabel>{status.isLoading ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Reading finalized Devnet state...</p> : status.isError ? <p role="alert" className="mt-3 text-sm text-[var(--warning)]">Devnet status is unavailable from this deployment.</p> : <div className="space-y-3">{rows.map(([title, rowStatus, detail, href]) => <div key={title} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)]">{detail}{href && <> <a className="text-[var(--identity)] underline underline-offset-4" href={href} target="_blank" rel="noreferrer">Explorer</a></>}</p></div><Pill tone={rowStatus === "ready" ? "green" : rowStatus === "pending" || rowStatus === "sample only" ? "amber" : "red"}>{rowStatus}</Pill></div>)}</div>}</Card><Card className="p-5"><Pill tone="cyan">Grant-ready narrative</Pill><h3 className="sky-display mt-4 text-xl font-semibold">Why Solana?</h3><p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">USDC collateral can be escrowed transparently; immutable market terms and source-hashed weather evidence make every settlement auditable. Customers may eventually pay by bank, card, or self-custody wallet.</p><a className="sky-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2" href="https://github.com/msourial/SkyHedge-Sol" target="_blank" rel="noreferrer">View open-source build <ExternalLink className="h-4 w-4" /></a></Card></div><Card className="p-5"><SectionLabel>Current funding milestone</SectionLabel><h3 className="sky-display text-lg font-semibold">One reproducible agricultural-market lifecycle on Devnet.</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">The next public proof is protocol initialization, one NOAA-pinned Des Moines market, real test collateral transfers, and an Explorer-linked payout or data-unavailable refund. SkyHedge does not represent this milestone as complete until every transaction is finalized.</p></Card></section>;
}

function OwnerConsole({ status }: { status?: DevnetStatus }) {
  const wallet = useWallet();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"initialize" | "mint" | "seed" | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string; signature?: string } | null>(null);
  const owner = isProtocolAdmin(wallet.publicKey);
  const mintSupply = useQuery({ queryKey: ["admin-skyt-finalized-mint-supply"], queryFn: finalizedSkytMintSupply, enabled: owner && initialized === true, retry: false, refetchInterval: 30_000 });
  const mintState = initialSkytMintState(mintSupply.data, mintSupply.isError);
  const quoteTerms = status?.noaaEvidence.package?.quoteTerms;
  const seedPricingReady = status?.noaaEvidence.status === "ready" && isValidImmutableMarketPricingTerms(quoteTerms);
  useEffect(() => {
    let active = true;
    protocolExists().then((value) => active && setInitialized(value)).catch(() => active && setInitialized(null));
    return () => { active = false; };
  }, [wallet.publicKey?.toBase58()]);
  if (!wallet.connected) return <section aria-labelledby="owner-console-gate" className="rounded-xl border border-[var(--warning)]/50 bg-[var(--surface-1)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="sky-section-label text-[var(--warning)]">OWNER APPROVAL REQUIRED</p><h2 id="owner-console-gate" className="sky-display mt-1 text-xl font-semibold">Connect the protocol admin wallet</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">Connect the protocol admin wallet to show the Devnet setup and market-seeding approvals. In the header, choose Phantom or Solflare and connect <span className="font-medium text-[var(--foreground)]">{PROTOCOL_ADMIN.slice(0, 4)}…{PROTOCOL_ADMIN.slice(-4)}</span> on Devnet.</p></div><Pill tone="amber">Wallet not connected</Pill></div>
    <p role="status" className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">Connecting only reveals the owner controls. No transaction is sent unless you review and approve it in your wallet.</p>
  </section>;
  if (!owner) return <div role="status" className="border border-[var(--border)] bg-[var(--surface-1)] p-4 text-sm text-[var(--muted-foreground)]">Connected wallet is not the configured protocol admin. Owner controls are restricted to {PROTOCOL_ADMIN.slice(0, 4)}…{PROTOCOL_ADMIN.slice(-4)}.</div>;
  const run = async (kind: "initialize" | "mint" | "seed") => {
    if (!wallet.publicKey) return;
    setBusy(kind); setMessage(null);
    try {
      if (kind === "mint") {
        const latestSupply = await finalizedSkytMintSupply();
        const latestMintState = initialSkytMintState(latestSupply);
        if (latestMintState !== "available") throw new Error(latestMintState === "already-issued" ? `Finalized SKYT mint supply is already ${skytDisplay(latestSupply)}. This Builder flow will not repeat the initial allocation.` : "Could not verify the finalized Devnet mint supply; issuance is locked until the RPC read succeeds.");
      }
      if (kind === "seed") {
        const evidence = await api<{ validated: true; stationId: string; stationIdHash: string; providerHash: string; methodologyHash: string; seedSchedule: { salesCloseAt: number; observationStart: number; observationEnd: number }; quoteTerms: null | { probabilityBps: number; premiumRateBps: number; inputsHash: string } }>("/api/evidence-package");
        const seed = await desMoinesSeedTransactions(wallet.publicKey, evidence);
        const signatures = await approveAndConfirmDesMoinesSeed(seed, wallet, (step, signature) => {
          setMessage({ tone: "green", text: `Des Moines ${step} transaction finalized. Continue with the next wallet approval.`, signature });
        });
        setMessage({ tone: "green", text: "Des Moines market created, funded, and opened on finalized Devnet.", signature: signatures[2] });
        return;
      }
      const transaction = kind === "initialize" ? initializeProtocolTransaction(wallet.publicKey) : issueSkytTransaction(wallet.publicKey);
      const signature = await approveAndConfirm(transaction, wallet);
      setMessage({ tone: "green", text: kind === "initialize" ? "Protocol initialized on finalized Devnet." : "50,000 SKYT minted to your associated token account.", signature });
      if (kind === "initialize") setInitialized(true);
      if (kind === "mint") await mintSupply.refetch();
    } catch (error) { setMessage({ tone: "red", text: error instanceof Error ? error.message : "Wallet approval did not complete." }); }
    finally { setBusy(null); }
  };
  return <section aria-labelledby="owner-console" className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-card)]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="sky-section-label text-[var(--identity)]">Owner-only Devnet controls</p><h2 id="owner-console" className="sky-display mt-1 text-xl font-semibold">Initialize the real protocol.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">Each action opens your connected wallet. Nothing is submitted until you approve it; final status is checked against Devnet.</p></div><Pill tone={initialized ? "green" : "amber"}>{initialized ? "Protocol finalized" : initialized === false ? "Initialization required" : "Checking Devnet"}</Pill></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-3"><Card className="p-4"><ShieldCheck className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">1. Initialize protocol</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Pins the SKYT collateral mint, protocol PDA, fee vault, and separate settlement authority.</p><button disabled={busy !== null || initialized !== false} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("initialize")}>{busy === "initialize" ? "Awaiting wallet…" : initialized ? "Protocol initialized" : "Approve initialization"}</button></Card><Card className="p-4"><WalletCards className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">2. Issue Devnet test collateral</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Mints exactly {(Number(SKYT_ISSUANCE) / 1_000_000).toLocaleString()} SKYT with six decimals to your wallet. {mintState === "already-issued" ? `Finalized mint supply is ${skytDisplay(mintSupply.data ?? "0")} SKYT; this Builder flow will not reissue the initial allocation.` : mintState === "checking" ? "Checking finalized SKYT mint supply before enabling the initial allocation." : mintState === "unavailable" ? "Finalized mint-supply read unavailable; issuance stays locked." : "The initial allocation is available only while finalized mint supply is zero."}</p><button disabled={busy !== null || initialized !== true || mintState !== "available"} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("mint")}>{busy === "mint" ? "Awaiting wallet…" : mintState === "already-issued" ? "Initial allocation already issued" : mintState === "checking" ? "Checking finalized mint supply…" : mintState === "unavailable" ? "Mint-supply check unavailable" : "Approve 50,000 SKYT mint"}</button><p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">This is a Builder safeguard, not an on-chain mint cap: the configured mint authority can still issue SKYT through another transaction.</p></Card><Card className="p-4"><FileCheck2 className={cn("h-5 w-5", seedPricingReady ? "text-[var(--success)]" : "text-[var(--warning)]")} aria-hidden /><h3 className="mt-3 text-sm font-semibold">3. Seed Des Moines</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{status?.noaaEvidence.status === "ready" ? seedPricingReady ? "NOAA has priced the exact immutable dates using complete five-day QPF coverage and ten historical windows." : "Station history is validated, but complete NOAA QPF or historical quote inputs for the exact future dates are unavailable." : "A validated NOAA station package is not available yet; market creation stays locked."} The Devnet test window is five full UTC days after the 24-hour sales period; historical rainfall is never substituted for future forecast evidence.</p><button disabled={busy !== null || initialized !== true || !seedPricingReady} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("seed")}>{busy === "seed" ? "Awaiting 3 wallet approvals…" : seedPricingReady ? "Approve Des Moines seed" : "Actuarial pricing package unavailable"}</button><p className="mt-2 text-[11px] leading-relaxed text-[var(--warning)]">No default 20% probability or substitute data will be committed. Seeding unlocks only when exact-window pricing terms and their input hash are produced.</p></Card></div>
    <p className="mt-4 text-xs text-[var(--faint)]">Only the admin wallet can seed this market. NOAA station GHCND:USW00014933 is queried immediately before transaction preparation; no placeholder evidence is accepted.</p>
    {message && <p role="alert" className={cn("mt-4 border p-3 text-sm", message.tone === "green" ? "border-[var(--success)]/50 text-[var(--success)]" : "border-[var(--destructive)]/50 text-[var(--destructive-foreground)]")}>{message.text}{message.signature && <> <a className="underline" href={explorerTx(message.signature)} target="_blank" rel="noreferrer">View finalized transaction</a></>}</p>}
  </section>;
}

function DeploymentNotice() { return <div role="status" className="flex gap-3 border border-[var(--warning)]/50 bg-[var(--warning-dim)] p-4 text-sm text-[var(--muted-foreground)]"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" /><p><strong className="text-[var(--foreground)]">Chain data unavailable.</strong> The Devnet program has not yet published an executable account, or this deployment has no API service. Markets, positions, and settlement evidence remain unavailable rather than simulated.</p></div>; }

function Markets({ onSelect, selectedSlug, status }: { onSelect: (id: MarketId) => void; selectedSlug: MarketId; status?: DevnetStatus }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchAgriculturalMarkets(query).map((market) => MARKETS.find((item) => item.id === market.slug)!).filter(Boolean), [query]);
  const dropdownOptions = useMemo(() => [
    ...MARKET_REGIONS.map((region) => ({ kind: "region" as const, region })),
    ...results.map((market) => ({ kind: "market" as const, market })),
  ], [results]);
  const showingAllCatalog = query.trim().length === 0 || showAll;
  const mapMarkets = useMemo(() => results.map((market) => agriculturalMarketBySlug(market.id)!).filter(Boolean), [results]);
  const getEvidenceStatus = useCallback((market: (typeof AGRICULTURAL_MARKETS)[number]): "researching_evidence" | "validated" | "DATA_UNAVAILABLE" => (
    evidenceValidated(market.slug as MarketId, status) ? "validated" : market.evidenceStatus
  ), [status]);

  useEffect(() => {
    const closeWhenOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) { setDropdownOpen(false); setActiveOption(-1); }
    };
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  const selectDropdownOption = (index: number) => {
    const option = dropdownOptions[index];
    if (!option) return;
    setDropdownOpen(false); setActiveOption(-1);
    if (option.kind === "region") { setQuery(option.region); setShowAll(false); return; }
    onSelect(option.market.id);
  };
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setDropdownOpen(false); setActiveOption(-1); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setDropdownOpen(true);
      setActiveOption((current) => event.key === "ArrowDown" ? (current + 1) % dropdownOptions.length : (current <= 0 ? dropdownOptions.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter" && dropdownOpen && activeOption >= 0) { event.preventDefault(); selectDropdownOption(activeOption); }
  };

  return <section className="space-y-4" aria-labelledby="markets-heading">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <SectionLabel>Agricultural rainfall indexes</SectionLabel>
        <h2 id="markets-heading" className="sky-display mt-1 text-2xl font-semibold">Explore crop-risk reference areas</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">Browse the catalog by location, crop, or region. Map markers are index reference points—not weather stations or insured boundaries.</p>
      </div>
      <Pill tone="amber">USD preview only</Pill>
    </header>

    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <AgriculturalMarketExplorerMap markets={mapMarkets} selectedSlug={selectedSlug} getEvidenceStatus={getEvidenceStatus} onSelect={onSelect} />

      <aside className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]" aria-label="Agricultural index locations">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Index reference locations</h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{results.length} catalog {results.length === 1 ? "area" : "areas"}</p>
          </div>
          <MapPin className="h-5 w-5 shrink-0 text-[var(--identity)]" aria-hidden="true" />
        </div>

        <div ref={searchRef} className="relative mt-4">
          <label className="sky-label" htmlFor="market-search">Find an index</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" />
            <input id="market-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={dropdownOpen} aria-controls="market-search-options" aria-activedescendant={activeOption >= 0 ? `market-search-option-${activeOption}` : undefined} className="sky-input min-h-11 w-full pl-11 pr-12" value={query} onFocus={() => setDropdownOpen(true)} onKeyDown={onSearchKeyDown} onChange={(event) => { setQuery(event.target.value); setShowAll(false); setDropdownOpen(true); setActiveOption(-1); }} placeholder="Search area, country, region, or crop" autoComplete="off" />
            {query && <button type="button" onClick={() => { setQuery(""); setShowAll(false); setDropdownOpen(true); setActiveOption(-1); }} className="absolute right-1 top-1/2 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]" aria-label="Clear market search"><X className="h-4 w-4" aria-hidden="true" /></button>}
          </div>
          {dropdownOpen && <div id="market-search-options" role="listbox" aria-label="Available regions and matching areas" className="absolute inset-x-0 z-20 mt-2 max-h-[min(60vh,32rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-2 shadow-xl">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold text-[var(--faint)]">Available regions</p>
            {MARKET_REGIONS.map((region, index) => <button key={region} id={`market-search-option-${index}`} role="option" aria-selected={activeOption === index} type="button" className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors", activeOption === index ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--foreground)] hover:bg-[var(--surface-2)]")} onMouseEnter={() => setActiveOption(index)} onClick={() => selectDropdownOption(index)}><Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{region}</span></button>)}
            <div className="my-2 border-t border-[var(--border)]" />
            <p className="px-3 pb-2 pt-1 text-xs font-semibold text-[var(--faint)]">Matching areas</p>
            {results.length ? results.map((market, resultIndex) => { const index = MARKET_REGIONS.length + resultIndex; return <button key={market.id} id={`market-search-option-${index}`} role="option" aria-label={`${market.city}; ${market.location}; ${market.region}; ${market.crops.join(", ")}`} aria-selected={activeOption === index} type="button" className={cn("flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", activeOption === index ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--foreground)] hover:bg-[var(--surface-2)]")} onMouseEnter={() => setActiveOption(index)} onClick={() => selectDropdownOption(index)}><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words"><span className="block font-medium">{market.city}</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{market.location}</span><span className="mt-0.5 block text-xs text-[var(--faint)]">{market.region} · {market.crops.join(", ")}</span></span></button>; }) : <p role="status" className="px-3 py-3 text-sm text-[var(--muted-foreground)]">No researched areas match this search.</p>}
          </div>}
          <p role="status" className="mt-2 text-xs text-[var(--muted-foreground)]">{showingAllCatalog ? "All researched catalog areas are shown." : `${results.length} researched ${results.length === 1 ? "area" : "areas"} found.`}</p>
        </div>

        {results.length === 0 ? <EmptyState icon={<Search className="h-7 w-7" />} title="No catalog matches" hint="An unlisted place is not yet a validated index." cta={<button type="button" className="sky-btn-primary mt-3 min-h-11 px-4" onClick={() => { setQuery(""); setShowAll(true); }}>Show all researched areas</button>} /> : <div className="mt-3 max-h-[30rem] space-y-2 overflow-y-auto pr-1" aria-label="Matching agricultural locations">
          {results.map((market) => {
            const evidence = getEvidenceStatus(agriculturalMarketBySlug(market.id)!);
            const evidenceLabel = evidence === "validated" ? "NOAA station validated" : evidence === "DATA_UNAVAILABLE" ? "Data unavailable" : "Researching evidence";
            return <button key={market.id} type="button" data-testid={`market-index-option-${market.id}`} data-latitude={agriculturalMarketBySlug(market.id)!.latitude} data-longitude={agriculturalMarketBySlug(market.id)!.longitude} aria-label={`${market.location}; ${evidenceLabel}`} aria-pressed={selectedSlug === market.id} onClick={() => onSelect(market.id)} className={cn("w-full rounded-xl border p-3 text-left transition-colors hover:border-[var(--identity)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]", selectedSlug === market.id ? "border-[var(--identity)] bg-[var(--identity-dim)]" : "border-[var(--border)] bg-[var(--surface-1)]")}>
              <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block font-semibold leading-snug">{market.city}</span><span className="mt-1 block break-words text-xs leading-relaxed text-[var(--muted-foreground)]">{market.location}</span></span><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--identity)]" aria-hidden="true" /></span>
              <span className="mt-2 block text-xs text-[var(--faint)]">{market.region} · {market.crops.join(", ")}</span>
              <span className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><span className={cn("h-2 w-2 shrink-0 rounded-full", evidence === "validated" ? "bg-[var(--success)]" : evidence === "DATA_UNAVAILABLE" ? "bg-[var(--destructive)]" : "bg-[var(--warning)]")} aria-hidden="true" />{evidenceLabel}</span>
            </button>;
          })}
        </div>}
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Selecting an area opens its protection details. A map pin is not proof of weather-station coverage.</p>
      </aside>
    </div>
  </section>;
}

function Protect(props: { marketId: MarketId; amount: string; amountBase: string | null; setAmount: (value: string) => void; threshold: string; setThreshold: (value: string) => void; operator: "gte" | "lte"; setOperator: (value: "gte" | "lte") => void; start: string; setStart: (value: string) => void; end: string; setEnd: (value: string) => void; status?: DevnetStatus; windowLocked: boolean; salesCloseAt: number | null; valid: boolean; requestQuote: () => void; quote?: Quote; loading: boolean; error: unknown }) {
  const market = MARKETS.find((item) => item.id === props.marketId)!;
  const wallet = useWallet();
  const [transaction, setTransaction] = useState<{ state: "idle" | "preparing" | "confirmed" | "error"; message?: string; signature?: string }>({ state: "idle" });
  const thresholdMm = Number(props.threshold) || 0;
  const hasThreshold = Number.isFinite(thresholdMm) && thresholdMm > 0;
  const evidenceReady = evidenceValidated(props.marketId, props.status);
  const marketReady = props.marketId === "des-moines" && isOpenDesMoinesMarket(props.status);
  const committedMarket = props.status?.desMoinesMarket;
  const quoteMatchesCurrentRequest = Boolean(props.quote
    && props.amountBase
    && props.quote.protectedAmount === props.amountBase
    && committedMarket?.quoteProbabilityBps === props.quote.probabilityBps
    && committedMarket?.premiumRateBps === props.quote.premiumRateBps);
  const canPurchase = props.valid && quoteMatchesCurrentRequest && Boolean(wallet.publicKey) && Boolean(committedMarket?.address);
  const reason = !evidenceReady ? "A final NOAA station package is not available yet." : !marketReady ? "The Des Moines test market has not been seeded and opened on finalized Devnet yet." : !wallet.publicKey ? "Connect a Devnet Phantom or Solflare wallet to continue." : !props.amountBase || BigInt(props.amountBase) > TESTER_PROTECTION_CAP_BASE ? "Open testers can protect up to 500 SKYT per wallet." : "Request a NOAA-backed quote before approving the Devnet transaction.";
  const approveProtection = async () => {
    if (!wallet.publicKey || !props.status?.desMoinesMarket.address || !props.amountBase || !props.quote) return;
    setTransaction({ state: "preparing", message: "Preparing an unsigned Devnet transaction for wallet approval…" });
    try {
      const unsigned = await api<UnsignedTx>("/api/transactions/unsigned", { method: "POST", body: JSON.stringify({ action: "open_position", market: props.status.desMoinesMarket.address, wallet: wallet.publicKey.toBase58(), amount: props.amountBase, approved: true }) });
      const signature = await signAndSend(unsigned.base64, wallet);
      setTransaction({ state: "confirmed", message: "Protection position finalized on Devnet.", signature });
    } catch (error) {
      setTransaction({ state: "error", message: error instanceof Error ? error.message : "The Devnet transaction was not completed." });
    }
  };
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="sky-hero-card">
      <SectionLabel className="text-[var(--identity)]">{market.city} agricultural index</SectionLabel>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{market.location}</p>
      <div className="mt-5"><AgriculturalAreaMap market={agriculturalMarketBySlug(props.marketId)!} status={evidenceReady ? "validated" : market.evidenceStatus} /></div>
      <h2 className="sky-display mt-2 text-2xl font-semibold">Measure rainfall, protect crop exposure.</h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">This index measures cumulative liquid rainfall. {hasThreshold ? `${thresholdMm} mm equals ${millimetersToInches(thresholdMm)} in.` : "Millimetres are canonical; inches are a display conversion."}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Protection amount (USD preview)"><input className="sky-input" inputMode="decimal" value={props.amount} onChange={(event) => props.setAmount(event.target.value)} /></Field>
        <Field label="Rainfall threshold (mm / in)"><input className="sky-input" inputMode="decimal" aria-describedby="threshold-unit-help" value={props.threshold} disabled={props.windowLocked} onChange={(event) => props.setThreshold(event.target.value)} /><p id="threshold-unit-help" aria-live="polite" className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{hasThreshold ? `${thresholdMm} mm = ${millimetersToInches(thresholdMm)} in. ${props.windowLocked ? "This seeded market value is immutable." : "Enter millimetres; inches are display-only."}` : "Enter millimetres; inches are displayed here for reference."}</p></Field>
        <Field label="Risk direction"><select className="sky-input" value={props.operator} disabled={props.windowLocked} onChange={(event) => props.setOperator(event.target.value as "gte" | "lte")}><option value="gte">Rainfall at or above threshold</option><option value="lte">Rainfall at or below threshold</option></select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Window start"><input className="sky-input" type="date" value={props.start} disabled={props.windowLocked} onChange={(event) => props.setStart(event.target.value)} /></Field><Field label="Window end"><input className="sky-input" type="date" value={props.end} disabled={props.windowLocked} onChange={(event) => props.setEnd(event.target.value)} /></Field></div>
      </div>
      {props.windowLocked && <p role="status" className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Dates are committed on-chain for this market and cannot be changed. Sales close {props.salesCloseAt ? new Date(props.salesCloseAt * 1_000).toLocaleString() : "at the recorded on-chain deadline"}.</p>}
      {!marketReady || !evidenceReady ? <div role="alert" className="mt-4 border-l-2 border-[var(--warning)] bg-[var(--warning-dim)] p-4 text-sm leading-relaxed text-[var(--muted-foreground)]"><strong className="text-[var(--warning)]">Protection action unavailable.</strong> {reason}</div> : <p className="mt-4 text-sm text-[var(--success)]">Des Moines is open for capped Devnet testing. SKYT and test positions have no real-world value.</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button disabled={!props.valid || props.loading} className="sky-btn-secondary min-h-11 px-4" onClick={props.requestQuote}>{props.loading ? "Pricing from NOAA…" : "Request NOAA quote"}</button><button disabled={!canPurchase || transaction.state === "preparing"} aria-describedby={!canPurchase ? "protection-unavailable-reason" : undefined} className="sky-btn-primary min-h-11 px-4" onClick={() => void approveProtection()}>{transaction.state === "preparing" ? "Awaiting wallet…" : "Approve Devnet protection"}</button></div>
      {!canPurchase && <p id="protection-unavailable-reason" className="mt-3 text-xs text-[var(--muted-foreground)]">{reason}</p>}
      {transaction.state !== "idle" && <p role={transaction.state === "error" ? "alert" : "status"} className={cn("mt-4 border p-3 text-sm", transaction.state === "error" ? "border-[var(--destructive)]/50 text-[var(--destructive-foreground)]" : "border-[var(--success)]/50 text-[var(--success)]")}>{transaction.message}{transaction.signature && <> <a className="underline" href={explorerTx(transaction.signature)} target="_blank" rel="noreferrer">View finalized transaction</a></>}</p>}
    </section>
    <div className="space-y-5"><OracleSettlementPanel marketAddress={props.marketId === "des-moines" ? props.status?.desMoinesMarket.address ?? null : null} /><QuotePanel quote={props.quote} error={props.error} /></div>
  </div>;
}

function OracleSettlementPanel({ marketAddress }: { marketAddress: string | null }) {
  const wallet = useWallet();
  const claim = useQuery({
    queryKey: ["claim-readiness", marketAddress, wallet.publicKey?.toBase58()],
    queryFn: () => api<ClaimReadiness>(`/api/markets/${marketAddress}/positions/${wallet.publicKey!.toBase58()}/claim-readiness`),
    enabled: Boolean(marketAddress && wallet.connected && wallet.publicKey),
    retry: false,
    refetchInterval: 15_000,
  });
  const [transaction, setTransaction] = useState<{ state: "idle" | "preparing" | "confirmed" | "error"; message?: string; signature?: string }>({ state: "idle" });

  const approveClaim = async () => {
    if (!marketAddress || !wallet.publicKey || !claim.data?.action) return;
    setTransaction({ state: "preparing", message: "Preparing the finalized on-chain claim for wallet approval…" });
    try {
      const unsigned = await api<UnsignedTx>("/api/transactions/unsigned", {
        method: "POST",
        body: JSON.stringify({ action: claim.data.action, market: marketAddress, wallet: wallet.publicKey.toBase58(), approved: true }),
      });
      const signature = await signAndSend(unsigned.base64, wallet);
      setTransaction({ state: "confirmed", message: claim.data.action === "claim_payout" ? "Oracle-settled payout finalized on Devnet." : "Premium refund finalized on Devnet.", signature });
      await claim.refetch();
    } catch (error) {
      setTransaction({ state: "error", message: error instanceof Error ? error.message : "The claim was not completed." });
    }
  };

  return <Card className="border-[var(--border)] p-5">
    <SectionLabel>Oracle settlement</SectionLabel>
    <h2 className="sky-display mt-2 text-lg font-semibold">Payout verification</h2>
    {!wallet.connected ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Connect your wallet to check for a protection position and claim status.</p>
      : !marketAddress ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">No finalized market account is available for this area.</p>
        : claim.isLoading ? <p role="status" className="mt-3 text-sm text-[var(--muted-foreground)]">Checking finalized settlement and position state…</p>
          : claim.isError ? <p role="alert" className="mt-3 text-sm text-[var(--warning)]">Finalized claim status is unavailable. No claim transaction can be prepared.</p>
            : claim.data ? <>
              <Pill tone={claim.data.state === "claimable" ? "green" : claim.data.state === "pending" ? "amber" : claim.data.state === "not_claimable" ? "red" : "slate"}>{claim.data.state.replaceAll("_", " ")}</Pill>
              <p role="status" className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">{claim.data.reason}</p>
              <p className="sky-mono mt-2 text-[10px] text-[var(--faint)]">Finalized slot {claim.data.finalizedSlot} · outcome {claim.data.result.toUpperCase()}</p>
              {claim.data.amount && <p className="mt-2 text-sm font-semibold">{skytDisplay(claim.data.amount)} available</p>}
              {claim.data.observation && <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-[var(--muted-foreground)]">NOAA rainfall</dt><dd>{(Number(claim.data.observation.rainfallMmX100) / 100).toFixed(2)} mm</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Authorized oracle signer</dt><dd className="sky-mono mt-1 break-all">{claim.data.observation.authority}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">NOAA evidence hash</dt><dd className="sky-mono mt-1 break-all">{claim.data.observation.sourceHash}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Pinned station / methodology hashes</dt><dd className="sky-mono mt-1 break-all">{claim.data.observation.stationIdHash} / {claim.data.observation.methodologyHash}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Observation window (UTC)</dt><dd>{new Date(claim.data.observation.windowStart * 1_000).toISOString()} → {new Date(claim.data.observation.windowEnd * 1_000).toISOString()}</dd></div>
              </dl>}
              {(claim.data.observationSignature || claim.data.resolutionSignature) && <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--border)] pt-3 text-xs">
                {claim.data.observationSignature && <a className="text-[var(--identity)] underline underline-offset-4" href={explorerTx(claim.data.observationSignature)} target="_blank" rel="noreferrer">Oracle observation transaction</a>}
                {claim.data.resolutionSignature && <a className="text-[var(--identity)] underline underline-offset-4" href={explorerTx(claim.data.resolutionSignature)} target="_blank" rel="noreferrer">Final settlement transaction</a>}
              </div>}
              <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">The program verifies the authorized SkyHedge signer and the committed station, methodology, and dates. NOAA does not cryptographically sign this payload; the signer remains the trust boundary, and the source hash makes the submitted evidence auditable.</p>
              {claim.data.action && <button disabled={transaction.state === "preparing"} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => void approveClaim()}>{transaction.state === "preparing" ? "Waiting for wallet approval…" : claim.data.action === "claim_payout" ? "Approve payout claim" : "Approve premium refund"}</button>}
            </> : null}
    {transaction.state !== "idle" && <p role={transaction.state === "error" ? "alert" : "status"} className={cn("mt-4 border p-3 text-sm", transaction.state === "error" ? "border-[var(--destructive)]/50 text-[var(--destructive-foreground)]" : "border-[var(--success)]/50 text-[var(--success)]")}>{transaction.message}{transaction.signature && <> <a className="underline" href={explorerTx(transaction.signature)} target="_blank" rel="noreferrer">View finalized transaction</a></>}</p>}
  </Card>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="sky-label">{label}</span>{children}</label>; }
function QuotePanel({ quote, error }: { quote?: Quote; error: unknown }) { if (error) return <Card className="border-[var(--destructive)]/50"><Pill tone="red">DATA_UNAVAILABLE</Pill><h2 className="sky-display mt-4 text-lg">No quote was created.</h2><p role="alert" className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{apiUnavailable(error) ? "NOAA or pricing evidence is unavailable in this deployment. SkyHedge never substitutes generated weather data." : error instanceof Error ? error.message : "The protection request could not be priced."}</p></Card>; if (!quote) return <Card><Pill tone="magenta">Approval required</Pill><h2 className="sky-display mt-4 text-lg">Quote evidence will appear here.</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">The premium is derived from 70% historical probability and 30% NOAA forecast probability, with a 15% risk loading and 1% protocol fee.</p></Card>; return <Card className="border-[var(--identity)]/50"><Pill tone="cyan">Quote ready</Pill><h2 className="sky-display mt-4 text-lg">{skytDisplay(quote.premium)}</h2><p className="text-sm text-[var(--muted-foreground)]">Premium before explicit transaction approval</p><div className="mt-5 grid grid-cols-2 gap-2"><Stat label="Probability" value={`${(quote.probabilityBps / 100).toFixed(2)}%`} accent="cyan" /><Stat label="Premium rate" value={`${(quote.premiumRateBps / 100).toFixed(2)}%`} /><Stat label="Protocol fee" value={skytDisplay(quote.protocolFee)} /><Stat label="Model" value={quote.modelVersion} /></div><p className="sky-mono mt-4 break-all text-[10px] leading-relaxed text-[var(--faint)]">Methodology hash: {quote.inputsHash}</p><button disabled className="sky-btn-primary mt-5 min-h-11 w-full">Connect wallet to approve</button></Card>; }

function Liquidity() { return <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><Card><SectionLabel>Liquidity safeguards</SectionLabel><h2 className="sky-display text-xl">Collateral is available only before lock.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Guardrail title="Tester cap" text="A seeded test market can accept at most 10,000 SKYT total liquidity. SKYT has no real-world value." /><Guardrail title="Pre-lock only" text="LP funding and withdrawals are permitted only while the market is open." /><Guardrail title="Reserved exposure" text="Withdrawals cannot reduce collateral below protection already reserved." /><Guardrail title="Final accounting" text="The 1% protocol fee transfers after the claim deadline; residual funds redeem pro rata." /></div></Card><Card><Pill tone="amber">Gates not satisfied</Pill><h2 className="sky-display mt-4 text-lg">Liquidity actions unavailable</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">No finalized market has a verified program, published IDL, initialized protocol, validated NOAA evidence, and seeded collateral. The interface will not manufacture a funding or withdrawal transaction before those gates pass.</p><button disabled aria-describedby="liquidity-unavailable-reason" className="sky-btn-primary mt-5 min-h-11 w-full">Prepare liquidity unavailable</button><p id="liquidity-unavailable-reason" className="sr-only">Liquidity is unavailable until all finalized Devnet protocol and market gates pass.</p></Card></div>; }
function Guardrail({ title, text }: { title: string; text: string }) { return <div className="border-l-2 border-[var(--violet)] bg-[var(--surface-2)] p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{text}</p></div>; }
function PortfolioView() { const { publicKey, connected } = useWallet(); const portfolio = useQuery({ queryKey: ["portfolio", publicKey?.toBase58()], queryFn: () => api<Portfolio>(`/api/portfolio/${publicKey!.toBase58()}`), enabled: Boolean(publicKey), retry: false }); const balances = useQuery({ queryKey: ["finalized-wallet", publicKey?.toBase58()], queryFn: () => finalizedWalletState(publicKey!), enabled: Boolean(publicKey), retry: false, refetchInterval: 30_000 }); if (!connected || !publicKey) return <EmptyState icon={<WalletCards className="h-8 w-8" />} title="Connect Phantom or Solflare to inspect your portfolio" hint="Connected wallets read finalized Devnet balances directly; nothing is simulated." />; const data = portfolio.data; return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Wallet" value={`${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`} accent="cyan" /><Stat label="Finalized SOL" value={balances.data ? balances.data.sol.toFixed(4) : balances.isError ? "Unavailable" : "Loading…"} /><Stat label="Finalized SKYT" value={balances.data ? (Number(balances.data.skytBaseUnits) / 10 ** balances.data.skytDecimals).toLocaleString() : balances.isError ? "Unavailable" : "Loading…"} /><Stat label="Protections" value={data?.protections.length ?? "—"} /><Stat label="Liquidity positions" value={data?.liquidity.length ?? "—"} /></div><p role="status" className="text-xs text-[var(--muted-foreground)]">{balances.data ? `Balances read directly from finalized Devnet slot ${balances.data.slot}.` : balances.isError ? "Finalized Devnet balance read is unavailable; no balance is estimated." : "Reading balances directly from finalized Devnet…"}</p>{portfolio.isError ? <DeploymentNotice /> : data && data.protections.length + data.liquidity.length === 0 ? <EmptyState icon={<Database className="h-8 w-8" />} title="No finalized positions indexed" hint={data.message ?? "The indexer has not reported positions for this wallet."} /> : <Card><p className="text-sm text-[var(--muted-foreground)]">Fetching final-chain records…</p></Card>}</div>; }
function Evidence() {
  const evidence = useQuery({ queryKey: ["evidence"], queryFn: () => api<{ rows: EvidenceRow[] }>("/api/settlement/evidence"), retry: false });
  const [city, setCity] = useState<MarketId>("des-moines");
  const weatherXm = useQuery({ queryKey: ["weatherxm", city], queryFn: () => api<{ source: "WeatherXM"; settlementEligible: false; location: { latitude: number; longitude: number }; agent: { baseUrl: string; freeEndpoint: string; paidEndpoints: string[]; paymentProtocol: string; priceUsdPerRequest: string }; status: string; message: string }>(`/api/weatherxm/latest?city=${city}`), retry: false });
  return <section className="space-y-5"><div><SectionLabel>Evidence sources</SectionLabel><p className="max-w-2xl text-sm text-[var(--muted-foreground)]">NOAA is the sole settlement source. WeatherXM Agent API is supplemental context only and never determines a payout.</p></div><Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="sky-display text-lg">WeatherXM Agent API</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Free health checks are used to verify availability. Live weather observations require x402 payment and stay outside settlement.</p></div><select aria-label="WeatherXM market location" className="sky-input max-w-44" value={city} onChange={(event) => setCity(event.target.value as MarketId)}>{MARKETS.map((market) => <option key={market.id} value={market.id}>{market.city}</option>)}</select></div>{weatherXm.isLoading ? <p className="mt-4 text-sm text-[var(--muted-foreground)]">Checking WeatherXM Agent API availability...</p> : weatherXm.isError ? <p role="alert" className="mt-4 text-sm text-[var(--warning)]">WeatherXM Agent API is unreachable from this deployment. NOAA settlement is unchanged.</p> : weatherXm.data ? <div className="mt-4 grid gap-2 sm:grid-cols-3"><Stat label="Agent status" value="Reachable" accent="cyan" /><Stat label="Free endpoint" value={weatherXm.data.agent.freeEndpoint} /><Stat label="Observation calls" value={`x402 $${weatherXm.data.agent.priceUsdPerRequest}`} /></div> : null}{weatherXm.data ? <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">{weatherXm.data.message}</p> : null}</Card><AgriculturalAreaMap market={agriculturalMarketBySlug(city)!} status={agriculturalMarketBySlug(city)?.evidenceStatus ?? "researching_evidence"} />{evidence.isError ? <DeploymentNotice /> : !evidence.data?.rows.length ? <EmptyState icon={<FileCheck2 className="h-8 w-8" />} title="No finalized NOAA settlement evidence" hint="Evidence appears after a valid observation window is finalized on-chain." /> : <div className="space-y-3">{evidence.data.rows.map((item) => <Card key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="sky-display text-base">{item.city.replaceAll("-", " ")}</h2><p className="sky-mono mt-1 text-xs text-[var(--faint)]">{item.windowStart} → {item.windowEnd}</p></div><Pill tone={item.verdict === "DATA_UNAVAILABLE" ? "red" : "green"}>{item.verdict}</Pill></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Stat label="NOAA rainfall" value={mm(item.noaaMm ? Number(item.noaaMm) : null)} /><p className="sky-mono break-all text-[10px] leading-relaxed text-[var(--faint)]">Source hash: {item.sourceHash}</p></div></Card>)}</div>}</section>;
}
