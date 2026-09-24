import { BALANCE, HOUR, UNITS } from "../data/balance";
import type { Army, GameState } from "../types/game";
import { armyIsSupplied } from "./logistics";
import { fortificationLevel, transferCity } from "./cities";
import { recordEvent } from "./events";
import type { SeededRng } from "./rng";

export const unitCount = (army: Army) =>
  army.units.reduce((n, stack) => n + stack.count, 0);
export const hasDirectUnits = (army: Army) =>
  army.units.some((stack) => stack.type !== "artillery" && stack.count > 0);
const stationed = (state: GameState, cityId: string) =>
  state.armies.filter((army) => army.cityId === cityId);
export const cityUnderAttack = (state: GameState, cityId: string) =>
  state.battles.some((battle) => battle.cityId === cityId) ||
  !!state.cities.find((city) => city.id === cityId)?.capture ||
  state.armies.some(
    (army) =>
      army.order.kind === "bombard" && army.order.targetCityId === cityId,
  );

export function combatFactor(state: GameState, army: Army): number {
  return (
    Math.max(
      BALANCE.combat.minimumMoraleFactor,
      army.morale / BALANCE.morale.maximum,
    ) * (armyIsSupplied(state, army) ? 1 : BALANCE.combat.unsuppliedFactor)
  );
}

/** Integer casualties with persistent partial damage; infantry screens artillery. */
export function damageArmy(army: Army, damage: number): void {
  army.damage += damage;
  for (const type of ["infantry", "cavalry", "artillery"] as const) {
    const stack = army.units.find((unit) => unit.type === type);
    if (!stack) continue;
    const lost = Math.min(
      stack.count,
      Math.floor(army.damage / UNITS[type].hp),
    );
    stack.count -= lost;
    army.damage -= lost * UNITS[type].hp;
    army.morale = Math.max(
      0,
      army.morale - lost * BALANCE.combat.casualtyMoraleLoss,
    );
    if (stack.count > 0) break;
  }
  army.units = army.units.filter((stack) => stack.count > 0);
}

export function syncMilitary(state: GameState, at: number): void {
  state.armies = state.armies.filter((army) => unitCount(army) > 0);
  for (const city of state.cities) {
    const armies = stationed(state, city.id);
    const contested = new Set(armies.map((army) => army.ownerId)).size > 1;
    const battle = state.battles.find((entry) => entry.cityId === city.id);
    if (contested && !battle) {
      state.battles.push({
        cityId: city.id,
        startedAt: at,
        nextRoundAt: at + BALANCE.combat.intervalMs,
      });
      recordEvent(
        state,
        at,
        `Battle started at ${city.name}.`,
        "battle-start",
        city.id,
      );
    } else if (!contested && battle) {
      state.battles = state.battles.filter((entry) => entry !== battle);
      const winner = state.factions.find(
        (faction) => faction.id === armies[0]?.ownerId,
      )?.name;
      recordEvent(
        state,
        at,
        `Battle ended at ${city.name}. ${winner ? `${winner} holds the field.` : "Both forces were destroyed."}`,
        "battle-end",
        city.id,
      );
    }
    const attacker =
      !contested &&
      armies.find(
        (army) => army.ownerId !== city.ownerId && hasDirectUnits(army),
      );
    if (!attacker) city.capture = null;
    else if (city.capture?.factionId !== attacker.ownerId) {
      const duration =
        BALANCE.capture.durationMs *
        Math.max(
          BALANCE.capture.minimumIntegrityFactor,
          city.integrity / city.maxIntegrity,
        ) *
        (1 + fortificationLevel(city) * BALANCE.capture.fortificationDelay);
      city.capture = {
        factionId: attacker.ownerId,
        startedAt: at,
        completesAt: at + Math.ceil(duration),
      };
    }
    // Direct contact interrupts ranged fire; invalid/defeated targets end the order.
    for (const army of armies) {
      if (army.order.kind !== "bombard") continue;
      if (
        contested ||
        bombardProblem(
          state,
          army,
          army.order.targetCityId,
          army.order.targetArmyId,
          false,
        )
      )
        army.order = { kind: "hold" };
    }
  }
}

export function resolveBattles(
  state: GameState,
  at: number,
  rng: SeededRng,
): void {
  const damage = new Map<Army, number>();
  for (const battle of state.battles) {
    if (battle.nextRoundAt > at) continue;
    const city = state.cities.find((entry) => entry.id === battle.cityId)!;
    const armies = stationed(state, city.id).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    for (const attacker of armies) {
      const enemies = armies.filter(
        (army) => army.ownerId !== attacker.ownerId,
      );
      const total = enemies.reduce((sum, army) => sum + unitCount(army), 0);
      const attack =
        ((attacker.units.reduce(
          (sum, stack) => sum + UNITS[stack.type].attack * stack.count,
          0,
        ) *
          combatFactor(state, attacker) *
          BALANCE.combat.intervalMs) /
          HOUR) *
        (1 + (rng.next() * 2 - 1) * BALANCE.combat.variance);
      for (const defender of enemies) {
        const defence =
          defender.units.reduce(
            (sum, stack) => sum + UNITS[stack.type].defence * stack.count,
            0,
          ) / unitCount(defender);
        const cityBonus =
          defender.ownerId === city.ownerId
            ? ((BALANCE.combat.cityDefence +
                fortificationLevel(city) *
                  BALANCE.combat.fortificationDefence) *
                city.integrity) /
              city.maxIntegrity
            : 0;
        const received =
          (attack * unitCount(defender)) / total / (defence * (1 + cityBonus));
        damage.set(defender, (damage.get(defender) ?? 0) + received);
      }
    }
    battle.nextRoundAt += BALANCE.combat.intervalMs;
  }
  // Snapshot attacks first: neither army iteration order nor first-strike bias decides the winner.
  for (const [army, amount] of damage) damageArmy(army, amount);
}

export function resolveCaptures(state: GameState, at: number): void {
  for (const city of state.cities) {
    if (!city.capture || city.capture.completesAt > at) continue;
    const owner = city.capture.factionId;
    transferCity(state, city, owner);
    city.stability = BALANCE.capture.stability;
    city.morale = Math.min(city.morale, BALANCE.capture.morale);
    city.occupiedAt = at;
    recordEvent(
      state,
      at,
      `${city.name} captured by ${state.factions.find((faction) => faction.id === owner)!.name}. Occupation begins.`,
      "capture",
      city.id,
    );
  }
}

export function bombardProblem(
  state: GameState,
  army: Army,
  targetCityId: string,
  targetArmyId: string | null,
  checkSupply = true,
): string | null {
  if (!army.cityId) return "Moving armies cannot bombard.";
  if (!army.units.some((stack) => stack.type === "artillery"))
    return "Requires artillery.";
  if (
    state.armies.some(
      (other) => other.cityId === army.cityId && other.ownerId !== army.ownerId,
    )
  )
    return "Army is in direct combat.";
  const city = state.cities.find((entry) => entry.id === targetCityId);
  const target = targetArmyId
    ? state.armies.find((entry) => entry.id === targetArmyId)
    : null;
  if (
    !city ||
    (targetArmyId
      ? !target || target.cityId !== city.id || target.ownerId === army.ownerId
      : city.ownerId === army.ownerId)
  )
    return "Choose an enemy city or stationed army.";
  const route = state.routes.find(
    (entry) =>
      (entry.a === army.cityId && entry.b === city.id) ||
      (entry.b === army.cityId && entry.a === city.id),
  );
  if (!route || route.distanceKm > BALANCE.artillery.rangeKm)
    return "Target must be connected and within artillery range.";
  if (checkSupply && !armyIsSupplied(state, army))
    return "Artillery requires supply.";
  return null;
}

export function resolveBombardment(state: GameState, at: number): void {
  const damage = new Map<Army, number>();
  for (const army of state.armies) {
    const order = army.order;
    if (order.kind !== "bombard" || order.nextFireAt > at) continue;
    order.nextFireAt += BALANCE.artillery.cooldownMs;
    if (bombardProblem(state, army, order.targetCityId, order.targetArmyId))
      continue;
    const guns = army.units.find((stack) => stack.type === "artillery")!.count;
    const factor = guns * combatFactor(state, army);
    const city = state.cities.find((entry) => entry.id === order.targetCityId)!;
    if (order.targetArmyId) {
      const target = state.armies.find(
        (entry) => entry.id === order.targetArmyId,
      )!;
      damage.set(
        target,
        (damage.get(target) ?? 0) + BALANCE.artillery.armyDamage * factor,
      );
    } else {
      city.integrity = Math.max(
        0,
        city.integrity -
          (BALANCE.artillery.cityDamage * factor) /
            (1 +
              fortificationLevel(city) *
                BALANCE.artillery.fortificationProtection),
      );
      city.morale = Math.max(
        0,
        city.morale - BALANCE.artillery.moraleDamage * factor,
      );
      city.stability = Math.max(
        0,
        city.stability - BALANCE.artillery.stabilityDamage * factor,
      );
    }
  }
  for (const [army, amount] of damage) damageArmy(army, amount);
}
