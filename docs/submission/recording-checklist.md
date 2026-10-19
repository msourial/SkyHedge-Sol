# Demo recording checklist — Seeker (2:30)

Follow [docs/demo-script.md](../demo-script.md). Devnet only. No fake balances, weather totals, or traction numbers. Do not use a regulated-product noun.

## Before you hit record

Phone `SM02G406197714` was checked on 18 Oct 2026. Re-read the screen if any figure moved.

- [x] Seeker attached over USB (`adb devices` shows `SM02G406197714`).
- [x] SkyHedge open. Wallet connected (`DKA9…FD6y`). Balance on screen: **329,973.85 SKYT**, **5.6296 SOL**.
- [x] Markets: **New York (Central Park)** chip **Open**.
- [x] Protect: **Nov 1 · W** priced row **≥ 69 mm · 20.0% · 24.00 per 100 SKYT · 4.1×**. Button **Protect for 24.00 SKYT** (100 SKYT). Not tapped.
- [x] This wallet has **no position** on Nov 1 · W (`4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq`), Nov 30 · M, or Dec 31 · M.
- [ ] Devnet pill is **still visible**. There is no `EXPO_PUBLIC_MARKETING_SHOTS=1` build on the device or on disk. Leave the pill. Say Devnet.
- [ ] Unlock, Do Not Disturb, Phantom Testnet Mode → Solana Devnet.
- [ ] Chrome on the Seeker open to **https://skyhedge.app** (headline and **Open web app**).
- [ ] App left on **Markets**, not on the buy button.

## One command

```bash
scripts/record-seeker-demo.sh
```

Saves `~/Documents/Codex/demo-assets/seeker-raw.mp4`. Ctrl+C when the wallet beat ends (limit 170s). Then:

```bash
scripts/edit-encode-demo.sh
```

`ffmpeg` is not installed on this Mac yet. The edit script stops until it is. Output path: `~/Documents/Codex/demo-assets/skyhedge-encode-demo.mp4`.

## Timing

| Time | On screen | Must show |
| --- | --- | --- |
| 0:00–0:03 | Title card | SkyHedge logo |
| 0:03–0:16 | skyhedge.app | Rain on your plans? Get paid. · Open web app |
| 0:16–0:34 | Markets | New York · Open |
| 0:34–1:08 | Protect | Nov 1 · W · priced row · 100 SKYT |
| 1:08–1:40 | Phantom | Live `open_position` approval |
| 1:40–2:02 | Ticket, then Wallet | Explorer link · connected address · SKYT balance |
| 2:02–2:27 | Ticket or Wallet | NOAA final data · DataUnavailable refund (spoken, not a fake payout) |
| 2:27–2:30 | End card | skyhedge.app |

Do not open the hidden sample payout preview. The Wallet positions list is not indexed; the coverage ticket is the position.
