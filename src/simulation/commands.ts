import { BALANCE, BUILDINGS, RESOURCES, UNITS } from "../data/balance";
import type { GameCommand, GameState, ResourceBundle } from "../types/game";
import { cityStockpile } from "./logistics";
import { nextId, recordEvent } from "./events";
import { bombardProblem, syncMilitary } from "./combat";
import { travelDuration } from "./movement";

function spend(stock: ResourceBundle, cost: ResourceBundle): void {
  const missing = RESOURCES.filter(
    (resource) => stock[resource] < cost[resource],
  );
  if (missing.length) throw new Error(`Not enough ${missing.join(", ")}.`);
  for (const resource of RESOURCES) stock[resource] -= cost[resource];
}
export function applyCommand(
  state: GameState,
  command: GameCommand,
  actorId = state.playerFactionId,
): GameState {
  const next = structuredClone(state);
  const at = next.lastUpdatedAt;
  if (!next.factions.some((faction) => faction.id === actorId))
    throw new Error("Unknown faction.");
  if (command.kind === "bombard" || command.kind === "hold") {
    const army = next.armies.find((entry) => entry.id === command.armyId);
    if (!army || army.ownerId !== actorId)
      throw new Error("You do not control this army.");
    if (army.order.kind === "move") throw new Error("Army is already moving.");
    if (command.kind === "hold") army.order = { kind: "hold" };
    else {
      const problem = bombardProblem(
        next,
        army,
        command.targetCityId,
        command.targetArmyId ?? null,
      );
      if (problem) throw new Error(problem);
      if (army.order.kind === "bombard")
        throw new Error("Stop the current bombardment first.");
      army.order = {
        kind: "bombard",
        targetCityId: command.targetCityId,
        targetArmyId: command.targetArmyId ?? null,
        nextFireAt: at + BALANCE.artillery.cooldownMs,
      };
      const city = next.cities.find(
        (entry) => entry.id === command.targetCityId,
      )!;
      recordEvent(
        next,
        at,
        `${city.name} under bombardment from ${army.name}.`,
        "bombardment",
        city.id,
        [army.ownerId, city.ownerId],
      );
    }
    return next;
  }
  if (command.kind === "move") {
    const army = next.armies.find((army) => army.id === command.armyId);
    if (!army || army.ownerId !== actorId)
      throw new Error("You do not control this army.");
    if (army.order.kind === "move" || !army.cityId)
      throw new Error("Army is already moving.");
    const destination = next.cities.find((city) => city.id === command.toId);
    if (!destination) throw new Error("Unknown destination.");
    const route = next.routes.find(
      (route) =>
        (route.a === army.cityId && route.b === destination.id) ||
        (route.b === army.cityId && route.a === destination.id),
    );
    if (!route) throw new Error("No direct land route connects these cities.");
    if (!army.units.length) throw new Error("Cannot move an empty army.");
    army.order = {
      kind: "move",
      routeId: route.id,
      fromId: army.cityId,
      toId: destination.id,
      departedAt: at,
      arrivesAt: at + travelDuration(army, route),
    };
    army.cityId = null;
    syncMilitary(next, at);
    recordEvent(next, at, `${army.name} departed for ${destination.name}.`);
    return next;
  }
  const city = next.cities.find((city) => city.id === command.cityId);
  if (!city || city.ownerId !== actorId)
    throw new Error("You do not control this city.");
  const lane = city.queues.filter(
    (item) =>
      item.kind === (command.kind === "build" ? "building" : "recruitment"),
  );
  if (lane.length >= BALANCE.queueLimit) throw new Error("This queue is full.");
  const startedAt = Math.max(at, ...lane.map((item) => item.completesAt));
  if (command.kind === "build") {
    const definition = BUILDINGS[command.building];
    if (!definition) throw new Error("Unknown building.");
    const level =
      (city.buildings.find((building) => building.type === command.building)
        ?.level ?? 0) + 1;
    if (level > definition.maxLevel)
      throw new Error("Building is already at its maximum level.");
    if (
      city.queues.some(
        (item) =>
          item.kind === "building" && item.building === command.building,
      )
    )
      throw new Error("This building is already queued.");
    const cost = Object.fromEntries(
      RESOURCES.map((resource) => [
        resource,
        definition.cost[resource] * level,
      ]),
    ) as ResourceBundle;
    spend(cityStockpile(next, city), cost);
    city.queues.push({
      id: nextId(next, "queue"),
      kind: "building",
      building: command.building,
      level,
      startedAt,
      completesAt: startedAt + definition.durationMs * level,
    });
    recordEvent(
      next,
      at,
      `${city.name}: ${definition.label} level ${level} queued.`,
    );
  } else {
    const definition = UNITS[command.unit];
    if (!definition) throw new Error("Unknown unit.");
    const prerequisite = definition.prerequisite;
    if (
      !city.buildings.some(
        (building) =>
          building.type === prerequisite.building &&
          building.level >= prerequisite.level,
      )
    )
      throw new Error(
        `Requires ${BUILDINGS[prerequisite.building].label} level ${prerequisite.level}.`,
      );
    spend(cityStockpile(next, city), definition.cost);
    city.queues.push({
      id: nextId(next, "queue"),
      kind: "recruitment",
      unit: command.unit,
      startedAt,
      completesAt: startedAt + definition.recruitMs,
    });
    recordEvent(
      next,
      at,
      `${city.name}: ${definition.label} recruitment queued.`,
    );
  }
  return next;
}
/** The UI asks the simulation for action validation; rules stay outside React. */
export function commandProblem(
  state: GameState,
  command: GameCommand,
): string | null {
  try {
    applyCommand(state, command);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid command.";
  }
}
