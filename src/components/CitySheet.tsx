import { useEffect, useRef } from "react";
import {
  BALANCE,
  BUILDINGS,
  BUILDING_TYPES,
  RESOURCES,
  UNITS,
  UNIT_TYPES,
} from "../data/balance";
import { costLabel, dateTime, duration, number, rate } from "../app/format";
import { useUiStore } from "../state/uiStore";
import { useGameStore } from "../state/gameStore";
import { cityRates } from "../simulation/economy";
import { cityStockpile, suppliedCityIds } from "../simulation/logistics";
import { commandProblem } from "../simulation/commands";
import type { GameState } from "../types/game";
import { cityUnderAttack } from "../simulation/combat";
import { ArmyCard } from "./ArmyCard";

export function CitySheet({ game }: { game: GameState }) {
  const { selectedCityId, cityTab, selectCity, setCityTab } = useUiStore();
  const { dispatch, busy, error } = useGameStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const city = game.cities.find((city) => city.id === selectedCityId);
  useEffect(() => {
    if (selectedCityId && !dialog.current?.open) dialog.current?.showModal();
    else if (!selectedCityId) dialog.current?.close();
  }, [selectedCityId]);
  const close = () => selectCity(null);
  if (!city) return null;
  const owned = city.ownerId === game.playerFactionId;
  const faction = game.factions.find((faction) => faction.id === city.ownerId)!;
  const rates = cityRates(game, city);
  const supplied = suppliedCityIds(game).has(city.id);
  return (
    <dialog
      ref={dialog}
      className="city-sheet"
      aria-labelledby="city-title"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <span className="eyebrow">{faction.name}</span>
            <h2 id="city-title">{city.name}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close city details"
          >
            ×
          </button>
        </header>
        <div className="city-tabs" role="group" aria-label="City sections">
          {(["Overview", "Buildings", "Army"] as const).map((tab) => (
            <button
              key={tab}
              aria-pressed={cityTab === tab}
              onClick={() => setCityTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {error && (
          <p className="notice warning" role="alert">
            {error}
          </p>
        )}
        {!owned && (
          <p className="notice">
            Foreign territory. Defeat field forces and occupy with infantry or
            cavalry to capture.
          </p>
        )}
        {cityTab === "Overview" && (
          <>
            <p className="muted capitalize">
              {city.class} city{" "}
              {cityUnderAttack(game, city.id) && (
                <strong className="warning"> · Under attack</strong>
              )}
            </p>
            {city.capture && (
              <p className="notice warning">
                Occupation in progress · completes{" "}
                {dateTime(city.capture.completesAt)}
              </p>
            )}
            {city.occupiedAt !== null && (
              <p className="notice">
                Occupied since {dateTime(city.occupiedAt)}. Secure supply and
                rebuild stability.
              </p>
            )}
            {city.criticalSince !== null && (
              <p className="notice warning">
                Rebellion imminent ·{" "}
                {duration(
                  city.criticalSince +
                    BALANCE.rebellion.durationMs -
                    game.lastUpdatedAt,
                )}{" "}
                to restore morale to {BALANCE.rebellion.threshold}.
              </p>
            )}
            <div className="stat-grid">
              <div>
                <span>Integrity / HP</span>
                <strong>
                  {Math.round(city.integrity)}
                  <small> / {city.maxIntegrity}</small>
                </strong>
              </div>
              <div>
                <span>Morale</span>
                <strong className={city.morale < 40 ? "warning" : ""}>
                  {Math.round(city.morale)}
                  <small> / 100</small>
                </strong>
              </div>
              <div>
                <span>Stability</span>
                <strong>
                  {Math.round(city.stability)}
                  <small> / 100</small>
                </strong>
              </div>
              <div>
                <span>Population</span>
                <strong>
                  {city.populationM.toFixed(1)}
                  <small> million</small>
                </strong>
              </div>
              <div>
                <span>Supply</span>
                <strong className={supplied ? "accent" : "warning"}>
                  {supplied ? "Connected" : "Isolated"}
                </strong>
              </div>
            </div>
            <p className="muted">
              {city.shortageMinutes > 0
                ? `Food shortage for ${duration(city.shortageMinutes * 60_000)}. Morale and stability are falling.`
                : "Food demand is met. Stability recovers while the city is supplied."}
            </p>
            <h3>
              City economy <span className="muted">/ hour</span>
            </h3>
            <div className="resource-breakdown">
              {RESOURCES.map((resource) => (
                <div key={resource}>
                  <span className="capitalize">{resource}</span>
                  <strong>
                    {rate(
                      rates.production[resource] - rates.consumption[resource],
                    )}
                  </strong>
                  <small>
                    {rates.production[resource].toFixed(1)} in ·{" "}
                    {rates.consumption[resource].toFixed(1)} used
                  </small>
                </div>
              ))}
            </div>
            {!supplied && (
              <p className="notice">
                Using local reserves:{" "}
                {RESOURCES.map(
                  (resource) =>
                    `${number(city.localStockpile[resource])} ${resource}`,
                ).join(" · ")}
              </p>
            )}
            <h3>Stationed armies</h3>
            <p>
              {game.armies
                .filter((army) => army.cityId === city.id)
                .map(
                  (army) =>
                    `${army.name} (${army.units.reduce((sum, unit) => sum + unit.count, 0)})`,
                )
                .join(" · ") || "No army stationed here."}
            </p>
            <h3>Infrastructure</h3>
            <p>
              {city.buildings
                .map(
                  (building) =>
                    `${BUILDINGS[building.type].label} ${building.level}`,
                )
                .join(" · ")}
            </p>
            {owned && (
              <div className="action-row">
                <button onClick={() => setCityTab("Army")}>
                  Recruit units
                </button>
                <button
                  className="secondary"
                  onClick={() => setCityTab("Buildings")}
                >
                  Develop city
                </button>
              </div>
            )}
          </>
        )}
        {cityTab === "Buildings" && (
          <div className="card-list">
            {BUILDING_TYPES.map((type) => {
              const definition = BUILDINGS[type];
              const currentLevel =
                city.buildings.find((building) => building.type === type)
                  ?.level ?? 0;
              const command = {
                kind: "build" as const,
                cityId: city.id,
                building: type,
              };
              const problem = commandProblem(game, command);
              return (
                <article className="card" key={type}>
                  <div className="card-heading">
                    <h3>{definition.label}</h3>
                    <span className="tag">
                      {currentLevel ? `Level ${currentLevel}` : "Not built"}
                    </span>
                  </div>
                  <p>{definition.description}</p>
                  <p className="cost">
                    {costLabel(definition.cost, currentLevel + 1)} ·{" "}
                    {duration(definition.durationMs * (currentLevel + 1))}
                  </p>
                  {owned && (
                    <>
                      <button
                        disabled={busy || !!problem}
                        onClick={() => void dispatch(command)}
                      >
                        {currentLevel ? "Upgrade" : "Build"} {definition.label}
                      </button>
                      {problem && (
                        <small className="action-hint">{problem}</small>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {cityTab === "Army" && (
          <>
            {owned && (
              <div className="card-list">
                {UNIT_TYPES.map((type) => {
                  const definition = UNITS[type];
                  const command = {
                    kind: "recruit" as const,
                    cityId: city.id,
                    unit: type,
                  };
                  const problem = commandProblem(game, command);
                  return (
                    <article className="card" key={type}>
                      <div className="card-heading">
                        <h3>{definition.label}</h3>
                        <span className="tag">
                          {duration(definition.recruitMs)}
                        </span>
                      </div>
                      <p className="cost">{costLabel(definition.cost)}</p>
                      <p className="muted">
                        Upkeep: {definition.upkeepMoneyPerHour} money +{" "}
                        {definition.foodPerHour} food / hour
                      </p>
                      <button
                        disabled={busy || !!problem}
                        onClick={() => void dispatch(command)}
                      >
                        Recruit {definition.label}
                      </button>
                      {problem && (
                        <small className="action-hint">{problem}</small>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <h3>Stationed forces</h3>
            {game.armies
              .filter((army) => army.cityId === city.id)
              .map((army) =>
                army.ownerId === game.playerFactionId ? (
                  <ArmyCard key={army.id} army={army} game={game} />
                ) : (
                  <p key={army.id}>
                    {army.name} ·{" "}
                    {army.units.reduce((sum, unit) => sum + unit.count, 0)}{" "}
                    units
                  </p>
                ),
              )}
            {!game.armies.some((army) => army.cityId === city.id) && (
              <p className="muted">No army stationed here.</p>
            )}
          </>
        )}
        {
          <section className="queue-section" aria-label="City queues">
            <h3>
              Orders{" "}
              <span className="muted">· {city.queues.length} queued</span>
            </h3>
            {city.queues.length === 0 ? (
              <p className="muted">
                Construction and recruitment run independently. Up to{" "}
                {BALANCE.queueLimit} orders in each queue.
              </p>
            ) : (
              city.queues.map((item) => (
                <div className="queue-item" key={item.id}>
                  <span>
                    {item.kind === "building"
                      ? `${BUILDINGS[item.building].label} ${item.level}`
                      : UNITS[item.unit].label}
                    <small>
                      {item.startedAt > game.lastUpdatedAt
                        ? "Waiting in queue"
                        : "In progress"}{" "}
                      · completes {dateTime(item.completesAt)}
                    </small>
                  </span>
                  <strong>
                    {duration(item.completesAt - game.lastUpdatedAt)}
                  </strong>
                </div>
              ))
            )}
            <p className="muted">
              Available {supplied ? "treasury" : "local reserve"}:{" "}
              {RESOURCES.map(
                (resource) =>
                  `${number(cityStockpile(game, city)[resource])} ${resource}`,
              ).join(" · ")}
            </p>
          </section>
        }
      </div>
    </dialog>
  );
}
