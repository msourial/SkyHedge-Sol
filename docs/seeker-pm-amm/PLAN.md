# Seeker pm-AMM plan

Author: SkyHedge contributors. Date: 2026-11-10.

## Problem and goals

Move native rain trading to the existing PREDICT Devnet markets while retaining the installed Seeker app's Line design, navigation, welcome, typography, peril tiles, review sheet and receipt. Prices, balances and shares come from chain; strikes and verification come from the shared catalog and evidence.

The owner explicitly authorized non-interactive EGM execution. Take the proceed choice at section gates. Prefer shared read helpers, SDK instruction builders and the existing MWA signer. No phone installation, recording, external publishing, secret access or live transaction is part of this work.

## Non-goals

No web styles, production network, new visual system, operator resolution or liquidity operations. Preserve legacy modules required by other perils and tests; rain cannot buy through the old program.

## Screens

Markets uses Line rows and sections for the visible catalog, Canadian cities first. Hide Seattle and Miami according to shared visibility. Protect retains city selection, peril tiles, hero, payoff chart, chain table and sticky action. Add Yes/No and mUSDC amount controls with existing primitives. Quotes show estimated shares and a 1% minimum. Review keeps the SignSheet presentation and explicitly identifies fee, station, window and source. Receipt retains the existing confirmed presentation and Devnet explorer link. Wallet uses the existing position card surfaces for mUSDC, shares, estimated value, settlement status and Collect. Verification uses an existing sheet and shared source/trust copy with daily evidence, hash and resolution/re-check links. Unsupported perils retain the existing unavailable treatment.

## Boundaries and flow

`shared/pm-amm/client.ts` owns reusable catalog, chain reads, balances and units. A static evidence index imports the same committed JSON records on both platforms. `client/src/lib/pm-amm.ts` delegates without changing web behaviour.

`mobile/src/pm-amm/` owns SDK instruction assembly, quote review identity, Devnet checks and persisted per-wallet pending sends. The exported buy function accepts a signer so app MWA and a Node harness run identical safety logic. Re-fetch immediately before signing; changed state, fee or insufficient fresh output requires a new review. Persist before invoking the signer; decline clears, uncertain send blocks repetition. Owner identity is part of review and send guards. Claim uses SDK claimWinnings and positive winning balance.

Native integration reuses `mobile/src/line/` primitives, SignSheet and PurchaseReceipt, plus `mobile/src/wallet.ts`. Node harness lives at `mobile/tools/pm-amm-devnet-buy.ts`; it defaults to read-only, validates Devnet and controlled public keys before signing, and reads a key only from the caller-provided path.

## Milestones and files

1. Plan and shared reads: this document; shared client/evidence index; web adapter; shared verification view model.
2. Native transactions: mobile pm-AMM module, secure pending store, harness and module tests; mobile package manifests, polyfills and Metro configuration as required by SDK bundling.
3. Screens: native pm-AMM controller and Line integration in App and screen components; preserve established styles and non-rain navigation.
4. Verification: root/mobile checks and tests, Android export, fresh-context read-only Goldfish review, fixes and `REVIEW.md`. Reconcile this plan with final file boundaries and remaining limitations.

## Risks and acceptance

MWA may return an uncertain send; durable markers must survive restart. SDK dependencies may require Hermes polyfills and package exports; Android export must prove bundling. Faucet limits must be explained with repository-established links. Market closure and wallet changes invalidate review. Evidence represents the published resolver record, including missing-data limits, rather than a new oracle promise.

Required checks: root check, test:pmamm and test:line; mobile check and test:mobile; Android Expo export; existing lint script if present. Offline tests cover listing, freshness, SDK accounts/compute/ATA setup, pending markers, controlled-wallet refusal, positions and evidence. No test sends a Devnet transaction. Fresh reviewer checks fidelity, transaction safety, bundling and secret handling. Fix Major findings before final commit and report exact results and harness command.

## Concrete file map and interfaces

- `shared/pm-amm/client.ts`: catalog, visible mobile order, shared connection, `loadMarkets(connection?)`, `loadBalances(states, owner, rpc?)`, units and `positionSummary`.
- `shared/pm-amm/evidence/index.ts`: static imports of committed evidence; coverage test fails when a JSON record is omitted.
- `shared/pm-amm/verification.ts`: `verificationViewModel(spec, evidence?)` validates record identity and supplies source, station, daily amounts, total, threshold, outcome, hash, resolution and re-check links.
- `shared/pm-amm/client.test.ts`: mocked balances, listing order/visibility, positions, evidence coverage, verification and copy checks.
- `client/src/lib/pm-amm.ts`: re-export shared reads while retaining web run metadata.
- `mobile/src/pm-amm/transactions.ts`: `createBuyReview`, `checkBuyReview`, `buildPmAmmBuyTransaction`, `submitPmAmmBuy`, SDK claim builder/submission and pending reconciliation. The signer accepts an unsigned VersionedTransaction and returns a signature only after confirmed success. Errors with signatures retain them in public pending metadata. Pending status checks clear only finalized transactions, without replaying them.
- `mobile/src/pm-amm/pending-store.ts`: SecureStore implementation keyed by wallet public key; no signer keys are stored here.
- `mobile/src/pm-amm/view.ts`: native ticket/payoff model from shared quote and copy, including opposite No outcome.
- `mobile/src/pm-amm/PmAmmLine.tsx`: native market, trade and wallet controller; foreground polling every 15 seconds, explicit refresh, wallet-generation guards, existing Line presentation and verification sheets.
- `mobile/App.tsx`: preserve font loading, Welcome, navigation and tab bar; use the pm-AMM controller without mounting the retained legacy controller and its network effects.
- `mobile/src/line/MarketsLine.tsx`: expose existing Section/MarketRow for reuse.
- `mobile/src/line/ProtectLine.tsx`: expose existing Protect styles for the native pm-AMM view.
- `mobile/src/line/SignSheet.tsx`, `PurchaseReceipt.tsx`: optional pm-AMM review metadata; retain presentation and progress behavior while displaying mUSDC/shares.
- `mobile/src/line/payout-graphics.tsx`: optional reverse outcome for No; default legacy behavior unchanged.
- `mobile/package.json`, `mobile/package-lock.json`: SDK 0.2.0, SPL token, Anchor and required runtime polyfills.
- `mobile/metro.config.js`: enable SDK package exports for the math entry.
- `mobile/src/polyfills.ts`, `mobile/src/polyfill-modules.d.ts`: Buffer/randomness, UTF-8 encoding, process and structuredClone before SDK imports.
- `mobile/tools/pm-amm-devnet-buy.ts`: guarded read-only/default harness; exclusive durable pending file on explicit send; no faucet or transaction is sent by verification commands.
- `mobile/src/pm-amm.test.ts`, `mobile/src/pm-amm-copy.test.ts`: mocked SDK transactions, freshness, owner changes, pending markers, claim and harness guards; source-tree copy scan.
- `mobile/src/covered.test.ts`, `presentation.test.ts`, `protect-copy.test.ts`, `welcome-store.test.ts`: preserve existing copy assertions while avoiding disallowed literal terms in the source tree.
- `docs/seeker-pm-amm/README.md`, `REVIEW.md`, `2026-11-10_DRIFT_REPORT.md`: coordinator command, limits, exact checks and review/drift findings.

Discovery hides catalog-hidden markets; Wallet still displays and allows collection of existing holdings in them. Unknown-signature pending attempts remain blocked because a failed RPC response cannot prove no send occurred. The coordinator must investigate those attempts externally. Known signatures can be checked through Wallet; finalized status clears the block and refreshes balances, never automatically retries a trade.

Final transaction tooling also uses `mobile/tools/pm-amm-pending-store.ts` for an exclusive per-public-key marker file under the mobile package directory (resolved relative to the harness script), covered by the mobile transaction tests; `mobile/.gitignore` excludes this public runtime state. `mobile/src/line/WalletLine.tsx` exposes its existing wallet card styles for the pm-AMM wallet. `mobile/src/pm-amm-view.test.ts` verifies review amounts, side semantics and reuse of the native screen shell.

`mobile/src/round3-render.test.ts` also covers the existing receipt rendering with Yes/No pm-AMM metadata. Review and submission now share one quote timestamp so the shown minimum and enforced minimum agree.
