# Root dependency audit

Measured November 10, 2026 with npm audit and npm audit --omit=dev at repository root. Counts are npm dependency findings, including inherited package paths, not independent exploit counts. No audit was applied to native or spike dependency trees.

| Scope | Stage | Low | Moderate | High | Critical | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Full | Before | 6 | 36 | 19 | 0 | 61 |
| Production | Before | 0 | 27 | 17 | 0 | 44 |
| Full | After | 7 | 31 | 7 | 0 | 45 |
| Production | After | 0 | 22 | 7 | 0 | 29 |

Upgraded x402 core/fetch/svm to 2.30.0 with required Solana Kit 8.6.0; Drizzle ORM to 0.45.4; Zod to 4.6.7; Vite to 6.4.6 with React plugin 4.7.0 and node-polyfills 0.28.0. Added explicit Mocha 11.8.0 (compatible with ts-mocha peer range) and scoped its serialize-javascript dependency to patched 7.1.3. npm audit fix updated compatible transitive dependencies, including body-parser, source-map-js and Vercel paths. Root SDK stays pinned to 0.2.0 and Anchor core to 1.0.2.

The first general audit fix failed peer resolution because patched x402 requires Kit 8. The Vite update required newer plugin peers. These were installed together without --force or --legacy-peer-deps. Typecheck and the full server suite pass after the upgrades. Final build/browser/shared checks are recorded in REVIEW.md.

## Remaining high findings

Both audits retain seven high dependency findings rooted in two packages, with npm reporting no available fix:

- [bigint-buffer buffer overflow](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg): inherited by @solana/buffer-layout-utils, @solana/spl-token, both Anchor packages and the SDK. Replacing or patching its native conversion interface would require a separately reviewed dependency fork; no patched release is reported. A pure-JS fallback warning on this machine does not establish that every installation avoids the affected code.
- toml: [prototype pollution](https://github.com/advisories/GHSA-v5mp-jgw5-2x6j), [recursion](https://github.com/advisories/GHSA-82x6-q7mm-w9cf), [array-table CPU exhaustion](https://github.com/advisories/GHSA-4qx8-w7c3-pj3p), [dotted-key CPU exhaustion](https://github.com/advisories/GHSA-9j65-hcg3-gc64) and [integer-literal CPU exhaustion](https://github.com/advisories/GHSA-9qmh-m7c6-f92p), through Anchor. No patched release is reported. Replacing its parser is an upstream compatibility change, not a safe version override.

The other five high entries are inherited paths: @anchor-lang/core, @coral-xyz/anchor, @pm-amm/sdk, @solana/buffer-layout-utils and @solana/spl-token. Nothing is suppressed, and no finding is declared harmless. Remaining moderate/low findings are still present in npm audit output. This work is a devnet demo, not a security certification or readiness for real-value use.
