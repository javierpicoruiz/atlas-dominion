import locations from "./europeCities.json" with { type: "json" };
import { BALANCE, bundle } from "./balance";
import type { City, GameState, Location, Route } from "../types/game";
import { createRng, type RngFactory } from "../simulation/rng";
import { validateTime } from "../simulation/clock";
import { cityDefaults } from "../simulation/cities";
import { pathDistanceKm, routePath } from "../simulation/geography";

export const EUROPE_CITIES = locations;
const waypoint = (lat: number, lon: number): Location => ({ lat, lon });
// Strategic land corridors, not turn-by-turn road geometry. Channel access uses the tunnel.
const bordeaux = waypoint(44.84, -0.58);
const bilbao = waypoint(43.26, -2.93);
const zaragoza = waypoint(41.65, -0.89);
const montpellier = waypoint(43.61, 3.88);
const genoa = waypoint(44.41, 8.93);
const calais = waypoint(50.93, 1.81);
const folkestone = waypoint(51.09, 1.14);
const corridors: {
  a: string;
  b: string;
  terrain?: Route["terrain"];
  waypoints?: Location[];
  label?: string;
}[] = [
  {
    a: "madrid",
    b: "gijon",
    terrain: "mountain",
    waypoints: [waypoint(42.6, -5.57)],
  },
  { a: "madrid", b: "barcelona", waypoints: [zaragoza] },
  { a: "gijon", b: "paris", waypoints: [bilbao, bordeaux] },
  {
    a: "madrid",
    b: "marseille",
    waypoints: [zaragoza, waypoint(41.39, 2.16), montpellier],
  },
  {
    a: "barcelona",
    b: "milano",
    waypoints: [montpellier, waypoint(43.3, 5.38), genoa],
  },
  { a: "paris", b: "marseille", waypoints: [waypoint(45.76, 4.84)] },
  { a: "marseille", b: "milano", terrain: "mountain", waypoints: [genoa] },
  { a: "barcelona", b: "marseille", waypoints: [montpellier] },
  {
    a: "milano",
    b: "roma",
    waypoints: [waypoint(44.49, 11.34), waypoint(43.77, 11.25)],
  },
  { a: "paris", b: "brussels" },
  { a: "brussels", b: "amsterdam" },
  { a: "brussels", b: "maastricht" },
  { a: "maastricht", b: "amsterdam" },
  { a: "maastricht", b: "koln" },
  { a: "koln", b: "berlin", waypoints: [waypoint(52.37, 9.73)] },
  {
    a: "berlin",
    b: "copenhagen",
    waypoints: [
      waypoint(53.55, 10),
      waypoint(55.49, 9.47),
      waypoint(55.4, 10.39),
    ],
  },
  {
    a: "milano",
    b: "koln",
    terrain: "mountain",
    waypoints: [waypoint(47.56, 7.59)],
  },
  {
    a: "paris",
    b: "london",
    label: "Channel Tunnel",
    waypoints: [calais, folkestone],
  },
  { a: "london", b: "birmingham" },
  { a: "birmingham", b: "manchester" },
];

export function createEuropeCampaign(
  seed: number,
  startedAt: number,
  rngFactory: RngFactory = createRng,
): GameState {
  validateTime(startedAt);
  const rng = rngFactory(seed);
  const config = BALANCE.europe;
  const cities: City[] = locations.map((location) => {
    const populationM =
      config.populationM[location.id as keyof typeof config.populationM];
    return {
      id: location.id,
      name: location.name,
      lat: location.lat,
      lon: location.lon,
      ownerId:
        location.country === "ES"
          ? "player"
          : location.country === "GB"
            ? "britain"
            : "ai",
      populationM,
      ...cityDefaults(populationM),
      development: 1,
      productionPerHour: bundle(
        0,
        populationM * config.foodPerPopulationHour +
          config.foodReservePerCityHour,
        config.ironPerCityHour,
        config.oilPerCityHour,
      ),
      morale:
        BALANCE.initialMorale +
        Math.floor(rng.next() * BALANCE.initialMoraleVariation),
      stability: BALANCE.initialStability,
      shortageMinutes: 0,
      localStockpile: { ...BALANCE.startingLocalStockpile },
      buildings: [{ type: "barracks", level: 1 }],
      queues: [],
    };
  });
  const routes: Route[] = corridors.map((corridor) => {
    const route: Route = {
      ...corridor,
      id: `${corridor.a}-${corridor.b}`,
      type: "road",
      terrain: corridor.terrain ?? "plains",
      distanceKm: 0,
    };
    route.distanceKm = Math.ceil(pathDistanceKm(routePath({ cities }, route)));
    return route;
  });
  return {
    schemaVersion: 3,
    seed: seed >>> 0,
    rngState: rng.state(),
    nextId: 1,
    startedAt,
    lastUpdatedAt: startedAt,
    lastEconomyAt: startedAt,
    playerFactionId: "player",
    factions: [
      {
        id: "player",
        name: "The Meridian Union",
        color: "#79c6af",
        controller: "player",
        capitalId: "madrid",
        resources: { ...BALANCE.startingResources },
      },
      {
        id: "ai",
        name: "Continental Accord",
        color: "#dfac79",
        controller: "ai",
        capitalId: "paris",
        resources: { ...BALANCE.startingResources },
      },
      {
        id: "britain",
        name: "British League",
        color: "#94aefa",
        controller: "ai",
        capitalId: "london",
        resources: { ...BALANCE.startingResources },
      },
    ],
    cities,
    routes,
    resourceNodes: [],
    battles: [],
    events: [],
    armies: [
      {
        id: "vanguard",
        name: "Meridian Vanguard",
        ownerId: "player",
        cityId: "madrid",
      },
      {
        id: "eastern-guard",
        name: "Continental Guard",
        ownerId: "ai",
        cityId: "paris",
      },
      {
        id: "british-guard",
        name: "British Guard",
        ownerId: "britain",
        cityId: "london",
      },
    ].map((army) => ({
      ...army,
      morale: BALANCE.initialMorale,
      damage: 0,
      units: [{ type: "infantry", count: BALANCE.initialGarrison }],
      order: { kind: "hold" },
    })),
  };
}
