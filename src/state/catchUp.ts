import { BALANCE } from "../data/balance";
import { advanceGameState } from "../simulation/advanceTime";
import type { GameState } from "../types/game";

/** Yield between offline batches so long, unlimited campaigns don't freeze the UI.
 * These timers only yield execution; all elapsed time still comes from timestamps.
 */
export async function catchUpGameState(
  state: GameState,
  at: number,
  yieldControl: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<GameState> {
  let next = state;
  while (at - next.lastUpdatedAt > BALANCE.catchUpChunkMs) {
    await yieldControl();
    next = advanceGameState(
      next,
      next.lastUpdatedAt,
      next.lastUpdatedAt + BALANCE.catchUpChunkMs,
    );
  }
  return advanceGameState(next, next.lastUpdatedAt, at);
}
