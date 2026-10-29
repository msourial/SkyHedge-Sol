# Cover progress and forecast edge

`GET /api/mobile?resource=cover-progress&market=<address>` returns
`{progress: {[address]: CoverProgress}}`. `resource=forecast-edge` returns
`{edges: {[address]: {forecast, historyProbability}}}`. Both accept
`markets=a,b,c` instead of `market`, with at most 20 addresses. The existing
Express and Vercel `/api/mobile` entrypoints dispatch both resources.
`getCoverProgress` and `getForecastEdge` in the mobile client load these maps.
No screens or crons are involved.

Accounts are read directly, including expired markets, with owner and IDL
checks. City/peril hashes use the existing shared resolver (rain retains the
legacy city hash). Station, provider and methodology hashes must match the
committed pin. Windows are half-open date ranges `[start,end)`, as in settlement.

Observations use CDO v2 GHCN-Daily `units=metric`, with the existing
`parseCdoObservation` / `parseNoaaDailyRainfall` quality and measurement flag
rules. Rain sums PRCP mm; snow sums SNOW mm (snowfall depth, not snow-water
equivalent); wind takes maximum WSF2 m/s; heat takes maximum TMAX °C. Cold is
unsupported. Reported days can have gaps; `daysReported` and `observedThrough`
must accompany partial values. Only all expected days makes `complete` true.
No current station-calendar day is accepted as a completed daily observation.
Before the window, the value is null and state is `not_started`. With no
accepted data it is null and `unavailable`; a measured zero remains zero.

When the optional `NOAA_TOKEN` is absent or CDO fails to supply data, the reader
POSTs to NOAA RCC-ACIS StnData with the same GHCN station, requesting daily flags
and four decimal places. ACIS inches convert to mm, Fahrenheit to Celsius,
`M` is missing and `T` is trace zero. Daily values round to the GHCN element's
native precision (SNOW whole mm, PRCP/TMAX tenths). Flagged non-trace ACIS
values fail closed. Failed CDO quality checks also fail closed rather than
being bypassed by a fallback. ACIS distribution/rounding and later NOAA
revisions can differ from final CDO records; these are provisional readings,
not settlement evidence. The source is labelled by the actual provider.
ACIS does not document WSF2, so wind remains unavailable without CDO WSF2;
AWND or gusts are never substituted.

Forecasts count the GEFS control and members 01–30 from Open-Meteo's Ensemble
API, model `gfs_seamless`, at the pinned station coordinates in the city's timezone.
The model label is `NOAA GEFS (gfs_seamless) via Open-Meteo Ensemble API`.
Requests use `forecast_days=35` (the ensemble API maximum), combining GEFS
0.25-degree forecasts for roughly the first 10 days with GEFS 0.5-degree
forecasts beyond that horizon.
Rain sums `precipitation_sum` mm; snow sums `snowfall_sum` cm converted to mm;
heat takes maximum `temperature_2m_max` °C. At least 20 complete member
trajectories are required. Each member must cover every remaining window day;
nulls, unknown units, and missing dates never become zero. Members satisfy the
market's actual operator (`gte`, `gt`, `lte`, `lt`). `membersAtOrAbove` counts
matching members (for downward operators it therefore counts below).

Every past station-calendar day of a started window must have an observation;
NOAA lag/gaps suppress the forecast. The complete observed prefix is added to
each future member sum or included in its maximum. Today's daily forecast can
be used, but past daily forecasts cannot replace observations. Ended windows
and windows beyond the returned horizon have no forecast. GEFS 10 m wind maxima
and gusts are incompatible with WSF2, so wind forecasts return null. Cold also
returns null. Open-Meteo does not supply an issuance timestamp in this response;
`issuedAt` is null and `fetchedAt` is the actual retrieval time.

Observation reads share an in-memory one-hour cache by station, element and
window/cutoff; forecast responses share a one-hour cache by model, station, variable
and current day. In-flight reads are deduplicated. Cutoff/day keys prevent a
previous day's coverage from leaking over midnight. A refresh on load is enough.

`historyProbability` is the pinned on-chain Chance divided by 10,000, in 0–1
units. The new keeper path commits history-only Chance and never reads a
forecast. Existing non-pinned model callers retain their current behaviour.
The separate forecast never changes committed pricing. `edgeChip` accepts
percentages (0–100) and emits signed percentage points only at absolute edges
of at least 5 points. Shared wire types live in `shared/weather-signals.ts`.

Provider references:
- https://www.ncei.noaa.gov/cdo-web/webservices/v2
- https://docs.rcc-acis.org/acisws/
- https://open-meteo.com/en/docs/ensemble-api

The synthetic fixture `server/services/fixtures/r3-ensemble.json` follows the
live API's unsuffixed control and `_member01` ... `_member30` daily fields and
per-field unit metadata. It deliberately varies member totals for counting tests.

Run all checks as requested, then `npx tsx scripts/r3-live-smoke.ts` for real
provider output. The smoke script does not load dotenv or print RPC credentials.
