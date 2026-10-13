# Canadian market plan (Superteam Canada angle)

## Program support: yes, no program change needed
- `create_market` derives the PDA `["market", protocol, next_market_id]`, so any number of markets can exist next to Des Moines (market 1).
- City, station, provider and methodology go in as 32-byte hashes (`city_hash`, `station_id_hash`, `provider_hash`, `methodology_hash`). The program doesn't care about the source, so ECCC works the same way NOAA does.
- Settlement uses `submit_weather_observation` with a matching `station_id_hash`, signed by the settlement authority.

## Data source: ECCC MSC GeoMet OGC API (verified live 2026-10-12)
- `https://api.weather.gc.ca/collections/climate-daily/items?CLIMATE_IDENTIFIER=6158731` is open data and needs no key. The Oct 10 record returned. Oct 11 is still unpublished, so there is about 1 day of lag.
- The `TOTAL_PRECIPITATION` field is in mm. Flags: M, E and A are rejected; T (trace) is accepted.
- The adapter is `server/services/eccc.ts` with tests. Open-Meteo is fine for the forecast/quote, but it isn't settlement-grade.

## Recommendation: Toronto (Pearson, TORONTO INTL A, climate ID 6158731)
- It's Miro's home city and a natural Superteam Canada hub. It's also the most recognisable Canadian market for judges.
- The station is an ECCC primary airport station with a long, clean daily record.
- Alternative: Vancouver (1108395). It's the wettest of the three in October, so a demo is more likely to hit the strike. Use it if you want a real payout story.

## Plan
1. Off-chain (done locally): ECCC adapter, Toronto config, and copy/mockup showing Toronto alongside Des Moines.
2. Off-chain (to do): a `/api/markets/toronto/evidence-package` route that mirrors des-moines, plus making `protection.ts` accept the toronto slug. Hold this until the readiness bug fix lands, because it touches the same gating.
3. On-chain (needs Miro's admin wallet on the Seeker, DKA9…FD6y): `create_market` (Toronto hashes, threshold, window), then `fund_pool` (SKYT liquidity), then `open_market` (the program refuses to open a market with no LP shares). That's 3 signatures; only create and open must come from the admin wallet, since `fund_pool` accepts any LP wallet. Settlement later needs the settlement authority.
4. Fallback if time is short: demo Des Moines live, and show Toronto as "Opens soon" with real ECCC history. No signature needed.
