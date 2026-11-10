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
