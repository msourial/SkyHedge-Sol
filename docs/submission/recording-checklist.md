# Demo recording checklist — Seeker (2:30)

Follow with [docs/demo-script.md](../demo-script.md). Devnet only. No fake balances, weather totals, or traction numbers. Never say “insurance.”

## Before you hit record

### Phone (SM02G406197714 / Seeker)

- [ ] Unlock Seeker; Wi‑Fi on (no SIM is fine).
- [ ] **Do Not Disturb** on; discard/clear notification shade.
- [ ] Brightness comfortable for camera; auto-brightness off if it flickers.
- [ ] Status bar clean: no low-battery icon, no USB-debug toast if possible.
- [ ] Phantom: Settings → Developer Settings → **Testnet Mode** → Solana **Devnet**.
- [ ] Test wallet funded with **Devnet SOL** (fees) and **SKYT** (`3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`).
- [ ] SkyHedge release APK installed (`com.skyhedge.mobile`); cold-launch once to confirm Markets loads.
- [ ] Prefer an **open** Des Moines rainfall window so Protect shows a real priced ticket. If not open, use the live window and say “Devnet” on camera.

### Desk / capture

- [ ] USB connected; `adb devices` shows the Seeker.
- [ ] Mirror with a window titled **Seeker**:

```bash
scrcpy -s SM02G406197714 --window-title 'Seeker' --max-size 1080 --stay-awake --disable-screensaver
```

- [ ] Record the scrcpy window (or on-device screen record). Suggested ffmpeg of the Seeker window after you note its geometry, or QuickTime/OBS capturing that window:

```bash
# Example: record selected display/window in OBS → 1080p portrait crop, 30fps
# Or on-device:
adb -s SM02G406197714 shell screenrecord --time-limit 150 /sdcard/skyhedge-demo.mp4
# then pull:
adb -s SM02G406197714 pull /sdcard/skyhedge-demo.mp4 ./skyhedge-demo.mp4
```

- [ ] Mic check; script open beside you; Explorer bookmarked for optional signature beat.

## Timing (voiceover beats)

| Time | On screen | Must show |
| --- | --- | --- |
| 0:00–0:12 | Title / brief rain still | “SkyHedge” |
| 0:12–0:35 | **Markets** → Des Moines → Rainfall + NOAA chart | Live station picture |
| 0:35–1:05 | **Protect** ticket (coverage, You pay, Payout, trigger, window, chance, fee) | Real quote numbers |
| 1:05–1:35 | **Review in wallet** → Phantom approve → finalized | Real signature path |
| 1:35–1:55 | **Wallet** address, SKYT, position card | Explorer affordance |
| 1:55–2:20 | Settlement / refund story on position or payoff | No staged fake payout |
| 2:20–2:30 | End card | skyhedge.app · Solana Mobile |

Trim Markets scroll first if over 2:30. Keep Phantom approval in one continuous take.

## After recording

- [ ] Trim to ≤2:30; export 1080p.
- [ ] Upload; put URL in README (`<<DEMO_VIDEO_URL>>`) and `docs/submission/links.md`.
- [ ] Do **not** publish the GitHub release until the video link is ready (draft is fine).
