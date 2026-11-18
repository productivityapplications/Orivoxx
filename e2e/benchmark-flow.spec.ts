import { expect, test } from "@playwright/test";

async function submitFake(page: import("@playwright/test").Page, variant: "Compliant" | "Regressed") {
  await page.goto("/submit");
  await expect(page.getByRole("heading", { name: "Submit a run" })).toBeVisible();
  await page.getByText(variant, { exact: true }).click();
  await page.getByRole("button", { name: /Run fake baseline/i }).click();
  await page.waitForURL(/\/results\/res_/, { timeout: 30_000 });

  return page.url().split("/results/")[1] ?? "";
}

test("submit -> run -> score -> leaderboard", async ({ page }) => {
  const resultId = await submitFake(page, "Compliant");

  expect(resultId).toMatch(/^res_[a-z0-9]{10,40}$/);
  await expect(page.getByRole("heading", { name: /TaskBoard/ })).toBeVisible();
  await expect(page.getByText("99.5").first()).toBeVisible();
  await expect(page.getByText(/9 passed/i)).toBeVisible();
  await expect(page.getByText("Produced-code diff")).toBeVisible();
  await expect(page.getByText(/No model call contributed/i)).toBeVisible();

  const firstRequirement = page.getByRole("button", {
    name: /Project access must be owner-scoped/,
  });

  await expect(firstRequirement).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/matched the produced repository/i).first()).toBeVisible();

  await page.goto("/leaderboard?kind=all");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator(`a[href="/results/${resultId}"]`)).toHaveCount(1);
  await expect(page.getByText("Fake fixture (taskboard/compliant)").first()).toBeVisible();
});

test("regressed fixture is capped and the cap is visible", async ({ page }) => {
  await submitFake(page, "Regressed");

  await expect(page.getByText("59.9").first()).toBeVisible();
  await expect(page.getByText(/Critical spec failure/i).first()).toBeVisible();
  await expect(page.getByText(/A critical failure limited the overall score/i)).toBeVisible();
  await expect(page.getByText(/2 failed/i)).toBeVisible();
});

test("requirement rows toggle with the keyboard", async ({ page }) => {
  await submitFake(page, "Compliant");

  const second = page.getByRole("button", { name: /No shell execution dependency/ });

  await second.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(second).toHaveAttribute("aria-expanded", "false");
});

test("unknown result is a 404 with a way back", async ({ page }) => {
  const response = await page.goto("/results/res_0000000000000000000000000000ff");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("That page does not exist.")).toBeVisible();
  await expect(
    page.locator("#main").getByRole("link", { name: "Leaderboard" }),
  ).toBeVisible();
});

test("every screen is dark and stays inside the viewport", async ({ page }) => {
  for (const path of ["/", "/app", "/benchmarks", "/leaderboard", "/compare", "/submit", "/docs"]) {
    await page.goto(path);

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(background, path).toBe("rgb(11, 11, 9)");
    expect(overflow, path).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();

  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(mobileOverflow).toBeLessThanOrEqual(1);
});
