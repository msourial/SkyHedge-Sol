# Devnet authority configuration

This is a public-key-only record. It contains no recovery phrases, private keys, API tokens, or database credentials.

| Role | Public key | Responsibility |
| --- | --- | --- |
| Protocol admin | `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y` | Must sign protocol initialization and any two-step authority changes. |
| Settlement service | `AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh` | Submits one NOAA-normalized final observation per market. |
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` | Executable Devnet program identity. |
| Current upgrade authority | `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c` | Current BPF upgrade authority as verified on Devnet. Rotate to the protocol-admin wallet before treating this as an owner-controlled release. |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` | Six-decimal Devnet test mint. Finalized supply is 350,000 SKYT; mint authority is the protocol admin. |

## Verified chain state (2026-09-29)

- The protocol PDA is initialized, unpaused, and records the admin, separate settlement authority, and SKYT mint shown above. `nextMarketId` is 1.
- The program is executable and upgradeable. Upgrade authority remains `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`; it has not been rotated. The deployed 22-instruction Anchor IDL matches the committed IDL and contains `cancel_empty_draft_market`. The public finalized-RPC status reader reports the recovery capability as verified.
- Des Moines market ID 0 is an expired `Draft` with a zero-SKYT vault. Its immutable observation schedule and quote-input hash differ from the current NOAA seed package. It must not be funded or opened; the on-chain cancellation instruction rechecks empty balances and liabilities.
- The Vercel Production Builder gate for empty-Draft cancellation is enabled only after program/IDL verification. The protocol admin must approve cancellation of market ID 0. Then the Builder can prepare a fresh market (next ID 1) from current exact-window NOAA pricing terms; create, fund, and open remain separate wallet-approved transactions.
- NOAA historical station evidence, exact-window forecast/pricing inputs, and future final settlement observations are distinct artifacts. A pricing package is not future settlement rainfall.
- Production health reports NOAA configured, but the settlement signer and cron authentication are absent; automated oracle settlement requires those production secrets to be configured.

The settlement private key is stored locally in an ignored file. It must be rotated before any use beyond this Devnet build, and never committed or pasted into chat.

The protocol admin is a wallet public key, distinct from the current program-upgrade signer. The owner must approve market cancellation, creation, funding, and opening through the admin wallet; no service or deployer key can substitute for those approvals.
