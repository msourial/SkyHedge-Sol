import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity, AlertTriangle, ArrowRight, Code2, Database, Droplets, ExternalLink, FileCheck2, Globe2, MapPin, Search, ShieldCheck, ShieldPlus, WalletCards, X } from "lucide-react";
import type { DevnetStatus, EvidenceRow, Portfolio, Quote } from "@/lib/types";
import { api, apiUnavailable, mm, skytDisplay } from "@/lib/api";
import { Card, EmptyState, Pill, SectionLabel, Stat } from "@/components/sky";
import { AgriculturalAreaMap } from "@/components/sky/agricultural-area-map";
import { cn } from "@/lib/utils";
import { approveAndConfirm, approveAndConfirmDesMoinesSeed, desMoinesSeedTransactions, explorerTx, initializeProtocolTransaction, isProtocolAdmin, issueSkytTransaction, protocolExists, SKYT_ISSUANCE } from "@/lib/admin";
import { finalizedWalletState, PROTOCOL_ADMIN } from "@/lib/solana";
import { AGRICULTURAL_MARKETS, agriculturalMarketBySlug, agriculturalMarketLocation, millimetersToInches, searchAgriculturalMarkets, SUGGESTED_AGRICULTURAL_MARKET_SLUGS, type AgriculturalMarketSlug } from "../../../shared/agricultural-markets";

const MARKETS = AGRICULTURAL_MARKETS.map((market) => ({ id: market.slug, city: market.name, location: agriculturalMarketLocation(market), station: market.evidenceStatus === "validated" ? market.noaaStationId : "NOAA station validation in progress", crops: market.crops, region: market.region, context: market.agriculturalContext, evidenceStatus: market.evidenceStatus })) as Array<{ id: AgriculturalMarketSlug; city: string; location: string; station: string | null; crops: readonly string[]; region: string; context: string; evidenceStatus: "researching_evidence" | "validated" }>;
const TABS = [
  { id: "markets", label: "Markets", icon: Activity },
  { id: "protect", label: "Protect", icon: ShieldPlus },
  { id: "liquidity", label: "Liquidity", icon: Droplets },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "builders", label: "Builders", icon: Code2 },
] as const;
type Tab = (typeof TABS)[number]["id"];
type MarketId = AgriculturalMarketSlug;
type MarketCardData = (typeof MARKETS)[number];
const MARKET_REGIONS = ["North America", "South America", "Emerging markets"] as const;
const today = new Date().toISOString().slice(0, 10);
const weekFromToday = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

function validTab(value: string | null): Tab { return TABS.some((tab) => tab.id === value) ? value as Tab : "markets"; }
function validMarket(value: string | null): MarketId { return MARKETS.some((market) => market.id === value) ? value as MarketId : "des-moines"; }
function baseUnits(value: string): string | null {
  if (!/^\d+(\.\d{0,6})?$/.test(value) || Number(value) <= 0) return null;
  const [whole, fractional = ""] = value.split(".");
  return `${whole}${fractional.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
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
  const amountBase = baseUnits(amount);
  const selectedMarket = agriculturalMarketBySlug(marketId)!;
  const quoteQuery = useQuery({
    queryKey: ["quote", quoteRequest],
    queryFn: () => api<Quote>("/api/quotes", { method: "POST", body: JSON.stringify({ city: marketId, observationStart: start, observationEnd: end, thresholdMm: Number(threshold), operator, protectedAmount: amountBase }) }),
    enabled: quoteRequest > 0 && selectedMarket.evidenceStatus === "validated" && Boolean(amountBase) && Boolean(threshold) && start < end,
    retry: false,
  });
  const switchTab = (next: Tab) => { setTab(next); window.history.replaceState(null, "", `/?tab=${next}&city=${marketId}`); };
  const selectMarket = (id: MarketId) => { setMarketId(id); setQuoteRequest(0); switchTab("protect"); };

  return <div className="space-y-6">
    <header className="relative overflow-hidden border-b border-[var(--border)] pb-6">
      <div className="absolute right-0 top-0 h-32 w-64 opacity-60 [background:repeating-linear-gradient(135deg,transparent_0_10px,rgba(45,226,230,.12)_10px_11px)]" aria-hidden />
      <p className="sky-section-label text-[var(--identity)]">DEVNET / NOAA-ONLY / PROTECTION PROTOCOL</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="sky-display text-2xl font-bold leading-tight sm:text-4xl">Climate risk, <span className="text-[var(--identity)]">deterministically settled.</span></h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">SkyHedge is fixed-payout rainfall protection—not a trading venue. Your wallet remains in control of every real transaction.</p></div><Pill tone="cyan">Signal online</Pill></div>
    </header>
    <OwnerConsole />
    <nav aria-label="Product sections" className="sky-scroll-x flex gap-2 border-b border-[var(--border)] pb-3">{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => switchTab(id)} className={cn("flex min-h-11 shrink-0 items-center gap-2 border px-3.5 text-sm transition-colors", tab === id ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]" : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]")}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {tab === "markets" && <Markets onSelect={selectMarket} />}
    {tab === "protect" && <Protect marketId={marketId} amount={amount} setAmount={setAmount} threshold={threshold} setThreshold={setThreshold} operator={operator} setOperator={setOperator} start={start} setStart={setStart} end={end} setEnd={setEnd} valid={selectedMarket.evidenceStatus === "validated" && Boolean(amountBase) && start < end && Number(threshold) > 0} requestQuote={() => setQuoteRequest((count) => count + 1)} quote={quoteQuery.data} loading={quoteQuery.isFetching} error={quoteQuery.error} />}
    {tab === "liquidity" && <Liquidity />}
    {tab === "portfolio" && <PortfolioView />}
    {tab === "evidence" && <Evidence />}
    {tab === "builders" && <BuilderProof />}
  </div>;
}

function BuilderProof() {
  const status = useQuery({ queryKey: ["devnet-status"], queryFn: () => api<DevnetStatus>("/api/devnet/status"), retry: false, refetchInterval: 30_000 });
  const data = status.data;
  const rows = data ? [
    ["Program executable", data.program.status, data.program.executable ? "Executable account verified on Devnet." : "Program account is not executable yet.", data.program.explorerUrl],
    ["IDL available", data.idl.status, `${data.idl.instructionCount} instructions and ${data.idl.accountCount} account types loaded from the committed IDL.`, null],
    ["Protocol initialized", data.protocol.status, data.protocol.initialized ? `Next market id ${data.protocol.nextMarketId ?? "0"}.` : "Protocol PDA has not been initialized.", null],
    ["SKYT mint ready", data.skytMint.status, data.skytMint.exists ? `Supply ${skytDisplay(data.skytMint.supply ?? "0")} with ${data.skytMint.decimals ?? 0} decimals.` : "Configured SKYT mint is not found.", null],
    ["Des Moines market", data.desMoinesMarket.status, data.desMoinesMarket.address ? `Market ${data.desMoinesMarket.marketId} found; vault balance ${skytDisplay(data.desMoinesMarket.vaultBalance ?? "0")}.` : "Not seeded yet; Des Moines remains the first activation target.", null],
    ["NOAA evidence", "pending", data.noaaEvidence.message, null],
  ] as const : [];
  return <section className="space-y-6"><header className="border-b border-[var(--border)] pb-6"><p className="sky-section-label text-[var(--identity)]">SOLANA BUILDER PROOF</p><h2 className="sky-display mt-2 max-w-3xl text-2xl font-semibold sm:text-3xl">Climate protection, with verifiable settlement.</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">SkyHedge is building a consumer-friendly climate-risk product with Solana used as the transparent settlement rail—not as a requirement for customers to understand or use crypto.</p></header><div className="grid gap-4 md:grid-cols-3"><Stat label="Protocol model" value="Fixed payout" accent="cyan" /><Stat label="Settlement source" value="NOAA only" accent="green" /><Stat label="Public collateral" value="USDC planned" accent="amber" /></div><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card className="p-5"><SectionLabel>Live Devnet status</SectionLabel>{status.isLoading ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Reading finalized Devnet state...</p> : status.isError ? <p role="alert" className="mt-3 text-sm text-[var(--warning)]">Devnet status is unavailable from this deployment.</p> : <div className="space-y-3">{rows.map(([title, rowStatus, detail, href]) => <div key={title} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)]">{detail}{href && <> <a className="text-[var(--identity)] underline underline-offset-4" href={href} target="_blank" rel="noreferrer">Explorer</a></>}</p></div><Pill tone={rowStatus === "ready" ? "green" : rowStatus === "pending" ? "amber" : "red"}>{rowStatus}</Pill></div>)}</div>}</Card><Card className="p-5"><Pill tone="cyan">Grant-ready narrative</Pill><h3 className="sky-display mt-4 text-xl font-semibold">Why Solana?</h3><p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">USDC collateral can be escrowed transparently; immutable market terms and source-hashed weather evidence make every settlement auditable. Customers may eventually pay by bank, card, or self-custody wallet.</p><a className="sky-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2" href="https://github.com/msourial/SkyHedge-Sol" target="_blank" rel="noreferrer">View open-source build <ExternalLink className="h-4 w-4" /></a></Card></div><Card className="p-5"><SectionLabel>Current funding milestone</SectionLabel><h3 className="sky-display text-lg font-semibold">One reproducible agricultural-market lifecycle on Devnet.</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">The next public proof is protocol initialization, one NOAA-pinned Des Moines market, real test collateral transfers, and an Explorer-linked payout or data-unavailable refund. SkyHedge does not represent this milestone as complete until every transaction is finalized.</p></Card></section>;
}

function OwnerConsole() {
  const wallet = useWallet();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"initialize" | "mint" | "seed" | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string; signature?: string } | null>(null);
  const owner = isProtocolAdmin(wallet.publicKey);
  useEffect(() => {
    let active = true;
    protocolExists().then((value) => active && setInitialized(value)).catch(() => active && setInitialized(null));
    return () => { active = false; };
  }, [wallet.publicKey?.toBase58()]);
  if (!wallet.connected) return null;
  if (!owner) return <div role="status" className="border border-[var(--border)] bg-[var(--surface-1)] p-4 text-sm text-[var(--muted-foreground)]">Connected wallet is not the configured protocol admin. Owner controls are restricted to {PROTOCOL_ADMIN.slice(0, 4)}…{PROTOCOL_ADMIN.slice(-4)}.</div>;
  const run = async (kind: "initialize" | "mint" | "seed") => {
    if (!wallet.publicKey) return;
    setBusy(kind); setMessage(null);
    try {
      if (kind === "seed") {
        const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
        const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7);
        const date = (value: Date) => value.toISOString().slice(0, 10);
        const evidence = await api<{ validated: true; stationId: string; stationIdHash: string; providerHash: string; methodologyHash: string; quoteInputsHash: string }>(`/api/markets/des-moines/evidence-package?start=${date(start)}&end=${date(end)}`);
        const seed = await desMoinesSeedTransactions(wallet.publicKey, evidence);
        const signatures = await approveAndConfirmDesMoinesSeed(seed, wallet);
        setMessage({ tone: "green", text: "Des Moines market created, funded, and opened on finalized Devnet.", signature: signatures[2] });
        return;
      }
      const transaction = kind === "initialize" ? initializeProtocolTransaction(wallet.publicKey) : issueSkytTransaction(wallet.publicKey);
      const signature = await approveAndConfirm(transaction, wallet);
      setMessage({ tone: "green", text: kind === "initialize" ? "Protocol initialized on finalized Devnet." : "50,000 SKYT minted to your associated token account.", signature });
      if (kind === "initialize") setInitialized(true);
    } catch (error) { setMessage({ tone: "red", text: error instanceof Error ? error.message : "Wallet approval did not complete." }); }
    finally { setBusy(null); }
  };
  return <section aria-labelledby="owner-console" className="border border-[var(--identity)]/40 bg-[var(--surface-1)] p-5 shadow-[0_0_40px_rgba(45,226,230,.05)]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="sky-section-label text-[var(--identity)]">Owner-only Devnet controls</p><h2 id="owner-console" className="sky-display mt-1 text-xl font-semibold">Initialize the real protocol.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">Each action opens your connected wallet. Nothing is submitted until you approve it; final status is checked against Devnet.</p></div><Pill tone={initialized ? "green" : "amber"}>{initialized ? "Protocol finalized" : initialized === false ? "Initialization required" : "Checking Devnet"}</Pill></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-3"><Card className="p-4"><ShieldCheck className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">1. Initialize protocol</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Pins the SKYT collateral mint, protocol PDA, fee vault, and separate settlement authority.</p><button disabled={busy !== null || initialized !== false} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("initialize")}>{busy === "initialize" ? "Awaiting wallet…" : initialized ? "Protocol initialized" : "Approve initialization"}</button></Card><Card className="p-4"><WalletCards className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">2. Issue Devnet test collateral</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Mints exactly {(Number(SKYT_ISSUANCE) / 1_000_000).toLocaleString()} SKYT with six decimals to your wallet.</p><button disabled={busy !== null || initialized !== true} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("mint")}>{busy === "mint" ? "Awaiting wallet…" : "Approve 50,000 SKYT mint"}</button></Card><Card className="p-4"><FileCheck2 className="h-5 w-5 text-[var(--success)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">3. Seed Des Moines</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Fetches a real NOAA evidence package, then asks for three approvals: create, fund 2,000 SKYT, and open.</p><button disabled={busy !== null || initialized !== true} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("seed")}>{busy === "seed" ? "Awaiting 3 wallet approvals…" : "Approve Des Moines seed"}</button></Card></div>
    <p className="mt-4 text-xs text-[var(--faint)]">Only the admin wallet can seed this market. NOAA station GHCND:USW00014933 is queried immediately before transaction preparation; no placeholder evidence is accepted.</p>
    {message && <p role="alert" className={cn("mt-4 border p-3 text-sm", message.tone === "green" ? "border-[var(--success)]/50 text-[var(--success)]" : "border-[var(--destructive)]/50 text-[var(--destructive-foreground)]")}>{message.text}{message.signature && <> <a className="underline" href={explorerTx(message.signature)} target="_blank" rel="noreferrer">View finalized transaction</a></>}</p>}
  </section>;
}

function DeploymentNotice() { return <div role="status" className="flex gap-3 border border-[var(--warning)]/50 bg-[var(--warning-dim)] p-4 text-sm text-[var(--muted-foreground)]"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" /><p><strong className="text-[var(--foreground)]">Chain data unavailable.</strong> The Devnet program has not yet published an executable account, or this deployment has no API service. Markets, positions, and settlement evidence remain unavailable rather than simulated.</p></div>; }

function Markets({ onSelect }: { onSelect: (id: MarketId) => void }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchAgriculturalMarkets(query).map((market) => MARKETS.find((item) => item.id === market.slug)!).filter(Boolean), [query]);
  const suggestions = useMemo(() => SUGGESTED_AGRICULTURAL_MARKET_SLUGS.map((slug) => MARKETS.find((market) => market.id === slug)!).filter(Boolean), []);
  const dropdownOptions = useMemo(() => [
    ...MARKET_REGIONS.map((region) => ({ kind: "region" as const, region })),
    ...results.map((market) => ({ kind: "market" as const, market })),
  ], [results]);
  const showingSuggestions = query.trim().length === 0 && !showAll;
  const displayedMarkets = showingSuggestions ? suggestions : results;

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

  return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><SectionLabel>Agricultural rainfall indexes</SectionLabel><p className="max-w-2xl text-sm text-[var(--muted-foreground)]">USD protection previews for regional crop risk. All values remain pre-launch until a NOAA station is validated and USDC collateral is available.</p></div><Pill tone="amber">USD preview only</Pill></div><div ref={searchRef} className="relative mt-5 max-w-2xl"><label className="sky-label" htmlFor="market-search">Find an index</label><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden /><input id="market-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={dropdownOpen} aria-controls="market-search-options" aria-activedescendant={activeOption >= 0 ? `market-search-option-${activeOption}` : undefined} className="sky-input min-h-11 w-full pl-11 pr-12" value={query} onFocus={() => setDropdownOpen(true)} onKeyDown={onSearchKeyDown} onChange={(event) => { setQuery(event.target.value); setShowAll(false); setDropdownOpen(true); setActiveOption(-1); }} placeholder="Search an area, country, region, or crop" autoComplete="off" />{query && <button type="button" onClick={() => { setQuery(""); setShowAll(false); setDropdownOpen(true); setActiveOption(-1); }} className="absolute right-1 top-1/2 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]" aria-label="Clear market search"><X className="h-4 w-4" aria-hidden /></button>}</div>{dropdownOpen && <div id="market-search-options" role="listbox" aria-label="Available regions and matching areas" className="absolute z-20 mt-2 max-h-[min(60vh,32rem)] w-full overflow-y-auto border border-[var(--identity)]/40 bg-[var(--surface-1)] p-2 shadow-[0_18px_45px_rgba(0,0,0,.35)]"><p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--faint)]">Available regions</p>{MARKET_REGIONS.map((region, index) => <button key={region} id={`market-search-option-${index}`} role="option" aria-selected={activeOption === index} type="button" className={cn("flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm transition-colors", activeOption === index ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--foreground)] hover:bg-[var(--surface-2)]")} onMouseEnter={() => setActiveOption(index)} onClick={() => selectDropdownOption(index)}><Globe2 className="h-4 w-4 shrink-0" aria-hidden /><span>{region}</span></button>)}<div className="my-2 border-t border-[var(--border)]" /><p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--faint)]">Matching areas</p>{results.length ? results.map((market, resultIndex) => { const index = MARKET_REGIONS.length + resultIndex; return <button key={market.id} id={`market-search-option-${index}`} role="option" aria-label={`${market.city}; ${market.location}; ${market.region}; ${market.crops.join(", ")}`} aria-selected={activeOption === index} type="button" className={cn("flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors", activeOption === index ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--foreground)] hover:bg-[var(--surface-2)]")} onMouseEnter={() => setActiveOption(index)} onClick={() => selectDropdownOption(index)}><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 break-words"><span className="block font-medium">{market.city}</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{market.location}</span><span className="mt-0.5 block text-[11px] text-[var(--faint)]">{market.region} · {market.crops.join(", ")}</span></span></button>; }) : <p role="status" className="px-3 py-3 text-sm text-[var(--muted-foreground)]">No researched areas match this search.</p>}</div>}<p role="status" className="mt-2 text-xs text-[var(--muted-foreground)]">{showingSuggestions ? "Suggested research areas across three crop belts." : `${results.length} researched ${results.length === 1 ? "area" : "areas"} found.`}</p></div>{!showingSuggestions && results.length === 0 ? <EmptyState icon={<Search className="h-8 w-8" />} title="No researched index matches that search" hint="This catalog contains only release-gated crop-belt areas. An unlisted area is not yet a validated market." cta={<button type="button" className="sky-btn-primary mt-4 min-h-11 px-4" onClick={() => { setQuery(""); setShowAll(true); }}>Show all researched areas</button>} /> : <><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="sky-display text-lg font-semibold">{showingSuggestions ? "Suggested indexes" : "Matching researched indexes"}</h2>{showingSuggestions && <button type="button" className="min-h-11 text-sm text-[var(--identity)] underline underline-offset-4 transition-colors hover:text-[var(--foreground)]" onClick={() => setShowAll(true)}>Browse all 12 areas</button>}</div><div className="mt-4 grid gap-4 lg:grid-cols-3">{displayedMarkets.map((market) => <MarketCard key={market.id} market={market} onSelect={onSelect} />)}</div></>}</section>;
}

function MarketCard({ market, onSelect }: { market: MarketCardData; onSelect: (id: MarketId) => void }) { const catalogMarket = agriculturalMarketBySlug(market.id)!; return <Card hover className="relative overflow-hidden p-5"><div className="absolute right-0 top-0 h-16 w-16 border-b border-l border-[var(--signal)]/40" aria-hidden /><div className="flex items-start justify-between gap-3"><div><p className="sky-eyebrow">{market.region} · rainfall index</p><h3 className="sky-display mt-1 text-lg font-semibold">{market.city}</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">{market.location}</p></div><Pill tone={market.evidenceStatus === "validated" ? "green" : "amber"}>{market.evidenceStatus === "validated" ? "Evidence validated" : "Researching evidence"}</Pill></div><p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">{market.context}</p><p className="sky-mono mt-3 text-xs text-[var(--faint)]">Crop systems: {market.crops.join(" · ")}</p><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Index" value="Rainfall" /><Stat label="Unit" value="mm / in" /><Stat label="Expiry" value="Wk / Mo" /></div><p className="mt-4 text-xs text-[var(--warning)]">{market.station}</p><div className="mt-5"><AgriculturalAreaMap market={catalogMarket} status={market.evidenceStatus} variant="compact" /></div><button className="sky-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2" onClick={() => onSelect(market.id)}>Explore index <ArrowRight className="h-4 w-4" /></button></Card>; }

function Protect(props: { marketId: MarketId; amount: string; setAmount: (value: string) => void; threshold: string; setThreshold: (value: string) => void; operator: "gte" | "lte"; setOperator: (value: "gte" | "lte") => void; start: string; setStart: (value: string) => void; end: string; setEnd: (value: string) => void; valid: boolean; requestQuote: () => void; quote?: Quote; loading: boolean; error: unknown }) {
  const market = MARKETS.find((item) => item.id === props.marketId)!;
  const thresholdMm = Number(props.threshold) || 0;
  const hasThreshold = Number.isFinite(thresholdMm) && thresholdMm > 0;
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="sky-hero-card">
      <SectionLabel className="text-[var(--identity)]">Agricultural index / {market.city}</SectionLabel>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{market.location}</p>
      <div className="mt-5"><AgriculturalAreaMap market={agriculturalMarketBySlug(props.marketId)!} status={market.evidenceStatus} /></div>
      <h2 className="sky-display mt-2 text-2xl font-semibold">Measure rainfall, protect crop exposure.</h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">This index measures cumulative liquid rainfall. {hasThreshold ? `${thresholdMm} mm equals ${millimetersToInches(thresholdMm)} in.` : "Millimetres are canonical; inches are a display conversion."}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Protection amount (USD preview)"><input className="sky-input" inputMode="decimal" value={props.amount} onChange={(event) => props.setAmount(event.target.value)} /></Field>
        <Field label="Rainfall threshold (mm / in)"><input className="sky-input" inputMode="decimal" aria-describedby="threshold-unit-help" value={props.threshold} onChange={(event) => props.setThreshold(event.target.value)} /><p id="threshold-unit-help" aria-live="polite" className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{hasThreshold ? `${thresholdMm} mm = ${millimetersToInches(thresholdMm)} in. Enter millimetres; inches are display-only.` : "Enter millimetres; inches are displayed here for reference."}</p></Field>
        <Field label="Risk direction"><select className="sky-input" value={props.operator} onChange={(event) => props.setOperator(event.target.value as "gte" | "lte")}><option value="gte">Rainfall at or above threshold</option><option value="lte">Rainfall at or below threshold</option></select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Window start"><input className="sky-input" type="date" value={props.start} onChange={(event) => props.setStart(event.target.value)} /></Field><Field label="Window end"><input className="sky-input" type="date" value={props.end} onChange={(event) => props.setEnd(event.target.value)} /></Field></div>
      </div>
      <div role="alert" className="mt-4 border-l-2 border-[var(--warning)] bg-[var(--warning-dim)] p-4 text-sm leading-relaxed text-[var(--muted-foreground)]"><strong className="text-[var(--warning)]">Protection action unavailable.</strong> This market has no finalized NOAA evidence station or seeded collateral. Checkout remains disabled until the Devnet program, IDL, protocol, market, evidence, and collateral gates all pass. The test cap is 500 SKYT per wallet.</div>
      <button disabled aria-describedby="protection-unavailable-reason" className="sky-btn-primary mt-6 min-h-11 w-full sm:w-auto">Purchase unavailable — market not ready</button>
      <p id="protection-unavailable-reason" className="sr-only">Checkout is unavailable because required Devnet market gates have not passed.</p>
    </section>
    <QuotePanel quote={props.quote} error={props.error} />
  </div>;
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
