import { BALANCE, HOUR, RESOURCES, UNITS, bundle } from "../data/balance";
import type { City, GameState, ResourceBundle } from "../types/game";
import { armySupportCity, cityStockpile, suppliedCityIds } from "./logistics";

export interface EconomicRates {
  production: ResourceBundle;
  consumption: ResourceBundle;
}
export function cityRates(state: GameState, city: City): EconomicRates {
  const production = { ...city.productionPerHour };
  production.money +=
    (((city.populationM *
      city.development *
      BALANCE.taxPerPopulationHour *
      city.morale) /
      BALANCE.morale.maximum) *
      city.stability) /
    BALANCE.stability.maximum;
  for (const node of state.resourceNodes) {
    if (node.cityId === city.id && node.ownerId === city.ownerId)
      production[node.resource] += node.outputPerHour;
  }
  const consumption = bundle(
    0,
    city.populationM * city.development * BALANCE.foodPerPopulationHour,
  );
  // Moving troops continue to draw rations and wages from their departure city.
  for (const army of state.armies) {
    const supportCityId = armySupportCity(state, army)?.id;
    if (army.ownerId !== city.ownerId || supportCityId !== city.id) continue;
    for (const stack of army.units) {
      consumption.money += UNITS[stack.type].upkeepMoneyPerHour * stack.count;
      consumption.food += UNITS[stack.type].foodPerHour * stack.count;
    }
  }
  return { production, consumption };
}
export function factionRates(
  state: GameState,
  factionId: string,
): EconomicRates {
  const rates = { production: bundle(), consumption: bundle() };
  const supplied = suppliedCityIds(state);
  for (const city of state.cities.filter(
    (city) => city.ownerId === factionId && supplied.has(city.id),
  )) {
    const cityRate = cityRates(state, city);
    for (const resource of RESOURCES) {
      rates.production[resource] += cityRate.production[resource];
      rates.consumption[resource] += cityRate.consumption[resource];
    }
  }
  return rates;
}
/** Aggregate each shared stockpile before allocating food, avoiding city-order bias. */
export function advanceEconomy(
  state: GameState,
  elapsedMs: number,
): Map<string, number> {
  const hours = elapsedMs / HOUR;
  const supplied = suppliedCityIds(state);
  const pools = new Map<
    ResourceBundle,
    { demand: ResourceBundle; cityIds: string[] }
  >();
  for (const city of state.cities) {
    const stock = cityStockpile(state, city, supplied);
    const pool = pools.get(stock) ?? { demand: bundle(), cityIds: [] };
    const rates = cityRates(state, city);
    for (const resource of RESOURCES) {
      stock[resource] += rates.production[resource] * hours;
      pool.demand[resource] += rates.consumption[resource] * hours;
    }
    pool.cityIds.push(city.id);
    pools.set(stock, pool);
  }
  const fulfilment = new Map<string, number>();
  for (const [stock, pool] of pools) {
    const foodRatio =
      pool.demand.food === 0 ? 1 : Math.min(1, stock.food / pool.demand.food);
    for (const id of pool.cityIds) fulfilment.set(id, foodRatio);
    for (const resource of RESOURCES)
      stock[resource] = Math.max(0, stock[resource] - pool.demand[resource]);
  }
  return fulfilment;
}
