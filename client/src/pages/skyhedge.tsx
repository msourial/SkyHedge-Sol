import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CloudRain, ShieldCheck, WalletCards, Database, Sparkles, AlertTriangle } from "lucide-react";

type Market = { id: string; city: string; stationId: string; status: string };
type WalletProvider = { isPhantom?: boolean; isSolflare?: boolean; connect: () => Promise<{ publicKey: { toString(): string } }> };
const rpcUrl = "https://api.devnet.solana.com";

export default function SkyHedgePage() {
  const [wallet, setWallet] = useState<string>();
  const [solBalance, setSolBalance] = useState<string>();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedCity, setSelectedCity] = useState("new-york");
  const [amount, setAmount] = useState("100000000");
  const [advisory, setAdvisory] = useState<string>();
  const [notice, setNotice] = useState("Connect a Devnet wallet to begin. No transaction is simulated.");

  useEffect(() => { fetch("/api/markets").then((response) => response.ok ? response.json() : []).then(setMarkets).catch(() => setMarkets([])); }, []);

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

  async function getAdvice() {
    try {
      const response = await fetch("/api/advisory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: selectedCity, risk: "excess-rain", thresholdMm: 50, protectedAmount: amount }) });
      const body = await response.json() as { reasoning?: string; error?: string };
      setAdvisory(body.reasoning ?? body.error ?? "Advice could not be prepared.");
    } catch { setAdvisory("Advice is unavailable. No transaction was prepared."); }
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-6xl px-6 py-12">
    <header className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-3"><CloudRain className="h-9 w-9 text-cyan-300" /><span className="text-2xl font-bold tracking-tight">SkyHedge</span><Badge className="bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15">SOLANA DEVNET</Badge></div><p className="mt-3 max-w-2xl text-slate-300">Fixed-payout rainfall protection with deterministic NOAA settlement—not a weather-trading platform.</p></div><Button onClick={connect} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><WalletCards className="mr-2 h-4 w-4" />{wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "Connect Phantom / Solflare"}</Button></header>
    <div className="mb-8 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-50">{notice}{wallet && <span className="ml-2 text-cyan-200">SOL: {solBalance ?? "loading…"}</span>}</div>
    <section className="mb-10 grid gap-4 md:grid-cols-3">{markets.map((market) => <Card key={market.id} className="border-slate-800 bg-slate-900/70 text-slate-100"><CardHeader><div className="flex items-center justify-between"><CardTitle>{market.city} rainfall</CardTitle><Badge variant="outline" className="border-amber-400/40 text-amber-200">{market.status.replace("_", " ")}</Badge></div><CardDescription className="text-slate-400">NOAA {market.stationId}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-slate-300"><p>Max capacity: 10,000 SKYT</p><p>Max payout exposure: 8,000 SKYT</p><p>Wallet coverage cap: 500 SKYT</p></CardContent></Card>)}</section>
    <section className="grid gap-6 lg:grid-cols-2"><Card className="border-slate-800 bg-slate-900/70 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" />Protection advisor</CardTitle><CardDescription className="text-slate-400">AI structures intent only. It cannot sign, trade, or settle.</CardDescription></CardHeader><CardContent className="space-y-4"><label className="block text-sm">City<select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"><option value="new-york">New York</option><option value="miami">Miami</option><option value="chicago">Chicago</option></select></label><label className="block text-sm">Protection amount (SKYT base units)<Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" className="mt-1 border-slate-700 bg-slate-950" /></label><Button onClick={getAdvice} variant="secondary">Explain matching protection</Button>{advisory && <p className="rounded-md bg-slate-950 p-3 text-sm text-slate-300">{advisory}</p>}</CardContent></Card>
    <Card className="border-slate-800 bg-slate-900/70 text-slate-100"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-cyan-300" />Transparent lifecycle</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-300"><p><strong>1. Fund or protect:</strong> wallet-signed SKYT transfers only after the Devnet program and IDL are deployed.</p><p><strong>2. Lock:</strong> market metadata, sales, and LP withdrawals close before the rainfall window.</p><p><strong>3. Settle:</strong> the dedicated authority submits a NOAA source hash once; missing final data becomes DATA_UNAVAILABLE.</p><p><strong>4. Claim:</strong> winners claim their fixed payout. Void markets refund premiums. The claim window is 30 days.</p><p className="flex items-center gap-2 text-amber-200"><AlertTriangle className="h-4 w-4" />No contract action is available until the deployed program IDL is registered—there are no mock transactions.</p></CardContent></Card></section>
    <footer className="mt-10 flex items-center gap-2 text-sm text-slate-500"><Sparkles className="h-4 w-4" />NOAA is the only V1 settlement source. SkyHedge is Devnet test software.</footer>
  </div></main>;
}

declare global { interface Window { solana?: WalletProvider; solflare?: WalletProvider; } }
