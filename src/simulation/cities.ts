import { BALANCE } from "../data/balance";
import type { City, CityClass, GameState } from "../types/game";

export function cityDefaults(populationM: number) {
  const cityClass =
    (Object.keys(BALANCE.cityClasses) as CityClass[]).find(
      (key) => populationM < BALANCE.cityClasses[key].maxPopulation,
    ) ?? "metropolis";
  const integrity = BALANCE.cityClasses[cityClass].integrity;
  return {
    class: cityClass,
    integrity,
    maxIntegrity: integrity,
    criticalSince: null,
    occupiedAt: null,
    capture: null,
  };
}
export const fortificationLevel = (city: City) =>
  city.buildings.find((building) => building.type === "fortifications")
    ?.level ?? 0;

/** Buildings, damage and local reserves survive a change of government. Paid unfinished orders do not. */
export function transferCity(
  state: GameState,
  city: City,
  ownerId: string,
): void {
  city.ownerId = ownerId;
  city.capture = null;
  city.criticalSince = null;
  city.queues = [];
  for (const node of state.resourceNodes)
    if (node.cityId === city.id) node.ownerId = ownerId;
}
