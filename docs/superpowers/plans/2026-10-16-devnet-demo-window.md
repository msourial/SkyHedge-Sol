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

1. **Upgrade.** Done. Signature `5fWW9j1wKpN7bLuHaHV1JMHVV2aLPAU3fokxivLuoMEQ7fDPsGBX7UV6h9DJBLcmqJr8rDYDzVmdrhRkHCXr5jgP`. Do not upgrade again.
2. **Des Moines window.** Done. Market 2 create `3BKexk…` / fund `5Uqswf…` / open `5Gbdau…` (see `docs/devnet-ops.md`). Sales close `2026-10-18T23:00:00Z`, observation Oct 19–24 UTC, 2,000 SKYT vault. Chicago stays closed.
3. **Chip.** Done. `marketListChipTone`: Live / Weekly open mint; Sales closed neutral; soon amber. Seeker shows Des Moines **Weekly open**.
4. **Mockups.** Done (Wallet is connect CTA — session cleared; Protect shows real **~9.05** SKYT). Cropped into `client/public/mockups/landing/{markets,protect,wallet}.png`. Normal APK reinstalled.
5. **Production.** Deploy + screenshots + `docs/status-report.md` + push `seeker-revamp` (this step).
