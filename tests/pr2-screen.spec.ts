import { expect, test } from "./fixtures";
import { DISCOVERY_QUOTES } from "../shared/ui-discovery-fixtures";

test.use({ viewport: { width: 393, height: 852 } });
test("Markets uses real WindowQuote premiums, preserves a selection, and never opens cold", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-25T12:00:00Z"));
  await page.route("**/api/devnet/status**", (route) => route.fulfill({ json: { cityWindows: [], desMoinesMarket: { status: "pending", evidenceStatus: "researching_evidence" } } }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requested: string[] = [];
  await page.route("**/api/mobile?resource=window-quote&**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    requested.push(params.get("peril")!);
    const quote = DISCOVERY_QUOTES.find((q) => q.cityId === params.get("city") && q.peril === params.get("peril"));
    return quote ? route.fulfill({ json: { ...quote, windowStart: params.get("windowStart"), windowEnd: params.get("windowEnd"), salesCloseAt: params.get("windowStart") } }) : route.fulfill({ status: 409, json: { error: "not open" } });
  });
  await page.goto("/app?tab=markets");
  await expect(page.getByRole("button", { name: "Cover this", exact: true })).toBeVisible();
  await expect(page.locator(".ln-stat-strip")).toContainText("24.00");
  await page.getByRole("tab", { name: "Wind", exact: true }).click();
  await expect(page.locator(".ln-market-hero")).toContainText("Chicago");
  await expect(page.locator(".ln-market-hero")).toContainText("4.1x");
  await page.getByRole("button", { name: "Cover this", exact: true }).click();
  await expect(page).toHaveURL("/app?tab=protect&city=chicago&peril=wind&tenor=weekly&trigger=12&start=2026-10-26&end=2026-11-02");
  await expect(page.locator(".ln-sub")).toHaveText("O'Hare · Oct 26 – Nov 2 · Sales close Oct 26");
  await expect(page.getByRole("tab", { name: "Wind", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Trigger chain" })).toContainText("Trigger (m/s)");
  expect(requested).not.toContain("cold");
  expect(errors).toEqual([]);
});
test("modelled quotes have no offer and Cold stays selectable with a ghost", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=modelled");
  await expect(page.getByRole("button", { name: "Cover this" })).toHaveCount(0);
  await expect(page.locator(".ln-market-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "Cold", exact: true }).click();
  await expect(page.getByText("Cold isn't open yet.")).toBeVisible();
  await expect(page.locator(".ln-empty svg")).toHaveAccessibleName(/Cold/);
  await expect(page.locator(".ln-empty svg [stroke='#F2C230']")).toHaveCount(0);
});
test("Wallet totals use equal figure styles and receipts distinguish paid, dry and claimable", async ({ page }) => {
  for (const [state, status, result] of [["open", "Open", null], ["paid", "Paid out", "Result +76.00 SKYT"], ["dry", "Dry window", "Result -24.00 SKYT"], ["pending", "Payout ready to collect", null]] as const) {
    await page.goto(`/preview?screen=wallet&state=${state}`);
    await expect(page.locator(".ln-wallet-row")).toContainText(status);
    if (state === "open") {
      await expect(page.locator(".ln-cells")).toContainText("-24.00");
      await expect(page.locator(".ln-cells")).toContainText("+76.00");
      await expect(page.locator(".ln-wallet-row")).toContainText("69 mm or more · Nov 1 to Dec 1");
      await expect(page.locator(".ln-wallet-figures")).toContainText("Max loss");
      await expect(page.locator(".ln-wallet-figures")).toContainText("Max gain");
    }
    await page.locator(".ln-wallet-row").click();
    await expect(page.getByRole("region", { name: "Cover receipt" })).toContainText(status);
    const equal = await page.locator(".ln-money-cell").evaluateAll((cells) => cells.map((cell) => {
      const figure = cell.querySelector(".ln-money-figure")!;
      const style = getComputedStyle(figure), box = cell.getBoundingClientRect();
      return [style.fontSize, style.fontWeight, style.color, box.width, box.height];
    }));
    expect(equal[0]).toEqual(equal[1]);
    if (result) await expect(page.getByRole("region", { name: "Cover receipt" })).toContainText(result);
    else await expect(page.getByRole("region", { name: "Cover receipt" })).not.toContainText("Result");
    await expect(page.getByTestId("final-reading")).toHaveCount(state === "open" ? 0 : 1);
    if (state === "pending") await expect(page.getByRole("region", { name: "Cover receipt" })).not.toContainText("Paid out");
  }
});

test("Markets keeps the hero and CTA above the single covers summary", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=with-covers");
  await expect(page.locator(".ln-market-hero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cover this", exact: true })).toBeVisible();
  await expect(page.locator(".ln-cover-tile")).toHaveCount(0);
  await expect(page.locator(".ln-covers-summary")).toContainText("1 open covers");
});
test("landing selects all five instruments and cover sizes with exact loss and gain", async ({ page }) => {
  await page.goto("/preview?screen=landing&state=ready");
  for (const [label, city] of [["Rain", "New York"], ["Snow", "Chicago"], ["Wind", "Chicago"], ["Heat", "Miami"]]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".ln-sub")).toContainText(city);
    await expect(page.locator(".ln-note").first()).toContainText("Chance is from 10 years of NOAA history, not a forecast.");
    await page.getByRole("button", { name: "50", exact: true }).click();
    await expect(page.locator(".ln-money-cell").first()).toContainText("-12.00");
    await expect(page.locator(".ln-money-cell").last()).toContainText("+38.00");
  }
  await page.getByRole("tab", { name: "Cold", exact: true }).click();
  await expect(page.getByText("Cold isn't open yet.")).toBeVisible();
  await expect(page.locator(".ln-money-cell")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Trigger chain" })).toHaveCount(0);
});
test("Markets, Wallet, Landing have no overflow, type below 13px, or undersized touch targets", async ({ page }) => {
  for (const url of ["screen=markets&state=ready", "screen=markets&state=cold", "screen=wallet&state=open", "screen=wallet&state=paid&receipt=1", "screen=landing&state=ready", "state=ready"]) {
    await page.goto(`/preview?${url}`);
    await expect(page.getByRole("note")).toHaveText("Fixture — preview data");
    const violations = await page.locator(".ln").evaluateAll((roots) => {
      const nodes = roots.flatMap((root) => [...root.querySelectorAll<HTMLElement>("*")]).filter((el) => el.getBoundingClientRect().height && getComputedStyle(el).visibility !== "hidden");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        tiny: nodes.filter((el) => el.textContent?.trim() && Number.parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className),
        touch: nodes.filter((el) => el.matches("button, summary, a") && !el.hasAttribute("disabled") && (el.getBoundingClientRect().height < 48 || el.getBoundingClientRect().width < 48)).map((el) => el.className),
      };
    });
    expect(violations, url).toEqual({ overflow: false, tiny: [], touch: [] });
  }
});
test("peril keyboard navigation moves focus and reduced motion stops animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview?screen=markets&state=ready");
  await page.getByRole("tab", { name: "All", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Cold", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Cold", exact: true })).toHaveAttribute("aria-selected", "true");
  const animations = await page.locator(".ln").evaluate((root) => root.getAnimations({ subtree: true }).length);
  expect(animations).toBe(0);
});
test("Protect has no first-run strip", async ({ page }) => {
  await page.goto("/preview?screen=protect");
  await expect(page.locator(".ln-intro")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Trigger chain" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket", exact: true })).toHaveCount(1);
});
