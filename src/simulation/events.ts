import { BALANCE } from "../data/balance";
import type { GameState } from "../types/game";
export const nextId = (state: GameState, prefix: string) =>
  `${prefix}-${state.nextId++}`;
export function recordEvent(
  state: GameState,
  at: number,
  message: string,
): void {
  state.events.push({ id: nextId(state, "event"), at, message });
  state.events = state.events.slice(-BALANCE.eventLimit);
}
