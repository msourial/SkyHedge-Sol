# Seeker device check — 2026-10-16

Device: SM02G406197714 (Seeker). APK: release SHA `6becdfc300f917923e1e2f50d95839d384ddc62514249aba72cbe691e4ad954d`. Compared to https://skyhedge.app.

Captures: `markets.png`, `protect.png`, `wallet.png`.

## Verdict

App launches and all three tabs render. **No crash.** Demo path is blocked by a closed Des Moines sales window; Wallet balance read can hang without a failure UI.

## Bugs / gaps

| # | Severity | Screen | Issue |
| --- | --- | --- | --- |
| 1 | **High (demo)** | Protect / Markets | Des Moines shows **Sales closed** / “This window isn't selling right now” (window Oct 14–18). No priced quote → Protect CTA disabled. Needs a new open Devnet window (on-chain seed — **ask before**). |
| 2 | **Med** | Wallet | Connected (`DKA9…FD6y`) + position tracker visible, but SKYT shows **—** and caption stays **“Reading balances from Solana…”** with no error or Retry when the RPC/API read fails. |
| 3 | **Low (copy/sync)** | Markets vs skyhedge.app | Landing lists Des Moines / NY / Miami / Chicago as **Live**; app shows Des Moines **Sales closed**, others **Ready to open**, Toronto **Opens soon**. Landing is marketing status; app is lifecycle — consider aligning labels so judges aren’t confused. |

## Not bugs

- Wind / Snow / Heat **SOON** on Protect — intentional.
- Wallet connected with open position “Waiting for the weather” — real Devnet state.
- Offline/network: Wi‑Fi was up; Storm Glass chrome matches landing.

## Fix plan (step 2)

1. Wallet: if balance fetch rejects or times out, stop saying “Reading…” — show friendly error + Retry (keep — for SKYT; never invent zero).
2. Protect closed window: keep honest closed-state UI; for demo recording, ask to open/seed next Des Moines window on Devnet (not done in this pass).
3. Landing Live vs app lifecycle: optional copy tweak later; not required for APK rebuild.
