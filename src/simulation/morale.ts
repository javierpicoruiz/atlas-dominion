import { BALANCE, HOUR, MINUTE } from "../data/balance";
import type { City } from "../types/game";
const clamp = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, value));
export function advanceMorale(
  city: City,
  fulfilment: number,
  elapsedMs: number,
): void {
  const hours = elapsedMs / HOUR;
  const shortage = 1 - fulfilment;
  city.shortageMinutes =
    shortage > 0 ? city.shortageMinutes + elapsedMs / MINUTE : 0;
  city.stability = clamp(
    city.stability +
      (BALANCE.stability.recoveryPerHour * fulfilment -
        BALANCE.stability.shortageLossPerHour * shortage) *
        hours,
    BALANCE.stability.maximum,
  );
  const fortifications =
    city.buildings.find((building) => building.type === "fortifications")
      ?.level ?? 0;
  const config = BALANCE.morale;
  const target =
    config.base +
    config.stabilityWeight * city.stability +
    config.fulfilmentBonus * fulfilment +
    config.fortificationBonus * fortifications;
  const stage =
    city.shortageMinutes <= config.shortageStagesMinutes[0]
      ? 0
      : city.shortageMinutes <= config.shortageStagesMinutes[1]
        ? 1
        : 2;
  city.morale = clamp(
    city.morale +
      (target - city.morale) *
        (1 - Math.exp(-config.convergencePerHour * hours)) -
      config.shortageLossPerHour[stage] * shortage * hours,
    config.maximum,
  );
}
