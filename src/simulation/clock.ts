import type { GameState } from "../types/game";
export interface Clock {
  now: () => number;
}
export const systemClock: Clock = { now: () => Date.now() };
export function validateTime(timestamp: number): void {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0)
    throw new Error("Time must be a non-negative integer timestamp.");
}
export const resumeTime = (state: GameState, clock: Clock) =>
  Math.max(state.lastUpdatedAt, clock.now());
