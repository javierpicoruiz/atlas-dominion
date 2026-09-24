import type { City, GameState, ResourceBundle } from "../types/game";

/** Foundation supply graph: owned routes connect capital/depot sources to cities. */
export function suppliedCityIds(state: GameState): Set<string> {
  const supplied = new Set<string>();
  for (const faction of state.factions) {
    const owned = state.cities.filter((city) => city.ownerId === faction.id);
    const ownedIds = new Set(owned.map((city) => city.id));
    const frontier = owned
      .filter(
        (city) =>
          city.id === faction.capitalId ||
          city.buildings.some((building) => building.type === "depot"),
      )
      .map((city) => city.id);
    while (frontier.length) {
      const id = frontier.shift()!;
      if (supplied.has(id)) continue;
      supplied.add(id);
      for (const route of state.routes) {
        const neighbor =
          route.a === id ? route.b : route.b === id ? route.a : null;
        if (neighbor && ownedIds.has(neighbor) && !supplied.has(neighbor))
          frontier.push(neighbor);
      }
    }
  }
  return supplied;
}
export function cityStockpile(
  state: GameState,
  city: City,
  supplied = suppliedCityIds(state),
): ResourceBundle {
  return supplied.has(city.id)
    ? state.factions.find((faction) => faction.id === city.ownerId)!.resources
    : city.localStockpile;
}
