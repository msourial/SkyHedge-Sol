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
