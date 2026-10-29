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
  await page.locator('.mk-card[data-card-id="chicago-wind"]').click();
  await expect(page).toHaveURL("/app?tab=protect&city=chicago&peril=wind&tenor=weekly&trigger=12&start=2026-10-26&end=2026-11-02");
  await expect(page.locator(".ln-sub")).toHaveText("O'Hare · Oct 26 – Nov 2 · Sales close Oct 26");
  await expect(page.getByRole("tab", { name: "Wind", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Trigger chain" })).toContainText("Trigger (m/s)");
  expect(requested).not.toContain("cold");
  expect(errors).toEqual([]);
});
test("modelled quotes have no offer and Cold opens its explanation", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=modelled");
  await expect(page.getByRole("button", { name: "Cover this", exact: true })).toHaveCount(0);
  await expect(page.locator(".ln-market-row .mk-row-trigger")).toHaveCount(0);
  await page.locator('.mk-card[data-kind="cold"]').click();
  await expect(page.getByRole("dialog", { name: "Cold", exact: true })).toContainText("The contract can't take triggers below zero.");
});
test("Wallet totals use equal figure styles and receipts distinguish paid, dry and claimable", async ({ page }) => {
  for (const [state, status, result] of [["open", "Open", null], ["paid", "Paid out", "Result +76.00 SKYT"], ["dry", "Dry window", "Result -24.00 SKYT"], ["pending", "Payout ready to collect", null]] as const) {
    await page.goto(`/preview?screen=wallet&state=${state}`);
    if (state === "open") await expect(page.locator(".ln-wallet-row")).not.toContainText(status);
    else await expect(page.locator(".ln-wallet-row")).toContainText(status);
    if (state === "open") {
      await expect(page.locator(".ln-cells")).toContainText("-24.00");
      await expect(page.locator(".ln-cells")).toContainText("+76.00");
      await expect(page.locator(".ln-wallet-totals")).not.toContainText("SKYT");
      await expect(page.locator(".ln-wallet-total-caption")).toHaveText("Totals in SKYT across 1 open cover.");
      await expect(page.locator(".ln-wallet-trigger")).toHaveText("69 mm or more");
      await expect(page.locator(".ln-wallet-row")).toContainText("Rain · New York · Oct 26 to Nov 2");
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

test("Wallet open rows and total labels stay on clean lines at 393px", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/preview?screen=wallet&state=open");
  const row = page.locator(".ln-wallet-row");
  await expect(row).toBeVisible();
  const layout = await row.evaluate((el) => {
    const boxes = [...el.querySelectorAll<HTMLElement>("*")].filter((node) => [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) && node.getBoundingClientRect().width && getComputedStyle(node).display !== "none").map((node) => ({ text: node.innerText.trim(), rect: node.getBoundingClientRect().toJSON() }));
    const textBoxes = boxes.filter((box) => box.text.length && box.rect.height > 0);
    const overlap = textBoxes.some((a, i) => textBoxes.slice(i + 1).some((b) => a.rect.left < b.rect.right - 1 && a.rect.right > b.rect.left + 1 && a.rect.top < b.rect.bottom - 1 && a.rect.bottom > b.rect.top + 1 && a.text !== b.text && !(a.rect.left <= b.rect.left && a.rect.right >= b.rect.right && a.rect.top <= b.rect.top && a.rect.bottom >= b.rect.bottom) && !(b.rect.left <= a.rect.left && b.rect.right >= a.rect.right && b.rect.top <= a.rect.top && b.rect.bottom >= a.rect.bottom)));
    return { overlap, rowHeight: el.getBoundingClientRect().height, cells: [...document.querySelectorAll<HTMLElement>(".ln-wallet-totals .ln-money-cell")].map((cell) => ({ width: cell.getBoundingClientRect().width, height: cell.getBoundingClientRect().height, label: cell.querySelector(".ln-label")?.getBoundingClientRect().height, labelScroll: cell.querySelector(".ln-label")?.scrollHeight })) };
  });
  expect(layout.overlap).toBe(false);
  expect(layout.rowHeight).toBeGreaterThanOrEqual(96);
  expect(layout.cells).toHaveLength(2);
  for (const cell of layout.cells) {
    expect(cell.width).toBe(172);
    expect(cell.height).toBe(88);
    expect(cell.label).toBeLessThanOrEqual(18);
    expect(cell.labelScroll).toBeLessThanOrEqual(18);
  }
  await expect(page.locator(".ln-wallet-totals .ln-label")).toHaveText(["Max loss, open covers", "Max gain, open covers"]);
});

test("Markets keeps one covers summary above the hero and CTA", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=with-covers");
  await expect(page.locator(".ln-market-hero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cover this", exact: true })).toBeVisible();
  await expect(page.locator(".ln-cover-tile")).toHaveCount(0);
  await expect(page.locator(".ln-covers-summary")).toContainText("1 open cover");
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
  await page.goto("/preview?screen=wallet&state=wallet-multi");
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

test("city-led mixed markets keeps New York and skips the held hero and Wallet multi leads with triggers", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=markets-mixed");
  const hero = page.locator(".ln-market-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByRole("heading", { name: "New York", exact: true })).toBeVisible();
  await expect(hero).toContainText("69");
  const heldRow = page.locator(".ln-market-row").filter({ hasText: "Covered" });
  await expect(heldRow).toHaveCount(1);
  await expect(heldRow.locator(".mk-row-status svg")).toHaveAttribute("width", "16");
  await expect(page.locator(".ln-market-row").last()).toContainText("Covered");
  await page.goto("/preview?screen=wallet&state=wallet-multi");
  await expect(page.locator(".ln-wallet-row")).toHaveCount(4);
  for (const row of await page.locator(".ln-wallet-row").all()) {
    await expect(row.locator(".ln-wallet-trigger")).toHaveText(/or more$/);
  }
  await expect(page.locator(".ln-peril-tabs")).toBeVisible();
  await expect(page.locator(".ln-wallet-window")).toHaveCount(1);
  const tiny = await page.locator(".ln").evaluate((root) => [...root.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent?.trim() && el.getBoundingClientRect().height && Number.parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className));
  expect(tiny).toEqual([]);
  const firstRow = page.locator(".ln-wallet-row").first();
  const textOverlaps = await firstRow.evaluate((row) => {
    const nodes = [...row.querySelectorAll<HTMLElement>(".ln-wallet-trigger, .ln-label, .ln-wallet-figures, .ln-wallet-state")];
    return nodes.some((a, i) => nodes.slice(i + 1).some((b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; }));
  });
  expect(textOverlaps).toBe(false);
});

test("Markets loading reserves the complete hero and four card shells", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=loading");
  await expect(page.getByRole("heading", { name: "New York", exact: true })).toBeVisible();
  await expect(page.locator(".mk-shell")).toHaveCount(4);
  const hero = page.locator(".ln-market-hero--loading");
  await expect(hero).toBeVisible();
  await expect(hero.locator(".ln-stat-strip .ln-label")).toHaveText(["Chance", "Multiple", "Max loss"]);
  await expect(hero.locator(".ln-placeholder-value")).toHaveText(["--", "--", "--"]);
  await expect(hero.locator(".ln-art rect").first()).toBeVisible();
  await expect(hero.locator(".ln-cta")).toBeDisabled();
  await expect(page.getByText("Getting your quote")).toHaveCount(0);
  const dimensions = await hero.evaluate((node) => {
    const stage = node.querySelector(".ln-market-stage")!.getBoundingClientRect();
    const stats = node.querySelector(".ln-stat-strip")!.getBoundingClientRect();
    const cta = node.querySelector(".ln-cta")!.getBoundingClientRect();
    return [stage.height, stats.height, cta.height];
  });
  await page.goto("/preview?screen=markets&state=ready");
  const loadedDimensions = await page.locator(".ln-market-hero").evaluate((node) => {
    const stage = node.querySelector(".ln-market-stage")!.getBoundingClientRect();
    const stats = node.querySelector(".ln-stat-strip")!.getBoundingClientRect();
    const cta = node.querySelector(".ln-cta")!.getBoundingClientRect();
    return [stage.height, stats.height, cta.height];
  });
  expect(dimensions).toEqual(loadedDimensions);
});

test("Markets rows keep the trigger and window together and remove the unavailable list", async ({ page }) => {
  await page.goto("/preview?screen=markets&state=ready");
  const row = page.locator(".mk-row").first();
  await expect(row.locator(".mk-row-trigger")).toContainText("≥ 29 mm");
  await expect(row.locator(".mk-row-end")).toContainText("by Nov 9");
  await expect(row).toHaveCSS("height", "64px");
  await expect(page.locator(".ln-unavailable-toggle, .ln-unavailable-row, .ln-peril-tabs")).toHaveCount(0);
});

test("Wallet removes redundant open status and keeps dates in groups", async ({ page }) => {
  await page.goto("/preview?screen=wallet&state=open");
  const single = page.locator(".ln-wallet-row");
  await expect(single).toHaveCount(1);
  await expect(single).not.toContainText("Open");
  await expect(single.locator(".ln-label")).toContainText("Oct 26 to Nov 2");

  await page.goto("/preview?screen=wallet&state=wallet-two");
  await expect(page.locator(".ln-wallet-row")).toHaveCount(2);
  await expect(page.locator(".ln-wallet-window")).toHaveCount(1);
  await expect(page.locator(".ln-wallet-window")).toHaveCSS("font-size", "13px");
  await expect(page.locator(".ln-wallet-row .ln-wallet-state")).toHaveCount(0);
  await expect(page.locator(".ln-wallet-row .ln-label").first()).not.toContainText("Nov 1 to Dec 1");
  const groupGap = await page.evaluate(() => {
    const zone = document.querySelector(".ln-browse > .ln-zone")!.getBoundingClientRect();
    const group = document.querySelector(".ln-wallet-window")!.getBoundingClientRect();
    return group.top - zone.bottom;
  });
  expect(groupGap).toBeLessThanOrEqual(12);

  await page.goto("/preview?screen=wallet&state=paid");
  await expect(page.locator(".ln-wallet-state")).toHaveText("Paid out");
  await expect(page.locator(".ln-wallet-state")).toHaveCSS("color", "rgb(242, 194, 48)");
});

test("Protect dry rows separate Multiple from regular 13px Not open", async ({ page }) => {
  await page.goto("/preview?state=dry");
  const row = page.locator(".ln-row[data-open=false]").filter({ hasText: "Not open" }).first();
  await expect(row).toBeVisible();
  const dry = await row.evaluate((node) => {
    const multiple = node.children[2].getBoundingClientRect();
    const maxLoss = node.children[3].getBoundingClientRect();
    const style = getComputedStyle(node.children[3]);
    return { gap: maxLoss.left - multiple.right, fontSize: style.fontSize, family: style.fontFamily };
  });
  expect(dry.gap).toBeGreaterThanOrEqual(16);
  expect(dry.fontSize).toBe("13px");
  expect(dry.family.toLowerCase()).toContain("inter");
});

test("covered Protect uses an inline receipt without a bar; other Protect states clear the bar", async ({ page }) => {
  for (const state of ["covered", "ready", "loading", "error", "connect", "paid", "dry", "closed", "modelled", "cold"]) {
    await page.goto(`/preview?state=${state}`);
    const scroll = page.locator("[data-testid=protect-scroll]");
    await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    if (state === "covered") {
      await expect(page.locator(".ln-pay")).toHaveCount(0);
      await expect(page.locator(".ln-covered-row")).toContainText("Covered");
      await expect(page.getByRole("button", { name: "View in Wallet", exact: true })).toBeVisible();
    } else {
      const bar = page.locator(".ln-pay, .ln-not-open").first();
      const clearance = await page.evaluate(() => {
        const content = document.querySelector("[data-testid=protect-scroll]")!;
        const bar = document.querySelector(".ln-pay, .ln-not-open")!;
        const last = content.lastElementChild!;
        return last.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
      });
      await expect(bar).toBeVisible();
      expect(clearance).toBe(true);
    }
    await expect(page.getByText("Your cover", { exact: true })).toHaveCount(state === "covered" ? 1 : 0);
    await expect(page.getByText("Highest in", { exact: false })).toHaveCount(0);
    const tiny = await page.locator(".ln").evaluate((root) => [...root.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent?.trim() && el.getBoundingClientRect().height && Number.parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className));
    expect(tiny).toEqual([]);
  }
});
