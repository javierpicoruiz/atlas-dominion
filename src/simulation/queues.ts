import { BUILDINGS, UNITS } from "../data/balance";
import type { GameState } from "../types/game";
import { nextId, recordEvent } from "./events";
export function resolveQueues(state: GameState, timestamp: number): void {
  for (const city of state.cities) {
    for (const item of city.queues.filter(
      (queued) => queued.completesAt <= timestamp,
    )) {
      if (item.kind === "building") {
        const existing = city.buildings.find(
          (building) => building.type === item.building,
        );
        if (existing) existing.level = item.level;
        else city.buildings.push({ type: item.building, level: item.level });
        recordEvent(
          state,
          item.completesAt,
          `${city.name}: ${BUILDINGS[item.building].label} level ${item.level} completed.`,
        );
      } else {
        let army = state.armies.find(
          (army) =>
            army.cityId === city.id &&
            army.ownerId === city.ownerId &&
            army.order.kind === "hold",
        );
        if (!army) {
          army = {
            id: nextId(state, "army"),
            name: `${city.name} Regiment`,
            cityId: city.id,
            ownerId: city.ownerId,
            units: [],
            order: { kind: "hold" },
          };
          state.armies.push(army);
        }
        const stack = army.units.find((stack) => stack.type === item.unit);
        if (stack) stack.count++;
        else army.units.push({ type: item.unit, count: 1 });
        recordEvent(
          state,
          item.completesAt,
          `${city.name}: ${UNITS[item.unit].label} recruited.`,
        );
      }
    }
    city.queues = city.queues.filter((item) => item.completesAt > timestamp);
  }
}
