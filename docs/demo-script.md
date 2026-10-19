# SkyHedge demo script (2:30)

Encode judges. Live site: **https://skyhedge.app**. Native app: React Native Android on Solana Seeker, branch `seeker-revamp`. All activity is **Solana Devnet** with the **SKYT** test token (no real value).

Never use a regulated-product noun for this app. Never invent a balance, a rainfall total, a price, or a traction number. If a figure on screen differs from the pre-check below, read the screen.

## What the camera follows

1. Web landing: **Rain on your plans? Get paid.** and **Open web app** (`/app`).
2. Seeker **Markets**: **New York (Central Park)** with the **Open** chip.
3. **Protect** expiry chain: **Nov 1 · W**, the one priced trigger row, coverage **100 SKYT**.
4. Sticky button builds an unsigned Devnet `open_position`. Approve it in **Phantom**. Do not tap this until the take is recording and you are ready to sign.
5. After approval, the **coverage ticket** on Protect is the position (Explorer link). **Wallet** shows the connected address and the SKYT balance read from Solana.
6. Settlement, spoken over that ticket: NOAA final data after expiry, or a **DataUnavailable** refund if valid data never arrives.

## Pre-check (Seeker `SM02G406197714`, 18 Oct 2026, 9:41pm)

Read again before record. These are observations, not a script to memorize if the chain moves.

| Check | What was on screen / on Devnet |
| --- | --- |
| Wallet | Connected. Address starts `DKA9` and ends `FD6y`. **329,973.85 SKYT**. **5.6296 SOL** for fees. |
| Markets | New York (Central Park) **Open**. Chicago, Miami, Dallas–Fort Worth, and Los Angeles showed **Soon** on the first screen. |
| Nov 1 · W | Selected. **14 days**. Settlement line: “NOAA Central Park · settles after expiry from NOAA final data.” |
| Priced row | **≥ 69 mm**, **20.0%**, **24.00** per 100 SKYT, **4.1×**. Other rows said **Coming soon**. |
| 100 SKYT | App default coverage. The button read **Protect for 24.00 SKYT**, which is the live price for 100 SKYT at that rate. |
| Not already bought | Claim readiness for this wallet on Nov 1 market `4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq` was `no_position`. Nov 30 · M and Dec 31 · M were also `no_position`. |
| Devnet pill | **Visible** (“Devnet · test token”). No `EXPO_PUBLIC_MARKETING_SHOTS=1` build is installed, and none is on disk. Do not paint the pill out. Say Devnet. |
| Positions list | Wallet says finalized positions are **not indexed** on this deployment. After the purchase, prove the position with the Protect coverage ticket and the Explorer signature, not with an empty Positions list. |

Program `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`. SKYT mint `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`.

The phone was left on **Markets**. Nothing was signed.

## Record

One command (writes the Seeker mirror, no mic):

```bash
~/Documents/Codex/2026-08-12/i-would-stop-positioning-v1-as/work/SkyHedge-clock-in-redesign/scripts/record-seeker-demo.sh
```

Stop with Ctrl+C when the wallet beat is done, or let the 170-second limit end it. Raw file: `~/Documents/Codex/demo-assets/seeker-raw.mp4`.

Before that command: unlock the Seeker, Do Not Disturb on, Phantom in Testnet Mode on Solana Devnet. Open Chrome to **https://skyhedge.app** so the first frames are the landing.

## Shot list

Title and end cards are added in the edit (3 seconds each). The Seeker recording is the middle. Keep the Phantom approval in one continuous take.

| Time | On screen | Do | Voiceover |
| --- | --- | --- | --- |
| 0:00–0:03 | Title card. Logo, “SkyHedge”. | Edit only. | “SkyHedge.” |
| 0:03–0:16 | Seeker browser on skyhedge.app. Headline **Rain on your plans? Get paid.** Button **Open web app**. | Hold, then tap Open web app once so `/app` is visible. Don’t join the waitlist. | “Rain on your plans? Get paid. This is SkyHedge on the web. Open the web app, then the same protection on a Solana Seeker.” |
| 0:16–0:34 | SkyHedge app, **Markets**. New York row, **Open** chip. | Switch to the app. Pause on New York. Don’t open a Soon city. | “Markets. New York is open. Central Park rain. The other cities on this list are still opening soon.” |
| 0:34–1:08 | **Protect**. Chips **Nov 1 · W**, Nov 30 · M, Dec 31 · M. Priced row only. **100 SKYT** if the chip is on screen. Button **Protect for … SKYT**. | Tap New York, or the Protect tab. Confirm Nov 1 · W. If 100 isn’t selected, tap **100** — not the blue button yet. | “Protect. I take the weekly expiry, November first. The chain lists rain triggers. Only one row is priced. That is the trigger already pinned on Devnet. Coverage stays at one hundred test SKYT. The button shows the live price for that amount.” |
| 1:08–1:40 | Tap the blue **Protect for … SKYT** button. Phantom approval for `open_position`. Approve. | This is the live signature. One take. If Phantom asks for a network, it must be Devnet. | “One tap builds an unsigned open position. I approve it in Phantom. The premium goes into that market’s vault. Nothing was signed until this screen.” |
| 1:40–2:02 | Protect **coverage ticket** (status, tx, Explorer). Then **Wallet**: Connected, SKYT balance, SOL for fees. | Stay long enough to read the ticket, then open Wallet. If Positions still says not indexed, leave that sentence on screen. | “The wallet is still connected. The SKYT balance is read from Devnet. After the approval, the protection ticket shows the position and an Explorer link. On this deployment the positions list is not indexed, so an empty list is not the proof. The ticket is.” |
| 2:02–2:27 | Stay on the ticket or Wallet. No sample payout screen. | Do not open the hidden demo preview (it uses sample millimetres). | “Here is how it settles. After the expiry, SkyHedge uses NOAA’s final Central Park numbers. If the rain reaches the trigger, the payout can be collected to the wallet. If valid data never arrives by the deadline, the market is marked DataUnavailable, and the premium comes back. SkyHedge does not invent a rainfall total.” |
| 2:27–2:30 | End card. Logo and **skyhedge.app**. | Edit only. | “SkyHedge. skyhedge.app.” |

Trim the Markets beat first if the Seeker take runs long. The edited file must stay under 3 minutes.

## After the take

```bash
~/Documents/Codex/2026-08-12/i-would-stop-positioning-v1-as/work/SkyHedge-clock-in-redesign/scripts/edit-encode-demo.sh
```

That needs `ffmpeg` and `~/Documents/Codex/demo-assets/seeker-raw.mp4`. Output: `~/Documents/Codex/demo-assets/skyhedge-encode-demo.mp4` (1080×1920). Narration text: `~/Documents/Codex/demo-assets/audio/voiceover.txt`. VoiceStudio on this machine cannot generate audio yet (the Apple Silicon binary is an empty placeholder, and no local models are installed).

## Devnet notes

| Item | Value |
| --- | --- |
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` |
| Open on the Seeker list | New York rainfall, when a window is selling |
| This week’s buy | Nov 1 · W, the single priced trigger row, 100 SKYT |
| Also open on Devnet | Des Moines windows are in the status API. They are not the demo path. |
| Soon on the first Markets screen | Chicago, Miami, Dallas–Fort Worth, Los Angeles. Toronto stays closed. |
| Settlement | NOAA final data after expiry. No valid observation by the data deadline → `DataUnavailable` → premium refund. |
| Wallet positions | Not indexed on this deployment. The coverage ticket is the on-screen position. |
