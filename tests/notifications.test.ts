import { afterEach, expect, it, vi } from "vitest";
import { createEuropeCampaign } from "../src/data/europeCampaign";
import { advanceGameState } from "../src/simulation/advanceTime";
import { applyCommand } from "../src/simulation/commands";
import { HOUR } from "../src/data/balance";
import { recordEvent } from "../src/simulation/events";
import {
  EMPTY_INBOX,
  notificationSummary,
  updateInbox,
} from "../src/notifications/inbox";
import { createNotificationStore } from "../src/state/notificationStore";
import {
  deviceNotificationProblem,
  enableDeviceNotifications,
  showDeviceNotifications,
} from "../src/notifications/device";

const START = 1_800_000_001_234;
const world = () => createEuropeCampaign(1234, START);
afterEach(() => vi.unstubAllGlobals());
it("notifies completed recruitment and construction, excludes orders and other factions", () => {
  let game = applyCommand(world(), {
    kind: "recruit",
    cityId: "madrid",
    unit: "infantry",
  });
  game = applyCommand(game, {
    kind: "build",
    cityId: "madrid",
    building: "depot",
  });
  game = applyCommand(
    game,
    { kind: "recruit", cityId: "paris", unit: "infantry" },
    "ai",
  );
  game = advanceGameState(game, START, START + HOUR);
  const result = updateInbox(EMPTY_INBOX, game);
  expect(result.added.map((event) => event.kind)).toEqual([
    "recruitment",
    "construction",
  ]);
  expect(result.added.every((event) => event.cityId === "madrid")).toBe(true);
  expect(updateInbox(result.inbox, game).added).toEqual([]);
});
it("notifies lost cities using event-time ownership", () => {
  const game = world();
  const city = game.cities.find((city) => city.id === "madrid")!;
  city.ownerId = "ai";
  recordEvent(game, START, "Madrid captured", "capture", city.id, [
    "player",
    "ai",
  ]);
  expect(updateInbox(EMPTY_INBOX, game).added).toHaveLength(1);
});
it("persists read state and deduplicates after reload, without mixing new campaigns", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const game = world();
  recordEvent(game, START, "Madrid in danger", "unrest", "madrid");
  const first = createNotificationStore(storage);
  first.getState().ingest(game);
  first.getState().markRead();
  first.getState().setEnabled(true);
  const reopened = createNotificationStore(storage);
  expect(reopened.getState().ingest(game)).toEqual([]);
  expect(reopened.getState().inbox.notices[0].read).toBe(true);
  expect(reopened.getState().enabled).toBe(true);
  reopened.getState().ingest(createEuropeCampaign(1234, START + HOUR));
  expect(reopened.getState().inbox.notices).toEqual([]);
});
it("groups offline updates into one summary, prioritising urgent unrest", () => {
  const game = world();
  recordEvent(game, START, "Rebellion imminent", "unrest", "madrid");
  recordEvent(game, START, "Infantry ready", "recruitment", "madrid");
  expect(notificationSummary(game.events)).toMatchObject({
    title: "Atlas Dominion · 2 updates",
    body: "Rebellion imminent (+1 more in Notifications)",
  });
});
it("notification storage failures cannot interrupt play", () => {
  const store = createNotificationStore({
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  });
  expect(() => store.getState().ingest(world())).not.toThrow();
});
it("device permission is explicit, secure-context gated and denial handled", async () => {
  const requestPermission = vi.fn(async () => "denied");
  vi.stubGlobal("window", { isSecureContext: false, Notification: {} });
  vi.stubGlobal("Notification", { permission: "default", requestPermission });
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn() } });
  expect(deviceNotificationProblem()).toContain("HTTPS");
  await expect(enableDeviceNotifications()).rejects.toThrow("HTTPS");
  expect(requestPermission).not.toHaveBeenCalled();
  vi.stubGlobal("window", { isSecureContext: true, Notification: {} });
  await expect(enableDeviceNotifications()).rejects.toThrow("not granted");
  expect(requestPermission).toHaveBeenCalledOnce();
});
it("uses mobile-compatible service-worker notifications and does not request permission on delivery", async () => {
  const showNotification = vi.fn(async () => undefined);
  const requestPermission = vi.fn();
  vi.stubGlobal("window", { isSecureContext: true, Notification: {} });
  vi.stubGlobal("Notification", { permission: "granted", requestPermission });
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistration: async () => ({ showNotification }) },
  });
  vi.stubGlobal("document", { baseURI: "https://example.com/atlas/" });
  const game = world();
  recordEvent(game, START, "Army arrived", "arrival", "madrid");
  await showDeviceNotifications(game.events);
  expect(showNotification).toHaveBeenCalledWith(
    "Atlas Dominion",
    expect.objectContaining({
      body: "Army arrived",
      icon: "https://example.com/atlas/icons/soldier-cucumber-192.png",
      data: { cityId: "madrid" },
    }),
  );
  expect(requestPermission).not.toHaveBeenCalled();
});
