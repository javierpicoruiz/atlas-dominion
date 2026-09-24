import initialBalance from "../../data/balance.json";
import type { BuildingType, ResourceBundle, UnitType } from "../types/game";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const RESOURCES = ["money", "food", "iron", "oil"] as const;
export const UNIT_TYPES = ["infantry", "cavalry", "artillery"] as const;
export const BUILDING_TYPES = [
  "barracks",
  "arsenal",
  "depot",
  "fortifications",
  "university",
] as const;
export const bundle = (
  money = 0,
  food = 0,
  iron = 0,
  oil = 0,
): ResourceBundle => ({ money, food, iron, oil });

export const BALANCE = {
  tickMs: initialBalance.campaign.simulationTickSeconds * 1000,
  campaignHours: initialBalance.campaign.durationHours,
  foodPerPopulationHour: 10,
  taxPerPopulationHour: 36,
  morale: {
    base: 20,
    stabilityWeight: 0.45,
    fulfilmentBonus: 25,
    convergencePerHour: 0.35,
    shortageStagesMinutes: [30, 120],
    shortageLossPerHour: [2, 8, 16],
    fortificationBonus: 2,
    maximum: 100,
  },
  stability: { recoveryPerHour: 1, shortageLossPerHour: 3, maximum: 100 },
  terrain: { plains: 1, forest: 1.2, mountain: 1.6 },
  queueLimit: 4,
  eventLimit: 30,
  startingResources: bundle(2400, 650, 160, 70),
  startingLocalStockpile: bundle(200, 80, 30, 10),
  initialMorale: 78,
  initialMoraleVariation: 5,
  initialStability: 85,
  initialGarrison: 3,
  seed: 73421,
} as const;

interface UnitDefinition {
  label: string;
  cost: ResourceBundle;
  recruitMs: number;
  speedKph: number;
  upkeepMoneyPerHour: number;
  foodPerHour: number;
  prerequisite: { building: BuildingType; level: number };
}
const infantry = initialBalance.units.infantry;
const cavalry = initialBalance.units.cavalry;
const artillery = initialBalance.units.artillery;
export const UNITS: Record<UnitType, UnitDefinition> = {
  infantry: {
    label: "Infantry",
    cost: bundle(infantry.money, infantry.food),
    recruitMs: infantry.recruitMinutes * MINUTE,
    speedKph: infantry.speedKph,
    upkeepMoneyPerHour: infantry.upkeepMoneyPerHour,
    foodPerHour: 1,
    prerequisite: { building: "barracks", level: 1 },
  },
  cavalry: {
    label: "Cavalry",
    cost: bundle(cavalry.money, cavalry.food),
    recruitMs: cavalry.recruitMinutes * MINUTE,
    speedKph: cavalry.speedKph,
    upkeepMoneyPerHour: cavalry.upkeepMoneyPerHour,
    foodPerHour: 2,
    prerequisite: { building: "barracks", level: 2 },
  },
  artillery: {
    label: "Artillery",
    cost: bundle(artillery.money, 0, artillery.iron),
    recruitMs: artillery.recruitMinutes * MINUTE,
    speedKph: artillery.speedKph,
    upkeepMoneyPerHour: artillery.upkeepMoneyPerHour,
    foodPerHour: 1,
    prerequisite: { building: "arsenal", level: 1 },
  },
};
interface BuildingDefinition {
  label: string;
  cost: ResourceBundle;
  durationMs: number;
  maxLevel: number;
  description: string;
}
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  barracks: {
    label: "Barracks",
    cost: bundle(350, 0, 15),
    durationMs: 30 * MINUTE,
    maxLevel: 2,
    description: "Level 1 recruits infantry. Level 2 unlocks cavalry.",
  },
  arsenal: {
    label: "Arsenal",
    cost: bundle(600, 0, 40),
    durationMs: HOUR,
    maxLevel: 1,
    description: "Unlocks artillery recruitment.",
  },
  depot: {
    label: "Depot",
    cost: bundle(300, 0, 20),
    durationMs: 45 * MINUTE,
    maxLevel: 1,
    description:
      "Establishes a supply-network source for connected friendly cities.",
  },
  fortifications: {
    label: "Fortifications",
    cost: bundle(450, 0, 35),
    durationMs: HOUR,
    maxLevel: 2,
    description:
      "+2 target morale per level. Combat defence comes in the military milestone.",
  },
  university: {
    label: "University",
    cost: bundle(800, 0, 25),
    durationMs: 2 * HOUR,
    maxLevel: 1,
    description:
      "Prepares this city for research in a future milestone; no research output yet.",
  },
};
