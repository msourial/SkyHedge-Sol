/** Focus and visibility can fire together. Coalesce them and never overlap reads. */
export function watchReadiness(refresh: () => Promise<void>, browser: {
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
}, intervalMs = 60_000) {
  let live = true, busy = false, last = -Infinity;
  const run = () => {
    if (!live || busy || browser.document.visibilityState === "hidden" || Date.now() - last < intervalMs) return;
    busy = true; last = Date.now();
    void refresh().catch(() => {}).finally(() => { busy = false; });
  };
  run();
  const timer = setInterval(run, intervalMs);
  browser.window.addEventListener("focus", run);
  browser.document.addEventListener("visibilitychange", run);
  return () => {
    live = false; clearInterval(timer);
    browser.window.removeEventListener("focus", run);
    browser.document.removeEventListener("visibilitychange", run);
  };
}

/** A failed read must replace old readiness with unknown, never a cached claim action. */
export async function readReadiness<T>(markets: readonly string[], read: (market: string) => Promise<T>): Promise<Record<string, T | null>> {
  const rows = await Promise.all([...new Set(markets)].map(async market => {
    try { return [market, await read(market)] as const; }
    catch { return [market, null] as const; }
  }));
  return Object.fromEntries(rows);
}
