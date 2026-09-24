import { describe, expect, it } from "vitest";
import { BALANCE, HOUR, MINUTE } from "../src/data/balance";
import { createTestCampaign } from "../src/data/testCampaign";
import { advanceGameState } from "../src/simulation/advanceTime";
import { applyCommand } from "../src/simulation/commands";
import { armyVisualPosition } from "../src/map/mapData";
import { parseSaveState } from "../src/state/saveSchema";
import { armyIsSupplied, suppliedCityIds } from "../src/simulation/logistics";
import { combatFactor, unitCount } from "../src/simulation/combat";
import type { GameState } from "../src/types/game";

const START = 1_800_000_001_234;
const world = () => createTestCampaign(1234, START);
const advance = (state: GameState, ms: number) =>
  advanceGameState(state, state.lastUpdatedAt, state.lastUpdatedAt + ms);
const battle = (attackers = 8, defenders = 3) => {
  const state = world();
  state.armies[0].cityId = "ironridge";
  state.armies[0].units[0].count = attackers;
  state.armies[1].units[0].count = defenders;
  return state;
};
const guns = () => {
  const state = world();
  state.armies[0].units = [{ type: "artillery", count: 2 }];
  return state;
};
const bombard = (state = guns(), targetArmyId?: string) =>
  applyCommand(state, {
    kind: "bombard",
    armyId: "vanguard",
    targetCityId: "eastwatch",
    targetArmyId,
  });
const unrest = () => {
  const state = world();
  state.armies = [];
  const city = state.cities[0];
  city.morale = 1;
  city.stability = 0;
  state.factions[0].resources.food = 0;
  state.resourceNodes = [];
  for (const c of state.cities) {
    c.productionPerHour.food = 0;
    c.localStockpile.food = 0;
  }
  return state;
};

it("interpolates army positions from timestamps, clamps both ends and never mutates state", () => {
  const state = applyCommand(world(), {
    kind: "move",
    armyId: "vanguard",
    toId: "eastwatch",
  });
  const before = structuredClone(state);
  const army = state.armies[0];
  if (army.order.kind !== "move") throw new Error("Expected move");
  const from = state.cities[0];
  const to = state.cities.find((city) => city.id === "eastwatch")!;
  const middle = armyVisualPosition(
    state,
    army,
    (army.order.departedAt + army.order.arrivesAt) / 2,
  );
  expect(middle.lon).toBeCloseTo((from.lon + to.lon) / 2);
  expect(middle.lat).toBeCloseTo((from.lat + to.lat) / 2);
  expect(armyVisualPosition(state, army, START - HOUR).lon).toBe(from.lon);
  expect(armyVisualPosition(state, army, START + 10 * HOUR).lon).toBe(to.lon);
  expect(state).toEqual(before);
});
it("combat is seeded, deterministic, simultaneous and resolves over multiple rounds", () => {
  const state = battle();
  const early = advance(state, BALANCE.combat.intervalMs - 1);
  expect(early.armies.map(unitCount)).toEqual([8, 3]);
  expect(early.battles).toHaveLength(1);
  const round = advance(state, BALANCE.combat.intervalMs);
  expect(round.armies.every((army) => army.damage > 0)).toBe(true);
  expect(round).toEqual(advance(battle(), BALANCE.combat.intervalMs));
  const reverse = structuredClone(state);
  reverse.armies.reverse();
  expect(
    advance(reverse, BALANCE.combat.intervalMs)
      .armies.slice()
      .sort((a, b) => a.id.localeCompare(b.id)),
  ).toEqual(round.armies.slice().sort((a, b) => a.id.localeCompare(b.id)));
  expect(state.armies.every((army) => army.damage === 0)).toBe(true);
});
it("stronger equivalent forces generally win despite defending-city advantage", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = battle(16, 3);
    state.rngState = seed;
    const next = advance(state, 2 * HOUR);
    expect(next.armies.some((army) => army.id === "eastern-guard")).toBe(false);
    expect(next.armies.some((army) => army.id === "vanguard")).toBe(true);
    expect(next.events.some((event) => event.kind === "battle-end")).toBe(true);
  }
});
it("morale and supply reduce effective combat strength", () => {
  const state = world();
  const army = state.armies[0];
  const supplied = combatFactor(state, army);
  army.morale /= 2;
  expect(combatFactor(state, army)).toBeCloseTo(supplied / 2);
  army.cityId = "ironridge";
  expect(armyIsSupplied(state, army)).toBe(true);
  state.routes = [];
  expect(combatFactor(state, army)).toBeCloseTo(
    (supplied / 2) * BALANCE.combat.unsuppliedFactor,
  );
});
it("fortifications and intact city defences reduce defender damage", () => {
  const plain = battle();
  const fortified = structuredClone(plain);
  fortified.cities
    .find((city) => city.id === "ironridge")!
    .buildings.push({ type: "fortifications", level: 2 });
  expect(
    advance(fortified, BALANCE.combat.intervalMs).armies[1].damage,
  ).toBeLessThan(advance(plain, BALANCE.combat.intervalMs).armies[1].damage);
});
it("artillery damages integrity on cooldown, preserves buildings, and never captures by bombardment", () => {
  const state = bombard();
  const target = state.cities.find((city) => city.id === "eastwatch")!;
  expect(
    advance(state, BALANCE.artillery.cooldownMs - 1).cities.find(
      (city) => city.id === target.id,
    )!.integrity,
  ).toBe(target.integrity);
  const next = advance(state, HOUR);
  const city = next.cities.find((entry) => entry.id === target.id)!;
  expect(city.integrity).toBeLessThan(target.integrity);
  expect(city.ownerId).toBe("ai");
  expect(city.buildings).toEqual(target.buildings);
  expect(
    next.events.filter((event) => event.kind === "bombardment"),
  ).toHaveLength(1);
});
it("artillery can target enemy field forces, and stops after their destruction", () => {
  const state = guns();
  state.armies[1].cityId = "eastwatch";
  const ordered = bombard(state, "eastern-guard");
  const next = advance(ordered, 2 * HOUR);
  expect(next.armies.some((army) => army.id === "eastern-guard")).toBe(false);
  expect(next.armies[0].order.kind).toBe("hold");
  expect(parseSaveState(next)).toEqual(next);
});
it("moving cancels bombardment, and unsupplied guns cannot fire", () => {
  const state = bombard();
  const moving = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  expect(advance(moving, 10 * MINUTE).cities[4].integrity).toBe(
    state.cities[4].integrity,
  );
  const isolated = guns();
  isolated.armies[0].cityId = "greenfield";
  isolated.routes = isolated.routes.filter(
    (route) => route.id !== "haven-greenfield",
  );
  expect(() =>
    applyCommand(isolated, {
      kind: "bombard",
      armyId: "vanguard",
      targetCityId: "sunmere",
    }),
  ).toThrow("supply");
  const paused = bombard();
  paused.cities[0].ownerId = "ai";
  paused.routes = paused.routes.filter(
    (route) => route.id === "haven-eastwatch",
  );
  expect(advance(paused, 10 * MINUTE).cities[4].integrity).toBe(
    paused.cities[4].integrity,
  );
});
it("bombardment validates ownership, range and adjacency", () => {
  expect(() => bombard(world())).toThrow("artillery");
  expect(() =>
    applyCommand(guns(), {
      kind: "bombard",
      armyId: "vanguard",
      targetCityId: "ironridge",
    }),
  ).toThrow("connected");
  const far = guns();
  far.routes.find((route) => route.id === "haven-eastwatch")!.distanceKm = 151;
  expect(() => bombard(far)).toThrow("range");
  expect(() =>
    applyCommand(guns(), {
      kind: "bombard",
      armyId: "eastern-guard",
      targetCityId: "haven",
    }),
  ).toThrow("control");
});
it("artillery is slower and vulnerable to direct combat, and cannot capture by occupation", () => {
  const state = guns();
  const foot = applyCommand(world(), {
    kind: "move",
    armyId: "vanguard",
    toId: "eastwatch",
  }).armies[0].order;
  const slow = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "eastwatch",
  }).armies[0].order;
  if (foot.kind !== "move" || slow.kind !== "move")
    throw new Error("Expected moves");
  expect(slow.arrivesAt).toBeGreaterThan(foot.arrivesAt);
  state.armies[0].cityId = "eastwatch";
  expect(advance(state, HOUR).cities[4].ownerId).toBe("ai");
  state.armies[1].cityId = "eastwatch";
  expect(
    advance(state, HOUR).armies.some((army) => army.id === "vanguard"),
  ).toBe(false);
});
it("direct forces must defeat defenders before a timed capture, which preserves damage and buildings", () => {
  const state = battle(16, 3);
  const city = state.cities.find((entry) => entry.id === "ironridge")!;
  city.integrity = 300;
  city.buildings.push({ type: "university", level: 1 });
  const early = advance(state, MINUTE);
  expect(
    early.cities.find((entry) => entry.id === city.id)!.capture,
  ).toBeNull();
  let next = early;
  while (next.armies.some((army) => army.ownerId === "ai"))
    next = advance(next, MINUTE);
  const capture = next.cities.find((entry) => entry.id === city.id)!.capture!;
  expect(capture).not.toBeNull();
  next = advanceGameState(next, next.lastUpdatedAt, capture.completesAt - 1);
  expect(next.cities.find((entry) => entry.id === city.id)!.ownerId).toBe("ai");
  next = advance(next, 1);
  const captured = next.cities.find((entry) => entry.id === city.id)!;
  expect(captured.ownerId).toBe("player");
  expect(captured.stability).toBe(BALANCE.capture.stability);
  expect(captured.morale).toBeLessThanOrEqual(BALANCE.capture.morale);
  expect(captured.occupiedAt).toBe(capture.completesAt);
  expect(captured.integrity).toBe(300);
  expect(captured.buildings).toEqual(city.buildings);
  expect(
    next.resourceNodes.find((node) => node.cityId === city.id)!.ownerId,
  ).toBe("player");
  expect(suppliedCityIds(next).has(city.id)).toBe(true);
  expect(parseSaveState(next)).toEqual(next);
});
it("reinforcements interrupt capture and retreat cancels occupation", () => {
  const state = world();
  state.armies[0].cityId = "eastwatch";
  const capturing = advance(state, MINUTE);
  expect(capturing.cities[4].capture).not.toBeNull();
  const retreat = applyCommand(capturing, {
    kind: "move",
    armyId: "vanguard",
    toId: "haven",
  });
  expect(retreat.cities[4].capture).toBeNull();
  capturing.armies[1].cityId = "eastwatch";
  expect(advance(capturing, MINUTE).cities[4].capture).toBeNull();
});
it("45 continuous minutes below 20 cause rebellion exactly at the deadline with population militia", () => {
  const state = unrest();
  const before = advance(state, BALANCE.rebellion.durationMs - 1);
  expect(before.cities[0].ownerId).toBe("player");
  const next = advance(before, 1);
  const city = next.cities[0];
  expect(city.ownerId).toBe("rebels-haven");
  expect(next.factions.some((faction) => faction.id === city.ownerId)).toBe(
    true,
  );
  expect(next.armies.find((army) => army.cityId === city.id)!.units).toEqual([
    {
      type: "infantry",
      count: Math.ceil(city.populationM * BALANCE.rebellion.infantryPerMillion),
    },
  ]);
  expect(city.criticalSince).toBeNull();
  expect(city.capture).toBeNull();
  expect(city.occupiedAt).toBeNull();
  expect(city.buildings).toEqual(state.cities[0].buildings);
  expect(city.localStockpile).toEqual(state.cities[0].localStockpile);
  expect(next.events.some((event) => event.kind === "unrest")).toBe(true);
  expect(next.events.find((event) => event.kind === "rebellion")!.at).toBe(
    START + BALANCE.rebellion.durationMs,
  );
  expect(parseSaveState(next)).toEqual(next);
});
it("morale recovery to exactly 20 cancels the countdown; a new fall starts a fresh 45 minutes", () => {
  let state = advance(unrest(), 44 * MINUTE);
  state.cities[0].morale = 20;
  state = advance(state, 0);
  expect(state.cities[0].criticalSince).toBeNull();
  state.cities[0].morale = 1;
  const next = advance(state, 2 * MINUTE);
  expect(next.cities[0].ownerId).toBe("player");
  expect(next.cities[0].criticalSince).toBe(state.lastUpdatedAt);
});
it("food-driven morale recovery cancels unrest before rebellion", () => {
  const state = world();
  state.cities[0].morale = 19;
  const next = advance(state, 45 * MINUTE);
  expect(next.cities[0].ownerId).toBe("player");
  expect(next.cities[0].morale).toBeGreaterThan(20);
  expect(next.cities[0].criticalSince).toBeNull();
});
describe("offline military replay and save compatibility", () => {
  for (const [name, fixture] of [
    ["battle and capture", () => battle(16, 3)],
    ["bombardment", () => bombard()],
    ["rebellion", unrest],
  ] as const) {
    it(`${name} across arbitrary serialized refreshes equals one offline jump`, () => {
      const state = fixture();
      const end = START + 3 * HOUR + 457;
      const offline = advanceGameState(state, START, end);
      let live = state;
      for (let at = START + 47123; at < end; at += 47123)
        live = parseSaveState(advanceGameState(live, live.lastUpdatedAt, at));
      expect(advanceGameState(live, live.lastUpdatedAt, end)).toEqual(offline);
    });
  }
  it("explicitly migrates foundation saves without losing orders or balances", () => {
    const original = applyCommand(world(), {
      kind: "move",
      armyId: "vanguard",
      toId: "ashford",
    });
    const legacy = JSON.parse(JSON.stringify(original));
    legacy.schemaVersion = 1;
    delete legacy.battles;
    for (const city of legacy.cities)
      for (const key of [
        "class",
        "integrity",
        "maxIntegrity",
        "criticalSince",
        "occupiedAt",
        "capture",
      ])
        delete city[key];
    for (const army of legacy.armies) {
      delete army.morale;
      delete army.damage;
    }
    for (const event of legacy.events) {
      delete event.kind;
      delete event.cityId;
    }
    expect(parseSaveState(legacy)).toEqual(original);
  });
  it("rejects corrupt military state", () => {
    const state = advance(battle(), MINUTE);
    state.battles[0].nextRoundAt = START;
    expect(() => parseSaveState(state)).toThrow("inconsistent");
  });
});
