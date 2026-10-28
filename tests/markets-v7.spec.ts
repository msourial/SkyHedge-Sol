import { test, expect } from "@playwright/test";
import { marketsFixture } from "../shared/ui-markets-fixtures";
import { elsewhereCards } from "../shared/ui-markets";
test.use({ viewport: { width: 393, height: 852 } });
test("mixed first paint is New York with its hero and Covered row", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=mixed");
  await expect(page.getByRole("heading", { name: "New York", exact: true })).toBeVisible();
  const hero = page.locator(".mk-hero");
  await expect(hero).toContainText("69");
  await expect(hero).toContainText("Central Park");
  await expect(hero).not.toContainText("Des Moines");
  const covered = page.locator(".mk-row").filter({ hasText: "Covered" });
  await expect(covered).toHaveCount(1);
  const box = await covered.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(764);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  const geometry = await hero.evaluate((el) => {
    const stage = el.querySelector(".mk-stage")!.getBoundingClientRect(), stats = el.querySelector(".mk-stats")!.getBoundingClientRect(), cta = el.querySelector(".ln-cta")!.getBoundingClientRect(), hero = el.getBoundingClientRect();
    return [hero.height, stage.height, stats.height, cta.height, stats.top - stage.bottom, cta.top - stats.bottom, hero.bottom - cta.bottom];
  });
  expect(geometry).toEqual([336, 152, 56, 56, 16, 16, 24]);
});
test("cards follow shared consumer rank and keep stats exclusive to the hero", async ({ page }) => {
  for (const state of ["mixed", "full-week", "all-covered"]) {
    await page.goto(`/preview?screen=markets&state=${state}`);
    if (state === "all-covered") {
      await expect(page.locator('[data-grid="open"] .mk-card-footer')).toHaveText(["Covered", "Covered", "Covered"]);
      await expect(page.getByRole("button", { name: "View cover", exact: true })).toBeVisible();
    }
    const fixture = marketsFixture(state);
    if (state === "mixed") expect(elsewhereCards("new-york", fixture.markets).map((c) => c.id)).toEqual(["chicago-snow", "chicago-wind", "des-moines-rain"]);
    const expected = elsewhereCards("new-york", fixture.markets).map((c) => c.id);
    expect(await page.locator('[data-grid="open"] .mk-card').evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")))).toEqual(expected);
    for (const item of await page.locator(".mk-card, .mk-row").all()) await expect(item).not.toContainText(/chance|multiple|max loss/i);
    await expect(page.locator(".mk-markets")).not.toContainText(/Opening later|Chance · Multiple|Opening soon|Notify/);
  }
});
test("every Markets state has readable type, full contrast controls and valid targets", async ({ page }) => {
  for (const state of ["loading", "mixed", "ny-held-one", "ny-all-held", "ny-none-open", "nothing-open", "error", "empty", "full-week", "all-covered"]) {
    await page.goto(`/preview?screen=markets&state=${state}`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".mk-markets").evaluate(async (el) => { await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)); });
    const defects = await page.locator(".mk-markets").evaluate((root) => {
      const nodes = [...root.querySelectorAll<HTMLElement>("*")].filter((el) => el.getBoundingClientRect().height > 0);
      return {
        tiny: nodes.filter((el) => el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className),
        touch: nodes.filter((el) => el.matches("button,a,summary") && (el.getBoundingClientRect().width < 48 || el.getBoundingClientRect().height < 48)).map((el) => el.className),
        dim: nodes.filter((el) => el.matches("button,.mk-card,.mk-instrument,.mk-instrument *") && parseFloat(getComputedStyle(el).opacity) < 1).map((el) => el.className),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(defects, state).toEqual({ tiny: [], touch: [], dim: [], overflow: false });
  }
});
test("city sheet selects, closes, traps focus and keeps session city until reload", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=mixed");
  const button = page.getByRole("button", { name: "Choose a city, New York" });
  await button.click();
  const sheet = page.getByRole("dialog", { name: "Choose a city", exact: true });
  await expect(sheet.locator(".mk-city-row")).toHaveCount(9);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  const sheetTargets = await sheet.locator("button").evaluateAll((nodes) => nodes.map((node) => [node.getBoundingClientRect().width, node.getBoundingClientRect().height]));
  expect(sheetTargets.every(([w, h]) => w >= 48 && h >= 48)).toBe(true);
  await sheet.getByRole("button", { name: /Chicago/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chicago", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choose a city, Chicago" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "New York", exact: true })).toBeVisible();
});
test("Cold explains its restriction and pending Heat opens the existing Protect preview", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=mixed");
  await page.locator('.mk-card[data-kind="cold"]').click();
  const cold = page.getByRole("dialog", { name: "Cold", exact: true });
  await expect(cold).toContainText("The contract can't take triggers below zero.");
  await cold.getByRole("button", { name: "Close", exact: true }).click();
  await expect(cold).toHaveCount(0);
  await page.locator('.mk-card[data-card-id="miami-heat"]').click();
  await expect(page).toHaveURL(/screen=protect&state=heat&city=miami&peril=heat&tenor=monthly/);
  await expect(page.getByRole("tab", { name: "Heat", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Trigger chain" })).toBeVisible();
});
test("fallback and receipt states preserve city-led selection", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=ny-none-open");
  await expect(page.getByRole("heading", { name: "Chicago", exact: true })).toBeVisible();
  await page.goto("/preview?screen=markets&state=ny-all-held");
  await expect(page.locator(".mk-hero")).toContainText("Covered");
  await expect(page.getByRole("button", { name: "View cover", exact: true })).toBeVisible();
  await page.goto("/preview?screen=markets&state=nothing-open");
  await expect(page.getByRole("heading", { name: "New York", exact: true })).toBeVisible();
  await expect(page.locator(".mk-city-panel")).toContainText("Season starts Nov");
  await page.goto("/preview?screen=markets&state=empty");
  await expect(page.getByText("No markets are scheduled.", { exact: true })).toBeVisible();
});

test("open preview navigation retains the exact market window and trigger", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=mixed");
  await page.locator(".mk-row").filter({ hasText: "≥ 29 mm" }).click();
  await expect(page).toHaveURL(/screen=protect&state=ready.*trigger=29/);
  await expect(page.locator(".ln-numeral")).toHaveText("29");
  await expect(page.locator(".ln-sub")).toContainText("Nov 2 – Nov 9");
  await page.goto("/preview?screen=markets&state=full-week");
  await page.locator('.mk-card[data-card-id="miami-heat"]').click();
  await expect(page.locator(".ln-numeral")).toHaveText("30.6");
  await expect(page.getByRole("tab", { name: "Heat", exact: true })).toHaveAttribute("aria-selected", "true");
});
