# Devnet demo window

> **For agentic workers:** Native execution in this session. Commit after each step. Devnet only.

**Goal:** A funded Des Moines sales window stays open long enough to record a demo this week, Protect shows a real NOAA premium, and the landing mockups and production site match that.

**Architecture:** The permissionless program is already on Devnet. A fresh market is created from a NOAA quote package, not from the disabled 20% seeder. The Markets chip color comes from the displayed state, not the catalog flag.

**Tech Stack:** Anchor/Solana Devnet, NOAA QPF, React Native, Vite landing, Vercel production.

**Spec:** User approval 2026-10-16: Devnet only, test SKYT, admin wallet `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`. Say coverage, markets, and perils. No fake numbers. Ask before mainnet or any paid service.

## Global Constraints

- Devnet only. Program `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`. Upgrade authority `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`.
- Print what each transaction does before it is sent. Log signatures in `docs/devnet-ops.md`.
- Admin keypair is not on disk. Create, fund, and open must be signed by Phantom holding `DKA9…`.
- Do not commit `mobile/src/ReferenceAreaMap.tsx` or other map WIP.
- Green means live sales only. Amber means soon or an alert. Sales closed is grey.
- Chicago is skipped: there is no validated NOAA quote package, and `scripts/seed-markets.ts` is disabled because it hardcodes a 20% probability.

## Review Focus

- A second program upgrade must not be sent when the deployed ELF already matches the local binary.
- A fresh market must not be created while Des Moines sales are still open.
- A sales window must not be lengthened with a guessed premium. If the longer observation dates have no complete NOAA quote, use the validated 24-hour schedule.
- Marketing captures must come from `EXPO_PUBLIC_MARKETING_SHOTS=1`, then the device must be returned to a build without that flag.
- Landing mockups must not show a fabricated premium.

## Steps

1. **Upgrade.** Already landed. Signature `5fWW9j1wKpN7bLuHaHV1JMHVV2aLPAU3fokxivLuoMEQ7fDPsGBX7UV6h9DJBLcmqJr8rDYDzVmdrhRkHCXr5jgP` upgraded the program at slot 511854561. Local ELF is the prefix of the dump; trailing bytes are zeros. Deployed IDL matches `shared/idl/skyhedge_protection.json`. `settle_market` and `mark_data_unavailable` signers have no settlement-authority relation. Record the check. Do not upgrade again.
2. **Des Moines window.** Prefer sales open through Sunday 2026-10-18 19:00 America/New_York (`salesCloseAt` 2026-10-18T23:00:00Z, observation 2026-10-19 through 2026-10-24 UTC) only if `getDesMoinesEvidencePackage` returns `quoteTerms`. QPF currently ends 2026-10-24T06:00:00Z. If that quote fails, use the production 24-hour package. Fund 2,000 SKYT from the admin wallet (balance is about 347,998 SKYT). Three transactions: create, fund, open. Chicago stays closed.
3. **Chip.** `marketListChipTone` in `mobile/src/presentation.ts`. "Sales closed" is neutral. "Live" is mint. "Opens soon" and catalog `soon` are amber. Ready and concept stay glacier. Cover the Markets list chip, its row dot, and the Des Moines card pill.
4. **Mockups.** Marketing APK, Seeker `SM02G406197714`. Markets at the top, Protect with the open market and the real premium, Wallet connected. Crop 100px. Replace `client/public/mockups/landing/{markets,protect,wallet}.png`. Reinstall the normal release.
5. **Production.** Deploy, screenshot https://skyhedge.app at 1440 and 390, update `docs/status-report.md`, push `seeker-revamp`.
