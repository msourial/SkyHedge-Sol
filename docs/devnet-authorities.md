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
- The program is executable and upgradeable. Upgrade authority is `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`; the local upgrade signer matches it. The deployed Anchor IDL is one instruction behind the committed IDL and does not yet contain `cancelEmptyDraftMarket`.
- Des Moines market ID 0 is `Draft`, has no shares or liabilities, and its vault holds zero SKYT. Its immutable observation schedule and quote-input hash differ from the current NOAA seed package. It must not be funded or opened.
- After the program and IDL upgrade are finalized, the admin wallet must approve cancellation of this empty Draft. The next seed uses market ID 1 and a fresh, exact-window NOAA quote. Create, fund, and open remain separate wallet-approved transactions.
- The current NOAA historical package validates station availability only. Future quote inputs must independently cover the exact observation window; the current quote commitment is not future settlement rainfall.

The settlement private key is stored locally in an ignored file. It must be rotated before any use beyond this Devnet build, and never committed or pasted into chat.

The protocol admin is a wallet public key, distinct from the current program-upgrade signer. The owner must approve market cancellation, creation, funding, and opening through the admin wallet; no service or deployer key can substitute for those approvals.
