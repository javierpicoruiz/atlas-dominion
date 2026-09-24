import { test, expect } from "@playwright/test";
import { HOUR, MINUTE } from "../../src/data/balance";

test("the European campaign exposes all 16 real cities and no seven-day limit on a phone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".campaign-day")).toContainText("∞");
  await page.locator(".map-city-picker summary").click();
  const cities = page.locator(".map-city-picker");
  await expect(cities.getByRole("button")).toHaveCount(16);
  for (const name of [
    "Gijón",
    "Barcelona",
    "Madrid",
    "Paris",
    "Marseille",
    "Roma",
    "Milano",
    "Berlin",
    "Köln",
    "Amsterdam",
    "Maastricht",
    "Brussels",
    "Copenhagen",
    "London",
    "Birmingham",
    "Manchester",
  ])
    await expect(
      cities.getByRole("button", { name, exact: true }),
    ).toBeAttached();
  await cities.getByRole("button", { name: "Gijón", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gijón", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close city details" }).click();
  await page.locator(".map-city-picker summary").click();
  await page.getByRole("button", { name: "Fit campaign" }).click();
  await page.screenshot({ path: "test-results/mobile-europe.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("offline completions generate persistent unread notifications without duplicate alerts", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.goto("/");
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.locator(".map-city-picker summary").click();
  await page
    .locator(".map-city-picker")
    .getByRole("button", { name: "Madrid", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit units", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit Infantry", exact: true })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("1 queued");
  await page.clock.setSystemTime(now + 16 * MINUTE);
  await page.reload();
  await page
    .getByRole("button", { name: "Notifications (1 unread)", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(dialog.getByLabel("Notification history")).toContainText(
    "Madrid: Infantry recruited.",
  );
  await dialog.getByRole("button", { name: "Mark all read" }).click();
  await dialog.getByRole("button", { name: "Close notifications" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifications (0 unread)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications (0 unread)", exact: true })
    .click();
  await expect(
    page.getByLabel("Notification history").getByRole("button"),
  ).toHaveCount(1);
  await page
    .getByRole("dialog", { name: "Notifications", exact: true })
    .getByRole("button", { name: /Madrid: Infantry recruited/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Madrid", exact: true }),
  ).toBeVisible();
});

test("day eight stays playable and the local preview never requests permission automatically", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.addInitScript(() => {
    Object.defineProperty(window, "notificationPermissionCalls", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "default",
    });
    Notification.requestPermission = async () => {
      const tracked = window as unknown as {
        notificationPermissionCalls: number;
      };
      tracked.notificationPermissionCalls++;
      return "denied";
    };
  });
  await page.goto("/");
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.clock.setSystemTime(now + 8 * 24 * HOUR);
  await page.reload();
  await expect(page.locator(".campaign-day")).toHaveText(/DAY \d+ · ∞/);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { notificationPermissionCalls: number })
          .notificationPermissionCalls,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog).toContainText("Device alerts");
  await expect(
    dialog.getByRole("button", { name: "Enable device notifications" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { notificationPermissionCalls: number })
          .notificationPermissionCalls,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Close notifications" }).click();
  await page.locator(".map-city-picker summary").click();
  await page
    .locator(".map-city-picker")
    .getByRole("button", { name: "Madrid", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit units", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit Infantry", exact: true })
    .click();
  await expect(page.getByLabel("City queues")).toContainText("1 queued");
});
