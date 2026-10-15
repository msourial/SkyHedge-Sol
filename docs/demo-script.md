# SkyHedge demo script (Seeker + web)

Encode mid-submission / judges. Live site: **https://skyhedge.app**. Native app: React Native Android on Solana Seeker (`seeker-revamp`). All activity is **Solana Devnet** with the **SKYT** test token (no real value).

## Quick start for judges

1. Open **https://skyhedge.app** — Storm Glass UI, Des Moines rainfall pilot, MapTiler reference map when the key is configured.
2. Or install the release APK (see [Releases](https://github.com/msourial/SkyHedge-Sol/releases) or a local `mobile/android/app/build/outputs/apk/release/app-release.apk`).
3. In Phantom: Settings → Developer Settings → **Testnet Mode** → Solana **Devnet**. You need a little Devnet SOL (fees) and SKYT (premiums).
4. App path: **Markets** → pick a city → **Protect** → choose coverage → **Review in wallet** → approve in Phantom.
5. Without SKYT you can still browse markets, quotes, and live NOAA data.

## Devnet notes

| Item | Value |
|---|---|
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` |
| Live pilot | Des Moines rainfall (sales windows open/close by market schedule) |
| Coming soon | Toronto (Environment Canada adapter in-repo); wind/snow research-only |
| Settlement | NOAA only; incomplete or flagged data → `DATA_UNAVAILABLE` → premium refund path |
| Permissionless settle / unavailable | Implemented in program source (`seeker-revamp`); needs your Devnet program upgrade to go live on-chain |

Never invent balances, weather values, or traction numbers on camera.

---

## Video — 2:30 script + shot list (Seeker)

Record on the Seeker (scrcpy mirror on the Mac, or screen record on the phone). Phantom in Testnet Mode on Devnet, with SOL + SKYT in the wallet. Portrait, 1080p, clean status bar, notifications off.

| Time | Shot (on screen) | Voiceover |
|---|---|---|
| 0:00–0:15 | Title card "SkyHedge", then a runway in rain or fog (B-roll or still) | "A charter operator loses a day of flights to weather. A wedding gets rained out. A farmer's season dries up. Weather risk is everywhere, and the cover for it is slow, paperwork-heavy, and built for big companies." |
| 0:15–0:25 | Seeker home screen → tap SkyHedge → Markets tab | "SkyHedge is parametric weather protection on Solana Mobile. It's instant, it works anywhere, and it's fractional: protect exactly the amount you need." |
| 0:25–0:40 | Wallet tab → Connect → Phantom approval sheet → connected address + SKYT balance | "I connect with Mobile Wallet Adapter. My keys stay in my wallet, and SkyHedge never signs anything for me." |
| 0:40–1:00 | Markets: scroll locations, pick Des Moines → Rainfall; show the rainfall history chart | "I pick a place and a risk. Today's live Devnet market is cumulative rainfall in Des Moines, priced from NOAA history and the forecast." |
| 1:00–1:25 | Protect: enter 100 SKYT → quote → option ticket (You pay / Payout if triggered, trigger, window, chance, fee) | "Here's my option ticket: what I pay, what I get, the exact trigger, the window, and the odds. The 1% protocol fee is right there in the quote. No fine print." |
| 1:25–1:45 | Tap "Review in wallet" → Phantom shows the transaction → Approve → "Finalized on Solana Devnet" + signature | "One tap to review, and I approve in Phantom. The premium goes into an on-chain vault in our Anchor program, and that's my position." |
| 1:45–2:00 | Explorer link opened, then back to "Your position" card; expand Verification details | "Everything is verifiable: the program, the funded vault, and the NOAA station package are all checked on-chain." |
| 2:00–2:15 | Payoff chart on Protect; position card claim state | "When the window closes, the final NOAA observation is hashed and committed on-chain. If the trigger is hit, I claim my payout automatically. If the data never arrives, I get my premium back. No adjusters, no disputes." |
| 2:15–2:25 | Markets: Toronto "Opens soon" card | "Next is Canada. Our Environment Canada data feed is already built, and a Toronto market needs no program change, just a new market." |
| 2:25–2:30 | End card: "SkyHedge · skyhedge.app · Solana Mobile" | "We start with aviation and grow into every business that weather touches. SkyHedge: weather protection in your pocket." |

## Shot notes

- Record the wallet approval in one continuous take; judges look for a real signature.
- If the market isn't open at record time, film the ticket and approval on the most recent open window, and say "Devnet" on screen.
- Don't show seed phrases, raw error text, or any traction numbers.
- Keep total length at or under 2:30. Trim the Markets scroll first if you run long.
- Optional B-roll: open **https://skyhedge.app** on desktop to show the climate risk explorer and Des Moines reference map.
