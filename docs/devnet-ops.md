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

## TX 2–4 — Fresh Des Moines sales window (market id 2) — FINALIZED

Signer: protocol admin `DKA9…FD6y` via Phantom. Market PDA `HDJiTEYSnaeUNZWAHvgWrMaefKemFq61S32bE2RVyiEZ`. NOAA quote package (premium 905 bps / probability 700 bps). Target window: sales close `2026-10-18T23:00:00Z`, observation `2026-10-19` through `2026-10-24` UTC. Vault fund 2,000 SKYT. Second city skipped (no second validated NOAA package). Builder: open+sales-closed plans a fresh market ID (`shared/des-moines-seed-plan.ts`).

### TX 2 — Create
- **PRE:** Create market `2` with the NOAA quote package above.
- **POST signature:** `3BKexktWwPXnhUakASBud586FiiLWCARVkLnQ3qAfzxyZ3MV1r8Z3xVNER3jSDevXky3szz9RbaVo9UqDE3FNTfU`
- **Explorer:** https://explorer.solana.com/tx/3BKexktWwPXnhUakASBud586FiiLWCARVkLnQ3qAfzxyZ3MV1r8Z3xVNER3jSDevXky3szz9RbaVo9UqDE3FNTfU?cluster=devnet

### TX 3 — Fund
- **PRE:** Fund vault with 2,000 SKYT from admin ATA.
- **POST signature:** `5Uqswf7wQ9U5o5Abod2f2nneihU6T1jGTayvnUXRiiwjqEnYQsTJQWiLLqZRskzz71XtkGVki3dpTZvxM1naKcN`
- **Explorer:** https://explorer.solana.com/tx/5Uqswf7wQ9U5o5Abod2f2nneihU6T1jGTayvnUXRiiwjqEnYQsTJQWiLLqZRskzz71XtkGVki3dpTZvxM1naKcN?cluster=devnet

### TX 4 — Open
- **PRE:** Open market `2` for sales.
- **POST signature:** `5Gbdau5cPgCn6qsQYtsFUxoh6uSQjM7CFYkNyv4pqAEo9PBwjt3ECKeF7qx8RYD4MhC9erE8dYqYECseBuEcTKvZ`
- **Explorer:** https://explorer.solana.com/tx/5Gbdau5cPgCn6qsQYtsFUxoh6uSQjM7CFYkNyv4pqAEo9PBwjt3ECKeF7qx8RYD4MhC9erE8dYqYECseBuEcTKvZ?cluster=devnet

## Seeker verify — priced quote (2026-10-16)
- Market 2 create/fund/open finalized (sigs above). Live API quote for 100 SKYT: premium `9050000` (9.05 SKYT incl. 1% fee), probability 700 bps, window Oct 19–24 UTC / UI Oct 19–23, trigger ≥50 mm.
- Quote-gate fix: Protect fetches `/api/quotes` without a connected wallet; purchase CTA stays “Connect wallet to protect”.
- Seeker `SM02G406197714` APK rebuild+install; captures `docs/landing-review/device-check-2026-10-16/60-protect.png`–`62-protect-lower.png`:
  - Markets: Des Moines **Live** (green).
  - Protect: **You pay 9.05** SKYT / **You get if it rains 100** SKYT; 7.0% · 11.0x · 8.05+1.00; wallet Not connected; CTA Connect wallet.
- Phantom purchase on a wallet without an existing Des Moines position remains optional follow-up (admin DKA9 already shows a waiting position on Wallet).

## Weekly / monthly ladder (compat)
- Market 2 observation Oct 19–24 is a demo-length window, not a Mon–Mon weekly or calendar month. `tenorOf` returns null for it.
- Mobile `sellingWindows` falls back to open `desMoinesMarket` when `cityWindows` is empty/undeployed so Protect stays priced.
- Server `sellingWindow` maps unrecognized open tenors to `weekly` so deployed `cityWindows` still lists the pilot.
- Next ladder seed: `planLadderRoll` in `shared/window-ladder.ts` for the next 2 weekly + 2 monthly rungs (ask before sending admin txs).

## Rolling expiries

Each live city keeps two weekly rain windows (Monday 00:00 UTC through the next Monday) and two calendar-month windows. Sales close when that window starts. The strike is the 8th of 10 NOAA GHCND analogue totals for those exact dates, rounded up to a whole millimetre. NWS QPF is included only when it covers every day; otherwise the premium uses the analogue history alone. Nothing is filled in.

`npx tsx scripts/roll-window-ladder.ts` prints the missing rungs and does not sign. Signing needs `KEEPER_SIGN=yes` plus `KEEPER_KEYPAIR` for the current Devnet protocol admin (`DKA9…`). Create and open reject any other signer. A new key cannot seed until that admin proposes it and the new key accepts, which also transfers every admin power. Do not create that key or send the first ladder transaction without an explicit yes.

Vercel cron `GET /api/cron/windows` at 04:15 UTC plans the same ladder. It signs only when `KEEPER_SIGN=yes`. Devnet and test SKYT only.

