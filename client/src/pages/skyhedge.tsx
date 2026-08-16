import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloudRain, Search, ShieldCheck, WalletCards, Database, Sparkles, AlertTriangle, Bot, TrendingUp, Activity, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Market = { id: string; city: string; state?: string; stationId: string; status: string; maxLiquidity: string; maxExposure: string; perWalletMax: string };
type WalletProvider = { isPhantom?: boolean; isSolflare?: boolean; connect: () => Promise<{ publicKey: { toString(): string } }> };
type WeatherResponse = { cumulativeMm: number; records: Array<{ date: string; millimeters: number }>; source: string; stationId: string };
type Quote = { probabilityBps: number; premiumRateBps: number; premium: string; protocolFee: string; protectedAmount: string; modelVersion: string; inputsHash: string };
type Advisory = { recommendation: { city: string; stationId: string; methodology: string }; reasoning: string };

const rpcUrl = "https://api.devnet.solana.com";
const SKYT_DECIMALS = 6;
const SKYT = 1_000_000n;
const QUICK_AMOUNTS = [100n * SKYT, 250n * SKYT, 500n * SKYT];

function skyt(base: bigint | string): string {
  const value = typeof base === "string" ? BigInt(base) : base;
  return (Number(value) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

export default function SkyHedgePage() {
  const [wallet, setWallet] = useState<string>();
  const [solBalance, setSolBalance] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("new-york");
  const [risk, setRisk] = useState<"excess-rain" | "low-rain">("excess-rain");
  const [thresholdMm, setThresholdMm] = useState("50");
  const [amount, setAmount] = useState("250000000");
  const [quote, setQuote] = useState<Quote>();
  const [quoteError, setQuoteError] = useState<string>();
  const [advisory, setAdvisory] = useState<Advisory>();
  const [notice, setNotice] = useState("Connect a Devnet wallet to begin. No transaction is simulated.");

  const { data: markets } = useQuery<Market[]>({ queryKey: ["/api/markets"], staleTime: 60_000 });
  const station = markets?.find((market) => market.id === selectedCity);
  const today = new Date();
  const windowStart = addDays(today, 1);
  const windowEnd = addDays(today, 8);

  const { data: forecast } = useQuery<WeatherResponse>({
    queryKey: [`/api/weather/${selectedCity}/forecast?start=${windowStart}&end=${windowEnd}`],
    refetchInterval: 30_000,
    retry: false,
  });

  const filteredCities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return (markets ?? []).filter((market) => `${market.city}, ${market.state ?? ""}`.toLowerCase().includes(query)).slice(0, 8);
  }, [markets, searchQuery]);

  const amountValid = /^\d+$/.test(amount) && BigInt(amount) > 0n && BigInt(amount) <= BigInt(station?.perWalletMax ?? "500000000");

  async function connect() {
    const provider = [window.solana, window.solflare].filter(Boolean).find((item) => item?.isPhantom || item?.isSolflare);
    if (!provider) return setNotice("Install Phantom or Solflare, switch it to Devnet, then reconnect.");
    try {
      const address = (await provider.connect()).publicKey.toString();
      setWallet(address);
      const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "skyhedge-balance", method: "getBalance", params: [address, { commitment: "confirmed" }] }) });
      const body = await response.json() as { result?: { value?: number } };
      setSolBalance(((body.result?.value ?? 0) / 1_000_000_000).toFixed(4));
      setNotice("Wallet connected. SKYT balances and contract actions appear only after Devnet deployment and indexing.");
    } catch { setNotice("Wallet connection was declined or failed. No transaction was sent."); }
  }

  async function getQuote() {
    setQuote(undefined);
    setQuoteError(undefined);
    try {
      const response = await fetch("/api/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: selectedCity, observationStart: windowStart, observationEnd: windowEnd, thresholdMm: Number(thresholdMm), operator: risk === "excess-rain" ? "gte" : "lte", protectedAmount: amount }) });
      const body = await response.json() as Quote & { error?: string; message?: string; settlementAction?: string };
      if (!response.ok || body.error === "DATA_UNAVAILABLE") { setQuoteError(body.message ?? body.error ?? "Quote unavailable."); return; }
      setQuote(body);
    } catch { setQuoteError("Quote service is unavailable. No transaction was prepared."); }
  }

  async function getAdvice() {
    try {
      const response = await fetch("/api/advisory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: selectedCity, risk, thresholdMm: Number(thresholdMm), protectedAmount: amount }) });
      const body = await response.json() as Advisory & { error?: string };
      setAdvisory(body.error ? undefined : body);
    } catch { setAdvisory(undefined); }
  }

  const { data: portfolio } = useQuery({
    queryKey: [`/api/portfolio/${wallet}`],
    enabled: Boolean(wallet),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <CloudRain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">SkyHedge</span>
            <Badge variant="outline" className="hidden text-xs sm:inline-flex">SOLANA DEVNET</Badge>
          </div>

          {/* City Search */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search a city (e.g., Dallas, TX)"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {filteredCities.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No markets for that city yet.</div>}
                {filteredCities.map((market) => (
                  <button key={market.id} onClick={() => { setSelectedCity(market.id); setSearchQuery(""); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-secondary">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{market.city}, {market.state}</span>
                    <span className="ml-auto text-xs text-muted-foreground">NOAA {market.stationId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={connect} className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
            <WalletCards className="mr-2 h-4 w-4" />{wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "Connect Wallet"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Wallet notice */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-chart-2" />
          <span>{notice}</span>
          {wallet && <span className="ml-auto font-medium text-foreground">SOL: {solBalance ?? "loading…"}</span>}
        </div>

        {/* Get Started Banner */}
        <div className="mb-6 rounded-lg bg-gradient-to-r from-primary to-chart-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-primary-foreground">Protect your city against rainfall — on Solana Devnet</h3>
              <p className="text-sm text-primary-foreground/90">Fixed-payout protection with deterministic NOAA settlement. Pick a city, choose your protection amount, get a quote.</p>
            </div>
            <Button variant="secondary" className="bg-background text-foreground hover:bg-secondary">
              <ShieldCheck className="mr-2 h-4 w-4" />Get Started
            </Button>
          </div>
        </div>

        <Tabs defaultValue="trading" className="mb-6">
          <TabsList className="grid w-full grid-cols-4 bg-secondary p-1">
            <TabsTrigger value="trading" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Trading</TabsTrigger>
            <TabsTrigger value="portfolio" className="flex items-center gap-2"><Activity className="h-4 w-4" />Portfolio</TabsTrigger>
            <TabsTrigger value="lifecycle" className="flex items-center gap-2"><Database className="h-4 w-4" />Lifecycle</TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex items-center gap-2"><Bot className="h-4 w-4" />AI Assistant</TabsTrigger>
          </TabsList>

          {/* Trading Tab */}
          <TabsContent value="trading" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Rainfall forecast widget */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{station?.city}, {station?.state} Rainfall</CardTitle>
                    <Badge variant="outline" className="text-xs">NOAA 7-day forecast</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {forecast ? (
                    <div className="space-y-3">
                      <div className="text-3xl font-bold text-primary">{forecast.cumulativeMm.toFixed(1)}mm</div>
                      <div className="text-sm text-muted-foreground">Forecast cumulative, {windowStart} → {windowEnd}</div>
                      <div className="flex items-center text-sm">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-chart-2" />
                        <span>Live NOAA forecast</span>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{forecast.stationId}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Forecast data is unavailable for this station right now.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Market status widget */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Market Status</CardTitle>
                    <Badge variant="outline" className="text-xs text-amber-200">{station?.status.replace("_", " ") ?? "…"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Collateral</span><span className="font-medium">SKYT</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Max liquidity</span><span className="font-medium">{station ? `${skyt(station.maxLiquidity)} SKYT` : "…"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Max payout exposure</span><span className="font-medium">{station ? `${skyt(station.maxExposure)} SKYT` : "…"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Per-wallet cap</span><span className="font-medium text-chart-2">{station ? `${skyt(station.perWalletMax)} SKYT` : "…"}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* AI insight widget */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">AI Advisor</CardTitle>
                    <Badge className="bg-chart-5/20 text-chart-5">AI-Powered</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>The advisor structures protection intent against the selected city's NOAA cumulative-rainfall market. It cannot sign, trade, or settle.</p>
                  <p className="font-medium text-foreground">Use it to sanity-check your threshold and amount before quoting.</p>
                </CardContent>
              </Card>
            </div>

            {/* Protection builder */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Protection builder</CardTitle>
                <CardDescription>Pick a risk, threshold, and protection amount for {station?.city ?? "your city"}. Quotes come from live NOAA data — nothing is invented.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Risk type</Label>
                    <div className="flex rounded-md border border-border p-1">
                      {(["excess-rain", "low-rain"] as const).map((option) => (
                        <button key={option} onClick={() => setRisk(option)} className={cn("flex-1 rounded px-3 py-1.5 text-sm transition-colors", risk === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                          {option === "excess-rain" ? "Excess rain" : "Low rain"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger threshold</Label>
                    <Input type="number" min={1} value={thresholdMm} onChange={(event) => setThresholdMm(event.target.value)} className="border-border" />
                    <p className="text-xs text-muted-foreground">Cumulative mm over the observation window ({risk === "excess-rain" ? "≥" : "≤"} threshold triggers payout)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Observation window</Label>
                    <Input value={`${windowStart} → ${windowEnd}`} readOnly className="border-border" />
                  </div>
                </div>

                {/* Clear protection amount */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label className="text-base">Protection amount</Label>
                    <span className="text-xs text-muted-foreground">Per-wallet cap: {station ? `${skyt(station.perWalletMax)} SKYT` : "500 SKYT"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px] flex-1">
                      <Input type="number" min={1} value={skyt(amount)} onChange={(event) => setAmount((BigInt(Math.max(1, Number(event.target.value)) || 1) * SKYT).toString())} className="h-14 border-border pr-20 text-2xl font-bold" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">SKYT</span>
                    </div>
                    <div className="flex gap-2">
                      {QUICK_AMOUNTS.map((value) => (
                        <button key={value.toString()} onClick={() => setAmount(value.toString())} className={cn("rounded-md border px-4 py-2 text-sm font-medium transition-colors", amount === value.toString() ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                          {skyt(value)} SKYT
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">The amount you protect is the maximum fixed payout if the NOAA trigger is met.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={getQuote} disabled={!amountValid} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Sparkles className="mr-2 h-4 w-4" />Get quote
                  </Button>
                  <Button onClick={getAdvice} variant="outline">Ask the advisor</Button>
                  {!amountValid && <span className="text-xs text-amber-200">Enter an amount between 1 and {station ? `${skyt(station.perWalletMax)}` : "500"} SKYT.</span>}
                </div>

                {quoteError && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{quoteError}</span>
                  </div>
                )}

                {quote && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Premium (what you pay)</div>
                        <div className="text-3xl font-bold text-primary">{skyt(quote.premium)} SKYT</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Protocol fee</div>
                        <div className="text-xl font-semibold">{skyt(quote.protocolFee)} SKYT</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Trigger probability</div>
                        <div className="text-xl font-semibold">{(quote.probabilityBps / 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Protected amount</div>
                        <div className="text-xl font-semibold text-chart-2">{skyt(quote.protectedAmount)} SKYT</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Model {quote.modelVersion} · inputs hash {quote.inputsHash.slice(0, 16)}… · explicit wallet approval required before any on-chain action.</p>
                  </div>
                )}

                {advisory && (
                  <div className="space-y-2 rounded-lg border border-chart-5/30 bg-chart-5/10 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium text-chart-5"><Bot className="h-4 w-4" />Advisor</div>
                    <p className="text-foreground">{advisory.recommendation.methodology}</p>
                    <p className="text-muted-foreground">{advisory.reasoning}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Portfolio Overview</CardTitle></CardHeader>
                <CardContent>
                  {wallet ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Wallet</span><span className="font-mono text-sm">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">SOL balance</span><span className="text-xl font-bold">{solBalance ?? "…"} SOL</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">SKYT positions</span><span className="font-medium">Indexing…</span></div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">Connect your wallet to view portfolio data</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Active Positions</CardTitle></CardHeader>
                <CardContent>
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {(portfolio as { message?: string } | undefined)?.message ?? "No positions are shown until finalized Solana state has been indexed — SkyHedge never substitutes mock positions."}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Settlement History</CardTitle></CardHeader>
              <CardContent><div className="py-8 text-center text-sm text-muted-foreground">No settlement history available on Devnet yet.</div></CardContent>
            </Card>
          </TabsContent>

          {/* Lifecycle Tab */}
          <TabsContent value="lifecycle" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Transparent lifecycle</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  ["1. Fund or protect", "Wallet-signed SKYT transfers only after the Devnet program and IDL are deployed."],
                  ["2. Lock", "Market metadata, sales, and LP withdrawals close before the rainfall window."],
                  ["3. Settle", "The dedicated authority submits a NOAA source hash once; missing final data becomes DATA_UNAVAILABLE."],
                  ["4. Claim", "Winners claim their fixed payout. Void markets refund premiums. The claim window is 30 days."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-border bg-card p-4">
                    <div className="font-medium text-foreground">{title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />No contract action is available until the deployed program IDL is registered — there are no mock transactions.
            </div>
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant" className="space-y-6">
            <Card className="border-chart-5/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-chart-5" />SkyHedge Advisor</CardTitle>
                <CardDescription>AI structures protection intent only. It cannot sign, trade, or settle.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{station?.city}, {station?.state}</Badge>
                  <Badge variant="outline">{risk === "excess-rain" ? "Excess rain" : "Low rain"} · {thresholdMm}mm</Badge>
                  <Badge variant="outline">{skyt(amount)} SKYT protected</Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={getAdvice} className="bg-chart-5 text-white hover:bg-chart-5/90">Ask the advisor</Button>
                  <Button onClick={getQuote} variant="outline">Also get a quote</Button>
                </div>
                {advisory ? (
                  <div className="space-y-2 rounded-lg border border-chart-5/30 bg-chart-5/10 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium text-chart-5"><Bot className="h-4 w-4" />Advisor</div>
                    <p className="text-foreground">{advisory.recommendation.methodology}</p>
                    <p className="text-muted-foreground">{advisory.reasoning}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    Ask for a structured assessment of your threshold and amount for {station?.city ?? "the selected city"}'s NOAA cumulative-rainfall market.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />NOAA is the only V1 settlement source. SkyHedge is Devnet test software.
        </footer>
      </main>
    </div>
  );
}

declare global { interface Window { solana?: WalletProvider; solflare?: WalletProvider; } }