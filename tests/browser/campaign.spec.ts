import { test, expect } from "@playwright/test";

test("mobile campaign supports recruitment, construction, movement and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A foothold in the world." }),
  ).toBeVisible();
  await expect(page.getByLabel("Treasury")).toBeVisible();
  await expect(page.getByTestId("geographic-map")).toHaveAttribute("data-ready", "true");
  await page.screenshot({ path: "test-results/mobile-world.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: /^Haven, The Meridian Union/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Recruit units", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit Infantry", exact: true })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("1 queued");
  await page.getByRole("button", { name: "Buildings", exact: true }).click();
  await page
    .getByRole("button", { name: "Build Arsenal", exact: true })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("2 queued");
  await page.getByRole("button", { name: "Close city details" }).click();
  await page.getByRole("button", { name: "Forces", exact: true }).click();
  await page.getByRole("button", { name: /Move to Ashford/ }).click();
  await page
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await expect(page.getByText("Marching", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /^Haven, The Meridian Union/ })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("2 queued");
  await page.getByRole("button", { name: "Close city details" }).click();
  await page.getByRole("button", { name: "Forces", exact: true }).click();
  await expect(page.getByText("Marching", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("production PWA loads and restores a save offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A foothold in the world." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page
    .getByRole("button", { name: /^Haven, The Meridian Union/ })
    .click();
  await page
    .getByRole("button", { name: "Recruit units", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit Infantry", exact: true })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("1 queued");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A foothold in the world." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Haven, The Meridian Union/ })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("1 queued");
});

test("all navigation panels fit a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  for (const name of ["Forces", "Economy", "Tech", "Diplomacy", "World"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: /^Haven, The Meridian Union/ })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile-city.png" });
});
