import { expect, test } from "@playwright/test";

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
