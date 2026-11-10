# EGM implementation reviews

## M1 fresh-context review

Reviewer: `m1_review`, fresh conversation (`fork_turns: none`), read-only implementation-readiness/code persona. Read the bundled EGM persona and implementation-readiness standard, plan, all shared/operator files, catalog, dependency changes and spike baseline. No builds, tests or writes performed by reviewer.

Findings and fixes:

- Major: catalog spec could diverge from the stored on-chain name. Added shared canonical identity assertion, checking validated spec/name/end/authority/mint, and a tampering regression test; trader script uses it too.
- Major: rerunning an ambiguous resolution could overwrite the response used for the attempted send. Resolution checks persisted attempts before fetch/write; dry runs never change evidence. A logged successful resolution repairs its evidence signature after verifying the chain outcome. Unknown sends require manual reconciliation.
- Major: resolver used UTC final-day end. Added station-local next midnight and New York/Chicago/DST assertions.
- Major: evidence directory could be absent on a fresh checkout. Atomic JSON writer creates parent directories.
- Major: milestone plan lacked interfaces and concrete assertions. Expanded file boundaries, data shapes, wallet recovery and verification acceptance checks in PLAN.md.
- Nit: trader bypassed catalog identity checks. It now uses the shared assertion before quote/send.

Additional author correction before review: fixed constructed liquidity state to I80F48, matching the SDK converter, rather than the helper comment's Q64.64 wording. Regenerated measurements. Price and quote tests use float tolerance for SDK normal-CDF approximation.

Validation: root typecheck; shared tests; existing line, server, Phantom and spike tests. Full web test/build remains at M2 when routing is changed. Demo settlement completed after expiry.

Read-only follow-up confirmed the original fixes and found one further major: LP shares can remain after residual redemption. Replaced the nonzero-shares guard with pending I80F48 accumulator/checkpoint plus entry-surplus calculation; added zero-pending and surplus regression cases. The verifier now uses the canonical identity assertion. Receipt records are raw finalized evidence for manual inspection; successful execution alone does not assert economic payout correctness. Demo balance deltas are checked separately below.

M1 completion: nine finalized transaction receipts verified; the winning trader received 10.089787 mUSDC, creator received 49.710212 mUSDC after residual redemption, and both equal their winning-token burns. Re-running creator redemption sent nothing. Baseline site build could not export Expo because native dependencies are absent; M2 removes that build dependency. Baseline web tests were stopped because no Expo artifact existed. No mobile, Anchor or API files changed.

## M2 fresh-context review

Reviewer: `m2_review`, isolated conversation, read-only EGM implementation-readiness persona and standard. Read the plan, UI, shared trading/catalog code, routing/build changes, tests, SDK send implementation and API registration. No writes or execution.

- Major: browser tests lacked NO quotes, changed-state review, successful sends, Collect submission and uncertain-send behavior. Added mutable account fixtures and controlled Phantom/RPC tests for these flows.
- Major: polling could clear an uncertain-send warning and permit an immediate duplicate. Added a wallet-specific persisted pending marker before SDK sends; polling cannot clear it. Users must inspect activity and explicitly acknowledge before another action. Known wallet rejections clear the marker.
- Nit: a transaction finishing after wallet switching could show an old wallet's success in the new session. Completion now checks the captured submitting address before updating wallet-specific state.

Author routing check also found Express development/production fallbacks still targeting Expo; both now use the Vite client. Existing API registration remains ahead of static fallbacks. No native/Anchor/API files changed.

M2 validation: typecheck and Vite site build pass; all 13 Playwright web tests pass. RPC fixtures encode valid SDK account bytes; test numbers remain test-only. The suite exercises YES/NO review, changed-reserve rereview, Phantom signing rejection, successful mocked buy/Collect and devnet receipt links, pending-action persistence through polling, wallet disconnect balance clearing, catalog/evidence/deep links and narrow layout. Mocked success does not establish real extension signing; M1 separately proves shared-code live devnet execution.

## M3 fresh-context review

Reviewer: `m3_review`, isolated read-only EGM implementation-readiness/code pass. Read all wallet/UI/fixture/dependency changes and plan/guide. Confirmed both official kit bodies exactly match fetched originals after attribution headers.

- Major: storage access outside initial wallet setup could throw, including Phantom pending-marker reads, export and replacement. Guarded each path. If persistence is unavailable Phantom can still connect/read; sends require a persisted marker and refuse safely. Replacement now saves an imported fresh key atomically before updating the active signer, preserving the old stored key when saving fails.
- Major: missing replacement/storage/positive-balance/signer-switch tests. Added explicit replacement and cancellation, denied-storage plus Phantom reads, positive balance after refused top-up, and review/balance clearing on signer switch.
- Nit: guide status still said M3 pending. Updated at completion.

Author testing found newly funded balances could wait for the next polling interval. Funding readiness now triggers an immediate shared balance refresh. The wrapper reads actual ATA bytes and SOL balances without treating RPC failures as an absent account. Faucet attempts are persisted before requests; rerender/reload does not repeat refusals.

M3 validation: typecheck and site build pass; all 17 web tests pass in an isolated run. Both official source bodies compare exactly with retrieved originals. No creator key enters browser code, and no secret material is logged or committed.

## M4 fresh-context review

Reviewer: `m4_review`, isolated read-only EGM implementation-readiness/code pass. Read the plan, dependency diff/peers, audit records, screenshot automation, operator/trade/receipt verification and run-log diff. No blocker or major finding. No writes or execution.

- Nit: the environment runs Node 24 while package engines declares Node 22. Added a full supported-runtime validation pass using npm's Node 22 binary; exact version/results are recorded below.

Live validation found screenshot automation could request review before burner funding finished. It now waits for setup to finish and a positive measured balance. The UI disables review until a signing client is ready. No trade was sent in the premature attempt. One subsequent browser purchase completed, and finalized receipts verify its input/output/minimum. The browser profile stays outside the repo; captures never export/read its key. Screenshots were inspected for actual positions, complete verification and phone layout.

Real operator check: a disposable external no-trader key quoted and bought NO through the shared code; finalized receipt paid 5 mUSDC and received 9.762056 shares. Real browser check: automatically funded burner bought YES for 5 mUSDC, received 9.837940 shares, minimum 9.739559. Demo settlement and two-step creator redemption remain verified. No extra faucet wallets or retry loops were used.

M4 completion follow-up found a major verification gap: browser receipts accepted any catalog outcome mint rather than the selected market/side. Each trade now records market, direction, raw input and its own confirmed review text; verification validates canonical market identity and the exact expected mint. The current receipt's mint independently matches New York YES. A nit found that a changed quote could leave old review text in the capture log; automation now captures the refreshed review before its second confirmation. The existing real receipt verifies under the tightened checks.

Supported-runtime validation: Node v22.23.4 passed root typecheck, 80 line tests, 328 server tests, 3 Phantom tests, 2 spike tests, 7 shared pm-AMM tests, Vite site build and all 17 mocked web tests. The real browser receipt verifier and read-only external-trader quote also ran under Node 22. Native/Anchor/API source diffs are empty. External creator/no-trader key files remain mode 600; no keypair, profile or environment file is staged. Added lines contain none of the prohibited vocabulary. All work remains local; no deployment, push or PR.

Both root build modes passed on Node 22: `npm run build` produced the React client plus Express bundle, then `npm run build:site` produced the final static site without Expo. The final static build remains in dist for operator preview. Diff and vocabulary checks passed; no mobile, Anchor or API source changed.

## M5 fresh-context review

Reviewer: `m5_review`, fresh-context read-only EGM implementation-readiness/code review using the bundled persona and implementation-readiness standard. Required file reads and SDK IDL inspection completed; no writes or test execution by reviewer.

- Major: a CPI router could include unrelated sibling token transfers in the same outer instruction, overstating volume/fees. Limited attribution to the swap's stack-height subtree; missing CPI stack metadata refuses stats. Added a sell fixture with an unrelated sibling transfer and missing-stack refusal.
- Major: an undecoded sell fee transfer could silently understate gross volume/fees. Unparsed SPL token instructions in the swap subtree now refuse stats; added an incomplete-sell regression fixture.
- Nit: plan omitted exact M5 file boundaries and edge cases. Added the file list and attribution/error/timeout acceptance details.

Author live verification found creator swaps can retain their creator-fee share and debit less than the instruction's nominal input. Controlled wallets are excluded before transfer attribution and again in aggregation; their trades do not affect public figures. The finalized live scan reached all existing creation receipts and measured all zeros after exclusions (timestamped stats.devnet.json). Initial browser validation used a stale static build and a JSON import incompatible with the test runtime; rebuilt the site and switched to the existing require-based catalog fixture.

Additional verification preserves integer precision in displayed stats even above JavaScript's safe-number range. A 320px browser assertion exposed an existing market-card button overflow; wrapping the card footer at narrow widths fixes it. The stats table scrolls inside its own bounded container. One overlapping browser run lost its shared preview server; final validation uses an isolated run after rebuilding static assets.

M5 final validation: `npm run check`, 15 pm-AMM unit tests, 20 web tests (isolated rebuilt site), 80 line tests, 328 server tests and 3 Phantom tests pass. Site build and diff whitespace checks pass. No mobile/Anchor/API changes, secrets, deployment, push or PR actions. M5 complete.
