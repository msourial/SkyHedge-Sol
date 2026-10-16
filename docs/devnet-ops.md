# Devnet ops log (2026-10-16)

Devnet only. Admin wallet `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`. SKYT mint `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`. Program `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`. Upgrade authority `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`.

## TX 1 — Program upgrade
- **PRE:** Upgrade `skyhedge_protection` on Devnet with permissionless `settle_market` / `mark_data_unavailable`; signer upgrade authority `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`; program `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`.
- **POST signature:** `5fWW9j1wKpN7bLuHaHV1JMHVV2aLPAU3fokxivLuoMEQ7fDPsGBX7UV6h9DJBLcmqJr8rDYDzVmdrhRkHCXr5jgP`
- **Explorer:** https://explorer.solana.com/tx/5fWW9j1wKpN7bLuHaHV1JMHVV2aLPAU3fokxivLuoMEQ7fDPsGBX7UV6h9DJBLcmqJr8rDYDzVmdrhRkHCXr5jgP?cluster=devnet
- **IDL:** upgraded on `GNWLbfLbkNq7qM2J9hjt6mqSGqSVbALjK7tTTsosKCf4` (exact match to committed IDL).

## Verify — no second upgrade (2026-10-16 18:15 ET)

- Confirmed the signature above. Slot `511854561`. Log: `Upgraded program 5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`.
- Local ELF `anchor/target/deploy/skyhedge_protection.so` is 440,408 bytes, sha256 `4eba7dd7bfd4c4bbb981530ccb1ff9a527a9af6889c1d9518524f78d82b1b59e`. It is the prefix of the finalized program dump. The extra 36,104 bytes are zeros.
- Fetched IDL matches `shared/idl/skyhedge_protection.json`.
- `settle_market` signer is `settler` with no settlement-authority relation. `mark_data_unavailable` signer is `authority` with no settlement-authority relation.
- No second upgrade was sent.

