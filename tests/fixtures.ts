import { test as base } from "@playwright/test";

/** Keep UI checks local, including third-party CSS imported by the wallet adapter. */
export const test = base.extend<{ localRequests: void }>({
  localRequests: [async ({ context, baseURL }, use) => {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      // The app uses self-hosted fonts; this optional adapter font must not block CSS loading.
      if (url.hostname === "fonts.googleapis.com") {
        return route.fulfill({ contentType: "text/css", body: "" });
      }
      return route.abort();
    });
    await use();
  }, { auto: true }],
});
export { expect, type Page } from "@playwright/test";

/** Actual response shape: New York Week closed, Month has three real rungs. */
export async function monthlyProtect(page: import("@playwright/test").Page) {
  const { NYC_RAIN_MODELLED } = await import("../shared/ui-fixtures");
  await page.clock.setFixedTime(new Date("2026-10-26T12:00:00Z"));
  const start = Date.parse("2026-11-01") / 1000, end = Date.parse("2026-12-01") / 1000;
  await page.route("**/api/devnet/status**", (route) => route.fulfill({ json: { cityWindows: [
    { city: "new-york", peril: "rain", tenor: "weekly", address: "fixture-closed-week", observationStart: start - 7 * 86400, observationEnd: start, salesCloseAt: start - 8 * 86400 },
    { city: "new-york", peril: "rain", tenor: "monthly", address: "fixture-month-102", observationStart: start, observationEnd: end, salesCloseAt: start },
  ], desMoinesMarket: { status: "pending", evidenceStatus: "researching_evidence" } } }));
  await page.route("**/api/mobile?resource=window-quote&**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("windowStart") !== "2026-11-01") return route.fulfill({ status: 409, json: { error: "not open" } });
    return route.fulfill({ json: { ...NYC_RAIN_MODELLED, windowStart: "2026-11-01", windowEnd: "2026-12-01", salesCloseAt: "2026-11-01",
      rungs: [80, 102, 194].map((triggerValue, index) => ({ ...NYC_RAIN_MODELLED.rungs[index === 1 ? 3 : index === 0 ? 0 : 5], triggerValue,
        marketAddress: index === 1 ? "fixture-month-102" : null, isTopRung: index === 2 })) } });
  });
}
