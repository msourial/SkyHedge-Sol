# Status report — Encode Checkpoint 1 / mid-submission prep

Branch: `seeker-revamp`  
Date: 2026-10-16  
Repo: `SkyHedge-clock-in-redesign` → `msourial/SkyHedge-Sol`  
Live URL: https://skyhedge.app

## Verdict

Waitlist is **live on production** (Neon free via Vercel Storage, migrations applied, signup + admin CSV verified, test row deleted). Encode submission pack, judge README, 2:30 demo script, 9-slide PDF, release-note draft, and oracle build/tests are on the branch. **Push of `seeker-revamp` runs at the end of this report’s session (approved).** Encode project already exists — confirm **solo** team in the dashboard. No `adb install`; Anchor program **not** upgraded on Devnet; no on-chain txs.

## Commits (this session)

| Commit | Task | Summary |
| --- | --- | --- |
| `42d0966` | 2 | Encode submission pack under `docs/submission/` |
| `0585093` | 4 | Demo script Markets → Protect → Phantom → Wallet (2:30) |
| `6814575` | 3 | Judge-ready README (architecture mermaid, oracle table, tests) |
| `cbe831b` | 5 | Pitch deck HTML + PDF |
| `759fdf5` | 1 | Fold waitlist export/count into one Hobby-safe function |
| `19117ee` | 1 | ESM `.js` import for `shared/schema` (fixes Vercel 500) |
| *(status + release notes)* | 7–8 | This report + GitHub release notes draft |

## Per-task results

### 1. Waitlist live

- Neon **free_v3** resource `skyhedge-waitlist` via `vercel integration add neon` (connected to Production).
- `DATABASE_URL` (+ Neon vars) on Vercel Production; `ADMIN_TOKEN` / `IP_HASH_SALT` already present.
- Migrations `0002` / `0003` applied to Neon.
- Hobby 12-function limit: collapsed waitlist to one function + rewrites; removed unused claim-readiness API file (rewrite remains).
- Prod deploy `dpl_BnR57e39…` then fixed-module deploy (see latest aliased to skyhedge.app).
- **Verified:** `POST /api/waitlist` → 200 subscribed; `GET /api/waitlist/count` → 200; CSV export contained test email; **deleted only that test row** (remaining 0 for that email).

### 2–5. Submission / README / demo / slides

- Pack: description, problem/solution, how-it-works, why Solana/Seeker, tech stack, Devnet status, team (solo), links.
- README: quick start, architecture mermaid, oracle-failure table, test commands.
- Demo: 2:30 table + exact screens checklist.
- Deck: `docs/submission/deck.html` → `skyhedge-encode-deck.pdf` (9 slides). Traction = live waitlist only (no fabricated counts).

### 6. Oracle

- `cargo-build-sbf` OK.
- `permissionless_resolution`: **3 passed / 0 failed** (deadline gate, permissionless unavailable + refund, permissionless settle with observation).
- **Program not deployed** (per rules).

### 7. Protect / Wallet / APK / release notes

- No further Protect/Wallet polish required this pass (Storm Glass already on branch).
- Existing release APK kept (no adb install). SHA-256 documented in `docs/submission/github-release-notes.md`:
  - `6becdfc300f917923e1e2f50d95839d384ddc62514249aba72cbe691e4ad954d`
  - ~123 MB at `mobile/android/app/build/outputs/apk/release/app-release.apk`

### 8. Encode Checkpoint 1

- Project **already exists**.
- Team: **solo** (Miro) — confirm in Encode UI if prompted.

## Needs your approval / action

1. **Confirm solo team** in Encode Checkpoint 1 dashboard (project exists).
2. **`adb install`** of the release APK (verify SHA first) — not done.
3. **Anchor Devnet program upgrade** for permissionless settle / unavailable.
4. Optional: publish GitHub Release from draft notes; record demo video; fill `<<DEMO_VIDEO_URL>>`.
5. Optional: open/fund Des Moines (or other) markets on-chain when ready.

## Blocked / not done

- Map WIP still uncommitted (`agricultural-*.tsx`, `ReferenceAreaMap.tsx`, landing-review PNGs) — intentional.
- x402 not integrated.
- Confirmation email for waitlist not wired.
- Live waitlist **count is not published** (admin-only); after test-row delete, do not claim a signup total.

## Push

`git push origin seeker-revamp` executed after this status commit (user-approved).
