import { expect, test, monthlyProtect, type Page } from "./fixtures";

test.use({ viewport: { width: 393, height: 852 } });
const errors = [
  ["sign-declined", "You didn't approve it. Nothing was charged.", "Try again"],
  ["sign-insufficient", "You need 24.00 SKYT and have 12.00 SKYT.", "Close"],
  ["sign-closed", "Sales for this window closed.", "Back to Markets"],
  ["sign-already", "You already have cover for this window.", "View in Wallet"],
  ["sign-cap", "Cover limit reached: 500 SKYT for this market.", "Close"],
  ["sign-unconfirmed", "We couldn't confirm it. Check Wallet before you try again.", "Open Wallet"],
  ["sign-other", "Something went wrong. Check Wallet before you try again.", "Open Wallet"],
] as const;
const sheetStates = ["sign", "sign-progress", "sign-success", ...errors.map(([state]) => state)];
async function primaryCount(page: Page) {
  return page.locator("button").evaluateAll((buttons) => buttons.filter((button) => {
    const css = getComputedStyle(button), rect = button.getBoundingClientRect();
    return rect.width && rect.height && css.visibility !== "hidden" && css.backgroundColor === "rgb(124, 196, 255)";
  }).length);
}
async function noSmallText(page: Page) {
  const tiny = await page.locator(".ln-protect, .ln-modal").evaluateAll((roots) => roots.flatMap((root) => [...root.querySelectorAll("*")])
    .filter((el) => el.getBoundingClientRect().height && el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 13)
    .map((el) => ({ tag: el.tagName, text: el.textContent })));
  expect(tiny).toEqual([]);
}

test("bare Protect selects open Month, including a three-rung backend quote and a closed Week link", async ({ page }) => {
  await monthlyProtect(page);
  await page.goto("/app?tab=protect&city=new-york");
  await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute("data-open", "false");
  await expect(page.locator(".ln-numeral")).toHaveText("102");
  await expect(page.locator(".ln-row")).toHaveCount(3);
  await expect(page.locator(".ln-stage")).toBeVisible();
  await expect(page.locator(".ln-intro, .ln-status, .ln-odds, .ln-rule")).toHaveCount(0);
  expect(await primaryCount(page)).toBe(1);
  const closedStyle = await page.getByRole("button", { name: "Week", exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(closedStyle).toBe("rgb(122, 134, 150)");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.getByText("Rain isn't open for New York this week.", { exact: true })).toBeVisible();
  await expect(page.locator(".ln-stage, .ln-chain, section[aria-label='Ticket']")).toHaveCount(0);
  await page.getByRole("button", { name: "Open Nov 1 to Dec 1 instead", exact: true }).click();
  await expect(page.locator(".ln-numeral")).toHaveText("102");
  await noSmallText(page);
});

test("first paint contains the header and five complete chain rows above the external bar", async ({ page }, info) => {
  await page.goto("/preview?state=ready");
  await expect(page.locator(".ln-row")).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  const boxes = await page.locator(".ln-chain-head, .ln-row").evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height };
  }));
  const bar = (await page.locator(".ln-pay").boundingBox())!;
  const scroll = (await page.locator(".ln-scroll").boundingBox())!;
  for (const box of boxes.slice(0, 6)) { expect(box.top).toBeGreaterThanOrEqual(scroll.y); expect(box.bottom).toBeLessThanOrEqual(bar.y); }
  expect(boxes[0].height).toBe(32);
  boxes.slice(1).forEach((box) => expect(box.height).toBe(56));
  expect((await page.locator(".ln-stage").boundingBox())!.height).toBe(144);
  expect(bar.height).toBe(88);
  expect(await page.locator(".ln-scroll .ln-pay").count()).toBe(0);
  expect(await page.locator(".ln-scroll").evaluate((node) => node.scrollTop)).toBe(0);
  await info.attach("protect-first-paint-393x852", { body: await page.screenshot(), contentType: "image/png" });
  // Text runs are measured, clipped to the viewport and scroll container, then
  // compared. This catches label/figure and column collisions, not just elements.
  const overlaps = await page.locator(".ln-protect").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const boxes: Array<{ text: string; x: number; y: number; right: number; bottom: number }> = [];
    const clip = root.querySelector(".ln-scroll")!.getBoundingClientRect();
    while (walker.nextNode()) {
      const text = walker.currentNode, parent = text.parentElement!;
      if (!text.textContent?.trim() || parent.closest("svg") || parent.closest(".ln-note") || getComputedStyle(parent).visibility === "hidden") continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        const bottom = Math.min(rect.bottom, parent.closest(".ln-scroll") ? clip.bottom : innerHeight);
        if (rect.top >= bottom || rect.bottom <= 0) continue;
        boxes.push({ text: text.textContent, x: rect.left, y: rect.top, right: Math.min(rect.right, clip.right), bottom });
      }
    }
    return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1).map((b) => [a.text, b.text]));
  });
  expect(overlaps).toEqual([]);
});

test("instrument line stops at 96 before the fixed hero numeral and all type is at least 13px", async ({ page }) => {
  for (const state of ["ready", "month", "snow", "wind", "heat", "running"]) {
    await page.goto(`/preview?state=${state}`);
    const geometry = await page.locator(".ln-stage").evaluate((stage) => {
      const svg = stage.querySelector("svg")!;
      const lines = [...svg.querySelectorAll("line[stroke='#F2C230'], rect[fill='#F2C230']")].map((el) => el.getBoundingClientRect().right - stage.getBoundingClientRect().left);
      return { ends: lines, numeral: stage.querySelector(".ln-numeral")!.getBoundingClientRect().left - stage.getBoundingClientRect().left };
    });
    expect(geometry.ends.length, state).toBeGreaterThan(0);
    geometry.ends.forEach((end) => expect(end, state).toBeLessThanOrEqual(96.1));
    expect(geometry.numeral, state).toBeGreaterThanOrEqual(104);
    await noSmallText(page);
    await expect(page.locator(".ln-reading")).toHaveCount(state === "running" ? 1 : 0);
  }
});

test("MODELLED rows are dry Not open entries without any press styling or selection semantics", async ({ page }) => {
  await page.goto("/preview?state=ready");
  const rows = page.locator('.ln-row[data-open="false"]');
  await expect(rows).toHaveCount(5);
  for (const row of await rows.all()) {
    await expect(row).toBeDisabled();
    await expect(row).not.toHaveAttribute("role", "radio");
    await expect(row).not.toHaveAttribute("aria-pressed");
    await expect(row).not.toHaveAttribute("aria-checked");
    await expect(row).not.toHaveClass(/ln-press/);
    await expect(row.locator(":scope > span").last()).toHaveText("Not open");
    const style = await row.evaluate((node) => [...node.children].map((cell) => getComputedStyle(cell).color));
    expect(style.slice(0, -1).every((color) => color === "rgb(122, 134, 150)")).toBe(true);
    expect(style[style.length - 1]).toBe("rgb(169, 180, 194)");
  }
  const columns = await page.locator(".ln-chain-head").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  expect(Number.parseFloat(columns)).toBeGreaterThan(130);
  await expect(rows.first().locator(".ln-chain-trigger")).toHaveCSS("font-size", "15px");
});

for (const state of sheetStates) test(`${state} is one modal sheet with one primary and accessible text`, async ({ page }) => {
  await page.goto(`/preview?state=${state}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("note")).toHaveText("Fixture — preview data");
  expect(await primaryCount(page)).toBe(1);
  await expect(page.locator(".ln-scroll [role='dialog'], .ln-scroll .ln-sign-content")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Protect for/ })).toHaveCount(0);
  await noSmallText(page);
  const action = dialog.locator(".ln-cta");
  await dialog.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  const r = (await action.boundingBox())!;
  expect(r.height).toBe(56); expect(r.y + r.height).toBeLessThanOrEqual(852);
  if (state === "sign-progress") {
    await expect(dialog.locator(".ln-progress li")).toHaveCount(3);
    await expect(action).toBeDisabled();
    await expect(action).toHaveText("Waiting for your wallet");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  }
  const error = errors.find(([id]) => id === state);
  if (error) { await expect(dialog.getByRole("alert")).toHaveText(error[1]); await expect(action).toHaveText(error[2]); }
});

test("page opens Review, freezes the ticket, traps focus, and returns focus after closing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview?state=ready");
  const button = page.getByRole("button", { name: "Protect for 24.00 SKYT", exact: true });
  await expect(button).toBeVisible(); expect(await primaryCount(page)).toBe(1);
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Review your cover" });
  await expect(dialog).toBeVisible(); expect(await primaryCount(page)).toBe(1);
  await expect(dialog).toContainText("-24.00"); await expect(dialog).toContainText("+76.00");
  await expect(dialog.getByRole("button", { name: "Approve in wallet", exact: true })).toBeVisible();
  await expect(page.locator(".ln-page")).toHaveAttribute("inert", "");
  await expect(page.locator(".ln-tabs")).toHaveAttribute("inert", "");
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(button).toBeFocused();
  expect(await primaryCount(page)).toBe(1);
});

test("covered receipt freezes the chain, removes chips and keeps equal figures", async ({ page }) => {
  await page.goto("/preview?state=covered");
  await expect(page.locator(".ln-chips")).toHaveCount(0);
  await expect(page.locator(".ln-row[data-selected='true']")).toContainText("Your cover");
  await expect(page.locator(".ln-row:enabled")).toHaveCount(0);
  await expect(page.locator(".ln-pay")).toHaveCount(0);
  await expect(page.locator(".ln-covered-row")).toContainText("Covered");
  await expect(page.locator(".ln-covered-row")).toHaveCSS("height", "56px");
  await expect(page.locator(".ln-money-cell").first()).toContainText("-24.00");
  await expect(page.locator(".ln-money-cell").last()).toContainText("+76.00");
  await expect(page.getByRole("button", { name: "View in Wallet", exact: true })).toBeVisible();
  await expect(page.locator(".ln-payoff text")).toHaveCount(3);
});

test("closed Week, Cold, loading and connect show the specified panel and bar", async ({ page }) => {
  await page.goto("/preview?state=week-closed");
  await expect(page.locator(".ln-stage, .ln-chain")).toHaveCount(0);
  await page.getByRole("button", { name: "Open Nov 1 to Dec 1 instead", exact: true }).click();
  await expect(page.locator(".ln-numeral")).toHaveText("102");
  await page.goto("/preview?state=cold-not-open");
  await expect(page.locator(".ln-not-open")).toHaveText("Cold isn't open yet.");
  await expect(page.locator(".ln-stage, .ln-chain, .ln-pay")).toHaveCount(0);
  await page.goto("/preview?state=loading");
  await expect(page.locator(".ln-pay")).toContainText("Max loss...");
  await expect(page.locator(".ln-pay")).toContainText("Max gain...SKYT");
  await expect(page.getByRole("button", { name: "Getting your quote" })).toBeDisabled();
  await page.goto("/preview?state=connect");
  await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
  await expect(page.locator(".ln-pay")).toContainText("-24.00");
  await expect(page.locator(".ln-pay")).toContainText("+76.00");
});

test("browser Back closes Review and errors, but keeps pending signing in the sheet", async ({ page }) => {
  await page.goto("/preview?state=sign");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/state=sign$/);
  await expect(page.getByRole("button", { name: "Protect for 24.00 SKYT", exact: true })).toBeVisible();
  await page.goto("/preview?state=sign-progress");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/state=sign-progress$/);
  await page.goto("/preview?state=sign-declined");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("progress advances in place, uses reduced motion text and decline retries Review", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview?state=sign-progress&step=confirm");
  await expect(page.getByRole("dialog").locator('li[data-state="done"]')).toHaveCount(2);
  await expect(page.getByRole("dialog").getByText("Working", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirming on Devnet", exact: true })).toBeDisabled();
  const animations = await page.getByRole("dialog").evaluate((node) => node.getAnimations({ subtree: true }).length);
  expect(animations).toBe(0);
  await page.goto("/preview?state=sign-declined");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review your cover" })).toBeVisible();
  await page.getByRole("button", { name: "Approve in wallet", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Covering" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Waiting for your wallet", exact: true })).toBeDisabled();
});
