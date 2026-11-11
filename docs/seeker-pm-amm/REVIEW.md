# Seeker pm-AMM review

Date: 2026-11-10. Branch: `seeker-pm-amm`.

## EGM execution

The owner authorized non-interactive drafting, implementation, fresh-context review and drift reconciliation. The EGM draft was written before production changes; section gates used the authorized proceed choice. The design-only drafting phase ended before implementation.

A fresh read-only Goldfish (`fork_turns: none`) read the plugin's design critic and implementation-readiness personas, implementation-readiness and zoom-out standards, PLAN, the mobile/shared modules and tests, relevant SDK builders/IDL, Metro configuration, and three supplied reference PNGs. It performed no builds, edits, key reads or transactions. Final verdict after rereading fixes: **no remaining Major or Blocker findings**.

## Findings and fixes

| Severity | Finding | Fix and evidence |
| --- | --- | --- |
| Major | No-side review/receipt described the Yes winning trigger. | No ticket/receipt says less than the strike; hero says Pays out below. Side semantics and receipt rendering tests cover both sides. |
| Major | No-side chance showed the Yes probability. | Ticket chance uses the complement of chain Yes price; the chain's retained Yes column explicitly says Yes price. Asymmetric-reserve test checks the complement. |
| Major | Harness pending metadata depended on key-file path, permitting the same wallet to evade its marker through a different filename. | `createFilePendingStore` uses deterministic public-key filenames and exclusive creation. Cross-instance offline test proves a second writer is refused. |
| Major | Wallet could not check retained uncertain sends. | Check transaction uses `reconcilePendingSend`, clearing only finalized success/failure. Pending, unknown, no-signature and RPC errors retain the marker. No automatic replacement send occurs. |
| Nit | Harness confirmation errors lost a known signature. | Error retains signature, and the submission module persists it for checking. |

Integration checks also corrected legacy controller side effects by leaving it unmounted, reversed No payoff charts, retained signed winning net values instead of clamping them to zero, displayed held positions from hidden discovery markets, and preserved quote identity through a wallet change during storage writes. Review and submission use one quote timestamp, verified by a final Goldfish reread with no new Major or Blocker findings.

Metro initially failed on Anchor's browser package retaining an unused `require('fs')` in NodeWallet.local. A narrowly scoped resolver returns an empty filesystem module only for Anchor. Native signing uses MWA, with Buffer/randomness, UTF-8 encoding, process and structuredClone initialized before SDK imports. The integrated Android Hermes export succeeds.

## Verification

| Command | Result |
| --- | --- |
| Root `npm run check` | PASS, exit 0 |
| Root `npm run test:pmamm` | PASS, 38 tests, 0 failures |
| Root `npm run test:line` | PASS, 80 tests, 0 failures |
| Mobile `npm run check` | PASS, exit 0 |
| Mobile `npm run test:mobile` | PASS, 317 tests, 0 failures |
| Mobile `npx expo export --platform android --output-dir /tmp/seeker-export` | PASS, exit 0; Android Hermes bundle exported |
| Lint | No lint script exists in root or mobile package manifests |
| `git diff --check` | PASS |

Offline tests use mocked RPC and cover visible catalog order, SDK swap/claim program/accounts/compute budget/missing ATAs, quote freshness, fees, slippage, owner changes, durable/concurrent/uncertain sends, controlled-wallet and RPC refusal, shares/collection, public evidence and source copy. No harness keypair dry run or live buy was performed.

## Limits and coordinator handoff

Static review confirms reuse of Line tokens, typography, icons, row/section components, Protect styles, SignSheet and receipt presentation. Export proves Metro/Hermes packaging. Pixel equality, device runtime and a real MWA approval/buy still require coordinator verification; no phone installation or recording occurred.

A pending send without a known signature remains blocked because RPC uncertainty cannot prove no send occurred. Known signatures can be checked from Wallet. Published settlement uses the single resolver and source/missing-data limits described by shared copy.

The implementation did not access private keys or private configuration, send Devnet transactions, push, deploy or modify other branches. The coordinator harness command and explicit `--send` switch are documented in README.

Commits are blocked by the environment: the worktree's actual Git directory is `/workspace/skyhedge-work/.git/worktrees/skyhedge-seeker-pmamm`, outside writable roots. The attempted first plan commit failed creating `index.lock` with a read-only-filesystem error. All implementation files remain available for review and commit; no permission escalation or metadata relocation was attempted.
