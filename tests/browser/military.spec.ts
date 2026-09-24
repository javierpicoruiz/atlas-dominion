import { test, expect, type Page } from "@playwright/test";
import { createTestCampaign } from "../../src/data/testCampaign";
import { HOUR, MINUTE } from "../../src/data/balance";
import type { GameState } from "../../src/types/game";

async function installCampaign(page: Page, state: GameState) {
  await page.goto("/");
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(async (game) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("atlas-dominion");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("campaigns", "readwrite");
      tx.objectStore("campaigns").put({
        id: "latest",
        revision: 100,
        state: game,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
}

test("geographic map supports touch pan, pinch zoom, fit and army selection", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("geographic-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const haven = page.getByRole("button", {
    name: /^Haven, The Meridian Union/,
  });
  const original = (await haven.boundingBox())!;
  const canvas = (await page.locator(".maplibregl-canvas").boundingBox())!;
  const x = canvas.x + canvas.width / 2;
  const y = canvas.y + canvas.height / 2;
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 55, y: y + 35 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => Math.abs((await haven.boundingBox())!.x - original.x))
    .toBeGreaterThan(10);
  await page.getByRole("button", { name: "Fit campaign" }).click();
  const before = (await haven.boundingBox())!;
  const eastBefore = (await page
    .getByRole("button", { name: /^Eastwatch, Eastern/ })
    .boundingBox())!;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 30, y },
      { x: x + 30, y },
    ],
  });
  for (const distance of [40, 55, 75])
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - distance, y },
        { x: x + distance, y },
      ],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => {
      const a = await haven.boundingBox();
      const b = await page
        .getByRole("button", { name: /^Eastwatch, Eastern/ })
        .boundingBox();
      return Math.abs(b!.x - a!.x);
    })
    .toBeGreaterThan(Math.abs(eastBefore.x - before.x) * 1.2);
  await page.getByRole("button", { name: "Fit campaign" }).click();
  await page.getByRole("button", { name: /^Meridian Vanguard,/ }).click();
  await expect(page.getByRole("dialog", { name: "Army orders" })).toBeVisible();
  await page.getByRole("button", { name: /Move to Eastwatch/ }).click();
  await expect(page.getByText(/Travel time:/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("Marching", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close army orders" }).click();
  await expect(
    page.getByRole("button", { name: /^Meridian Vanguard,.*move$/ }),
  ).toBeVisible();
});

test("hostile movement resolves battle and occupation through offline reload", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  const game = createTestCampaign(1234, now);
  game.armies[0].cityId = "ashford";
  game.armies[0].units[0].count = 16;
  await installCampaign(page, game);
  await page.getByRole("button", { name: /^Meridian Vanguard,/ }).click();
  await page.getByRole("button", { name: /Move to Ironridge/ }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("Marching", { exact: true })).toBeVisible();
  await page.clock.setSystemTime(now + 4 * HOUR);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Ironridge, The Meridian Union/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Ironridge, The Meridian Union/ })
    .click();
  await expect(page.getByText(/Occupied since/)).toBeVisible();
  await expect(page.getByText("Integrity / HP")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-captured-city.png" });
  await page.getByRole("button", { name: "Close city details" }).click();
  await page.getByRole("button", { name: "Dismiss catch-up summary" }).click();
  await page.locator(".map-events summary").click();
  await expect(
    page.getByRole("button", { name: /Battle started at Ironridge/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Battle ended at Ironridge/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ironridge captured/ }),
  ).toBeVisible();
});

test("artillery UI persists bombardment and damages a city while away", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  const game = createTestCampaign(1234, now);
  game.armies[0].units = [{ type: "artillery", count: 2 }];
  await installCampaign(page, game);
  await page.getByRole("button", { name: /^Meridian Vanguard,/ }).click();
  await page
    .getByRole("button", { name: "Bombard Eastwatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByRole("dialog").getByText("Bombarding", { exact: true })).toBeVisible();
  await page.clock.setSystemTime(now + 30 * MINUTE);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: /^Eastwatch, Eastern Accord.*under attack/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Eastwatch, Eastern Accord/ })
    .click();
  const integrity = await page
    .getByText("Integrity / HP")
    .locator("..")
    .innerText();
  expect(integrity).not.toContain("400 / 400");
  await page.getByRole("button", { name: "Close city details" }).click();
  await page.getByRole("button", { name: /^Meridian Vanguard,/ }).click();
  await expect(
    page.getByRole("button", { name: "Stop bombardment" }),
  ).toBeVisible();
});

test("offline rebellion updates ownership and shows a visible campaign event", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  const game = createTestCampaign(1234, now - 45 * MINUTE);
  game.armies = [];
  game.cities[0].morale = 1;
  game.cities[0].stability = 0;
  game.factions[0].resources.food = 0;
  game.resourceNodes = [];
  for (const city of game.cities) {
    city.productionPerHour.food = 0;
    city.localStockpile.food = 0;
  }
  await installCampaign(page, game);
  await expect(
    page.getByRole("button", { name: /^Haven, Haven Free State/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Haven Militia,/ }),
  ).toBeVisible();
  await expect(page.locator(".map-events summary")).toContainText(
    "Rebellion in Haven",
  );
});
