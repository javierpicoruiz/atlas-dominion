import { distanceKm, pathDistanceKm, routePath } from "../simulation/geography";
import type { GameState, Location } from "../types/game";
export function campaignGeoJSON(state: GameState) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...state.cities.map((city) => ({
        type: "Feature" as const,
        id: city.id,
        properties: {
          kind: "city",
          name: city.name,
          ownerId: city.ownerId,
          morale: city.morale,
        },
        geometry: { type: "Point" as const, coordinates: [city.lon, city.lat] },
      })),
      ...state.resourceNodes.map((node) => ({
        type: "Feature" as const,
        id: node.id,
        properties: {
          kind: "resource",
          name: node.name,
          ownerId: node.ownerId,
          resource: node.resource,
        },
        geometry: { type: "Point" as const, coordinates: [node.lon, node.lat] },
      })),
      ...state.routes.map((route) => ({
        type: "Feature" as const,
        id: route.id,
        properties: { kind: "route", distanceKm: route.distanceKm },
        geometry: {
          type: "LineString" as const,
          coordinates: routePath(state, route).map((point) => [
            point.lon,
            point.lat,
          ]),
        },
      })),
    ],
  };
}

/** Presentation only. Clamps at arrival without issuing orders or advancing the simulation. */
export function armyVisualPosition(
  state: GameState,
  army: import("../types/game").Army,
  at: number,
): Location {
  const order = army.order;
  if (order.kind !== "move")
    return state.cities.find((city) => city.id === army.cityId)!;
  const from = state.cities.find((city) => city.id === order.fromId)!;
  const to = state.cities.find((city) => city.id === order.toId)!;
  const progress = Math.max(
    0,
    Math.min(1, (at - order.departedAt) / (order.arrivesAt - order.departedAt)),
  );
  const route = state.routes.find((entry) => entry.id === order.routeId);
  const path = route ? routePath(state, route) : [from, to];
  if (route && route.a !== order.fromId) path.reverse();
  let remaining = progress * pathDistanceKm(path);
  for (let i = 1; i < path.length; i++) {
    const length = distanceKm(path[i - 1], path[i]);
    if (remaining <= length && length > 0) {
      const fraction = remaining / length;
      return {
        lon: path[i - 1].lon + (path[i].lon - path[i - 1].lon) * fraction,
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * fraction,
      };
    }
    remaining -= length;
  }
  return { lat: to.lat, lon: to.lon };
}
export function armyRouteGeoJSON(state: GameState) {
  return {
    type: "FeatureCollection" as const,
    features: state.armies.flatMap((army) => {
      const order = army.order;
      if (order.kind === "hold") return [];
      const from = state.cities.find(
        (city) =>
          city.id === (order.kind === "move" ? order.fromId : army.cityId),
      )!;
      const to = state.cities.find(
        (city) =>
          city.id === (order.kind === "move" ? order.toId : order.targetCityId),
      )!;
      const route =
        order.kind === "move"
          ? state.routes.find((entry) => entry.id === order.routeId)
          : undefined;
      const path = route ? routePath(state, route) : [from, to];
      if (route && route.a !== from.id) path.reverse();
      return [
        {
          type: "Feature" as const,
          properties: {
            kind: order.kind,
            color: state.factions.find(
              (faction) => faction.id === army.ownerId,
            )!.color,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: path.map((point) => [point.lon, point.lat]),
          },
        },
      ];
    }),
  };
}
