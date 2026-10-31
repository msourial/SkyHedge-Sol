import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_QUOTES } from "../../shared/ui-discovery-fixtures";
const address = "11111111111111111111111111111112";
const market = "11111111111111111111111111111113";

async function mockData(page: Page) {
  page.on("pageerror", e => console.log("App page error:", e.message));
  await page.clock.install({ time: new Date("2026-10-25T12:00:00Z") });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    if (url.pathname === "/api/devnet/status") return route.fulfill({ json: { network: "devnet", program: { executable: true }, idl: { status: "ready" }, protocol: { initialized: true }, feeVault: { exists: true }, skytMint: { exists: true, decimals: 6 }, noaaEvidence: { status: "unavailable", package: null }, cityWindows: [], desMoinesMarket: { status: "pending" } } });
    if (resource === "window-quote") {
      const quote = DISCOVERY_QUOTES.find(q => q.cityId === url.searchParams.get("city") && q.peril === url.searchParams.get("peril"));
      if (!quote) return route.fulfill({ status: 409, json: { error: "PERIL_NOT_OPEN" } });
      return route.fulfill({ json: { ...quote, windowStart: url.searchParams.get("windowStart"), windowEnd: url.searchParams.get("windowEnd"), salesCloseAt: url.searchParams.get("windowStart"), rungs: quote.rungs.map(r => ({ ...r, marketAddress: r.marketAddress ? market : null })) } });
    }
    if (resource === "cities") return route.fulfill({ json: { cities: [] } });
    if (resource === "agricultural-markets") return route.fulfill({ json: { markets: [] } });
    if (resource === "wallet-balances") return route.fulfill({ json: { sol: 1, skytBaseUnits: "1000000000", skytDecimals: 6, slot: 123 } });
    if (resource === "portfolio") return route.fulfill({ json: { wallet: address, indexed: true, protections: [], liquidity: [] } });
    return route.fulfill({ status: 503, json: { error: "DATA_UNAVAILABLE" } });
  });
  await page.route(/https:\/\/(api\.devnet\.solana\.com|solana-devnet\.api\.onfinality\.io)/, async route => {
    const { id, method } = route.request().postDataJSON();
    if (method === "getLatestBlockhash") return route.fulfill({ json: { jsonrpc: "2.0", id, result: { context: { slot: 123 }, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1000 } } } });
    if (method === "getProgramAccounts") return route.fulfill({ json: { jsonrpc: "2.0", id, result: [] } });
    return route.fulfill({ json: { jsonrpc: "2.0", id, error: { code: -32000, message: "Mock RPC unavailable; use server fallback" } } });
  });
}

test("landing has the requested copy, actions and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Weather on your plans?Get paid.");
  await expect(page.getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/app");
  await expect(page.getByRole("link", { name: "Watch demo" })).toHaveAttribute("href", "#demo");
  await expect(page.getByRole("link", { name: "Download APK" })).toHaveAttribute("href", "https://github.com/msourial/SkyHedge-Sol/releases");
  await expect(page.locator(".how li")).toHaveCount(3);
  await expect(page.locator(".money")).toContainText("1–4%");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("exports native Markets, Protect and Wallet with refreshable deep links and history", async ({ page }) => {
  await mockData(page);
  const errors: string[] = [];
  page.on("pageerror", e => { errors.push(e.message); console.log("Page error:", e.message); });
  await page.goto("/app");
  await expect(page.getByRole("tab", { name: "Markets tab", exact: true })).toBeVisible();
  await expect(page.getByText("Rain in Central Park", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Protect tab", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/protect$/);
  await page.getByRole("tab", { name: "Wallet tab", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/wallet$/);
  await page.reload();
  await expect(page.getByText("Phantom · Solana Devnet", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Markets tab", exact: true }).click();
  await page.goBack();
  await expect(page.getByText("Phantom · Solana Devnet", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("explains missing Phantom and connects, displays address and SKYT, and resets on account change", async ({ page }) => {
  await mockData(page);
  await page.goto("/app/wallet");
  await page.getByText("Connect wallet", { exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Install the Phantom" })).toContainText("Install the Phantom browser extension");
  await page.addInitScript(({ address }) => {
    const listeners: Record<string, Function[]> = {};
    const key = { toBase58: () => address };
    const provider = { isPhantom: true, publicKey: null as any,
      connect: async (options?: { onlyIfTrusted?: boolean }) => { if (options?.onlyIfTrusted) throw new Error("Not trusted"); provider.publicKey = key; return { publicKey: key }; },
      on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
      removeListener: (event: string, cb: Function) => { listeners[event] = (listeners[event] ?? []).filter(item => item !== cb); },
      disconnect: async () => { provider.publicKey = null; listeners.disconnect?.forEach(cb => cb()); },
      signTransaction: async (tx: any) => { (window as any).signedPayer = tx.message.staticAccountKeys[0].toBase58(); (window as any).signRequests = ((window as any).signRequests ?? 0) + 1; throw new Error("User rejected the request"); },
    };
    (window as any).phantom = { solana: provider };
    (window as any).changeAccount = () => { provider.publicKey = null; listeners.accountChanged?.forEach(cb => cb(null)); };
  }, { address });
  await page.reload();
  await page.getByText("Connect wallet", { exact: true }).click();
  await expect(page).toHaveURL(/\/app\/protect$/);
  await page.getByRole("tab", { name: "Wallet tab", exact: true }).click();
  await expect(page.getByText(address, { exact: true })).toBeVisible();
  await expect(page.getByText("1,000.00 SKYT", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Protect tab", exact: true }).click();
  await page.getByRole("button", { name: /Protect for .* SKYT/ }).click();
  await page.getByRole("button", { name: "Approve in wallet", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).signRequests)).toBe(1);
  expect(await page.evaluate(() => (window as any).signedPayer)).toBe(address);
  await expect(page.getByRole("heading", { name: /^Cancelled in Phantom/ })).toBeVisible();
  await page.getByRole("button", { name: "Back to Protect", exact: true }).click();
  await page.evaluate(() => (window as any).changeAccount());
  await page.getByRole("tab", { name: "Wallet tab", exact: true }).click();
  await expect(page.getByText(address, { exact: true })).toHaveCount(0);
});

test("trusted Phantom restoration preserves a Wallet deep link", async ({ page }) => {
  await mockData(page);
  await page.addInitScript(({ address }) => {
    const key = { toBase58: () => address };
    (window as any).phantom = { solana: { isPhantom: true, publicKey: key,
      connect: async () => ({ publicKey: key }), on: () => {}, removeListener: () => {},
    } };
  }, { address });
  await page.goto("/app/wallet");
  await expect(page.getByText(address, { exact: true })).toBeVisible();
  await expect(page.getByText("1,000.00 SKYT", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/wallet$/);
});
