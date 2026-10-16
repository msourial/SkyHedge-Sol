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

## TX 2–4 — Fresh Des Moines sales window (market id 2)
- **PRE (create):** Create Des Moines market `2` PDA `HDJiTEYSnaeUNZWAHvgWrMaefKemFq61S32bE2RVyiEZ` with NOAA quote package (premium 905 bps); sales close ~2026-10-17T22:15Z; observation through 2026-10-23; signer protocol admin `DKA9…FD6y`.
- **PRE (fund):** Fund vault `GGisoH9bSCR3cJ2qqGBtTNKvGw45HP2bT3o6d6iE64LK` with 2,000 SKYT from admin ATA.
- **PRE (open):** Open market `2` for sales.
- **POST:** Not finalized. Phantom opened for admin `DKA9…` but returned `User rejected the request` (and later `Unexpected error`); no create/fund/open signatures landed. Market id 2 is still absent (`nextMarketId=2`). Re-run: `npx tsx scripts/seed-fresh-des-moines-devnet.ts`, open http://127.0.0.1:8765/, unlock Phantom on **Devnet/Testnet mode** as DKA9, click **Start seed with Phantom**, approve all three txs. Or set `PROTOCOL_ADMIN_KEYPAIR` to the DKA9 keypair path and re-run. Second city skipped (needs a second validated NOAA package).
- **Builder:** Open+sales-closed now plans a fresh market ID (see `shared/des-moines-seed-plan.ts`); deployed on `seeker-revamp`.

## Seeker verify
- Blocked until market 2 create/fund/open signatures finalize. Protect cannot show a priced purchase quote while market 1 sales are closed and market 2 is absent.

