import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity, AlertTriangle, ArrowRight, Database, Droplets, FileCheck2, ShieldCheck, ShieldPlus, WalletCards } from "lucide-react";
import type { EvidenceRow, Market, Portfolio, Quote } from "@/lib/types";
import { api, apiUnavailable, mm, skytDisplay } from "@/lib/api";
import { Card, EmptyState, Pill, SectionLabel, Stat } from "@/components/sky";
import { cn } from "@/lib/utils";
import { approveAndConfirm, explorerTx, initializeProtocolTransaction, isProtocolAdmin, issueSkytTransaction, protocolExists, SKYT_ISSUANCE } from "@/lib/admin";
import { PROTOCOL_ADMIN } from "@/lib/solana";

const MARKETS = [
  { id: "new-york", city: "New York", station: "USW00094728 · Central Park" },
  { id: "miami", city: "Miami", station: "USW00012839 · Miami Intl." },
  { id: "chicago", city: "Chicago", station: "USW00094846 · O'Hare Intl." },
] as const;
const TABS = [
  { id: "markets", label: "Markets", icon: Activity },
  { id: "protect", label: "Protect", icon: ShieldPlus },
  { id: "liquidity", label: "Liquidity", icon: Droplets },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
] as const;
type Tab = (typeof TABS)[number]["id"];
type MarketId = (typeof MARKETS)[number]["id"];
const today = new Date().toISOString().slice(0, 10);
const weekFromToday = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

function validTab(value: string | null): Tab { return TABS.some((tab) => tab.id === value) ? value as Tab : "markets"; }
function validMarket(value: string | null): MarketId { return MARKETS.some((market) => market.id === value) ? value as MarketId : "new-york"; }
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
  const marketQuery = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/api/markets"), retry: false });
  const amountBase = baseUnits(amount);
  const quoteQuery = useQuery({
    queryKey: ["quote", quoteRequest],
    queryFn: () => api<Quote>("/api/quotes", { method: "POST", body: JSON.stringify({ city: marketId, observationStart: start, observationEnd: end, thresholdMm: Number(threshold), operator, protectedAmount: amountBase }) }),
    enabled: quoteRequest > 0 && Boolean(amountBase) && Boolean(threshold) && start < end,
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
    {marketQuery.isError && <DeploymentNotice />}
    <nav aria-label="Product sections" className="sky-scroll-x flex gap-2 border-b border-[var(--border)] pb-3">{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => switchTab(id)} className={cn("flex min-h-11 shrink-0 items-center gap-2 border px-3.5 text-sm transition-colors", tab === id ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]" : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]")}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {tab === "markets" && <Markets markets={marketQuery.data} onSelect={selectMarket} />}
    {tab === "protect" && <Protect marketId={marketId} amount={amount} setAmount={setAmount} threshold={threshold} setThreshold={setThreshold} operator={operator} setOperator={setOperator} start={start} setStart={setStart} end={end} setEnd={setEnd} valid={Boolean(amountBase) && start < end && Number(threshold) > 0} requestQuote={() => setQuoteRequest((count) => count + 1)} quote={quoteQuery.data} loading={quoteQuery.isFetching} error={quoteQuery.error} />}
    {tab === "liquidity" && <Liquidity />}
    {tab === "portfolio" && <PortfolioView />}
    {tab === "evidence" && <Evidence />}
  </div>;
}

function OwnerConsole() {
  const wallet = useWallet();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"initialize" | "mint" | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string; signature?: string } | null>(null);
  const owner = isProtocolAdmin(wallet.publicKey);
  useEffect(() => {
    let active = true;
    protocolExists().then((value) => active && setInitialized(value)).catch(() => active && setInitialized(null));
    return () => { active = false; };
  }, [wallet.publicKey?.toBase58()]);
  if (!wallet.connected) return null;
  if (!owner) return <div role="status" className="border border-[var(--border)] bg-[var(--surface-1)] p-4 text-sm text-[var(--muted-foreground)]">Connected wallet is not the configured protocol admin. Owner controls are restricted to {PROTOCOL_ADMIN.slice(0, 4)}…{PROTOCOL_ADMIN.slice(-4)}.</div>;
  const run = async (kind: "initialize" | "mint") => {
    if (!wallet.publicKey) return;
    setBusy(kind); setMessage(null);
    try {
      const transaction = kind === "initialize" ? initializeProtocolTransaction(wallet.publicKey) : issueSkytTransaction(wallet.publicKey);
      const signature = await approveAndConfirm(transaction, wallet);
      setMessage({ tone: "green", text: kind === "initialize" ? "Protocol initialized on finalized Devnet." : "50,000 SKYT minted to your associated token account.", signature });
      if (kind === "initialize") setInitialized(true);
    } catch (error) { setMessage({ tone: "red", text: error instanceof Error ? error.message : "Wallet approval did not complete." }); }
    finally { setBusy(null); }
  };
  return <section aria-labelledby="owner-console" className="border border-[var(--identity)]/40 bg-[var(--surface-1)] p-5 shadow-[0_0_40px_rgba(45,226,230,.05)]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="sky-section-label text-[var(--identity)]">Owner-only Devnet controls</p><h2 id="owner-console" className="sky-display mt-1 text-xl font-semibold">Initialize the real protocol.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">Each action opens your connected wallet. Nothing is submitted until you approve it; final status is checked against Devnet.</p></div><Pill tone={initialized ? "green" : "amber"}>{initialized ? "Protocol finalized" : initialized === false ? "Initialization required" : "Checking Devnet"}</Pill></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-2"><Card className="p-4"><ShieldCheck className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">1. Initialize protocol</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Pins the SKYT collateral mint, protocol PDA, fee vault, and separate settlement authority.</p><button disabled={busy !== null || initialized !== false} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("initialize")}>{busy === "initialize" ? "Awaiting wallet…" : initialized ? "Protocol initialized" : "Approve initialization"}</button></Card><Card className="p-4"><WalletCards className="h-5 w-5 text-[var(--identity)]" aria-hidden /><h3 className="mt-3 text-sm font-semibold">2. Issue Devnet test collateral</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">Mints exactly {(Number(SKYT_ISSUANCE) / 1_000_000).toLocaleString()} SKYT with six decimals to your wallet.</p><button disabled={busy !== null || initialized !== true} className="sky-btn-primary mt-4 min-h-11 w-full" onClick={() => run("mint")}>{busy === "mint" ? "Awaiting wallet…" : "Approve 50,000 SKYT mint"}</button></Card></div>
    <p className="mt-4 text-xs text-[var(--faint)]">Market seeding remains unavailable until this exact program is executable and the protocol PDA is finalized. It will never display invented market balances.</p>
    {message && <p role="alert" className={cn("mt-4 border p-3 text-sm", message.tone === "green" ? "border-[var(--success)]/50 text-[var(--success)]" : "border-[var(--destructive)]/50 text-[var(--destructive-foreground)]")}>{message.text}{message.signature && <> <a className="underline" href={explorerTx(message.signature)} target="_blank" rel="noreferrer">View finalized transaction</a></>}</p>}
  </section>;
}

function DeploymentNotice() { return <div role="status" className="flex gap-3 border border-[var(--warning)]/50 bg-[var(--warning-dim)] p-4 text-sm text-[var(--muted-foreground)]"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" /><p><strong className="text-[var(--foreground)]">Chain data unavailable.</strong> The Devnet program has not yet published an executable account, or this deployment has no API service. Markets, positions, and settlement evidence remain unavailable rather than simulated.</p></div>; }

function Markets({ markets, onSelect }: { markets?: Market[]; onSelect: (id: MarketId) => void }) { return <section><SectionLabel>Rainfall protection markets</SectionLabel><div className="grid gap-4 lg:grid-cols-3">{MARKETS.map((market) => { const indexed = markets?.find((item) => item.city === market.id); return <Card key={market.id} hover className="relative overflow-hidden p-5"><div className="absolute right-0 top-0 h-16 w-16 border-b border-l border-[var(--signal)]/40" aria-hidden /><div className="flex items-start justify-between gap-3"><div><p className="sky-eyebrow">Cumulative rainfall</p><h2 className="sky-display mt-1 text-lg font-semibold">{market.city}</h2></div><Pill tone={indexed?.indexed ? "green" : "amber"}>{indexed?.indexed ? "Indexed" : "Indexer pending"}</Pill></div><p className="sky-mono mt-5 text-xs text-[var(--muted-foreground)]">{indexed?.stationId === "committed" ? "Station committed on-chain" : market.station}</p><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Max pool" value="10,000 SKYT" /><Stat label="Exposure" value="8,000 SKYT" /><Stat label="Per wallet" value="500 SKYT" /></div><button className="sky-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2" onClick={() => onSelect(market.id)}>View protection <ArrowRight className="h-4 w-4" /></button></Card>; })}</div></section>; }

function Protect(props: { marketId: MarketId; amount: string; setAmount: (value: string) => void; threshold: string; setThreshold: (value: string) => void; operator: "gte" | "lte"; setOperator: (value: "gte" | "lte") => void; start: string; setStart: (value: string) => void; end: string; setEnd: (value: string) => void; valid: boolean; requestQuote: () => void; quote?: Quote; loading: boolean; error: unknown }) {
  const market = MARKETS.find((item) => item.id === props.marketId)!;
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="sky-hero-card"><SectionLabel className="text-[var(--identity)]">Protection request / {market.city}</SectionLabel><h2 className="sky-display mt-2 text-2xl font-semibold">Set your rainfall boundary.</h2><p className="mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">A qualifying trigger pays 100% of the protected amount. Quotes use published NOAA inputs and require approval before a transaction can be prepared.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Protected amount (SKYT)"><input className="sky-input" inputMode="decimal" value={props.amount} onChange={(event) => props.setAmount(event.target.value)} /></Field><Field label="Rainfall threshold (mm)"><input className="sky-input" inputMode="decimal" value={props.threshold} onChange={(event) => props.setThreshold(event.target.value)} /></Field><Field label="Risk direction"><select className="sky-input" value={props.operator} onChange={(event) => props.setOperator(event.target.value as "gte" | "lte")}><option value="gte">Rainfall at or above threshold</option><option value="lte">Rainfall at or below threshold</option></select></Field><div className="grid grid-cols-2 gap-3"><Field label="Window start"><input className="sky-input" type="date" value={props.start} onChange={(event) => props.setStart(event.target.value)} /></Field><Field label="Window end"><input className="sky-input" type="date" value={props.end} onChange={(event) => props.setEnd(event.target.value)} /></Field></div></div>{!props.valid && <p role="alert" className="mt-4 text-sm text-[var(--destructive-foreground)]">Enter a positive SKYT amount and threshold, with an end date after the start date.</p>}<button disabled={!props.valid || props.loading} className="sky-btn-primary mt-6 min-h-11 w-full sm:w-auto" onClick={props.requestQuote}>{props.loading ? "Pricing from NOAA…" : "Get protection quote"}</button></section><QuotePanel quote={props.quote} error={props.error} /></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="sky-label">{label}</span>{children}</label>; }
function QuotePanel({ quote, error }: { quote?: Quote; error: unknown }) { if (error) return <Card className="border-[var(--destructive)]/50"><Pill tone="red">DATA_UNAVAILABLE</Pill><h2 className="sky-display mt-4 text-lg">No quote was created.</h2><p role="alert" className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{apiUnavailable(error) ? "NOAA or pricing evidence is unavailable in this deployment. SkyHedge never substitutes generated weather data." : error instanceof Error ? error.message : "The protection request could not be priced."}</p></Card>; if (!quote) return <Card><Pill tone="magenta">Approval required</Pill><h2 className="sky-display mt-4 text-lg">Quote evidence will appear here.</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">The premium is derived from 70% historical probability and 30% NOAA forecast probability, with a 15% risk loading and 1% protocol fee.</p></Card>; return <Card className="border-[var(--identity)]/50"><Pill tone="cyan">Quote ready</Pill><h2 className="sky-display mt-4 text-lg">{skytDisplay(quote.premium)}</h2><p className="text-sm text-[var(--muted-foreground)]">Premium before explicit transaction approval</p><div className="mt-5 grid grid-cols-2 gap-2"><Stat label="Probability" value={`${(quote.probabilityBps / 100).toFixed(2)}%`} accent="cyan" /><Stat label="Premium rate" value={`${(quote.premiumRateBps / 100).toFixed(2)}%`} /><Stat label="Protocol fee" value={skytDisplay(quote.protocolFee)} /><Stat label="Model" value={quote.modelVersion} /></div><p className="sky-mono mt-4 break-all text-[10px] leading-relaxed text-[var(--faint)]">Methodology hash: {quote.inputsHash}</p><button disabled className="sky-btn-primary mt-5 min-h-11 w-full">Connect wallet to approve</button></Card>; }

function Liquidity() { return <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><Card><SectionLabel>Liquidity safeguards</SectionLabel><h2 className="sky-display text-xl">Collateral is available only before lock.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Guardrail title="Pre-lock only" text="LP funding and withdrawals are permitted only while the market is open." /><Guardrail title="Reserved exposure" text="Withdrawals cannot reduce collateral below protection already reserved." /><Guardrail title="Final accounting" text="The 1% protocol fee transfers after the claim deadline; residual funds redeem pro rata." /><Guardrail title="No synthetic actions" text="Funding remains disabled until a deployed Devnet IDL can prepare a real unsigned transaction." /></div></Card><Card><Pill tone="amber">Program IDL required</Pill><h2 className="sky-display mt-4 text-lg">Liquidity actions unavailable</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">The interface will not manufacture a funding or withdrawal transaction before Devnet program identity and IDL registration are available.</p><button disabled className="sky-btn-primary mt-5 min-h-11 w-full">Prepare liquidity transaction</button></Card></div>; }
function Guardrail({ title, text }: { title: string; text: string }) { return <div className="border-l-2 border-[var(--violet)] bg-[var(--surface-2)] p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{text}</p></div>; }
function PortfolioView() { const { publicKey, connected } = useWallet(); const portfolio = useQuery({ queryKey: ["portfolio", publicKey?.toBase58()], queryFn: () => api<Portfolio>(`/api/portfolio/${publicKey!.toBase58()}`), enabled: Boolean(publicKey), retry: false }); if (!connected || !publicKey) return <EmptyState icon={<WalletCards className="h-8 w-8" />} title="Connect Phantom or Solflare to inspect your portfolio" hint="Only finalized indexed Solana positions appear here. Nothing is simulated." />; if (portfolio.isError) return <DeploymentNotice />; const data = portfolio.data; return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Wallet" value={`${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`} accent="cyan" /><Stat label="Protections" value={data?.protections.length ?? "—"} /><Stat label="Liquidity positions" value={data?.liquidity.length ?? "—"} /></div>{data && data.protections.length + data.liquidity.length === 0 ? <EmptyState icon={<Database className="h-8 w-8" />} title="No finalized positions indexed" hint={data.message ?? "The indexer has not reported positions for this wallet."} /> : <Card><p className="text-sm text-[var(--muted-foreground)]">Fetching final-chain records…</p></Card>}</div>; }
function Evidence() {
  const evidence = useQuery({ queryKey: ["evidence"], queryFn: () => api<{ rows: EvidenceRow[] }>("/api/settlement/evidence"), retry: false });
  const [city, setCity] = useState<MarketId>("new-york");
  const weatherXm = useQuery({ queryKey: ["weatherxm", city], queryFn: () => api<{ source: "WeatherXM"; settlementEligible: false; station: { id: string; name: string | null; lastDayQuality: number | null }; observation: { timestamp: string; precipitationRate: number | null; precipitationAccumulated: number | null; temperature: number | null; humidity: number | null; dataQuality: number | null } }>(`/api/weatherxm/${city}/latest`), retry: false });
  return <section className="space-y-5"><div><SectionLabel>Evidence sources</SectionLabel><p className="max-w-2xl text-sm text-[var(--muted-foreground)]">NOAA is the sole settlement source. WeatherXM is supplemental, read-only operational context and can never determine a payout.</p></div><Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="sky-display text-lg">WeatherXM live context</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Nearest available station only; no placeholder observation is shown.</p></div><select aria-label="WeatherXM city" className="sky-input max-w-44" value={city} onChange={(event) => setCity(event.target.value as MarketId)}>{MARKETS.map((market) => <option key={market.id} value={market.id}>{market.city}</option>)}</select></div>{weatherXm.isLoading ? <p className="mt-4 text-sm text-[var(--muted-foreground)]">Requesting WeatherXM observation…</p> : weatherXm.isError ? <p role="alert" className="mt-4 text-sm text-[var(--warning)]">WeatherXM is unavailable for this deployment. Configure a server-side WeatherXM Pro API key; settlement remains NOAA-only.</p> : weatherXm.data ? <div className="mt-4 grid gap-2 sm:grid-cols-3"><Stat label="Station" value={weatherXm.data.station.name ?? weatherXm.data.station.id.slice(0, 8)} accent="cyan" /><Stat label="Observed" value={new Date(weatherXm.data.observation.timestamp).toLocaleString()} /><Stat label="Quality" value={weatherXm.data.observation.dataQuality == null ? "Not reported" : `${(weatherXm.data.observation.dataQuality * 100).toFixed(0)}%`} /></div> : null}</Card>{evidence.isError ? <DeploymentNotice /> : !evidence.data?.rows.length ? <EmptyState icon={<FileCheck2 className="h-8 w-8" />} title="No finalized NOAA settlement evidence" hint="Evidence appears after a valid observation window is finalized on-chain." /> : <div className="space-y-3">{evidence.data.rows.map((item) => <Card key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="sky-display text-base">{item.city.replaceAll("-", " ")}</h2><p className="sky-mono mt-1 text-xs text-[var(--faint)]">{item.windowStart} → {item.windowEnd}</p></div><Pill tone={item.verdict === "DATA_UNAVAILABLE" ? "red" : "green"}>{item.verdict}</Pill></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Stat label="NOAA rainfall" value={mm(item.noaaMm ? Number(item.noaaMm) : null)} /><p className="sky-mono break-all text-[10px] leading-relaxed text-[var(--faint)]">Source hash: {item.sourceHash}</p></div></Card>)}</div>}</section>;
}
