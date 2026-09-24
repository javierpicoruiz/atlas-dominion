import type { Army, GameState } from "../types/game";
import { useGameStore } from "../state/gameStore";
import { commandProblem } from "../simulation/commands";
import { travelDuration } from "../simulation/movement";
import { UNITS } from "../data/balance";
import { dateTime, duration } from "../app/format";

export function ArmyCard({ army, game }: { army: Army; game: GameState }) {
  const dispatch = useGameStore((state) => state.dispatch);
  const busy = useGameStore((state) => state.busy);
  const order = army.order;
  const destinations = game.routes
    .filter((route) => route.a === army.cityId || route.b === army.cityId)
    .map((route) => ({
      route,
      city: game.cities.find(
        (city) => city.id === (route.a === army.cityId ? route.b : route.a),
      )!,
    }))
    .filter(({ city }) => city.ownerId === army.ownerId);
  return (
    <article className="card army-card">
      <div className="card-heading">
        <h3>{army.name}</h3>
        <span className="tag">
          {order.kind === "move" ? "Marching" : "Garrison"}
        </span>
      </div>
      <p>
        {army.units
          .map((unit) => `${unit.count} ${UNITS[unit.type].label}`)
          .join(" · ")}
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
                  onClick={() => void dispatch(command)}
                >
                  Move to {city.name}{" "}
                  <small>{duration(travelDuration(army, route))}</small>
                </button>
              );
            })}
          </div>
          {destinations.length === 0 && (
            <p className="muted">No connected friendly destinations.</p>
          )}
        </>
      )}
    </article>
  );
}
