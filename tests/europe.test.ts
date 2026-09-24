import { expect, it } from "vitest";
import {
  createEuropeCampaign,
  EUROPE_CITIES,
} from "../src/data/europeCampaign";
import { createTestCampaign } from "../src/data/testCampaign";
import { HOUR, UNITS } from "../src/data/balance";
import { advanceGameState } from "../src/simulation/advanceTime";
import { applyCommand } from "../src/simulation/commands";
import { suppliedCityIds } from "../src/simulation/logistics";
import {
  distanceKm,
  pathDistanceKm,
  routePath,
} from "../src/simulation/geography";
import { armyVisualPosition, campaignGeoJSON } from "../src/map/mapData";
import { parseSaveState } from "../src/state/saveSchema";
import { cityClusters } from "../src/map/cityClusters";

const START = 1_800_000_001_234;
const world = () => createEuropeCampaign(1234, START);
it("creates exactly the requested real cities, at their sourced coordinates", () => {
  const state = world();
  expect(state.cities.map((city) => city.name)).toEqual([
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
  ]);
  expect(state.cities.find((city) => city.id === "gijon")).toMatchObject({
    lat: 43.53573,
    lon: -5.66152,
  });
  expect(state.cities.find((city) => city.id === "london")).toMatchObject({
    lat: 51.50853,
    lon: -0.12574,
  });
  for (const source of EUROPE_CITIES)
    expect(state.cities.find((city) => city.id === source.id)).toMatchObject({
      lat: source.lat,
      lon: source.lon,
    });
  expect(
    campaignGeoJSON(state).features.filter(
      (feature) => feature.properties.kind === "city",
    ),
  ).toHaveLength(16);
  expect(parseSaveState(state)).toEqual(state);
  expect(world()).toEqual(state);
});
it("connects all 16 cities with geographic corridors and supplies all starting cities", () => {
  const state = world();
  const connected = new Set([state.cities[0].id]);
  for (let i = 0; i < state.cities.length; i++)
    for (const route of state.routes) {
      if (connected.has(route.a)) connected.add(route.b);
      if (connected.has(route.b)) connected.add(route.a);
      expect(route.distanceKm).toBe(
        Math.ceil(pathDistanceKm(routePath(state, route))),
      );
    }
  expect(connected.size).toBe(16);
  expect(suppliedCityIds(state).size).toBe(16);
  const channel = state.routes.find((route) => route.id === "paris-london")!;
  expect(channel.label).toBe("Channel Tunnel");
  expect(channel.waypoints).toHaveLength(2);
  expect(channel.distanceKm).toBeGreaterThan(
    distanceKm(
      state.cities.find((city) => city.id === "paris")!,
      state.cities.find((city) => city.id === "london")!,
    ),
  );
});
it("geographic travel uses original speeds and interpolates in both directions along a corridor", () => {
  const state = world();
  const orderState = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "barcelona",
  });
  const army = orderState.armies[0];
  const order = army.order;
  if (order.kind !== "move") throw new Error("Expected move");
  const route = state.routes.find((route) => route.id === order.routeId)!;
  expect(order.arrivesAt - order.departedAt).toBe(
    Math.ceil((route.distanceKm / UNITS.infantry.speedKph) * HOUR),
  );
  expect(order.arrivesAt - order.departedAt).toBeGreaterThan(10 * HOUR);
  const path = routePath(state, route);
  const fraction = distanceKm(path[0], path[1]) / pathDistanceKm(path);
  const point = armyVisualPosition(
    orderState,
    army,
    order.departedAt + (order.arrivesAt - order.departedAt) * fraction,
  );
  expect(point.lat).toBeCloseTo(path[1].lat, 5);
  expect(point.lon).toBeCloseTo(path[1].lon, 5);
  state.armies[0].cityId = "barcelona";
  const reversed = applyCommand(state, {
    kind: "move",
    armyId: "vanguard",
    toId: "madrid",
  });
  const reverseOrder = reversed.armies[0].order;
  if (reverseOrder.kind !== "move") throw new Error("Expected move");
  expect(armyVisualPosition(reversed, reversed.armies[0], START).lon).toBe(
    path.at(-1)!.lon,
  );
  expect(
    armyVisualPosition(reversed, reversed.armies[0], reverseOrder.arrivesAt)
      .lon,
  ).toBeCloseTo(path[0].lon);
});
it(
  "a month offline has no campaign cutoff, and new recruitment still completes normally",
  () => {
    let state = world();
    state = advanceGameState(state, START, START + 30 * 24 * HOUR);
    expect(state.lastUpdatedAt).toBe(START + 30 * 24 * HOUR);
    const before = state.armies[0].units[0].count;
    state = applyCommand(state, {
      kind: "recruit",
      cityId: "madrid",
      unit: "infantry",
    });
    expect(
      state.cities.find((city) => city.id === "madrid")!.queues[0].completesAt -
        state.lastUpdatedAt,
    ).toBe(UNITS.infantry.recruitMs);
    state = advanceGameState(
      state,
      state.lastUpdatedAt,
      state.lastUpdatedAt + UNITS.infantry.recruitMs,
    );
    expect(state.armies[0].units[0].count).toBe(before + 1);
    expect(parseSaveState(state)).toEqual(state);
  },
  20_000,
);
it("schema 2 migration preserves queues, capture, armies, damage, resources and control", () => {
  let old = createTestCampaign(1234, START);
  old = applyCommand(old, {
    kind: "recruit",
    cityId: "haven",
    unit: "infantry",
  });
  old = applyCommand(old, {
    kind: "move",
    armyId: "vanguard",
    toId: "ashford",
  });
  old.cities[0].integrity = 321;
  old.cities[0].stability = 29;
  old.cities[4].capture = {
    factionId: "player",
    startedAt: START,
    completesAt: START + HOUR,
  };
  old.armies[1].damage = 13;
  const next = parseSaveState({ ...old, schemaVersion: 2 });
  expect(next.cities).toHaveLength(16);
  expect(next.cities.find((city) => city.id === "madrid")).toMatchObject({
    integrity: 321,
    stability: 29,
    queues: old.cities[0].queues,
  });
  expect(next.cities.find((city) => city.id === "marseille")!.capture).toEqual(
    old.cities[4].capture,
  );
  expect(next.armies[1].damage).toBe(13);
  expect(next.resourceNodes[0].cityId).toBe("barcelona");
  expect(next.factions[0].resources).toEqual(old.factions[0].resources);
  expect(next.rngState).toBe(old.rngState);
  expect(next.armies[0].order).toEqual({
    ...old.armies[0].order,
    fromId: "madrid",
    toId: "gijon",
    routeId: "madrid-gijon",
  });
  expect(parseSaveState(next)).toEqual(next);
});
it("European offline replay equals arbitrarily split advancement", () => {
  const state = applyCommand(world(), {
    kind: "move",
    armyId: "vanguard",
    toId: "marseille",
  });
  const end = START + 2 * 24 * HOUR;
  let split = state;
  for (let at = START + 5 * HOUR + 457; at < end; at += 5 * HOUR + 457)
    split = parseSaveState(advanceGameState(split, split.lastUpdatedAt, at));
  expect(advanceGameState(split, split.lastUpdatedAt, end)).toEqual(
    advanceGameState(state, START, end),
  );
});
it("clustering keeps every city once and preserves exact coordinates", () => {
  const cities = world().cities;
  const before = structuredClone(cities);
  const groups = cityClusters(
    cities,
    (city) => ({ x: city.lon * 10, y: city.lat * 10 }),
    72,
  );
  expect(groups.some((group) => group.cities.length > 1)).toBe(true);
  expect(
    groups
      .flatMap((group) => group.cities)
      .map((city) => city.id)
      .sort(),
  ).toEqual(cities.map((city) => city.id).sort());
  expect(
    cityClusters(cities, (city) => ({ x: city.lon, y: city.lat }), 0),
  ).toHaveLength(16);
  expect(cities).toEqual(before);
});

it("asynchronous catch-up yields between days without skipping simulation or orders", async () => {
  const { catchUpGameState } = await import("../src/state/catchUp");
  const state = applyCommand(world(), {
    kind: "move",
    armyId: "vanguard",
    toId: "marseille",
  });
  let yields = 0;
  const end = START + 3 * 24 * HOUR;
  const result = await catchUpGameState(state, end, async () => {
    yields++;
  });
  expect(yields).toBeGreaterThan(0);
  expect(result).toEqual(advanceGameState(state, START, end));
});
