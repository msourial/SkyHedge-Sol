# Overnight report — Storm Glass Protect/Wallet + oracle verify

Branch: `seeker-revamp`  
Date: 2026-10-15 (local overnight run)  
Repo: `SkyHedge-clock-in-redesign`

## Verdict

Protect and Wallet now match Markets’ Storm Glass chrome (navy canvas, graphite glass panes, glacier accent, amber only for alerts/Devnet, Inter Tight headings). Shared tab bar / empty / loading / error / offline states were aligned. Oracle permissionless settle + unavailable changes were already on the branch (`d2eab07`); rebuilt and re-tested. Release APK built locally (not installed). Nothing pushed, no Vercel deploy, no on-chain/program deploy.

## Commits made this overnight (local only)

| Commit | Summary |
| --- | --- |
| `27e448f` | Restyle Protect for Storm Glass to match Markets |
| `caddc30` | Restyle Wallet for Storm Glass to match Markets |
| `34fd86c` | Align tab bar and shared states with Storm Glass |
| `ff2ac2b` | Allow Metro to resolve shared Storm Glass tokens (needed for release bundle) |

Already on the branch before this run (not re-committed):

| Commit | Summary |
| --- | --- |
| `5b48a9f` | Markets Storm Glass restyle |
| `d2eab07` | Permissionless `mark_data_unavailable` after deadline; permissionless `settle_market` once observation exists; `BeginSettlement` event; `settler` on `MarketSettled` + `permissionless_resolution.rs` tests |
| `a9b9427` | Web client Storm Glass dark (unrelated to mobile tabs) |

Branch is **ahead of `origin/seeker-revamp` by 5** (includes prior `a9b9427` + the four overnight commits). **Not pushed.**

Left unstaged on purpose (map WIP / screenshots / rules):

- `mobile/src/ReferenceAreaMap.tsx`
- `client/src/components/sky/agricultural-*.tsx`
- `docs/mockups/live-*.png`
- `.cursor/`

## Per-screen notes

### Markets (reference — already done)
- Glass search, region chips, peril chips, Des Moines hero, GlassCard panes.
- No overnight UI edits beyond shared chrome.

### Protect (`27e448f` + journey shared primitives)
- Peril selector uses graphite glass chips and sentence-case `soon` (amber).
- Coverage hero / fact rows / collect payout: money tones use payout gold; mint for live/success; amber reserved for warn/Devnet.
- Staggered `Enter` on peril, hero, stats, facts; ticket + wallet-balance `GlassCard` delays.
- Notice styles: coral for errors, amber soft for “not selling”.
- Flows unchanged: quote chips, sticky CTA, coverage ticket, claim/refund paths.

### Wallet (`caddc30`)
- Connect / balance / positions use `GlassCard` (no opaque `s.card`).
- Connected balance hero has glacier accent; empty state keeps umbrella + “Browse markets →”.
- Distinct loading vs portfolio-error empty panes (spinner / coral alert).

### Shared chrome (`34fd86c`)
- Tab bar: navy canvas fill, glass top border, selected tab glacier soft + rain icon/label.
- Loading panel, offline Protect card, and error banner use glass/coral tokens consistently across tabs.

## Oracle (task 4)

**Already implemented in `d2eab07`.** Verified overnight:

- `cargo-build-sbf --manifest-path anchor/Cargo.toml` — success (warnings only)
- `cargo +nightly test --manifest-path anchor/Cargo.toml --test permissionless_resolution` — **3 passed**:
  - `stranger_cannot_mark_data_unavailable_before_deadline`
  - `stranger_can_mark_data_unavailable_after_deadline_and_buyer_refunds`
  - `stranger_can_settle_only_with_an_observation`
- Logs show `BeginSettlement` and stranger `SettleMarket` / `MarkDataUnavailable` paths.
- **Program not deployed** (per rules).

No new oracle commit (nothing to land beyond verification).

## Tests run (after each task)

| Gate | Result |
| --- | --- |
| `npm run check` (root `tsc`) | pass |
| `mobile`: `npm run check` | pass |
| `mobile`: `npm run test:mobile` | **112 pass / 0 fail** |
| `npm run test:server` | **178 pass** |
| Anchor `permissionless_resolution` | **3 pass** |

No stuck failures (>3 tries).

## Release APK

| | |
| --- | --- |
| Path | `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Size | ~123 MB |
| SHA-256 | `a85b252a19d7b0c5ee1af33e7f7ddf7986ce51db98e63b136da1723c6ccdb8b9` |
| Build | `EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app ./android/gradlew -p android :app:assembleRelease` |
| Install | **Not installed** (adb install skipped) |

Metro initially failed to resolve `../../shared/storm-glass.ts`; fixed in `ff2ac2b` by watching `../shared` in `mobile/metro.config.js`, then rebuild succeeded.

## Screenshots

No device screenshots this run (no install). Visual check for morning:

1. Markets — unchanged Storm Glass hero/chips (baseline).
2. Protect — glass peril row, mint live pill (sentence case), payout gold on trigger/payout rows, graphite ticket split.
3. Wallet — glass balance card with glacier rim; empty positions pane.
4. Tab bar — selected tab glacier soft, rain label (not generic green naming).

Optional: open APK on Seeker after you approve install.

## Blocked / not done

- Device visual QA (no adb install).
- Push to remote.
- Vercel deploy.
- Anchor program Devnet deploy (permissionless IDL is in-repo; chain still needs your upgrade).
- Map WIP intentionally untouched.

## Needs your approval

1. **`git push`** of `seeker-revamp` (5 commits ahead).
2. **`adb install`** of the release APK above (or replace public release asset after you verify SHA).
3. **Vercel deploy** if web Storm Glass (`a9b9427`) should go live.
4. **Program deploy / upgrade** of `skyhedge_protection` so permissionless settle/unavailable is live on Devnet (IDL + worker already match `d2eab07`).
