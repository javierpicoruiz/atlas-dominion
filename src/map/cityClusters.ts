import type { City } from "../types/game";
export interface CityCluster {
  cities: City[];
  lon: number;
  lat: number;
}
/** Screen-space grouping keeps real coordinates intact and nearby city buttons tappable. */
export function cityClusters(
  cities: City[],
  project: (city: { lon: number; lat: number }) => { x: number; y: number },
  radius: number,
): CityCluster[] {
  const groups: CityCluster[] = [];
  for (const city of cities) {
    const point = project(city);
    const group = groups.find((entry) => {
      const center = project(entry);
      return Math.hypot(point.x - center.x, point.y - center.y) < radius;
    });
    if (!group) groups.push({ cities: [city], lon: city.lon, lat: city.lat });
    else {
      group.cities.push(city);
      group.lon =
        group.cities.reduce((sum, entry) => sum + entry.lon, 0) /
        group.cities.length;
      group.lat =
        group.cities.reduce((sum, entry) => sum + entry.lat, 0) /
        group.cities.length;
    }
  }
  return groups;
}
