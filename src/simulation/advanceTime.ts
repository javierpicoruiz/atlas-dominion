import { BALANCE } from "../data/balance";
import type { GameState } from "../types/game";
import { validateTime } from "./clock";
import { advanceEconomy } from "./economy";
import { advanceMorale } from "./morale";
import { resolveArrivals } from "./movement";
import { createRng, type RngFactory } from "./rng";
import {
  syncMilitary,
  resolveBattles,
  resolveBombardment,
  resolveCaptures,
} from "./combat";
import { syncUnrest, resolveRebellions } from "./rebellion";
import { resolveQueues } from "./queues";

/** Pure transition. Economy ticks stay anchored to the campaign, never to refreshes.
 * At coincident timestamps: economy/morale, arrivals, queues, combat, bombardment,
 * capture, then rebellion. Military/unrest timers are reconciled between phases.
 * Newly completed units/buildings participate in the following economy tick.
 */
export function advanceGameState(
  state: GameState,
  previousTimestamp: number,
  currentTimestamp: number,
  rngFactory: RngFactory = createRng,
): GameState {
  validateTime(previousTimestamp);
  validateTime(currentTimestamp);
  if (previousTimestamp !== state.lastUpdatedAt)
    throw new Error("Simulation timestamp does not match this state.");
  if (currentTimestamp < previousTimestamp)
    throw new Error("Simulation cannot move backwards.");
  const next = structuredClone(state);
  const rng = rngFactory(next.rngState);
  syncMilitary(next, previousTimestamp);
  syncUnrest(next, previousTimestamp);
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
    const militaryAt = Math.min(
      ...next.battles.map((battle) => battle.nextRoundAt),
      ...next.armies.map((army) =>
        army.order.kind === "bombard" ? army.order.nextFireAt : Infinity,
      ),
      ...next.cities.flatMap((city) => [
        city.capture?.completesAt ?? Infinity,
        city.criticalSince === null
          ? Infinity
          : city.criticalSince + BALANCE.rebellion.durationMs,
      ]),
    );
    const at = Math.min(economyAt, queueAt, arrivalAt, militaryAt);
    if (at > currentTimestamp) break;
    if (at === economyAt) {
      const fulfilment = advanceEconomy(next, BALANCE.tickMs);
      for (const city of next.cities)
        advanceMorale(city, fulfilment.get(city.id)!, BALANCE.tickMs);
      next.lastEconomyAt = at;
      syncUnrest(next, at);
    }
    resolveArrivals(next, at);
    resolveQueues(next, at);
    syncMilitary(next, at);
    resolveBattles(next, at, rng);
    resolveBombardment(next, at);
    syncMilitary(next, at);
    resolveCaptures(next, at);
    syncUnrest(next, at);
    resolveRebellions(next, at);
    syncMilitary(next, at);
  }
  next.rngState = rng.state();
  next.lastUpdatedAt = currentTimestamp;
  return next;
}
