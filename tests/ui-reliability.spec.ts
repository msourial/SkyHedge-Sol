import { expect, test } from "@playwright/test";

const transparentTile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XfL2WQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("https://api.maptiler.com/maps/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentTile });
  });
});

test("search shows exact locations and matches locality, state, country, crop, and accents", async ({ page }) => {
  await page.goto("/?tab=markets&city=des-moines");
  const search = page.getByRole("combobox", { name: "Find an index" });
  await search.focus();
  await expect(page.getByText("Lubbock, Texas, United States", { exact: true })).toBeVisible();

  for (const [query, location] of [
    ["Lubbock", "Lubbock, Texas, United States"],
    ["Texas", "Lubbock, Texas, United States"],
    ["Canada", "Winnipeg, Manitoba, Canada"],
    ["cotton", "Lubbock, Texas, United States"],
    ["Cordoba", "Córdoba, Córdoba Province, Argentina"],
  ] as const) {
    await search.fill(query);
    await expect(page.getByText(location, { exact: true }).first()).toBeVisible();
  }
});

test("Leaflet renders the exact reference location and switches markets", async ({ page }) => {
  await page.goto("/?tab=protect&city=lubbock");
  const lubbockMap = page.getByTestId("area-map-lubbock");
  await expect(lubbockMap).toHaveAttribute("data-map-state", "ready");
  await expect(lubbockMap.getByText("Lubbock, Texas, United States", { exact: true }).last()).toBeVisible();

  await page.goto("/?tab=protect&city=ludhiana");
  const ludhianaMap = page.getByTestId("area-map-ludhiana");
  await expect(ludhianaMap).toHaveAttribute("data-map-state", "ready");
  await expect(ludhianaMap.getByText("Ludhiana, Punjab, India", { exact: true }).last()).toBeVisible();
});

test("map tile failures expose a truthful fallback and retry", async ({ page }) => {
  await page.unroute("https://api.maptiler.com/maps/**");
  await page.route("https://api.maptiler.com/maps/**", (route) => route.abort());
  await page.goto("/?tab=protect&city=lubbock");
  const map = page.getByTestId("area-map-lubbock");
  await expect(map).toHaveAttribute("data-map-state", "unavailable");
  await expect(map.getByRole("alert")).toContainText("Map unavailable");
  await expect(map.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(map.getByRole("link", { name: /Open larger map/ }).first()).toBeVisible();
});

test("wallet opens the supported chooser without attempting connection on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?tab=markets&city=des-moines");
  await expect(page.locator("[data-wallet-state=idle]")).toBeVisible();
  expect(errors.filter((message) => message.includes("WalletConnectionError"))).toEqual([]);

  await page.getByRole("button", { name: /Select Wallet|Connect Wallet/ }).click();
  await expect(page.getByText("Phantom", { exact: true })).toBeVisible();
  await expect(page.getByText("Solflare", { exact: true })).toBeVisible();
});

test("locations wrap without horizontal overflow at supported widths", async ({ page }) => {
  for (const width of [375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tab=markets&city=des-moines");
    await page.getByRole("combobox", { name: "Find an index" }).focus();
    await expect(page.getByText("Santa Cruz, Santa Cruz Department, Bolivia", { exact: true })).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});
