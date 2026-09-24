import { createEuropeCampaign } from "../data/europeCampaign";
import { nextId, recordEvent } from "../simulation/events";
import type { GameState } from "../types/game";

export const LEGACY_CITY_IDS: Record<string, string> = {
  haven: "madrid",
  ashford: "gijon",
  greenfield: "barcelona",
  ironridge: "paris",
  eastwatch: "marseille",
  sunmere: "milano",
};
const names: Record<string, string> = {
  Haven: "Madrid",
  Ashford: "Gijón",
  Greenfield: "Barcelona",
  Ironridge: "Paris",
  Eastwatch: "Marseille",
  Sunmere: "Milano",
};
export function expandLegacyCampaign(state: GameState): GameState {
  // Nonstandard saves are preserved; only the known six-city prototype is mapped.
  if (
    state.cities.length !== 6 ||
    !state.cities.every((city) => LEGACY_CITY_IDS[city.id])
  )
    return state;
  const next = structuredClone(state);
  const fresh = createEuropeCampaign(state.seed, state.lastUpdatedAt);
  const cityId = (id: string) => LEGACY_CITY_IDS[id] ?? id;
  const rename = (text: string) =>
    text.replace(
      /Haven|Ashford|Greenfield|Ironridge|Eastwatch|Sunmere/g,
      (name) => names[name],
    );
  const routeIds = new Map<string, string>();
  for (const route of state.routes) {
    const a = cityId(route.a),
      b = cityId(route.b);
    const replacement = fresh.routes.find(
      (entry) =>
        (entry.a === a && entry.b === b) || (entry.a === b && entry.b === a),
    );
    if (!replacement)
      throw new Error(
        "Legacy campaign route could not be migrated. Your save has been preserved.",
      );
    routeIds.set(route.id, replacement.id);
  }
  next.cities = fresh.cities.map((city) => {
    const existing = state.cities.find((entry) => cityId(entry.id) === city.id);
    return existing
      ? {
          ...structuredClone(existing),
          id: city.id,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
        }
      : city;
  });
  next.routes = fresh.routes;
  for (const faction of next.factions) {
    faction.capitalId = cityId(faction.capitalId);
    faction.name = rename(faction.name);
    if (faction.id === "ai") faction.name = "Continental Accord";
  }
  const british = fresh.factions.find((faction) => faction.id === "britain")!;
  // Id allocation also handles unusual old faction/army ids without data loss.
  if (next.factions.some((faction) => faction.id === british.id))
    british.id = nextId(next, "britain");
  next.factions.push(british);
  for (const city of next.cities)
    if (["london", "birmingham", "manchester"].includes(city.id))
      city.ownerId = british.id;
  for (const army of next.armies) {
    if (army.cityId) army.cityId = cityId(army.cityId);
    army.name = rename(army.name);
    if (army.order.kind === "move") {
      army.order.fromId = cityId(army.order.fromId);
      army.order.toId = cityId(army.order.toId);
      army.order.routeId = routeIds.get(army.order.routeId)!;
      // Already-issued orders retain their promised departure and arrival timestamps.
    } else if (army.order.kind === "bombard") {
      army.order.targetCityId = cityId(army.order.targetCityId);
      // Range changed from compressed routes to geography; do not silently fire across Europe.
      army.order = { kind: "hold" };
    }
  }
  const guard = fresh.armies.find((army) => army.ownerId === "britain")!;
  guard.id = nextId(next, "army");
  guard.ownerId = british.id;
  next.armies.push(guard);
  for (const node of next.resourceNodes) {
    node.cityId = cityId(node.cityId);
    const city = next.cities.find((entry) => entry.id === node.cityId)!;
    node.lat = city.lat;
    node.lon = city.lon;
    node.name = rename(node.name);
  }
  for (const battle of next.battles) battle.cityId = cityId(battle.cityId);
  for (const event of next.events) {
    if (event.cityId) event.cityId = cityId(event.cityId);
    event.message = rename(event.message);
  }
  recordEvent(
    next,
    next.lastUpdatedAt,
    "Campaign expanded to 16 European cities. Your progress and arrival times are preserved; check artillery targets on the new map.",
  );
  return next;
}
