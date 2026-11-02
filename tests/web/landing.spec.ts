import { test, expect } from "@playwright/test";

test("the real waitlist API rejects invalid email without a storage write", async ({
  request,
}) => {
  const response = await request.post("/api/waitlist", {
    data: { email: "not-an-email", company: "" },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: "INVALID_EMAIL" });
});

test("hero validates, prevents duplicate submits, and preserves attribution", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/waitlist", async (route) => {
    requests += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      email: "reader@example.com",
      company: "",
      source: "landing",
      utmSource: "launch",
      utmMedium: "social",
      utmCampaign: "us-first",
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ json: { ok: true, status: "subscribed" } });
  });
  await page.goto(
    "/?utm_source=launch&utm_medium=social&utm_campaign=us-first",
  );
  const form = page.getByRole("form", { name: "Join the SkyHedge waitlist" });
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Enter a valid email address.",
  );
  await expect(
    form.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(requests).toBe(0);
  await form
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(" reader@example.com ");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("button", { name: "Joining…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "You're on the waitlist",
  );
  expect(requests).toBe(1);
});

test("footer handles backend errors, retry, and already subscribed", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/waitlist", async (route) => {
    requests += 1;
    await route.fulfill(
      requests === 1
        ? {
            status: 503,
            json: {
              error: "WAITLIST_UNAVAILABLE",
              message:
                "Waitlist signup is temporarily unavailable. Try again soon.",
            },
          }
        : { json: { ok: true, status: "already_subscribed" } },
    );
  });
  await page.goto("/");
  const form = page.getByRole("form", { name: "Get SkyHedge launch updates" });
  await form
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("existing@example.com");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    form.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveValue("existing@example.com");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.locator("#join").getByRole("status")).toContainText(
    "Already on the list",
  );
  expect(requests).toBe(2);
});

test("a non-API response never produces a false signup success", async ({
  page,
}) => {
  await page.route("**/api/waitlist", (route) =>
    route.fulfill({ json: { ok: false } }),
  );
  await page.goto("/");
  const form = page.getByRole("form", { name: "Join the SkyHedge waitlist" });
  await form
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("reader@example.com");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Could not join the waitlist. Try again.",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("walkthrough works with keyboard and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "Watch demo" }).click();
  await expect(page).toHaveURL(/#demo$/);
  const first = page.getByRole("tab", { name: /01 Choose/ });
  await first.focus();
  await page.keyboard.press("ArrowDown");
  const second = page.getByRole("tab", { name: /02 Protect/ });
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByRole("img")).toHaveAttribute(
    "src",
    "/mockups/landing/protect.webp",
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /03 Collect/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page
      .locator(".hero-phone")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("walkthrough playback advances and stops at the final screen", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Play walkthrough" }).click();
  await page.clock.fastForward(5100);
  await expect(page.getByRole("tab", { name: /02 Protect/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.clock.fastForward(5100);
  await expect(page.getByRole("tab", { name: /03 Collect/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.clock.fastForward(5100);
  await expect(
    page.getByRole("button", { name: "Play walkthrough" }),
  ).toBeVisible();
});

test("layout and real screen assets work across phone, tablet and desktop sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}px`,
    ).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".hero-phone img")).toBeVisible();
    expect(
      await page
        .locator(".hero-phone img")
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
