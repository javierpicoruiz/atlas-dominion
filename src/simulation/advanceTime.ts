import { BALANCE } from "../data/balance";
import type { GameState } from "../types/game";
import { validateTime } from "./clock";
import { advanceEconomy } from "./economy";
import { advanceMorale } from "./morale";
import { resolveArrivals } from "./movement";
import { resolveQueues } from "./queues";

/** Pure transition. Economy ticks stay anchored to the campaign, never to refreshes.
 * At coincident timestamps: economy/morale, then arrivals, then queue completion.
 * Newly completed units/buildings participate in the following economy tick.
 */
export function advanceGameState(
  state: GameState,
  previousTimestamp: number,
  currentTimestamp: number,
): GameState {
  validateTime(previousTimestamp);
  validateTime(currentTimestamp);
  if (previousTimestamp !== state.lastUpdatedAt)
    throw new Error("Simulation timestamp does not match this state.");
  if (currentTimestamp < previousTimestamp)
    throw new Error("Simulation cannot move backwards.");
  const next = structuredClone(state);
  while (true) {
    const economyAt = next.lastEconomyAt + BALANCE.tickMs;
    const queueAt = Math.min(
      ...next.cities.flatMap((city) =>
        city.queues.map((item) => item.completesAt),
      ),
    );
    const arrivalAt = Math.min(
      ...next.armies.map((army) =>
        army.order.kind === "move" ? army.order.arrivesAt : Infinity,
      ),
    );
    const at = Math.min(economyAt, queueAt, arrivalAt);
    if (at > currentTimestamp) break;
    if (at === economyAt) {
      const fulfilment = advanceEconomy(next, BALANCE.tickMs);
      for (const city of next.cities)
        advanceMorale(city, fulfilment.get(city.id)!, BALANCE.tickMs);
      next.lastEconomyAt = at;
    }
    resolveArrivals(next, at);
    resolveQueues(next, at);
  }
  next.lastUpdatedAt = currentTimestamp;
  return next;
}
