import { z } from "zod";
import {
  BALANCE,
  BUILDING_TYPES,
  RESOURCES,
  UNIT_TYPES,
} from "../data/balance";
import { expandLegacyCampaign } from "./migrateEurope";
import { cityDefaults } from "../simulation/cities";
import type { GameState } from "../types/game";

const id = z.string().min(1);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = z.number().positive();
const uint = z.number().int().nonnegative().max(0xffffffff);
const score = z.number().min(0).max(100);
const resources = z.object(
  Object.fromEntries(
    RESOURCES.map((key) => [key, z.number().nonnegative()]),
  ) as Record<(typeof RESOURCES)[number], z.ZodNumber>,
);
const coordinates = {
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
};
const queueBase = { id, startedAt: timestamp, completesAt: timestamp };
const queue = z.discriminatedUnion("kind", [
  z.object({
    ...queueBase,
    kind: z.literal("building"),
    building: z.enum(BUILDING_TYPES),
    level: z.number().int().positive(),
  }),
  z.object({
    ...queueBase,
    kind: z.literal("recruitment"),
    unit: z.enum(UNIT_TYPES),
  }),
]);
const schema: z.ZodType<GameState> = z.object({
  schemaVersion: z.literal(3),
  battles: z.array(
    z.object({ cityId: id, startedAt: timestamp, nextRoundAt: timestamp }),
  ),
  seed: uint,
  rngState: uint,
  nextId: z.number().int().positive(),
  startedAt: timestamp,
  lastUpdatedAt: timestamp,
  lastEconomyAt: timestamp,
  playerFactionId: id,
  factions: z
    .array(
      z.object({
        id,
        name: id,
        color: id,
        controller: z.enum(["player", "ai"]),
        capitalId: id,
        resources,
      }),
    )
    .min(1),
  cities: z
    .array(
      z.object({
        id,
        name: id,
        ownerId: id,
        ...coordinates,
        class: z.enum(["town", "regional", "major", "metropolis"]),
        integrity: z.number().nonnegative(),
        maxIntegrity: positive,
        criticalSince: timestamp.nullable(),
        occupiedAt: timestamp.nullable(),
        capture: z
          .object({
            factionId: id,
            startedAt: timestamp,
            completesAt: timestamp,
          })
          .nullable(),
        populationM: positive,
        development: positive,
        productionPerHour: resources,
        morale: score,
        stability: score,
        shortageMinutes: z.number().nonnegative(),
        localStockpile: resources,
        buildings: z.array(
          z.object({
            type: z.enum(BUILDING_TYPES),
            level: z.number().int().positive(),
          }),
        ),
        queues: z.array(queue),
      }),
    )
    .min(1),
  resourceNodes: z.array(
    z.object({
      id,
      name: id,
      ownerId: id,
      cityId: id,
      ...coordinates,
      resource: z.enum(["food", "iron", "oil"]),
      outputPerHour: z.number().nonnegative(),
    }),
  ),
  routes: z.array(
    z.object({
      id,
      a: id,
      b: id,
      type: z.literal("road"),
      distanceKm: positive,
      waypoints: z.array(z.object(coordinates)).optional(),
      label: id.optional(),
      terrain: z.enum(["plains", "forest", "mountain"]),
    }),
  ),
  armies: z.array(
    z.object({
      id,
      name: id,
      ownerId: id,
      cityId: id.nullable(),
      morale: score,
      damage: z.number().nonnegative(),
      units: z
        .array(
          z.object({
            type: z.enum(UNIT_TYPES),
            count: z.number().int().positive(),
          }),
        )
        .min(1),
      order: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("hold") }),
        z.object({
          kind: z.literal("bombard"),
          targetCityId: id,
          targetArmyId: id.nullable(),
          nextFireAt: timestamp,
        }),
        z.object({
          kind: z.literal("move"),
          routeId: id,
          fromId: id,
          toId: id,
          departedAt: timestamp,
          arrivesAt: timestamp,
        }),
      ]),
    }),
  ),
  events: z.array(
    z.object({
      id,
      at: timestamp,
      message: id,
      kind: z.enum([
        "order",
        "arrival",
        "recruitment",
        "construction",
        "battle-start",
        "battle-end",
        "capture",
        "bombardment",
        "unrest",
        "rebellion",
      ]),
      cityId: id.nullable(),
      factionIds: z.array(id).optional(),
    }),
  ),
});

/** Additive migration: preserve queues, orders, balances and timestamps from the foundation. */
function migrateV1(value: unknown): unknown {
  const legacy = z
    .object({
      schemaVersion: z.literal(1),
      cities: z.array(z.object({ populationM: positive }).passthrough()),
      armies: z.array(z.object({}).passthrough()),
      events: z.array(z.object({}).passthrough()),
    })
    .passthrough()
    .safeParse(value);
  if (!legacy.success) return value;
  return {
    ...legacy.data,
    schemaVersion: 2,
    battles: [],
    cities: legacy.data.cities.map((city) => ({
      ...city,
      ...cityDefaults(city.populationM),
    })),
    armies: legacy.data.armies.map((army) => ({
      ...army,
      morale: BALANCE.initialMorale,
      damage: 0,
    })),
    events: legacy.data.events.map((event) => ({
      ...event,
      kind: "order",
      cityId: null,
    })),
  };
}
export function parseSaveState(value: unknown): GameState {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    (value.schemaVersion !== 1 &&
      value.schemaVersion !== 2 &&
      value.schemaVersion !== 3)
  )
    throw new Error(
      "Unsupported save schema. Your existing save has been preserved.",
    );
  const legacy = value.schemaVersion !== 3;
  const upgraded = value.schemaVersion === 1 ? migrateV1(value) : value;
  const parsed = schema.safeParse(
    legacy && upgraded && typeof upgraded === "object"
      ? { ...upgraded, schemaVersion: 3 }
      : upgraded,
  );
  if (!parsed.success)
    throw new Error(
      "The saved campaign is invalid. Your existing save has been preserved.",
    );
  const state = parsed.data;
  const fail = () => {
    throw new Error(
      "The saved campaign has inconsistent references or timestamps. Your existing save has been preserved.",
    );
  };
  if (
    state.startedAt > state.lastEconomyAt ||
    state.lastEconomyAt > state.lastUpdatedAt ||
    state.lastUpdatedAt - state.lastEconomyAt >= BALANCE.tickMs ||
    (state.lastEconomyAt - state.startedAt) % BALANCE.tickMs !== 0
  )
    fail();
  const factions = new Set(state.factions.map((faction) => faction.id));
  const cities = new Set(state.cities.map((city) => city.id));
  const routes = new Map(state.routes.map((route) => [route.id, route]));
  const allIds = [
    ...state.factions,
    ...state.cities,
    ...state.resourceNodes,
    ...state.routes,
    ...state.armies,
    ...state.events,
    ...state.cities.flatMap((city) => city.queues),
  ].map((entity) => entity.id);
  if (
    new Set(allIds).size !== allIds.length ||
    !state.factions.some(
      (faction) =>
        faction.id === state.playerFactionId && faction.controller === "player",
    )
  )
    fail();
  for (const faction of state.factions)
    if (!cities.has(faction.capitalId)) fail();
  for (const city of state.cities) {
    if (!factions.has(city.ownerId) || city.integrity > city.maxIntegrity)
      fail();
    for (const at of [city.criticalSince, city.occupiedAt])
      if (at !== null && (at < state.startedAt || at > state.lastUpdatedAt))
        fail();
    if (
      city.capture &&
      (!factions.has(city.capture.factionId) ||
        city.capture.factionId === city.ownerId ||
        city.capture.startedAt < state.startedAt ||
        city.capture.startedAt > state.lastUpdatedAt ||
        city.capture.completesAt <= state.lastUpdatedAt)
    )
      fail();
    for (const item of city.queues)
      if (
        item.startedAt < state.startedAt ||
        item.completesAt <= item.startedAt ||
        item.completesAt <= state.lastUpdatedAt
      )
        fail();
  }
  for (const node of state.resourceNodes)
    if (!factions.has(node.ownerId) || !cities.has(node.cityId)) fail();
  for (const route of state.routes)
    if (!cities.has(route.a) || !cities.has(route.b) || route.a === route.b)
      fail();
  for (const army of state.armies) {
    if (!factions.has(army.ownerId)) fail();
    if (army.order.kind !== "move") {
      if (army.order.kind === "bombard") {
        const order = army.order;
        if (
          !cities.has(order.targetCityId) ||
          order.nextFireAt <= state.lastUpdatedAt ||
          (order.targetArmyId &&
            !state.armies.some((entry) => entry.id === order.targetArmyId))
        )
          fail();
      }
      if (!army.cityId || !cities.has(army.cityId)) fail();
    } else {
      const order = army.order;
      const route = routes.get(order.routeId);
      if (
        army.cityId !== null ||
        !route ||
        !(
          (route.a === order.fromId && route.b === order.toId) ||
          (route.b === order.fromId && route.a === order.toId)
        ) ||
        order.departedAt < state.startedAt ||
        order.departedAt > state.lastUpdatedAt ||
        order.arrivesAt <= state.lastUpdatedAt
      )
        fail();
    }
  }
  if (
    new Set(state.battles.map((battle) => battle.cityId)).size !==
    state.battles.length
  )
    fail();
  for (const battle of state.battles)
    if (
      !cities.has(battle.cityId) ||
      battle.startedAt < state.startedAt ||
      battle.startedAt > state.lastUpdatedAt ||
      battle.nextRoundAt <= state.lastUpdatedAt
    )
      fail();
  for (const event of state.events)
    if (
      (event.cityId && !cities.has(event.cityId)) ||
      event.at > state.lastUpdatedAt
    )
      fail();
  return legacy ? parseSaveState(expandLegacyCampaign(state)) : state;
}
