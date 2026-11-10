# Environment Canada settlement for Canadian markets

Retrieved and measured November 10, 2026. Montreal and Toronto mid-December markets, when funded, settle on Environment and Climate Change Canada (Environment Canada) daily climate data: **total precipitation in millimetres (rain plus melted snow)**, not NOAA GHCND. Existing New York, Chicago and historical demo markets, including the mid-December US markets already on-chain, stay on NOAA.

## Stations

Official records from the [MSC climate-stations collection](https://api.weather.gc.ca/collections/climate-stations/items), retrieved November 10, 2026 at 14:07 America/Chicago:

| City | Official name | Climate ID | Transport Canada | WMO | Station ID | Type | Daily record through |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Toronto | TORONTO INTL A | 6158731 | YYZ | 71624 | 51459 | Aviation-Staffed | 2026-11-08 on the station record; see freshness below |
| Montreal | MONTREAL INTL A | 7025251 | YUL | 71627 | 51157 | Aviation-Staffed | 2026-11-08 on the station record; see freshness below |

Do not use climate ID `7025250` (MONTREAL/PIERRE ELLIOTT TRUDEAU INTL A). That YUL identifier stopped daily reporting on 2013-02-13 and was succeeded the next day by `7025251`. Do not use auto station `702S006`; its daily series was last dated 2026-10-01 when checked on November 10, 2026.

## Publication freshness (measured)

Queried the [climate-daily collection](https://api.weather.gc.ca/collections/climate-daily/items) at 2026-11-10T20:08:06Z (2:08 PM America/Chicago) for `datetime=2026-10-28/2026-11-11`.

- Toronto 6158731: 14 daily rows, 2026-10-28 through 2026-11-10. Complete numeric or trace readings through **2026-11-09**. The 2026-11-10 row was present with a null total (the local day was still in progress). Last complete day was therefore the previous local day — about one day, not weeks.
- Montreal 7025251: the same pattern. Complete through **2026-11-09**; 2026-11-10 present but null.

Source URLs used for that check:

- Toronto: `https://api.weather.gc.ca/collections/climate-daily/items?f=json&CLIMATE_IDENTIFIER=6158731&datetime=2026-10-28%2F2026-11-11&sortby=LOCAL_DATE&limit=20`
- Montreal: `https://api.weather.gc.ca/collections/climate-daily/items?f=json&CLIMATE_IDENTIFIER=7025251&datetime=2026-10-28%2F2026-11-11&sortby=LOCAL_DATE&limit=20`

## Resolver rules

`evaluateEccc` requires exactly one usable observation per station-local day in the window, from climate ID `spec.station`. Total precipitation is summed in integer tenths of a millimetre. The threshold is inclusive. The public evidence record is the same shape as NOAA: source URL, climate ID, raw response, per-day values, hash, and resolution transaction.

Settlement is refused when a required day is missing, duplicated, from another station, has a non-numeric or negative amount, has more than one decimal place, or carries a quality flag other than blank or trace. **Trace (`T`)** is a measured amount below 0.2 mm and counts as 0 mm when the reported amount is zero or empty; a trace flag with a positive amount is refused. Flags such as missing (`M`) or estimated (`E`) refuse, the same strictness as a NOAA quality flag. An incomplete same-day null, like the 2026-11-10 rows above, also refuses.

The resolver chooses the source per market (`spec.source === "eccc"` vs default NOAA). The in-app How to verify panel names Environment Canada and links the exact climate-daily URL for ECCC markets.

## Planned Montreal and Toronto markets (not yet created)

Intended strikes: observation days 2026-12-14 through 2026-12-16 inclusive, 400 mUSDC seed, trading close `endTs` 1797224399 (December 13, 2026, 10:59:59 PM America/Chicago; 2026-12-14T04:59:59Z), which is one second before local midnight at the start of observations in America/Toronto. Thresholds 5, 10 and 25 mm (50, 100 and 250 tenths) for each city — six markets, 2,400 mUSDC of seed plus rent.

These were not created in this run. After the mid-December US market sends, the creator had 189.720997 mUSDC and 0.01151556 SOL at 2026-11-10T20:00:40.058Z, below one 400 mUSDC seed. Planned specs are in [markets.canada.json](../../shared/pm-amm/markets.canada.json) for a later `--send` once funds return. Do not reduce the seed.
