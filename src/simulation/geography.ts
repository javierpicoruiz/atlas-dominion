import type { GameState, Location, Route } from "../types/game";

// Mean Earth radius, kilometres (IUGG). Geography is independent of rendering.
const EARTH_RADIUS_KM = 6371.0088;
export function distanceKm(a: Location, b: Location): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * radians) *
      Math.cos(b.lat * radians) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function routePath(
  state: Pick<GameState, "cities">,
  route: Route,
): Location[] {
  const from = state.cities.find((city) => city.id === route.a)!;
  const to = state.cities.find((city) => city.id === route.b)!;
  return [from, ...(route.waypoints ?? []), to];
}
export const pathDistanceKm = (path: Location[]) =>
  path
    .slice(1)
    .reduce((sum, point, index) => sum + distanceKm(path[index], point), 0);
