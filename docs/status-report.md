# Status report — Encode Checkpoint 1 / mid-submission prep

Branch: `seeker-revamp`  
Date: 2026-10-16  
Repo: `SkyHedge-clock-in-redesign` → `msourial/SkyHedge-Sol`  
Live URL: https://skyhedge.app

## Verdict

Des Moines market **2** is open on Devnet (create `3BKexk…`, fund `5Uqswf…`, open `5Gbdau…` — `docs/devnet-ops.md`). Seeker Protect shows a real NOAA premium **9.05 SKYT** per 100 SKYT without wallet connect; purchase CTA still requires Connect. Markets chip is mint for **Weekly open**. Landing mockups refreshed (priced Protect, Weekly open Markets; Wallet is connect CTA — session cleared). Weekly/monthly ladder code is on the branch with a pilot-window compat fallback; next Mon–Mon / calendar-month rungs need a separate admin seed (ask first). Never say insurance; no fake numbers.

## Commits (this session, selected)

| Commit | Task | Summary |
| --- | --- | --- |
| `8efd707` / `50b5bbe` | 1 | Device-check Markets/Protect/Wallet captures + BUGS |
| `9ec83a6` | 2 | Wallet balance hang → error + Retry |
| `7e228b5` | 3 | Landing mockups from `EXPO_PUBLIC_MARKETING_SHOTS=1` captures |
| `09df16a` | 4 / 6 | Recording checklist + waitlist already-subscribed UI |
| `8a6df88` | 5 | Release notes SHA for current arm64 APK |
| (this push) | seed + ladder | Devnet ops log, quote without wallet, ladder compat, mockups |

## Per-task results

### Devnet seed (market 2)

- Program upgrade already landed (`5fWW9j1w…`). Create / fund / open signed by Phantom `DKA9…`.
- Sales close `2026-10-18T23:00:00Z`, observation Oct 19–24 UTC, premium 905 bps / probability 700 bps, vault 2,000 SKYT.
- API quote: premium `9050000` (9.05 SKYT incl. 1% fee).

### Seeker Protect priced quote

- Quote fetch no longer requires wallet; StickyCta stays Connect until MWA.
- Captures: `docs/landing-review/device-check-2026-10-16/60-protect.png`–`65-protect-priced.png`.
- Markets: Des Moines **Weekly open** (green).

### Chip + ladder

- `marketListChipTone`: Live / Weekly open → mint; Sales closed → neutral; soon → amber.
- `sellingWindows` falls back to open `desMoinesMarket` when `cityWindows` is empty (demo window is not Mon–Mon).
- Server maps unrecognized open tenors into `cityWindows` as weekly for deploy.

### Marketing mockups

- `EXPO_PUBLIC_MARKETING_SHOTS=1`, crop 100px → `client/public/mockups/landing/{markets,protect,wallet}.png`.
- Protect shows **~9.05** SKYT; Markets **Weekly open**; Wallet is connect CTA (fresh install).
- Normal APK (flag off) rebuilt and reinstalled on Seeker.

### Waitlist

- Success + **Already on the list** verified on https://skyhedge.app.

## Needs your approval / action

1. Seed next **weekly/monthly ladder** rungs via `planLadderRoll` (admin Phantom) — ask before txs.
2. Optional: Phantom purchase on a wallet **without** an existing Des Moines position (DKA9 already waiting).
3. Confirm solo team in Encode UI; publish GitHub release when ready.

## Blocked / not done

- Connected Wallet marketing frame (MWA unlock on device).
- Map WIP still uncommitted (intentional).
- x402 not integrated.
