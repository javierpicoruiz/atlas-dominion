import type { GameState, Location } from "../types/game";
// Schematic campaign extent; a future MapLibre renderer can consume the same GeoJSON.
export const MAP_EXTENT = { west: 2, east: 8.5, south: 46.5, north: 52 };
export function project(location: Location): { x: number; y: number } {
  return {
    x:
      ((location.lon - MAP_EXTENT.west) / (MAP_EXTENT.east - MAP_EXTENT.west)) *
      100,
    y:
      ((MAP_EXTENT.north - location.lat) /
        (MAP_EXTENT.north - MAP_EXTENT.south)) *
      100,
  };
}
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
          coordinates: [route.a, route.b].map((id) => {
            const city = state.cities.find((city) => city.id === id)!;
            return [city.lon, city.lat];
          }),
        },
      })),
    ],
  };
}
