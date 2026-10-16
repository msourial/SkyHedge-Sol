# SkyHedge demo script (Seeker + web)

Encode mid-submission / judges. Live site: **https://skyhedge.app**. Native app: React Native Android on Solana Seeker (`seeker-revamp`). All activity is **Solana Devnet** with the **SKYT** test token (no real value).

## Quick start for judges

1. Open **https://skyhedge.app** — Storm Glass waitlist, or **https://skyhedge.app/app** for the Devnet product UI.
2. Or install the release APK ([Releases](https://github.com/msourial/SkyHedge-Sol/releases) or local `mobile/android/app/build/outputs/apk/release/app-release.apk`).
3. Phantom → Settings → Developer Settings → **Testnet Mode** → Solana **Devnet**. Need Devnet SOL (fees) and SKYT (premiums).
4. Flow: **Markets → Protect quote → Phantom approve → Wallet → settlement/refund story**.
5. Without SKYT you can still browse markets, quotes, and live NOAA data.

## Devnet notes

| Item | Value |
|---|---|
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` |
| Live pilot | Des Moines rainfall (windows follow each seeded market) |
| Coming soon | Toronto (Environment Canada adapter in-repo); wind/snow research-only |
| Settlement | NOAA only; incomplete/flagged data → `DATA_UNAVAILABLE` → premium refund |
| Permissionless settle / unavailable | In program source on `seeker-revamp`; Devnet upgrade may still be pending |

Never invent balances, weather values, or traction numbers on camera.

---

## Video — 2:30 flow + shot list (Seeker)

Record on the Seeker (scrcpy mirror or on-device screen record). Phantom in Testnet Mode on Devnet, with SOL + SKYT. Portrait, 1080p, clean status bar, notifications off.

| Time | Shot (on screen) | Voiceover |
|---|---|---|
| 0:00–0:12 | Title card "SkyHedge" · brief rain B-roll or still | "Weather kills days of revenue for operators who can't wait on paperwork. SkyHedge is parametric weather protection on Solana Mobile." |
| 0:12–0:35 | **Markets** tab: scroll cities → tap Des Moines → Rainfall → live NOAA chart / history | "I open Markets, pick Des Moines rainfall, and see the live NOAA picture that prices the quote." |
| 0:35–1:05 | **Protect**: coverage 100 SKYT → option ticket (You pay / Payout / trigger / window / chance / fee) | "On Protect I choose coverage. The ticket shows what I pay, what I get, the trigger, the window, the odds, and the 1% fee. No fine print." |
| 1:05–1:35 | Tap **Review in wallet** → **Phantom** approval sheet → Approve → "Finalized on Solana Devnet" + signature | "One tap to review. I approve in Phantom. The premium goes into an on-chain vault — that's my position." |
| 1:35–1:55 | **Wallet** tab: connected address, SKYT balance, **Your position** card + Explorer link | "Wallet shows my balance and the open position with an Explorer link. Keys never left my wallet." |
| 1:55–2:20 | Protect payoff / position claim state (or Markets card) while narrating settlement | "When the window closes, the final NOAA observation is hashed on-chain. Hit the trigger — claim the payout. No valid data by the deadline — reclaim the premium. No adjusters." |
| 2:20–2:30 | End card: "SkyHedge · skyhedge.app · Solana Mobile" | "SkyHedge: weather protection in your pocket." |

## Exact screens to record (checklist)

1. SkyHedge launch / splash (optional) → bottom nav **Markets**
2. Markets list with Des Moines hero + rainfall history chart
3. Protect coverage chips + filled **option ticket**
4. **Review in wallet** CTA → Phantom MWA sheet (amount visible) → Approve
5. In-app finalized confirmation (signature / Explorer affordance)
6. **Wallet** tab: address, SKYT, position card expanded
7. Settlement story beat (payoff chart and/or claim/refund copy on position — no staged fake payout)
8. End card (static or last frame of app + URL)

## Shot notes

- Keep Phantom approval in one continuous take; judges look for a real signature.
- If the market isn't open at record time, film ticket + approval on the most recent open window and say "Devnet" on screen.
- Don't show seed phrases, raw error spam, or traction numbers.
- Trim Markets scroll first if over 2:30.
- Optional B-roll: https://skyhedge.app desktop explorer map (after main Seeker path).
