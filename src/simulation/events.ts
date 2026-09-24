import { BALANCE } from "../data/balance";
import type { GameState, GameEvent } from "../types/game";
export const nextId = (state: GameState, prefix: string) =>
  `${prefix}-${state.nextId++}`;
export function recordEvent(
  state: GameState,
  at: number,
  message: string,
  kind: GameEvent["kind"] = "order",
  cityId: string | null = null,
  factionIds?: string[],
): void {
  const audience =
    factionIds ??
    (cityId
      ? [
          state.cities.find((city) => city.id === cityId)!.ownerId,
          ...state.armies
            .filter((army) => army.cityId === cityId)
            .map((army) => army.ownerId),
        ]
      : []);
  state.events.push({
    id: nextId(state, "event"),
    at,
    message,
    kind,
    cityId,
    factionIds: [...new Set(audience)],
  });
  state.events = state.events.slice(-BALANCE.eventLimit);
}
