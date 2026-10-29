# Round 3 mobile UI build

Implemented on `line-v6-markets` from `2ef3e06`. Changes remain uncommitted. No backend files or wire contracts changed.

## Changes

- `mobile/App.tsx`: early transaction signatures, recent purchase ordering in Wallet, per-market claim-readiness verification, refresh wiring, measured sticky-bar clearance.
- `mobile/src/line/SignSheet.tsx`, `PurchaseReceipt.tsx`: frozen purchase receipt, pending, timeout, confirmed, failed and Phantom rejection states; explorer action, Wallet navigation, retry, check scale/draw, stagger and reduced motion.
- `mobile/src/wallet.ts`, `buy-phase.ts`, `line-submit.ts`: emit signatures before confirmation; distinguish a definitive chain failure from a confirmation timeout.
- `mobile/src/line/WalletLine.tsx`, `CoverGauge.tsx`, `CoverDetail.tsx`: compact hero, reusable cover rows, live gauges, collection feedback, cover detail and account/transaction links. Wallet has no payoff sparklines or yellow trigger ticks. Only the first paid amount receives yellow.
- `mobile/src/line/MarketsLine.tsx`, `ForecastBlock.tsx`, `weather-hooks.ts`: read-only progress/GEFS loaders with 20-market batching, focus/hourly/manual refresh, null-data hiding, signed five-point edge threshold, comparison bars and source/member note. The note clears tabs at 412×915 and 393×852. Chance remains from the historical quote.
- `mobile/src/line/ProtectLine.tsx`, `HowPayout.tsx`, `payout-graphics.tsx`, `primitives.tsx`: live Pay/get line, payout information sheet, persisted multiple tip, one yellow trigger numeral on Protect, token tile radii. The detail payoff chart retains its single yellow trigger line.
- `mobile/src/round3.ts`, `multiple-tip-store.ts`: pure state/copy logic and a separate preference key in the app's existing SecureStore persistence.
- `mobile/src/round3.test.ts`, `round3-render.test.ts`: 11 new unit/render tests. Existing Wallet/Markets render hosts now support Linking and AppState.

## Verification

- `cd mobile && npm run test:mobile`: 279 passed.
- `cd mobile && npx tsc --noEmit`: passed.
- `npm run test:line`: 79 passed.
- `npm run test:server`: 321 passed.
- Root `npx tsc --noEmit`: passed.
- `git diff --check`: passed.

The existing RN Web harness was extended in `/tmp/skyhedge-native-preview` with `r3-entry.tsx`, `build-r3.cjs`, `capture-r3.cjs`, `extra-r3.cjs`, `verify-r3.cjs` and `motion-r3.cjs`. All fixture values are isolated to that preview and tests; the preview displays an Example data label. SecureStore is mocked in the preview and persistence tests. The harness explicitly controls screen-reader capability because RN Web otherwise reports it as always enabled.

PNG output: `/tmp/skyhedge-native-preview/captures-r3/` at 412×915, device scale 2:

- `markets-hero.png`, `markets-forecast-edge.png`, `markets-forecast-no-data.png`, `markets-forecast-negative.png`
- `protect.png`, `protect-tip.png`, `how-payout-sheet.png`, `protect-bottom.png`
- `success.png`, `success-pending.png`, `success-failed.png`, `success-cancelled.png`, `success-timeout.png`
- `wallet.png`, `wallet-gauge-states.png`, `wallet-bottom.png`
- `cover-detail.png`, `cover-detail-bottom.png`
- Additional `markets-forecast-393.png` at 393×852, device scale 2.

`verification.json` records browser interaction and layout assertions. `motion.json` records check-draw samples and the reduced-motion result. Each PNG was visually inspected.

## Remaining limits

- A physical Seeker/Phantom session, native haptics, native screen-reader announcements and device reduced-motion settings were not exercised in this environment. Browser captures use explicitly labelled fixtures, not a real purchase.
- `CoverProgress` supplies aggregate observations, coverage and source but no daily series. The mock's cumulative daily columns are omitted; detail uses the approved live aggregate gauge and requested payoff chart. No daily trajectory is fabricated.
- Purchase transaction links are available for signatures observed during the app session. Other covers always offer their actual Devnet cover-account link.
