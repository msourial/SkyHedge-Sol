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

## Weekly / monthly ladder
- Market 2 (`HDJiTEYSnaeUNZWAHvgWrMaefKemFq61S32bE2RVyiEZ`, tx `3BKexktWwPXnhUakASBud586FiiLWCARVkLnQ3qAfzxyZ3MV1r8Z3xVNER3jSDevXky3szz9RbaVo9UqDE3FNTfU`) is open. Sales close `2026-10-18T23:00:00Z`. Observation `2026-10-19T00:00:00Z` through `2026-10-24T00:00:00Z` (5 days, trigger ≥50 mm). It is not a Monday-to-Monday week and not a calendar month, so it is not one of the four rungs.
- Only windows whose bounds match a weekly or monthly rung appear in the Protect picker.

## Rolling expiries

Each live city keeps two weekly rain windows (Monday 00:00 UTC through the next Monday) and two calendar-month windows. Sales close when that window starts. The strike is the 8th of 10 NOAA GHCND analogue totals for those exact dates, rounded up to a whole millimetre. NWS QPF is included only when it covers every day; otherwise the premium uses the analogue history alone. Nothing is filled in.

Live rainfall cities, in order: New York (Central Park `GHCND:USW00094728`), Dallas–Fort Worth (`GHCND:USW00003927`), Des Moines (`GHCND:USW00014933`). Toronto stays closed until Environment Canada data is in. Each live city has its own ladder. A Des Moines window does not fill a New York or Dallas rung.

`npx tsx scripts/roll-window-ladder.ts` prints the missing rungs and does not sign. Add `--city new-york` or `--city dallas` to plan one city. `npx tsx scripts/sign-ladder-phantom.ts --city <slug>` opens a page on `127.0.0.1:8765` and Phantom approves each create, fund, and open as the Devnet protocol admin. The keeper refuses `--sign`. The admin key is not stored in the repo or in Vercel.

Vercel cron `GET /api/cron/windows` at 04:15 UTC plans the same ladder and stays a dry run. Devnet and test SKYT only.

A separate on-chain keeper role, limited to create, fund, and open, is proposed in `docs/keeper-role.md` for after the hackathon.

## TX — ladder create · weekly · Week of Oct 19
- **POST signature:** `26AytfRMXtdPwci7hHXka4RAoDG5Ukv7kKyypCqhdmEnfG2qd9KZJ2Wr4y7ixMS9XQU5Dzpjo7gRfWjfimLxHcSU`
- **Explorer:** https://explorer.solana.com/tx/26AytfRMXtdPwci7hHXka4RAoDG5Ukv7kKyypCqhdmEnfG2qd9KZJ2Wr4y7ixMS9XQU5Dzpjo7gRfWjfimLxHcSU?cluster=devnet

## TX — ladder fund · weekly · Week of Oct 19
- **POST signature:** `4AC221Mt1ZBh6AWWhgZroTL5ZrYgdGkebd3rkWvJniC9ktwLZRuD79Cb4zZxWvAu4WVb83ycNZQfWsAdteEkJGMi`
- **Explorer:** https://explorer.solana.com/tx/4AC221Mt1ZBh6AWWhgZroTL5ZrYgdGkebd3rkWvJniC9ktwLZRuD79Cb4zZxWvAu4WVb83ycNZQfWsAdteEkJGMi?cluster=devnet

## TX — ladder open · weekly · Week of Oct 19
- **POST signature:** `XFu49apPtRQ4KEWkiNZtxKaqEhwq5XhdxXFVyzUS2HhskceaZYXt8bzda4hm1Fzp3qWzrw9b93svzPrf8ZCDrX3`
- **Explorer:** https://explorer.solana.com/tx/XFu49apPtRQ4KEWkiNZtxKaqEhwq5XhdxXFVyzUS2HhskceaZYXt8bzda4hm1Fzp3qWzrw9b93svzPrf8ZCDrX3?cluster=devnet

## TX — ladder create · weekly · Week of Oct 26
- **POST signature:** `c1snSwPNqP6cBTGCgasHQv2DF7q6e2V9m9EJrskXXo4ry5hPFbd17giK88bLCe6ZzsMnTi1Rywoz1nBARi3ENSa`
- **Explorer:** https://explorer.solana.com/tx/c1snSwPNqP6cBTGCgasHQv2DF7q6e2V9m9EJrskXXo4ry5hPFbd17giK88bLCe6ZzsMnTi1Rywoz1nBARi3ENSa?cluster=devnet

## TX — ladder fund · weekly · Week of Oct 26
- **POST signature:** `3kJePbHs5mQXT8pN84WHWKQtSCnaJEpsBwpvQuqKoiSjNXLu3J3JDgAFa8yY4htocjEgwu33is1uFjBF6Gj16Pov`
- **Explorer:** https://explorer.solana.com/tx/3kJePbHs5mQXT8pN84WHWKQtSCnaJEpsBwpvQuqKoiSjNXLu3J3JDgAFa8yY4htocjEgwu33is1uFjBF6Gj16Pov?cluster=devnet

## TX — ladder open · weekly · Week of Oct 26
- **POST signature:** `5hP1i364ZTyKwKTysJtvwqBk5RWPAiXfiK6eMJzKa48UHqgMmKAYtx5DpQDf1cr94ZqN4NFyiYKscTWbBPxhYHok`
- **Explorer:** https://explorer.solana.com/tx/5hP1i364ZTyKwKTysJtvwqBk5RWPAiXfiK6eMJzKa48UHqgMmKAYtx5DpQDf1cr94ZqN4NFyiYKscTWbBPxhYHok?cluster=devnet

## TX — ladder create · monthly · November
- **POST signature:** `2scBmC57u1Mp5pShb57sU1msj6W44LFe2CjWyeNx6cxEQNHxqvWzj2Bv6LcAeT5xJRrkiCqUsqyUncmYyoEish2q`
- **Explorer:** https://explorer.solana.com/tx/2scBmC57u1Mp5pShb57sU1msj6W44LFe2CjWyeNx6cxEQNHxqvWzj2Bv6LcAeT5xJRrkiCqUsqyUncmYyoEish2q?cluster=devnet

## TX — ladder fund · monthly · November
- **POST signature:** `2ju4BHGqnWkbsHL8h1T7oBWVpQAKbcbKK6zs5Pxm6sUNpxFevdTQ6Nv8Ude8oMezQ8BL2yR1UcuSQgeRZqsdPhwu`
- **Explorer:** https://explorer.solana.com/tx/2ju4BHGqnWkbsHL8h1T7oBWVpQAKbcbKK6zs5Pxm6sUNpxFevdTQ6Nv8Ude8oMezQ8BL2yR1UcuSQgeRZqsdPhwu?cluster=devnet

## TX — ladder open · monthly · November
- **POST signature:** `4QNNuUNb6esQvhfZw7SgR6nqZLMRcZATqQj2MuFbTaxVU5tYrN64h4AyBAVbWEjBJfueuM72yv2Hosm1W8MvpQdu`
- **Explorer:** https://explorer.solana.com/tx/4QNNuUNb6esQvhfZw7SgR6nqZLMRcZATqQj2MuFbTaxVU5tYrN64h4AyBAVbWEjBJfueuM72yv2Hosm1W8MvpQdu?cluster=devnet

## TX — ladder create · monthly · December
- **POST signature:** `613GaEH3yDJUxMCjiuG7N8qATHR6v4EX7U3rhWnuRoJs1JFLQ25pTfQr8DAYkVaUUxhQq5z9DNmbs1yQ7e8DnpcV`
- **Explorer:** https://explorer.solana.com/tx/613GaEH3yDJUxMCjiuG7N8qATHR6v4EX7U3rhWnuRoJs1JFLQ25pTfQr8DAYkVaUUxhQq5z9DNmbs1yQ7e8DnpcV?cluster=devnet

## TX — ladder fund · monthly · December
- **POST signature:** `4iqr9a4X79GMMwJ8Z9EQD7Z7Xof5WnRaRh4hu9uDm44uo2oMaBCMVmQoshTy68tTuzr51kM3hj17RHgvgbehy2aG`
- **Explorer:** https://explorer.solana.com/tx/4iqr9a4X79GMMwJ8Z9EQD7Z7Xof5WnRaRh4hu9uDm44uo2oMaBCMVmQoshTy68tTuzr51kM3hj17RHgvgbehy2aG?cluster=devnet

## TX — ladder open · monthly · December
- **POST signature:** `6ebbCsk5c1TLUzz8YXxTAF2vnDJ4TFW8SPVcU9to4vg7hHkqw8JQTqJsF23WuQH9yZ2xc47AqbSU9tvSPt6Hz2X`
- **Explorer:** https://explorer.solana.com/tx/6ebbCsk5c1TLUzz8YXxTAF2vnDJ4TFW8SPVcU9to4vg7hHkqw8JQTqJsF23WuQH9yZ2xc47AqbSU9tvSPt6Hz2X?cluster=devnet

## Waiting for Phantom — New York and Dallas ladders

Not signed. Not seeded. Devnet and test SKYT only. Each missing rung is create, then fund 2,000 SKYT, then open. The strike and premium come from NOAA when the signer page loads. Nothing below sends a transaction.

New York station: `GHCND:USW00094728` (NY CITY CENTRAL PARK). Dallas station: `GHCND:USW00003927` (DALLAS FT WORTH AP).

```bash
# Dry run. Prints missing rungs. Does not sign.
npx tsx scripts/roll-window-ladder.ts --city new-york
npx tsx scripts/roll-window-ladder.ts --city dallas

# Phantom. Unlock DKA9…FD6y on Devnet and approve each create, fund, and open.
npx tsx scripts/sign-ladder-phantom.ts --city new-york
npx tsx scripts/sign-ladder-phantom.ts --city dallas
```

