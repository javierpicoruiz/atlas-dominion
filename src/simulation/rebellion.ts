import { BALANCE, bundle } from "../data/balance";
import type { GameState } from "../types/game";
import { transferCity } from "./cities";
import { nextId, recordEvent } from "./events";

export function syncUnrest(state: GameState, at: number): void {
  for (const city of state.cities) {
    if (city.morale >= BALANCE.rebellion.threshold) city.criticalSince = null;
    else if (city.criticalSince === null) {
      city.criticalSince = at;
      recordEvent(
        state,
        at,
        `Rebellion imminent in ${city.name}: restore morale to ${BALANCE.rebellion.threshold} within 45 minutes.`,
        "unrest",
        city.id,
      );
    }
  }
}
export function resolveRebellions(state: GameState, at: number): void {
  for (const city of state.cities) {
    if (
      city.criticalSince === null ||
      at < city.criticalSince + BALANCE.rebellion.durationMs
    )
      continue;
    const rebelId = city.ownerId === `rebels-${city.id}` ? nextId(state, "rebels") : `rebels-${city.id}`;
    if (!state.factions.some((faction) => faction.id === rebelId))
      state.factions.push({
        id: rebelId,
        name: `${city.name} Free State`,
        controller: "ai",
        color: BALANCE.rebellion.color,
        capitalId: city.id,
        resources: bundle(),
      });
    transferCity(state, city, rebelId);
    city.occupiedAt = null;
    city.morale = BALANCE.rebellion.morale;
    city.stability = BALANCE.rebellion.stability;
    state.armies.push({
      id: nextId(state, "militia"),
      name: `${city.name} Militia`,
      ownerId: rebelId,
      cityId: city.id,
      morale: BALANCE.initialMorale,
      damage: 0,
      order: { kind: "hold" },
      units: [
        {
          type: "infantry",
          count: Math.max(
            BALANCE.rebellion.minimumInfantry,
            Math.ceil(city.populationM * BALANCE.rebellion.infantryPerMillion),
          ),
        },
      ],
    });
    recordEvent(
      state,
      at,
      `Rebellion in ${city.name}! The city declared independence and raised militia.`,
      "rebellion",
      city.id,
    );
  }
}
