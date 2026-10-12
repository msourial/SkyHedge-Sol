# SkyHedge Clock In: takeover log

Times are America/Toronto (EDT, UTC-4). Clone: `~/Documents/Codex/2026-08-12/i-would-stop-positioning-v1-as/work/SkyHedge-clock-in`.
Source of truth (confirmed by Miro): `codex/clock-in-mobile` on github.com/msourial/SkyHedge-Sol. Nothing has been pushed, released, merged to `main`, or done on-chain.

## Deadline discrepancy (unresolved)

- Public hackathon page: **Oct 12, 2026, 7:59 PM EDT (23:59 UTC)**.
- Earlier repo notes (`docs/clock-in-readiness.md`) say the registered Align draft showed **Oct 12, 2026, 7:59 AM EDT (11:59 UTC)**.
- Owner: Miro, to confirm the live countdown in the Align account. Treat 7:59 AM as the working deadline until confirmed.

## Timeline

### Oct 12, ~01:05: initial review (read-only)
- Found the active clone on `codex/clock-in-mobile`. The older clone at `~/Documents/Per/Hackathons/Skyhedge Solana /SkyHedge-Sol` is stale (70 commits behind) and was not used.

### Oct 12, ~01:06: backup of the existing APK
- `cp mobile/android/app/build/outputs/apk/release/app-release.apk ~/Documents/Codex/apk-backup/app-release-2026-10-11-0040.apk`
- Old APK: built Oct 11 00:40, 119,467,701 bytes, SHA-256 `85d648befdc77d2c66fb6557d58fe0ed824331e8a2316d64d53eb30707c3e721`.

### Oct 12, ~01:06: tests and typecheck at `e00f28e`
| Check | Command | Result |
| --- | --- | --- |
| Mobile tests | `cd mobile && npm run test:mobile` | 33/33 pass (6 suites) |
| Mobile typecheck | `cd mobile && npx tsc --noEmit` | exit 0 |
| Root typecheck | `npx tsc` | exit 0 |
| Server tests | `npm run test:server` | 151 passing |
Playwright UI tests were not run.

### Oct 12, ~01:06: first APK build (stale)
- Env: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME=~/Library/Android/sdk EXPO_PUBLIC_API_BASE_URL=https://skyhedge.vercel.app`
- `cd mobile && ./android/gradlew -p android :app:assembleRelease`: BUILD SUCCESSFUL in 42s.
- Problem: the APK was unchanged (same Oct 11 00:40 timestamp and SHA `85d648be…`). Gradle treated the JS bundle as up to date even though `mobile/` changed in later commits (13 files after `c280331`).

### Oct 12, ~01:07: merge dry run
- `origin/main` (`bf23c8a`) is an ancestor of `codex/clock-in-mobile` (`e00f28e`), so this is a fast-forward. `git merge-tree --write-tree origin/main HEAD` reports clean. `main` was not changed.

### Oct 12, ~01:07: branch `clock-in-final` and commit `2d5a780`
- `git switch -c clock-in-final` from `codex/clock-in-mobile` at `e00f28e`.
- Commit `2d5a780` "docs: Clock In final submission status with placeholders". Files: `README.md` (+7) and `docs/clock-in-readiness.md` (+14/−1).
  - README: new Clock In entry block (APK, video, pitch, wallet test, deadline).
  - Readiness: the deadline line is updated and a "Final submission status (October 12, 2026)" table is added.
  - Placeholders: `<<FINAL_COMMIT_SHA>>`, `<<NEW_APK_RELEASE_URL>>`, `<<NEW_APK_SHA256>>`, `<<SEEKER_SMOKE_TEST_RESULT>>`, `<<WALLET_TEST_RESULT>>`, `<<DEMO_VIDEO_URL>>`, `<<MARKET_STATUS>>`.

### Oct 12, ~01:07: forced rebuild, first attempt interrupted
- The forced rebuild command was interrupted about 1 s after it started, before doing any work.

### Oct 12, ~01:07: source sync (per Miro's instruction)
- `git fetch origin`: local `codex/clock-in-mobile` equals `origin/codex/clock-in-mobile` (0 ahead, 0 behind) at `e00f28e`. No pull needed.
- Branch vs `origin/main`: 11 ahead, 0 behind, 46 files, +1598/−391.
  - Mobile: keyless dark maps (`ff23d50`), Signal Dark map journey (`58d1bef`), truthful map fallback (`e3fe01e`), complete-only NOAA weekly history (`c280331`).
  - Security: removed the public settlement signer trigger (`aece509`) and pinned patched `shell-quote` (`0db4eb7`).
  - Web: AI advisory research gates (`07ea46c`), enterprise risk workspace (`e00f28e`), merge of main's customer experience changes (`745e9c5`).
  - Docs: CLOCK IN release and demo status (`299343d`, `6d6ce68`).

### Oct 12, ~01:08: forced rebuild, succeeded
- `cd mobile && ./android/gradlew -p android :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease` (same env): BUILD SUCCESSFUL in 17s.
- Built at HEAD `2d5a780`. `git diff e00f28e HEAD -- mobile` is empty, so the mobile source is identical to `e00f28e`.
- Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`, 119,467,677 bytes, Oct 12 01:08.
- SHA-256: `b46c2eb6ca43abdad17ad3d93578282f53126146f0fd27c7391273d3fc431ebd`
- Signing: `apksigner verify --print-certs` shows debug-signed (CN=Android Debug), cert SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. For testers only, not a store release.
- Copy: `~/Documents/Codex/apk-backup/SkyHedge-ClockIn-e00f28e.apk`.
- Not yet installed or tested on the Seeker.

## Open items

| Item | Owner |
| --- | --- |
| Confirm the live Align deadline countdown (7:59 AM vs PM EDT) | Miro |
| Install and smoke-test the new APK (`b46c2eb6…`) on the Seeker | Miro |
| Physical Mobile Wallet Adapter test (authorize/sign, or record the exact blocker) | Miro |
| Record a narrated demo video of 3 minutes or less and upload it publicly | Miro |
| Review the Align draft and make the final submission | Miro |
| Fill placeholders, push `clock-in-final` to `codex/clock-in-mobile`, optionally fast-forward `main`, and create GitHub prerelease `clock-in-2026-10-12` with the APK and SHA | Grok Bot, after Miro approves |
| On-chain Devnet market actions (cancel/create/fund/open) | Miro's call; on hold |

## Redesign merge (2026-10-12 01:12 ET)
- Worktree: `SkyHedge-clock-in-redesign`. Branch `clock-in-submission` was created from `clock-in-redesign` @ 8331042, then `git merge --no-ff clock-in-final` (@ f178561) was run, giving merge commit d44e172.
- Redesign commits included: 5bd6316, 4a94fcc, 13a534b, 7605984, 20c32e7, 192f645, 2cb9a6d, 116389b, 8331042 (details in docs/redesign-log.md).
- Conflicts: none. clock-in-final changed only README.md, docs/clock-in-readiness.md and docs/takeover-log.md. The redesign changed only mobile/ and docs/redesign-log.md.
- Tests on the merged tree:
  - `mobile: npm run check` is clean.
  - `mobile: npm run test:mobile` is 37 pass / 0 fail.
  - `npm run test:server` is 151 passing. It used node_modules symlinked from the main clone, an uncommitted link.
  - No server/shared/api code differs from clock-in-final.
- Not done: no push, no APK build or install, no adb device touched. If clock-in-final gets more commits, re-merge them into clock-in-submission.

## Protect "market not open" investigation (2026-10-12 01:19 ET)
Reported symptom (Seeker, wallet connected): 100 SKYT, then Get quote, showed "Waiting for market readiness: The Des Moines market is not open for protection positions."

**Verdict: state/data issue, not a code bug. No code changed.**

- **What the app checks:** `getProtectionUnavailableReason` (mobile/src/protection.ts:69) reads `/api/devnet/status` and requires `desMoinesMarket.onchainStatus` to be exactly Open. This is a one-shot read plus manual refresh. Nothing polls forever.
- **What the backend returns** (curl https://skyhedge.vercel.app/api/devnet/status, 01:2x ET):
  - market id 0 at `9UUNQPXnrzUEDsra8PMMzByp9J9un1yysGdGuaz9JqVJ`, `onchainStatus {"Draft":{}}`, `vaultBalance 0`
  - salesCloseAt 2026-09-29 13:19 EDT (expired); observation window 2026-09-29 to 2026-10-04 20:00 EDT
  - protocol `nextMarketId 1`, so this is the only market
  - `supportsEmptyDraftCancellation true`
  - the NOAA package seedSchedule is fresh: sales close 2026-10-13 01:18 EDT, observation 2026-10-13 to 2026-10-18 20:00 EDT
- **On-chain** (Devnet RPC, finalized):
  - the market account exists, is owned by program 5hGLEG…NPWx, and is 384 bytes
  - vault `GtENxF…JQ7jY` holds 0 SKYT
  - this confirms Codex's note: an expired empty Draft, with no cancel ever landed on-chain
- **Market selection:** the backend's `latestMatchingMarket` picks the highest id, and id 0 is the only one, so the market id is correct.
- **Admin wallet:** `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y` holds 350,000 SKYT and 5.69 SOL on Devnet. It is the protocol admin and the SKYT mint authority.
- **Local keypair:** the Mac's local `~/.config/solana/id.json` is 7zfJ…HF2c, which is not the admin. The CLI script `scripts/seed-markets.ts` is intentionally disabled (it throws), and `scripts/open-draft-markets.ts` targets localhost:8899 only.

**Fix requires admin-signed transactions** (not done; needs Miro's approval and the DKA9… wallet in a browser wallet). Use the web admin dashboard at https://skyhedge.vercel.app/ (client/src/pages/dashboard.tsx, client/src/lib/admin.ts):
1. Connect the DKA9… admin wallet and click "Cancel expired empty Draft first". This sends `cancel_empty_draft_market` for market 0, which moves Draft to Cancelled. Wait for finalization.
2. Click "Seed Des Moines". `desMoinesSeedTransactions` builds three admin-signed transactions:
   - `create_market`: id 1, using the fresh NOAA seed schedule above
   - `fund_pool`: 2,000 SKYT (`DES_MOINES_SEED_LIQUIDITY_BASE`)
   - `open_market`
3. Refresh the app. The backend auto-selects id 1, and the status should read Open with a 2,000 SKYT vault.

Timing: the seed schedule's sales close is 2026-10-13 01:18 EDT, so the fresh market sells through the 7:59 PM deadline.
