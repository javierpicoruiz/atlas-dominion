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
): void {
  state.events.push({ id: nextId(state, "event"), at, message, kind, cityId });
  state.events = state.events.slice(-BALANCE.eventLimit);
}
