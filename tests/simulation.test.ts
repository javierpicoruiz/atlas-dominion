import { describe, expect, it } from "vitest";
import {
  BALANCE,
  BUILDINGS,
  HOUR,
  MINUTE,
  UNITS,
  bundle,
} from "../src/data/balance";
import { createTestCampaign } from "../src/data/testCampaign";
import { advanceGameState } from "../src/simulation/advanceTime";
import { applyCommand } from "../src/simulation/commands";
import { createRng } from "../src/simulation/rng";
import { cityStockpile, suppliedCityIds } from "../src/simulation/logistics";
import { cityRates } from "../src/simulation/economy";
import { campaignGeoJSON } from "../src/map/mapData";
import type { GameState } from "../src/types/game";

const START = 1_800_000_001_234;
const world = () => createTestCampaign(1234, START);
const advance = (state: GameState, milliseconds: number) =>
  advanceGameState(
    state,
    state.lastUpdatedAt,
    state.lastUpdatedAt + milliseconds,
  );
const player = (state: GameState) =>
  state.factions.find((faction) => faction.id === state.playerFactionId)!;
const recruit = (state: GameState) =>
  applyCommand(state, { kind: "recruit", cityId: "haven", unit: "infantry" });
const count = (state: GameState) =>
  state.armies
    .filter((army) => army.ownerId === "player")
    .flatMap((army) => army.units)
    .reduce((sum, stack) => sum + stack.count, 0);

it("creates exactly six cities, two factions and renderer-independent geographic data", () => {
  const state = world();
  expect(state.cities).toHaveLength(6);
  expect(state.factions.map((faction) => faction.controller)).toEqual([
    "player",
    "ai",
  ]);
  expect(campaignGeoJSON(state).features).toHaveLength(
    6 + state.resourceNodes.length + state.routes.length,
  );
  expect(createTestCampaign(1234, START)).toEqual(state);
  expect(createTestCampaign(1235, START)).not.toEqual(state);
});
it("advancing two hours changes resources deterministically without mutating input", () => {
  const state = world();
  const before = structuredClone(state);
  const next = advance(state, 2 * HOUR);
  expect(next).toEqual(advance(world(), 2 * HOUR));
  expect(player(next).resources.money).toBeGreaterThan(
    player(state).resources.money,
  );
  expect(player(next).resources.food).toBeCloseTo(
    player(state).resources.food + (62 - 31) * 2,
    8,
  );
  expect(player(next).resources.iron).toBeCloseTo(
    player(state).resources.iron + 7 * 2,
    8,
  );
  expect(player(next).resources.oil).toBeCloseTo(
    player(state).resources.oil + 3 * 2,
    8,
  );
  expect(state).toEqual(before);
});
it("a sustained food shortage lowers morale and stability and never creates negative stocks", () => {
  const state = world();
  player(state).resources.food = 0;
  state.resourceNodes = [];
  state.cities.forEach((city) => {
    city.productionPerHour.food = 0;
    city.localStockpile.food = 0;
  });
  const next = advance(state, 3 * HOUR);
  const haven = next.cities[0];
  expect(haven.morale).toBeLessThan(state.cities[0].morale - 20);
  expect(haven.stability).toBeLessThan(state.cities[0].stability);
  expect(haven.shortageMinutes).toBe(180);
  expect(player(next).resources.food).toBe(0);
  player(next).resources.food = 1000;
  const recovered = advance(next, HOUR);
  expect(recovered.cities[0].shortageMinutes).toBe(0);
  expect(recovered.cities[0].morale).toBeGreaterThan(haven.morale);
});
it("supplied cities recover stability and morale stays bounded over a seven-day jump", () => {
  const state = world();
  state.cities[0].morale = 0;
  state.cities[0].stability = 25;
  const next = advance(state, BALANCE.campaignHours * HOUR);
  expect(next.cities[0].stability).toBe(100);
  expect(
    next.cities.every((city) => city.morale >= 0 && city.morale <= 100),
  ).toBe(true);
  expect(
    next.factions
      .flatMap((faction) => Object.values(faction.resources))
      .every((value) => value >= 0 && Number.isFinite(value)),
  ).toBe(true);
});
it("recruitment completes while closed, exactly once at the scheduled timestamp", () => {
  const state = recruit(world());
  expect(count(advance(state, UNITS.infantry.recruitMs - 1))).toBe(3);
  const next = advance(state, 2 * HOUR);
  expect(count(next)).toBe(4);
  expect(next.cities[0].queues).toHaveLength(0);
  expect(
    next.events.find((event) => event.message.includes("recruited"))?.at,
  ).toBe(START + UNITS.infantry.recruitMs);
  expect(count(advance(next, HOUR))).toBe(4);
});
it("serial recruitment queues and parallel construction finish offline", () => {
  let state = recruit(recruit(world()));
  state = applyCommand(state, {
    kind: "build",
    cityId: "haven",
    building: "arsenal",
  });
  const items = state.cities[0].queues;
  expect(items[1].startedAt).toBe(items[0].completesAt);
  expect(items[2].startedAt).toBe(START);
  const next = advance(state, BUILDINGS.arsenal.durationMs);
  expect(count(next)).toBe(5);
  expect(next.cities[0].buildings).toContainEqual({
    type: "arsenal",
    level: 1,
  });
  const artillery = applyCommand(next, {
    kind: "recruit",
    cityId: "haven",
    unit: "artillery",
  });
  const completed = advance(artillery, UNITS.artillery.recruitMs);
  expect(completed.armies[0].units).toContainEqual({
    type: "artillery",
    count: 1,
  });
});
it("barracks upgrade unlocks cavalry after its completion", () => {
  const state = applyCommand(world(), {
    kind: "build",
    cityId: "haven",
    building: "barracks",
  });
  expect(() =>
    applyCommand(state, { kind: "recruit", cityId: "haven", unit: "cavalry" }),
  ).toThrow("Requires Barracks level 2");
  const built = advance(state, BUILDINGS.barracks.durationMs * 2);
  const next = advance(
    applyCommand(built, { kind: "recruit", cityId: "haven", unit: "cavalry" }),
    UNITS.cavalry.recruitMs,
  );
  expect(next.armies[0].units).toContainEqual({ type: "cavalry", count: 1 });
});
it("army movement uses timestamps, slowest-unit speed and route terrain", () => {
  const state = world();
  state.armies[0].units.push({ type: "artillery", count: 1 });
  const ordered = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "greenfield",
  });
  const order = ordered.armies[0].order;
  if (order.kind !== "move") throw new Error("Expected move order");
  const duration = Math.ceil((21 / 18) * HOUR * BALANCE.terrain.forest);
  expect(order.arrivesAt).toBe(START + duration);
  expect(advance(ordered, duration - 1).armies[0].cityId).toBeNull();
  const arrived = advance(ordered, duration);
  expect(arrived.armies[0].cityId).toBe("greenfield");
  expect(arrived.armies[0].order).toEqual({ kind: "hold" });
  expect(arrived.events.at(-1)?.at).toBe(START + duration);
});
it("recruitment at an emptied city creates a new army, without teleporting marching units", () => {
  let state = recruit(world());
  state = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  const next = advance(state, UNITS.infantry.recruitMs);
  expect(next.armies.find((army) => army.id === "vanguard")?.cityId).toBeNull();
  expect(next.armies.find((army) => army.cityId === "haven")?.units).toEqual([
    { type: "infantry", count: 1 },
  ]);
});
it("identical seeds and timestamped command sequences produce identical state", () => {
  const play = () => {
    let state = recruit(world());
    state = advance(state, 17 * MINUTE + 123);
    state = applyCommand(state, {
      kind: "build",
      cityId: "ashford",
      building: "fortifications",
    });
    state = applyCommand(state, {
      kind: "move",
      armyId: "vanguard",
      toId: "greenfield",
    });
    return advance(state, 4 * HOUR);
  };
  expect(play()).toEqual(play());
});
it("arbitrary refresh boundaries and serialized reloads equal one offline jump", () => {
  let state = recruit(world());
  state = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  const target = START + 3 * HOUR + 789;
  const offline = advanceGameState(state, START, target);
  let refreshed = state;
  for (let at = START + 17923; at < target; at += 17923)
    refreshed = advanceGameState(
      JSON.parse(JSON.stringify(refreshed)),
      refreshed.lastUpdatedAt,
      at,
    );
  expect(advanceGameState(refreshed, refreshed.lastUpdatedAt, target)).toEqual(
    offline,
  );
});
it("24-hour catch-up finishes in under one second with no real-time waiting", () => {
  const state = recruit(world());
  const before = performance.now();
  const next = advance(state, 24 * HOUR);
  expect(performance.now() - before).toBeLessThan(1000);
  expect(next.lastUpdatedAt).toBe(START + 24 * HOUR);
  expect(count(next)).toBe(4);
});
it("handles zero elapsed time and rejects invalid clocks", () => {
  const state = world();
  expect(advance(state, 0)).toEqual(state);
  expect(() => advance(state, -1)).toThrow("backwards");
  expect(() => advanceGameState(state, START - 1, START)).toThrow(
    "does not match",
  );
  for (const time of [NaN, Infinity, -1, 1.5])
    expect(() => advanceGameState(state, START, time)).toThrow();
});
it("injects and restores RNG without global randomness", () => {
  const rng = createRng(123);
  rng.next();
  const saved = rng.state();
  expect(createRng(saved).next()).toBe(rng.next());
  const custom = createTestCampaign(999, START, () => ({
    next: () => 0,
    state: () => 42,
  }));
  expect(custom.rngState).toBe(42);
  expect(
    custom.cities.every((city) => city.morale === BALANCE.initialMorale),
  ).toBe(true);
});
it("isolated cities consume local reserves without draining the shared treasury", () => {
  const state = world();
  state.routes = state.routes.filter(
    (route) => route.a !== "greenfield" && route.b !== "greenfield",
  );
  const city = state.cities.find((city) => city.id === "greenfield")!;
  city.productionPerHour = bundle();
  city.localStockpile.food = 0;
  state.resourceNodes = [];
  expect(suppliedCityIds(state).has(city.id)).toBe(false);
  expect(cityStockpile(state, city)).toBe(city.localStockpile);
  const next = advance(state, HOUR);
  expect(
    next.cities.find((entry) => entry.id === city.id)!.shortageMinutes,
  ).toBe(60);
  expect(next.cities[0].shortageMinutes).toBe(0);
  city.buildings.push({ type: "depot", level: 1 });
  expect(suppliedCityIds(state).has(city.id)).toBe(true);
});
it("moving armies continue to consume food and wages", () => {
  const state = world();
  const before = cityRates(state, state.cities[0]);
  const next = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  expect(cityRates(next, next.cities[0])).toEqual(before);
});
describe("command validation", () => {
  it("rejects foreign commands, unaffordable purchases, missing prerequisites and illegal moves without mutation", () => {
    const state = world();
    const before = structuredClone(state);
    expect(() =>
      applyCommand(state, {
        kind: "recruit",
        cityId: "ironridge",
        unit: "infantry",
      }),
    ).toThrow("control");
    expect(() =>
      applyCommand(state, {
        kind: "recruit",
        cityId: "haven",
        unit: "artillery",
      }),
    ).toThrow("Arsenal");
    expect(() =>
      applyCommand(state, {
        kind: "move",
        armyId: "eastern-guard",
        toId: "haven",
      }),
    ).toThrow("control");
    expect(() =>
      applyCommand(state, {
        kind: "move",
        armyId: "vanguard",
        toId: "eastwatch",
      }),
    ).toThrow("friendly");
    expect(() =>
      applyCommand(state, { kind: "move", armyId: "vanguard", toId: "haven" }),
    ).toThrow("route");
    expect(state).toEqual(before);
    player(state).resources.money = 0;
    expect(() => recruit(state)).toThrow("Not enough money");
  });
  it("charges costs once, limits queues and prevents duplicate buildings and movement orders", () => {
    const state = world();
    const ordered = recruit(state);
    expect(player(ordered).resources.money).toBe(
      player(state).resources.money - UNITS.infantry.cost.money,
    );
    expect(() => recruit(recruit(recruit(recruit(recruit(state)))))).toThrow(
      "full",
    );
    const building = applyCommand(state, {
      kind: "build",
      cityId: "haven",
      building: "depot",
    });
    expect(() =>
      applyCommand(building, {
        kind: "build",
        cityId: "haven",
        building: "depot",
      }),
    ).toThrow("already queued");
    const built = advance(building, HOUR);
    expect(() =>
      applyCommand(built, {
        kind: "build",
        cityId: "haven",
        building: "depot",
      }),
    ).toThrow("maximum");
    const moving = applyCommand(state, {
      kind: "move",
      armyId: "vanguard",
      toId: "ashford",
    });
    expect(() =>
      applyCommand(moving, {
        kind: "move",
        armyId: "vanguard",
        toId: "greenfield",
      }),
    ).toThrow("already moving");
  });
});
