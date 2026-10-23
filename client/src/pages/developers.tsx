import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";

const EXAMPLE_REQUEST = `GET /api/x402/quote?city=des-moines&observationStart=START&observationEnd=END&thresholdMm=THRESHOLD&operator=gte&protectedAmount=AMOUNT`;

const EXAMPLE_PAID = `{
  "city": "des-moines",
  "window": { "observationStart": "START", "observationEnd": "END", "tenor": "weekly" },
  "trigger": { "thresholdMm": "THRESHOLD", "operator": "gte" },
  "premium": "<SKYT base units>",
  "payout": "<SKYT base units>",
  "multiple": "<payout / premium>",
  "probability": "<from probabilityBps>",
  "fee": "<protocol fee, SKYT base units>",
  "evidence": {
    "station": { "id": "GHCND:USW00014933" },
    "sources": ["NOAA GHCND daily precipitation", "NOAA quantitative precipitation forecast"],
    "inputsHash": "<sha256 of the quote inputs>"
  },
  "payment": { "explorer": "https://explorer.solana.com/tx/<signature>?cluster=devnet" }
}`;

/**
 * Public notes for the paid quote endpoint. Figures in the sample JSON are placeholders.
 * The live premium comes from the same pricing path as the app.
 */
export default function DevelopersPage() {
  useEffect(() => {
    document.title = "SkyHedge developers";
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex min-h-[4.5rem] max-w-3xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-h-12 items-center gap-3" aria-label="SkyHedge home">
            <BrandMark size={34} />
            <span className="font-semibold">SkyHedge</span>
          </Link>
          <Link to="/app" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Open the app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="text-sm font-semibold text-[var(--identity)]">Developers</p>
        <h1 className="sky-display mt-2 text-4xl font-bold tracking-tight sm:text-5xl">A quote, if you pay for it.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
          HTTP kept status 402 in a drawer for decades. This endpoint finally uses it. One request, one Devnet USDC payment, and the same NOAA rainfall quote the app prices. The payment is for the request. It is not the protection premium, and it is not mainnet.
        </p>

        <section className="sky-card mt-8">
          <h2 className="sky-display text-2xl">Request</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <span className="sky-mono text-[var(--foreground)]">GET /api/x402/quote</span> on Solana Devnet. The city has to be one of the NOAA markets. The window has to be a Monday-to-Monday week or a calendar month, UTC. An unknown city or window is a 400, and nothing is charged.
          </p>
          <pre className="sky-mono mt-4 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed text-[var(--foreground)]">{EXAMPLE_REQUEST}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Example request. Replace the placeholders. <span className="sky-mono">protectedAmount</span> is SKYT base units, six decimals, at most 500 SKYT.</p>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">402</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            No payment, or a payment we will not settle, comes back as HTTP 402. The requirements live in the <span className="sky-mono text-[var(--foreground)]">PAYMENT-REQUIRED</span> header (base64 JSON) and again in the body under <span className="sky-mono text-[var(--foreground)]">paymentRequired</span>. Scheme <span className="sky-mono text-[var(--foreground)]">exact</span>, network <span className="sky-mono text-[var(--foreground)]">solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1</span>, asset Devnet USDC. The default access price is 0.01 USDC. <span className="sky-mono">extra.feePayer</span> is the facilitator, which pays the Solana fee. This server does not hold a signing key.
          </p>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">Paid response</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            A settled payment returns the quote the app would show: city, window, <span className="text-[var(--payout)]">trigger</span>, premium, <span className="text-[var(--payout)]">payout</span>, multiple, probability, and fee, plus the NOAA station, sources, and inputs hash. <span className="sky-mono text-[var(--foreground)]">PAYMENT-RESPONSE</span> carries the settlement. Premium and payout are SKYT base units from the pricing path.
          </p>
          <pre className="sky-mono mt-4 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed text-[var(--foreground)]">{EXAMPLE_PAID}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Example response. Placeholders are not a live quote. The station id is the pinned Des Moines NOAA station.</p>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">Settlement pending</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            If the transfer is submitted and Devnet has not finalized it — a public RPC <span className="sky-mono text-[var(--foreground)]">429</span> is enough — the response is HTTP 202 <span className="sky-mono text-[var(--foreground)]">SETTLEMENT_PENDING</span>. The body carries the signature and a Devnet Explorer link. There is no quote. Send the same <span className="sky-mono text-[var(--foreground)]">PAYMENT-SIGNATURE</span> again. Do not pay a second time. When that signature finalizes, that same payment returns the quote. The server checks <span className="sky-mono text-[var(--foreground)]">SOLANA_RPC_URL</span> before it will call a transfer unsettled.
          </p>
          <pre className="sky-mono mt-4 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed text-[var(--foreground)]">{`{
  "error": "SETTLEMENT_PENDING",
  "transaction": "<signature>",
  "explorer": "https://explorer.solana.com/tx/<signature>?cluster=devnet"
}`}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Example response. The signature is the one the facilitator submitted, not a sample payment.</p>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">When it refuses</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <li><span className="sky-mono text-[var(--foreground)]">WRONG_AMOUNT</span>, <span className="sky-mono text-[var(--foreground)]">WRONG_NETWORK</span>, <span className="sky-mono text-[var(--foreground)]">WRONG_ASSET</span> — 402, no quote. A new payment is required.</li>
            <li><span className="sky-mono text-[var(--foreground)]">PAYMENT_REPLAYED</span> — that transfer was already used for another quote. 402, no second quote.</li>
            <li><span className="sky-mono text-[var(--foreground)]">PAYMENT_UNSETTLED</span> — the transfer failed on Devnet. 402, no quote.</li>
            <li><span className="sky-mono text-[var(--foreground)]">FACILITATOR_UNAVAILABLE</span> — 503 before anything is submitted. No quote.</li>
          </ul>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">curl</h2>
          <pre className="sky-mono mt-4 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed text-[var(--foreground)]">{`curl -i "$X402_QUOTE_URL"`}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Example. Point <span className="sky-mono">X402_QUOTE_URL</span> at the request above. The first call should be a 402.</p>
        </section>

        <section className="sky-card mt-4">
          <h2 className="sky-display text-2xl">Agent</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <span className="sky-mono text-[var(--foreground)]">scripts/x402-agent-demo.ts</span> prints the 402, then pays from <span className="sky-mono text-[var(--foreground)]">X402_AGENT_KEYPAIR</span> (a path to a local keypair file, never committed). <span className="sky-mono text-[var(--foreground)]">--dry-run</span> stops after the requirements. <span className="sky-mono text-[var(--foreground)]">--bad-payment</span> resends a one-base-unit amount and expects <span className="sky-mono text-[var(--foreground)]">WRONG_AMOUNT</span>. If settlement is pending, the script re-sends that same payment. It checks the signature on Devnet before it will sign a new one.
          </p>
          <pre className="sky-mono mt-4 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed text-[var(--foreground)]">{`npx tsx scripts/x402-agent-demo.ts --dry-run \\
  --city des-moines --observation-start START --observation-end END \\
  --threshold-mm THRESHOLD --operator gte --protected-amount AMOUNT`}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Setup, the receiving address, and the Devnet USDC faucet steps are in <span className="sky-mono">docs/demo-script-x402.md</span>. The endpoint answers <span className="sky-mono">PAYMENT_NOT_CONFIGURED</span> until <span className="sky-mono">X402_PAY_TO</span> is set.
          </p>
        </section>
      </main>
    </div>
  );
}
