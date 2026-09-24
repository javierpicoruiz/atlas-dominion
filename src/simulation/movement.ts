import { BALANCE, HOUR, UNITS } from "../data/balance";
import type { Army, GameState, Route } from "../types/game";
import { recordEvent } from "./events";
export function travelDuration(army: Army, route: Route): number {
  const speed = Math.min(
    ...army.units.map((stack) => UNITS[stack.type].speedKph),
  );
  return Math.ceil(
    (route.distanceKm / speed) * HOUR * BALANCE.terrain[route.terrain],
  );
}
export function resolveArrivals(state: GameState, timestamp: number): void {
  for (const army of state.armies) {
    if (army.order.kind !== "move" || army.order.arrivesAt > timestamp)
      continue;
    const order = army.order;
    army.cityId = order.toId;
    army.order = { kind: "hold" };
    recordEvent(
      state,
      order.arrivesAt,
      `${army.name} arrived at ${state.cities.find((city) => city.id === order.toId)!.name}.`,
    );
  }
}
