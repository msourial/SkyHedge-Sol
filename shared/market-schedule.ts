const DAY_SECONDS = 86_400;

/**
 * Sales close exactly 24 hours after seed approval. NOAA daily observations
 * require complete UTC-day records, so the immutable observation window starts
 * at the next UTC midnight and covers five full days. The schedule is only a
 * candidate: seeding is allowed only if NOAA returns complete QPF for every
 * exact date, since the midnight alignment can consume part of the seven-day
 * forecast horizon.
 */
export function desMoinesSeedSchedule(nowMilliseconds = Date.now()) {
  const nowSeconds = Math.floor(nowMilliseconds / 1_000);
  const salesCloseAt = nowSeconds + DAY_SECONDS;
  const observationStart = Math.ceil(salesCloseAt / DAY_SECONDS) * DAY_SECONDS;
  return {
    salesCloseAt,
    observationStart,
    observationEnd: observationStart + 5 * DAY_SECONDS,
  };
}
