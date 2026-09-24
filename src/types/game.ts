export type Resource = "money" | "food" | "iron" | "oil";
export type ResourceBundle = Record<Resource, number>;
export type UnitType = "infantry" | "cavalry" | "artillery";
export type BuildingType =
  "barracks" | "arsenal" | "depot" | "fortifications" | "university";
export type Timestamp = number;
export interface Building {
  type: BuildingType;
  level: number;
}
export interface UnitStack {
  type: UnitType;
  count: number;
}
export interface Faction {
  id: string;
  name: string;
  color: string;
  controller: "player" | "ai";
  capitalId: string;
  resources: ResourceBundle;
}
export interface Location {
  lat: number;
  lon: number;
}
export type QueueItem = {
  id: string;
  startedAt: Timestamp;
  completesAt: Timestamp;
} & (
  | { kind: "building"; building: BuildingType; level: number }
  | { kind: "recruitment"; unit: UnitType }
);
export type CityClass = "town" | "regional" | "major" | "metropolis";
export interface City extends Location {
  class: CityClass;
  integrity: number;
  maxIntegrity: number;
  criticalSince: Timestamp | null;
  occupiedAt: Timestamp | null;
  capture: {
    factionId: string;
    startedAt: Timestamp;
    completesAt: Timestamp;
  } | null;
  id: string;
  name: string;
  ownerId: string;
  populationM: number;
  development: number;
  productionPerHour: ResourceBundle;
  morale: number;
  stability: number;
  shortageMinutes: number;
  localStockpile: ResourceBundle;
  buildings: Building[];
  queues: QueueItem[];
}
export interface ResourceNode extends Location {
  id: string;
  name: string;
  ownerId: string;
  cityId: string;
  resource: Exclude<Resource, "money">;
  outputPerHour: number;
}
export interface Route {
  id: string;
  a: string;
  b: string;
  type: "road";
  distanceKm: number;
  terrain: "plains" | "forest" | "mountain";
}
export type ArmyOrder =
  | { kind: "hold" }
  | {
      kind: "bombard";
      targetCityId: string;
      targetArmyId: string | null;
      nextFireAt: Timestamp;
    }
  | {
      kind: "move";
      routeId: string;
      fromId: string;
      toId: string;
      departedAt: Timestamp;
      arrivesAt: Timestamp;
    };
export interface Army {
  morale: number;
  damage: number;
  id: string;
  name: string;
  ownerId: string;
  cityId: string | null;
  units: UnitStack[];
  order: ArmyOrder;
}
export interface GameEvent {
  id: string;
  at: Timestamp;
  message: string;
  kind:
    | "order"
    | "arrival"
    | "battle-start"
    | "battle-end"
    | "capture"
    | "bombardment"
    | "unrest"
    | "rebellion";
  cityId: string | null;
}
export interface GameState {
  schemaVersion: 2;
  battles: { cityId: string; startedAt: Timestamp; nextRoundAt: Timestamp }[];
  seed: number;
  rngState: number;
  nextId: number;
  startedAt: Timestamp;
  lastUpdatedAt: Timestamp;
  lastEconomyAt: Timestamp;
  playerFactionId: string;
  factions: Faction[];
  cities: City[];
  resourceNodes: ResourceNode[];
  routes: Route[];
  armies: Army[];
  events: GameEvent[];
}
export type GameCommand =
  | { kind: "build"; cityId: string; building: BuildingType }
  | { kind: "recruit"; cityId: string; unit: UnitType }
  | { kind: "move"; armyId: string; toId: string }
  | {
      kind: "bombard";
      armyId: string;
      targetCityId: string;
      targetArmyId?: string;
    }
  | { kind: "hold"; armyId: string };
