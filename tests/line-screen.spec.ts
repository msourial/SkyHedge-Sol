import { expect, test } from "./fixtures";
import { NYC_RAIN_MODELLED } from "../shared/ui-fixtures";

test("max loss and max gain share size, weight, and colour", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/preview?state=ready");
  const cells = page.locator(".ln-money-cell");
  await expect(cells).toHaveCount(2);
  const style = await cells.evaluateAll((nodes) => nodes.map((node) => {
    const figure = node.querySelector(".ln-money-figure");
    const cell = getComputedStyle(node);
    const text = figure ? getComputedStyle(figure) : null;
    return {
      width: cell.width,
      height: cell.height,
      fontSize: text?.fontSize,
      fontWeight: text?.fontWeight,
      color: text?.color,
    };
  }));
  expect(style[0]).toEqual(style[1]);
  expect(style[0]?.fontSize).toBeTruthy();
  const text = await page.locator(".ln").innerText();
  expect(text).not.toMatch(/\b(insurance|guaranteed|risk-free|profit|edge)\b/i);
  expect(text).not.toMatch(/RainHedge|heatwave|expected value|can't lose|sure thing|safe bet|free money|lock in/i);
});

test("preview labels fixtures and opens only the pinned rain rung", async ({ page }) => {
  await page.goto("/preview?state=ready");
  await expect(page.getByRole("note")).toHaveText("Fixture — preview data");
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio")).toHaveAccessibleName("Trigger 69 mm, chance 20.0 percent, multiple 4.1 times, max loss 24.00 SKYT");
  await expect(page.locator('.ln-row[data-open="false"]')).toHaveCount(5);
  await page.getByRole("tab", { name: "Cold", exact: true }).click();
  await expect(page.getByText("Cold isn't open yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
});

test("live wind and heat quotes are modelled, and cold never requests a quote", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-24T12:00:00Z"));
  await page.route("**/api/devnet/status**", (route) => route.fulfill({ json: { cityWindows: [], desMoinesMarket: { status: "pending", evidenceStatus: "researching_evidence" } } }));
  const requested: string[] = [];
  const transactions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/transactions/unsigned")) transactions.push(request.url());
  });
  await page.route("**/api/mobile?resource=window-quote&**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const peril = params.get("peril")!;
    requested.push(peril);
    // Explicit test fixture; live UI receives the same backend field shape.
    return route.fulfill({ json: {
      ...NYC_RAIN_MODELLED,
      cityId: params.get("city"), peril,
      windowStart: params.get("windowStart"), windowEnd: params.get("windowEnd"),
      unit: peril === "wind" ? "m/s" : peril === "heat" ? "C" : "mm",
      analogueYears: 8,
      rungs: NYC_RAIN_MODELLED.rungs.map((rung) => ({ ...rung, marketAddress: null })),
    } });
  });
  for (const [city, label] of [["chicago", "Wind", "m/s"], ["miami", "Heat", "C"]]) {
    await page.goto(`/app?tab=protect&city=${city}`);
    await page.getByRole("tab", { name: label, exact: true }).click();
    const chain = page.getByRole("region", { name: "Trigger chain" });
    await expect(chain).toHaveCount(0);
    await expect(page.locator(".ln-instrument svg > *")).toHaveCount(0);
    await expect(page.getByText(`${label} isn't open for ${city === "chicago" ? "Chicago" : "Miami"} this week.`, { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ticket", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Protect for/ })).toHaveCount(0);
    await page.getByRole("tab", { name: "Cold", exact: true }).click();
    await expect(page.getByText("Cold isn't open yet.", { exact: true })).toBeVisible();
    await expect(chain).toHaveCount(0);
  }
  expect(requested).toContain("wind");
  expect(requested).toContain("heat");
  expect(requested).not.toContain("cold");
  expect(transactions).toEqual([]);
});
