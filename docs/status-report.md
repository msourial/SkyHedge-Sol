# Status report — Encode mid-submission prep

Branch: `seeker-revamp`  
Date: 2026-10-15  
Repo: `SkyHedge-clock-in-redesign`  
Live URL: https://skyhedge.app

## Verdict

Demo path is largely ready locally: Storm Glass Protect/Wallet (overnight), oracle permissionless settle/unavailable (already on branch, build+tests only), website polish + docs + Playwright green, release APK present. **One** Vercel production deploy ran from local CLI so `VITE_MAPTILER_KEY` is baked into the live site. Later polish commits are **not** on production until you approve another deploy (or push). Nothing else pushed; no `adb install`; Anchor program not deployed; no on-chain txs.

## Commits (this session, local only)

| Commit | Task | Summary |
| --- | --- | --- |
| `1db89d6` | 4–6 | Meta/OG, umbrella favicon, map load reliability, mobile CSS, quiet contrast, coverage wording, tab/retry labels |
| `3e21aa8` | 7 | README + `docs/demo-script.md` judges quick start / Devnet / skyhedge.app |
| `3066e72` | 8 | Markets research-hazard header fix + Playwright assertion updates |

Already on the branch before this session (overnight / earlier):

| Commit | Summary |
| --- | --- |
| `27e448f` / `caddc30` / `34fd86c` / `ff2ac2b` | Protect + Wallet Storm Glass + shared chrome + Metro shared tokens |
| `d2eab07` | Permissionless `mark_data_unavailable` / `settle_market` + `BeginSettlement` + settler + tests |
| `a9b9427` | Web client Storm Glass dark |
| `093c188` | Overnight verification report |

Branch is **ahead of `origin/seeker-revamp`** (local commits not pushed). Map WIP left unstaged on purpose (`agricultural-*.tsx`, `ReferenceAreaMap.tsx`, mockup PNGs, `.cursor/`).

## Per-task results

### 1. Redeploy Vercel prod (MapTiler key)

- **Done once:** `npx vercel deploy --prod --archive=tgz` → deployment `dpl_HG5XesB9vXtdkk2hpzMFJguYDpT1`, aliases include `skyhedge.app`.
- Cancelled an earlier Git redeploy of stale `e599ba3` so the one allowed prod ship used local HEAD (Storm Glass web + MapTiler env).
- **Live check:** Homepage loads Storm Glass UI. From `skyhedge.app`, MapTiler `style.json` / vector tiles return **200** with the production key. MapLibre can render Dataviz Dark. The explorer UI still timed out to “Map unavailable” in automation once (15s path); committed follow-up in `1db89d6` softens error counting / waits for `idle`+`resize` (not live until another deploy).
- Screenshot evidence: browser capture of homepage + map region with MapTiler attribution (automation session).

### 2. Protect / Wallet Storm Glass + consistency

- **Already done overnight** (`27e448f`, `caddc30`, `34fd86c`). No new UI commit this session.

### 3. Oracle fixes (`docs/oracle-failure-plan.md`)

- **Already implemented** in `d2eab07`. Overnight: `cargo-build-sbf` OK; `permissionless_resolution` **3/3**. **Program not deployed** (per rules).

### 4. Website polish

- Page title / description / canonical / OG+Twitter tags; `client/public/og.png`; isometric umbrella BrandMark (`shared/storm-glass` `brandMark` → favicon SVG/PNG sizes, apple-touch-icon, OG); mobile layout CSS for explorer/hazard/actions; map load reliability on committed explorer map.

### 5. Copy pass

- Replaced “insured boundary” → “coverage boundary” in web map chrome. Grep of product surfaces: “insurance” only in design rules that forbid the word. No fabricated market dates left in the README live-status blurb.

### 6. Accessibility

- `C.quiet` / `--faint` → `#98A3B0` (stronger contrast on navy). Tab labels `"… tab"`; retry `accessibilityLabel`. Touch targets already ≥44–48px on main controls; mobile hazard options / location rows forced to 48px.

### 7. README + demo script

- Judges quick start, live URL, Devnet notes, honest Des Moines window wording. See `README.md`, `docs/demo-script.md`.

### 8. Playwright

- Installed Chromium locally (`npx playwright install chromium`).
- `npm run test:ui`: **22 passed, 2 skipped** (skips are MapTiler-key-gated map tests), **0 failed**.

### 9. Release APK

- **Already built overnight** (not reinstalled). Path and hash below. Not `adb install`’d.

## Test results (gates after code changes)

| Gate | Result |
| --- | --- |
| `npm run check` | pass |
| `cd mobile && npm run check` | pass |
| `npm run test:server` | **178 passing** |
| `cd mobile && npm run test:mobile` | **112 pass / 0 fail** |
| `npm run test:ui` | **22 passed / 2 skipped / 0 failed** |
| Anchor permissionless tests | overnight: **3 pass** (not re-run this session) |

## APK

| | |
| --- | --- |
| Path | `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Size | ~123 MB (128 501 318 bytes) |
| SHA-256 | `a85b252a19d7b0c5ee1af33e7f7ddf7986ce51db98e63b136da1723c6ccdb8b9` |
| Install | **Not installed** |

## Live checks

| Check | Result |
| --- | --- |
| https://skyhedge.app | 200 in browser; Storm Glass landing |
| MapTiler key in prod build | Confirmed (style + `.pbf` 200 from site origin) |
| Explorer map “ready” in automation | Partial — attribution/key OK; component timeout observed before load-hardening commit; **hardening not on prod yet** |
| Favicon / OG on prod | Prod deploy predated `1db89d6` — umbrella OG/favicon need another deploy |

## Blockers / notes

- Map WIP intentionally uncommitted (OpenFreeMap experiment in working tree).
- One prod deploy quota used; polish + Playwright UI fixes still local.
- Permissionless oracle program binary is local; Devnet still needs your upgrade.
- Device visual QA needs your `adb install` approval.

## Needs your approval

1. **`git push`** of `seeker-revamp` (overnight + this session’s commits).
2. **Second Vercel production deploy** (or push-triggered) so meta/OG/favicon/map-load/research-header land on skyhedge.app.
3. **`adb install`** of the release APK above (verify SHA first).
4. **Anchor program Devnet deploy/upgrade** for permissionless settle / data-unavailable.
5. Optional: human eyeball of homepage map after deploy of `1db89d6+`.
