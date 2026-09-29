import { expect, test } from "@playwright/test";

const transparentTile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XfL2WQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("https://api.maptiler.com/maps/**", async (route) => {
    if (route.request().url().includes("/style.json")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        version: 8,
        name: "SkyHedge test map",
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#101a28" } }],
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentTile });
  });
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentTile });
  });
});

test("search shows exact locations and matches locality, state, country, crop, and accents", async ({ page }) => {
  await page.goto("/?tab=markets&city=des-moines");
  const search = page.getByRole("combobox", { name: "Find an index" });
  await search.focus();
  await expect(page.getByText("Lubbock, Texas, United States", { exact: true }).first()).toBeVisible();

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

test("wind gust and snowfall are research-only in Markets and never request quotes or transactions", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(quotes|transactions\/unsigned)/.test(request.url())) apiRequests.push(request.url());
  });
  await page.goto("/?tab=markets&city=des-moines");

  await page.getByRole("button", { name: "Wind gust" }).click();
  await expect(page.getByRole("heading", { name: "Wind gust protection is research-only" })).toBeVisible();
  await expect(page.getByText("Research-only hazard", { exact: true })).toBeVisible();
  await expect(page.getByText("NOAA-settled protection", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Researching NOAA evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Highest daily peak gust", { exact: false })).toBeVisible();
  await expect(page.getByText(/mph.*km\/h/)).toBeVisible();
  await expect(page.locator('[data-testid^="market-index-option-"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Snowfall" }).click();
  await expect(page.getByRole("heading", { name: "Snowfall protection is research-only" })).toBeVisible();
  await expect(page.getByText("Research-only hazard", { exact: true })).toBeVisible();
  await expect(page.getByText("NOAA-settled protection", { exact: true })).toHaveCount(0);
  await expect(page.getByText("New snowfall accumulated during the observation window", { exact: true })).toBeVisible();
  await expect(page.getByText(/not snow depth/i)).toBeVisible();
  await expect(page.getByText(/inches.*millimetres/i)).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test("research-only hazard selection on Protect hides rainfall inputs and blocks quote and purchase actions", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(quotes|transactions\/unsigned)/.test(request.url())) apiRequests.push(request.url());
  });
  await page.goto("/?tab=protect&city=des-moines");
  await page.getByRole("button", { name: "Wind gust" }).click();

  await expect(page.getByText("Weather protection", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wind gust protection is research-only" })).toBeVisible();
  await expect(page.getByText("Rainfall threshold (mm / in)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request NOAA quote" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve Devnet protection" })).toHaveCount(0);
  await page.getByRole("button", { name: "Snowfall" }).click();
  await expect(page.getByRole("heading", { name: "Snowfall protection is research-only" })).toBeVisible();
  expect(apiRequests).toEqual([]);

  await page.getByRole("button", { name: "Rainfall" }).click();
  await expect(page.getByText("Rainfall threshold (mm / in)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request NOAA quote" })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test("switching hazards clears an earlier rainfall quote until a new quote is requested", async ({ page }) => {
  await page.route("**/api/devnet/status", (route) => route.fulfill({ json: {
    network: "devnet",
    program: { address: "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx", status: "ready", executable: true, explorerUrl: "https://explorer.solana.com" },
    idl: { status: "ready", source: "committed", instructionCount: 22, accountCount: 5, supportsEmptyDraftCancellation: false },
    protocol: { address: "Protocol111111111111111111111111111111111", status: "ready", initialized: true, admin: null, settlementAuthority: null, collateralMint: null, nextMarketId: "1" },
    feeVault: { address: "Fee1111111111111111111111111111111111111", status: "ready", exists: true, balance: "0" },
    skytMint: { address: "Mint1111111111111111111111111111111111111", status: "ready", exists: true, decimals: 6, supply: "350000000000", mintAuthority: null },
    desMoinesMarket: { status: "ready", address: "Market11111111111111111111111111111111111", marketId: "1", vault: "Vault111111111111111111111111111111111111", vaultBalance: "2000000000", onchainStatus: "{\"open\":{}}", salesCloseAt: Math.floor(Date.now() / 1000) + 3600, observationStart: Date.parse("2026-09-29T00:00:00Z") / 1000, observationEnd: Date.parse("2026-10-04T00:00:00Z") / 1000, thresholdMmX100: "5000", operator: "gte", quoteProbabilityBps: 2_000, premiumRateBps: 2_400, quoteInputsHash: "ab".repeat(32), evidenceStatus: "validated", targetCityHash: "" },
    noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Historical sample only", package: null },
    generatedAt: new Date().toISOString(),
  } }));
  let quoteCalls = 0;
  await page.route("**/api/quotes", (route) => {
    quoteCalls += 1;
    return route.fulfill({ json: {
    probabilityBps: 2_000, premiumRateBps: 2_400, premium: "2400000", protocolFee: "1000000", protectedAmount: "100000000", modelVersion: "noaa-rain-v1", inputsHash: "ab".repeat(32),
    } });
  });
  await page.goto("/?tab=protect&city=des-moines");
  await page.getByRole("button", { name: "Request NOAA quote" }).click();
  await expect(page.getByText("Quote ready", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Wind gust" }).click();
  await page.getByRole("button", { name: "Rainfall" }).click();
  await expect(page.getByText("Quote ready", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request NOAA quote" })).toBeVisible();
  expect(quoteCalls).toBe(1);
  await page.getByRole("button", { name: "Request NOAA quote" }).click();
  await expect(page.getByText("Quote ready", { exact: true })).toBeVisible();
  expect(quoteCalls).toBe(2);
});

test("hazard selector remains usable without horizontal overflow on mobile", async ({ page }) => {
  for (const width of [375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tab=protect&city=des-moines");
    await expect(page.getByRole("group", { name: "Protection type" })).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});

test("selecting a search result opens the matching market and updates the URL", async ({ page }) => {
  await page.goto("/?tab=markets&city=des-moines");
  const search = page.getByRole("combobox", { name: "Find an index" });
  await search.fill("Texas");
  await page.getByRole("option", { name: /Lubbock cotton plains; Lubbock, Texas, United States/ }).click();
  await expect(page).toHaveURL(/tab=protect&city=lubbock/);
  await expect(page.getByRole("heading", { name: "Lubbock cotton plains agricultural index" })).toBeVisible();
});

test("Markets is a map-led agricultural index explorer with truthful location-only data", async ({ page }) => {
  test.skip(Boolean(process.env.MAP_TEST_KEY), "This fallback scenario runs without a configured map key.");
  await page.goto("/?tab=markets&city=des-moines");

  await expect(page.getByRole("region", { name: "Agricultural index map" })).toBeVisible();
  await expect(page.getByText("Index reference locations", { exact: true })).toBeVisible();
  await expect(page.getByText("Winnipeg, Manitoba, Canada", { exact: true })).toBeVisible();
  await expect(page.getByText("Map provider not configured", { exact: true })).toBeVisible();
  await expect(page.getByText(/active stations|station count|live station/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lubbock, Texas, United States/ })).toBeVisible();
  await expect(page.locator('[data-testid^="market-index-option-"]')).toHaveCount(12);
});

test("the explorer uses the twelve catalog reference coordinates and accessible marker controls", async ({ page }) => {
  test.skip(!process.env.MAP_TEST_KEY, "Provide a test-only MapTiler key to exercise vector-map markers.");
  await page.goto("/?tab=markets&city=des-moines");
  const map = page.getByTestId("market-explorer-map");
  await expect(map).toHaveAttribute("data-map-state", "ready");
  await expect(map.locator(".sky-index-marker")).toHaveCount(12);

  const referenceCoordinates = [
    ["des-moines", "41.59", "-93.62"], ["fresno", "36.74", "-119.78"], ["lubbock", "33.58", "-101.85"],
    ["winnipeg", "49.9", "-97.14"], ["cordoba", "-31.42", "-64.19"], ["sorriso", "-12.54", "-55.72"],
    ["asuncion", "-25.29", "-57.65"], ["santa-cruz", "-17.78", "-63.18"], ["ludhiana", "30.9", "75.86"],
    ["nagpur", "21.15", "79.09"], ["eldoret", "0.51", "35.27"], ["arusha", "-3.37", "36.68"],
  ] as const;
  for (const [slug, latitude, longitude] of referenceCoordinates) {
    const marker = map.locator(`.sky-index-marker[data-latitude="${latitude}"][data-longitude="${longitude}"]`);
    await expect(marker, `${slug} should use its catalog coordinates`).toHaveCount(1);
  }

  const winnipeg = map.locator('.sky-index-marker[aria-label^="Winnipeg, Manitoba, Canada"]');
  await expect(winnipeg).toHaveAttribute("data-evidence-status", "researching-evidence");
  const lubbockMarker = map.locator('.sky-index-marker[aria-label^="Lubbock, Texas, United States"]');
  await expect(lubbockMarker).toHaveAttribute("aria-pressed", "false");
  await lubbockMarker.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/tab=protect&city=lubbock/);
});

test("MapLibre reports repeated map tile failures and offers a retry", async ({ page }) => {
  test.skip(!process.env.MAP_TEST_KEY, "This map-tile failure scenario requires the test-only map key.");
  await page.unroute("https://api.maptiler.com/maps/**");
  await page.route("https://api.maptiler.com/maps/**", async (route) => {
    if (route.request().url().includes("/style.json")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        version: 8,
        name: "Failing tile test map",
        sources: { mock: { type: "vector", tiles: ["https://api.maptiler.com/maps/test-tiles/{z}/{x}/{y}.pbf"], minzoom: 0, maxzoom: 5 } },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#101a28" } },
          { id: "mock-lines", type: "line", source: "mock", "source-layer": "boundaries", paint: { "line-color": "#334155", "line-width": 1 } },
        ],
      }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?tab=markets&city=des-moines");
  const map = page.getByTestId("market-explorer-map");
  await expect(map).toHaveAttribute("data-map-state", "unavailable", { timeout: 18_000 });
  await expect(map.getByRole("alert")).toContainText("Map unavailable");
  await expect(map.getByRole("button", { name: "Retry map" })).toBeVisible();
});

test("selecting an agricultural area from the explorer opens Protect and keeps the location precise", async ({ page }) => {
  await page.goto("/?tab=markets&city=des-moines");
  await page.getByRole("button", { name: /Lubbock, Texas, United States/ }).click();

  await expect(page).toHaveURL(/tab=protect&city=lubbock/);
  await expect(page.getByText("Lubbock, Texas, United States", { exact: true }).first()).toBeVisible();
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
  await page.unroute("https://*.tile.openstreetmap.org/**");
  await page.route("https://api.maptiler.com/maps/**", (route) => route.abort());
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/?tab=protect&city=lubbock");
  const map = page.getByTestId("area-map-lubbock");
  await expect(map).toHaveAttribute("data-map-state", "unavailable");
  await expect(map.getByRole("alert")).toContainText("Map unavailable");
  await expect(map.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(map.getByRole("link", { name: /Open larger map/ }).first()).toBeVisible();
});

test("changing the protection amount invalidates a quote priced for the previous amount", async ({ page }) => {
  await page.route("**/api/devnet/status", (route) => route.fulfill({ json: {
    network: "devnet",
    program: { address: "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx", status: "ready", executable: true, explorerUrl: "https://explorer.solana.com" },
    idl: { status: "ready", source: "committed", instructionCount: 22, accountCount: 5, supportsEmptyDraftCancellation: false },
    protocol: { address: "Protocol111111111111111111111111111111111", status: "ready", initialized: true, admin: null, settlementAuthority: null, collateralMint: null, nextMarketId: "1" },
    feeVault: { address: "Fee1111111111111111111111111111111111111", status: "ready", exists: true, balance: "0" },
    skytMint: { address: "Mint1111111111111111111111111111111111111", status: "ready", exists: true, decimals: 6, supply: "350000000000", mintAuthority: null },
    desMoinesMarket: { status: "ready", address: "Market11111111111111111111111111111111111", marketId: "0", vault: "Vault111111111111111111111111111111111111", vaultBalance: "2000000000", onchainStatus: "{\"open\":{}}", salesCloseAt: Math.floor(Date.now() / 1000) + 3600, observationStart: Date.parse("2026-09-29T00:00:00Z") / 1000, observationEnd: Date.parse("2026-10-04T00:00:00Z") / 1000, thresholdMmX100: "5000", operator: "gte", quoteProbabilityBps: 2_000, premiumRateBps: 2_400, quoteInputsHash: "ab".repeat(32), evidenceStatus: "validated", targetCityHash: "" },
    noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Historical sample only", package: null },
    generatedAt: new Date().toISOString(),
  } }));
  await page.route("**/api/quotes", (route) => route.fulfill({ json: {
    probabilityBps: 2_000, premiumRateBps: 2_400, premium: "2400000", protocolFee: "1000000", protectedAmount: "100000000", modelVersion: "noaa-rain-v1", inputsHash: "ab".repeat(32),
  } }));
  let unsignedTransactionRequested = false;
  await page.route("**/api/transactions/unsigned", async (route) => {
    unsignedTransactionRequested = true;
    await route.fulfill({ status: 500, json: { error: "unexpected transaction preparation" } });
  });

  await page.goto("/?tab=protect&city=des-moines");
  await page.getByRole("button", { name: "Request NOAA quote" }).click();
  await expect(page.getByText("Quote ready", { exact: true })).toBeVisible();
  const approval = page.getByRole("button", { name: "Approve Devnet protection" });
  await expect(approval).toBeDisabled();

  await page.getByLabel("Protection amount (USD preview)").fill("200");
  await expect(page.getByText("Quote ready", { exact: true })).toHaveCount(0);
  await expect(approval).toBeDisabled();
  expect(unsignedTransactionRequested).toBe(false);
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

test("wallet connection timeout offers a safe reset without submitting a transaction", async ({ page }) => {
  await page.addInitScript(() => {
    const pendingProvider = {
      isPhantom: true,
      isConnected: false,
      publicKey: null,
      connect: () => new Promise(() => {}),
      on: () => {},
      off: () => {},
    };
    Object.defineProperty(window, "isPhantomInstalled", { value: true, configurable: true });
    Object.defineProperty(window, "phantom", { value: { solana: pendingProvider }, configurable: true });
  });
  await page.goto("/?tab=markets&city=des-moines");
  await page.getByRole("button", { name: /Select Wallet|Connect Wallet/ }).click();
  await page.getByRole("button", { name: "Phantom Detected" }).click();
  await expect(page.locator("[data-wallet-state=selected]")).toBeVisible();
  await page.getByRole("button", { name: "Connect" }).click();

  await expect(page.locator("[data-wallet-state=connecting]")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("No transaction was requested.", { timeout: 20_000 });
  const unsignedCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/transactions/unsigned")) unsignedCalls.push(request.url());
  });
  await page.getByRole("button", { name: "Reset connection and retry" }).click();
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  await expect(page.getByText("Wallet connection is taking longer than expected.")).toHaveCount(0);
  expect(unsignedCalls).toEqual([]);
});

test("locations wrap without horizontal overflow at supported widths", async ({ page }) => {
  for (const width of [375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tab=markets&city=des-moines");
    await page.getByRole("combobox", { name: "Find an index" }).focus();
    await expect(page.getByText("Santa Cruz, Santa Cruz Department, Bolivia", { exact: true }).first()).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});

test("customer screens hide protocol administration and Builder mode contains it", async ({ page }) => {
  await page.goto("/?tab=markets&city=des-moines");
  await expect(page.getByRole("heading", { name: "Agricultural rainfall protection" })).toBeVisible();
  await expect(page.getByText("Live Devnet status", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Builder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Builder mode" })).toBeVisible();
  await expect(page.getByText("Live Devnet status", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ui-mode", "builder");
});

test("Builder explains that owner controls appear after the admin wallet connects", async ({ page }) => {
  await page.goto("/?tab=builders&city=des-moines");
  await expect(page.getByRole("heading", { name: "Connect the protocol admin wallet" })).toBeVisible();
  await expect(page.getByText("Connect the protocol admin wallet to show the Devnet setup and market-seeding approvals.")).toBeVisible();
});

test("Builder does not call an expired zero-funded Draft market ready", async ({ page }) => {
  await page.route("**/api/devnet/status", (route) => route.fulfill({ json: {
    network: "devnet",
    program: { address: "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx", status: "ready", executable: true, explorerUrl: "https://explorer.solana.com" },
    idl: { status: "ready", source: "committed", instructionCount: 22, accountCount: 5, supportsEmptyDraftCancellation: true },
    protocol: { address: "Protocol111111111111111111111111111111111", status: "ready", initialized: true, admin: null, settlementAuthority: null, collateralMint: null, nextMarketId: "1" },
    feeVault: { address: "Fee1111111111111111111111111111111111111", status: "ready", exists: true, balance: "0" },
    skytMint: { address: "Mint1111111111111111111111111111111111111", status: "ready", exists: true, decimals: 6, supply: "350000000000", mintAuthority: null },
    desMoinesMarket: { status: "ready", address: "Market11111111111111111111111111111111111", marketId: "0", vault: "Vault111111111111111111111111111111111111", vaultBalance: "0", onchainStatus: JSON.stringify({ draft: {} }), salesCloseAt: Math.floor(Date.now() / 1_000) - 3_600, observationStart: null, observationEnd: null, thresholdMmX100: null, operator: null, quoteProbabilityBps: null, premiumRateBps: null, quoteInputsHash: null, evidenceStatus: "researching_evidence", targetCityHash: "" },
    noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Historical sample only", package: null },
    generatedAt: new Date().toISOString(),
  } }));
  await page.route("**/api/health", (route) => route.fulfill({ json: {
    status: "degraded",
    checks: { settlement: { status: "manual-or-missing", scheduler: "vercel-cron", signerConfigured: false, noaaConfigured: true, cronAuthConfigured: false } },
  } }));

  await page.goto("/?tab=builders&city=des-moines");
  const marketRow = page.getByRole("heading", { name: "Des Moines market" }).locator("xpath=../..");
  await expect(marketRow.getByText("pending", { exact: true })).toBeVisible();
  await expect(marketRow.getByText("Market 0 is an expired Draft with 0 SKYT collateral; protection requires an Open, funded market.", { exact: true })).toBeVisible();
});

test("Builder shows that automatic oracle settlement is blocked when cron auth is missing", async ({ page }) => {
  await page.route("**/api/devnet/status", (route) => route.fulfill({ json: {
    network: "devnet",
    program: { address: "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx", status: "ready", executable: true, explorerUrl: "https://explorer.solana.com" },
    idl: { status: "ready", source: "committed", instructionCount: 22, accountCount: 5, supportsEmptyDraftCancellation: false },
    protocol: { address: "Protocol111111111111111111111111111111111", status: "ready", initialized: true, admin: null, settlementAuthority: null, collateralMint: null, nextMarketId: "0" },
    feeVault: { address: "Fee1111111111111111111111111111111111111", status: "ready", exists: true, balance: "0" },
    skytMint: { address: "Mint1111111111111111111111111111111111111", status: "ready", exists: true, decimals: 6, supply: "350000000000", mintAuthority: null },
    desMoinesMarket: { status: "pending", address: null, marketId: null, vault: null, vaultBalance: null, onchainStatus: null, salesCloseAt: null, observationStart: null, observationEnd: null, thresholdMmX100: null, operator: null, evidenceStatus: "researching_evidence", targetCityHash: "" },
    noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Historical NOAA sample for 2026-09-13 through 2026-09-20 confirms station data availability only; it does not validate a future market window, settlement rainfall, or pricing.", package: null },
    generatedAt: new Date().toISOString(),
  } }));
  await page.route("**/api/health", (route) => route.fulfill({ json: {
    status: "ok",
    checks: { settlement: { status: "manual-or-missing", scheduler: "vercel-cron", signerConfigured: true, noaaConfigured: true, cronAuthConfigured: false } },
  } }));
  await page.goto("/?tab=builders&city=des-moines");
  await expect(page.getByRole("heading", { name: "Oracle settlement worker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NOAA station validation" })).toBeVisible();
  await expect(page.getByText("sample only", { exact: true })).toBeVisible();
  await expect(page.getByText(/Historical NOAA sample .* confirms station data availability only; it does not validate a future market window, settlement rainfall, or pricing\./)).toBeVisible();
  await expect(page.getByText("Automatic NOAA settlement is not ready; missing or unavailable: cron authentication.")).toBeVisible();
  await expect(page.getByText("unavailable", { exact: true }).first()).toBeVisible();
});

test("mobile bottom navigation exposes Liquidity and Builder through More", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?tab=markets&city=des-moines");
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "More" }).click();
  const drawer = page.getByRole("dialog", { name: "More sections" });
  await expect(drawer.getByRole("button", { name: "Liquidity" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Builder" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await mobileNavigation.getByRole("button", { name: "More" }).click();
  await drawer.getByRole("button", { name: "Liquidity" }).click();
  await expect(page.getByRole("heading", { name: "Provide test liquidity" })).toBeVisible();
});

test("uses the self-hosted IBM Plex design system with mobile-size inputs", async ({ page }) => {
  await page.goto("/?tab=protect&city=des-moines");
  const typography = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    inputSize: getComputedStyle(document.querySelector("input")!).fontSize,
  }));
  expect(typography.body).toContain("IBM Plex Sans");
  expect(Number.parseFloat(typography.inputSize)).toBeGreaterThanOrEqual(16);
});
