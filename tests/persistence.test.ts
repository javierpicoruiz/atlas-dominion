import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SaveConflictError,
  SaveDatabase,
  type SaveRepository,
} from "../src/state/saveStore";
import { parseSaveState } from "../src/state/saveSchema";
import { createGameStore } from "../src/state/gameStore";
import { createTestCampaign } from "../src/data/testCampaign";
import { advanceGameState } from "../src/simulation/advanceTime";
import { applyCommand } from "../src/simulation/commands";
import { HOUR, UNITS } from "../src/data/balance";

const START = 1_800_000_001_234;
const databases: SaveDatabase[] = [];
let serial = 0;
const database = () => {
  const db = new SaveDatabase(`atlas-test-${serial++}`);
  databases.push(db);
  return db;
};
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

it("round-trips the complete save through IndexedDB and catches up after reopening", async () => {
  const db = database();
  let state = createTestCampaign(12, START);
  state = applyCommand(state, {
    kind: "recruit",
    cityId: "haven",
    unit: "infantry",
  });
  state = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  expect(await db.load()).toBeNull();
  expect(await db.save(state, 0)).toBe(1);
  db.close();
  await db.open();
  const restored = await db.load();
  expect(restored).toEqual({ state, revision: 1 });
  expect(advanceGameState(restored!.state, START, START + 2 * HOUR)).toEqual(
    advanceGameState(state, START, START + 2 * HOUR),
  );
});
it("keeps the latest save and rejects stale concurrent writers", async () => {
  const db = database();
  const state = createTestCampaign(12, START);
  await db.save(state, 0);
  const next = advanceGameState(state, START, START + HOUR);
  expect(await db.save(next, 1)).toBe(2);
  await expect(db.save(state, 1)).rejects.toBeInstanceOf(SaveConflictError);
  expect((await db.load())?.state).toEqual(next);
});
it("rejects future versions and corrupt saves without overwriting them", async () => {
  const db = database();
  const state = createTestCampaign(12, START);
  await db.save(state, 0);
  await db.table("campaigns").update("latest", { "state.schemaVersion": 99 });
  await expect(db.load()).rejects.toThrow("Unsupported save schema");
  expect((await db.campaigns.get("latest"))?.state.schemaVersion).toBe(99);
  await db.campaigns.update("latest", {
    "state.schemaVersion": 3,
    "state.cities": [],
  });
  await expect(db.load()).rejects.toThrow("invalid");
});
it("validates finite resources, references, duplicate ids and simulation timestamps", () => {
  const state = createTestCampaign(12, START);
  expect(parseSaveState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  const corruptions = [
    (value: typeof state) => {
      value.factions[0].resources.money = NaN;
    },
    (value: typeof state) => {
      value.cities[0].ownerId = "missing";
    },
    (value: typeof state) => {
      value.routes[0].a = "missing";
    },
    (value: typeof state) => {
      value.armies[0].cityId = null;
    },
    (value: typeof state) => {
      value.cities[1].id = value.cities[0].id;
    },
    (value: typeof state) => {
      value.lastEconomyAt = START + 1;
    },
    (value: typeof state) => {
      value.lastUpdatedAt = START + HOUR;
    },
  ];
  for (const corrupt of corruptions) {
    const copy = structuredClone(state);
    corrupt(copy);
    expect(() => parseSaveState(copy)).toThrow();
  }
});

describe("application orchestration", () => {
  it("autosaves commands, restores on reload and completes orders using the injected clock", async () => {
    const db = database();
    let now = START;
    const store = createGameStore(db, { now: () => now });
    await store.getState().initialize();
    expect(store.getState().status).toBe("ready");
    await store
      .getState()
      .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" });
    expect((await db.load())?.state).toEqual(store.getState().game);
    now += 2 * HOUR;
    const reopened = createGameStore(db, { now: () => now });
    await reopened.getState().initialize();
    expect(reopened.getState().resumedMs).toBe(2 * HOUR);
    expect(reopened.getState().game?.armies[0].units[0].count).toBe(4);
    expect(
      reopened.getState().game?.cities.find((city) => city.id === "madrid")
        ?.queues,
    ).toHaveLength(0);
  });
  it("does not reset a campaign after read failure", async () => {
    const save = vi.fn();
    const store = createGameStore(
      {
        load: async () => {
          throw new Error("Unsupported save schema");
        },
        save,
      },
      { now: () => START },
    );
    await store.getState().initialize();
    expect(store.getState().game).toBeNull();
    expect(store.getState().status).toBe("error");
    expect(save).not.toHaveBeenCalled();
  });
  it("does not report success or charge costs if an autosave fails", async () => {
    const db = database();
    let fail = false;
    const repository: SaveRepository = {
      load: () => db.load(),
      save: (state, revision) =>
        fail
          ? Promise.reject(new Error("Quota exceeded"))
          : db.save(state, revision),
    };
    const store = createGameStore(repository, { now: () => START });
    await store.getState().initialize();
    const before = structuredClone(store.getState().game);
    fail = true;
    await store
      .getState()
      .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" });
    expect(store.getState().game).toEqual(before);
    expect(store.getState().error).toContain("Quota exceeded");
    fail = false;
    await store
      .getState()
      .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" });
    expect(store.getState().game?.factions[0].resources.money).toBe(
      before!.factions[0].resources.money - UNITS.infantry.cost.money,
    );
  });
  it("rejects stale tabs and clamps a rolled-back device clock", async () => {
    const db = database();
    let now = START;
    const first = createGameStore(db, { now: () => now });
    const second = createGameStore(db, { now: () => now });
    await first.getState().initialize();
    await second.getState().initialize();
    await first
      .getState()
      .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" });
    expect(first.getState().status).toBe("error");
    expect(first.getState().error).toContain("another tab");
    now -= HOUR;
    await second.getState().refresh();
    expect(second.getState().game?.lastUpdatedAt).toBe(START);
  });
  it("ignores a second command while the first transaction is pending", async () => {
    const db = database();
    const store = createGameStore(db, { now: () => START });
    await store.getState().initialize();
    await Promise.all([
      store
        .getState()
        .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" }),
      store
        .getState()
        .dispatch({ kind: "recruit", cityId: "madrid", unit: "infantry" }),
    ]);
    expect(
      store.getState().game?.cities.find((city) => city.id === "madrid")
        ?.queues,
    ).toHaveLength(1);
  });
});
