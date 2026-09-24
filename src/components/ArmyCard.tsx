import { useState } from "react";
import type { Army, GameCommand, GameState } from "../types/game";
import { useGameStore } from "../state/gameStore";
import { commandProblem } from "../simulation/commands";
import { travelDuration } from "../simulation/movement";
import { armyIsSupplied } from "../simulation/logistics";
import { BALANCE, UNITS } from "../data/balance";
import { dateTime, duration } from "../app/format";

export function ArmyCard({ army, game }: { army: Army; game: GameState }) {
  const { dispatch, busy } = useGameStore();
  const [pending, setPending] = useState<{
    command: GameCommand;
    label: string;
    eta: number;
  } | null>(null);
  const order = army.order;
  const owned = army.ownerId === game.playerFactionId;
  const inBattle = game.battles.some((battle) => battle.cityId === army.cityId);
  const destinations = game.routes
    .filter((route) => route.a === army.cityId || route.b === army.cityId)
    .map((route) => ({
      route,
      city: game.cities.find(
        (city) => city.id === (route.a === army.cityId ? route.b : route.a),
      )!,
    }));
  const problem = pending ? commandProblem(game, pending.command) : null;
  return (
    <article className="card army-card">
      <div className="card-heading">
        <h3>{army.name}</h3>
        <span className="tag">
          {order.kind === "move"
            ? "Marching"
            : inBattle
              ? "In battle"
              : order.kind === "bombard"
                ? "Bombarding"
                : "Garrison"}
        </span>
      </div>
      <p>
        {game.factions.find((faction) => faction.id === army.ownerId)?.name}
        <br />
        {army.units
          .map((unit) => `${unit.count} ${UNITS[unit.type].label}`)
          .join(" · ")}
        <br />
        Morale {Math.round(army.morale)} ·{" "}
        {armyIsSupplied(game, army)
          ? "Supplied"
          : "Supply problem · reduced combat strength"}
      </p>
      {order.kind === "move" ? (
        <p className="accent">
          To {game.cities.find((city) => city.id === order.toId)?.name} ·
          arrives {dateTime(order.arrivesAt)}
          <br />
          <small>
            {duration(order.arrivesAt - game.lastUpdatedAt)} remaining
          </small>
        </p>
      ) : (
        <>
          <p className="muted">
            Stationed in{" "}
            {game.cities.find((city) => city.id === army.cityId)?.name}
          </p>
          {order.kind === "bombard" && (
            <p className="warning">
              Target:{" "}
              {game.cities.find((city) => city.id === order.targetCityId)?.name}
              {order.targetArmyId ? " · field army" : " · city integrity"}
              <br />
              Next salvo {dateTime(order.nextFireAt)}
              {!armyIsSupplied(game, army) && " · fire paused until supplied"}
            </p>
          )}
          {owned &&
            (pending ? (
              <div className="order-confirmation">
                <h3>{pending.label}</h3>
                <p>
                  {pending.command.kind === "move"
                    ? "Travel time"
                    : "First salvo in"}
                  : {duration(pending.eta)}
                  <br />
                  Estimated {dateTime(game.lastUpdatedAt + pending.eta)}
                </p>
                {problem && <p className="warning">{problem}</p>}
                <div className="action-row">
                  <button
                    disabled={busy || !!problem}
                    onClick={async () => {
                      await dispatch(pending.command);
                      setPending(null);
                    }}
                  >
                    Confirm order
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setPending(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {order.kind === "bombard" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void dispatch({ kind: "hold", armyId: army.id })
                    }
                  >
                    Stop bombardment
                  </button>
                )}
                <div className="action-row">
                  {destinations.map(({ route, city }) => {
                    const command = {
                      kind: "move" as const,
                      armyId: army.id,
                      toId: city.id,
                    };
                    return (
                      <button
                        className="secondary"
                        key={city.id}
                        disabled={busy || !!commandProblem(game, command)}
                        onClick={() =>
                          setPending({
                            command,
                            label: `Move to ${city.name}`,
                            eta: travelDuration(army, route),
                          })
                        }
                      >
                        Move to {city.name}
                        <small>
                          {duration(travelDuration(army, route))}
                          {route.label ? ` · ${route.label}` : ""}
                          {city.ownerId !== army.ownerId ? " · hostile" : ""}
                        </small>
                      </button>
                    );
                  })}
                </div>
                {army.units.some((stack) => stack.type === "artillery") &&
                  order.kind !== "bombard" && (
                    <div className="bombard-options">
                      <h3>
                        Artillery targets · {BALANCE.artillery.rangeKm} campaign
                        km
                      </h3>
                      {destinations
                        .flatMap(({ city }) => [
                          ...(city.ownerId !== army.ownerId
                            ? [
                                {
                                  cityId: city.id,
                                  armyId: undefined,
                                  name: city.name,
                                },
                              ]
                            : []),
                          ...game.armies
                            .filter(
                              (target) =>
                                target.cityId === city.id &&
                                target.ownerId !== army.ownerId,
                            )
                            .map((target) => ({
                              cityId: city.id,
                              armyId: target.id,
                              name: target.name,
                            })),
                        ])
                        .map((target) => {
                          const command = {
                            kind: "bombard" as const,
                            armyId: army.id,
                            targetCityId: target.cityId,
                            targetArmyId: target.armyId,
                          };
                          const unavailable = commandProblem(game, command);
                          return (
                            <div key={target.armyId ?? target.cityId}>
                              <button
                                className="secondary"
                                disabled={busy || !!unavailable}
                                onClick={() =>
                                  setPending({
                                    command,
                                    label: `Bombard ${target.name}`,
                                    eta: BALANCE.artillery.cooldownMs,
                                  })
                                }
                              >
                                Bombard {target.name}
                              </button>
                              {unavailable && (
                                <small className="action-hint">
                                  {unavailable}
                                </small>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
              </>
            ))}
        </>
      )}
    </article>
  );
}
