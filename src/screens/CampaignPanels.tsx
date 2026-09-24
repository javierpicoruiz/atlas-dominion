import { RESOURCES } from "../data/balance";
import { duration, number, rate, time } from "../app/format";
import type { GameState } from "../types/game";
import { factionRates } from "../simulation/economy";
import { useUiStore, type Tab } from "../state/uiStore";
import { ArmyCard } from "../components/ArmyCard";

export function CampaignPanels({
  tab,
  game,
}: {
  tab: Exclude<Tab, "World">;
  game: GameState;
}) {
  const selectCity = useUiStore((state) => state.selectCity);
  const faction = game.factions.find(
    (faction) => faction.id === game.playerFactionId,
  )!;
  const rates = factionRates(game, faction.id);
  return (
    <section className="panel">
      <span className="eyebrow">CAMPAIGN COMMAND</span>
      <h1>{tab === "Tech" ? "Technology" : tab}</h1>
      {tab === "Forces" && (
        <>
          <p className="intro">
            Recruit in your cities. Redeploy along friendly land routes.
          </p>
          <div className="card-list">
            {game.armies
              .filter((army) => army.ownerId === faction.id)
              .map((army) => (
                <ArmyCard key={army.id} army={army} game={game} />
              ))}
          </div>
          <p className="notice">
            The slowest unit sets an army’s speed. Combat and hostile movement
            are planned for the military milestone.
          </p>
        </>
      )}
      {tab === "Economy" && (
        <>
          <p className="intro">
            Strong cities begin with a sustainable treasury.
          </p>
          <div className="economy-grid">
            {RESOURCES.map((resource) => {
              const net =
                rates.production[resource] - rates.consumption[resource];
              return (
                <article className="card" key={resource}>
                  <span className="eyebrow">{resource}</span>
                  <h2>{number(faction.resources[resource])}</h2>
                  <strong className={net < 0 ? "warning" : "accent"}>
                    {rate(net)} / hour
                  </strong>
                  <p>
                    {rates.production[resource].toFixed(1)} produced
                    <br />
                    {rates.consumption[resource].toFixed(1)} consumed
                  </p>
                  <small>
                    {net < 0
                      ? `${duration((faction.resources[resource] / -net) * 3_600_000)} reserve at current burn`
                      : "Reserves are growing"}
                  </small>
                </article>
              );
            })}
          </div>
          <h2>Your cities</h2>
          <div className="card-list">
            {game.cities
              .filter((city) => city.ownerId === faction.id)
              .map((city) => (
                <button
                  key={city.id}
                  className="city-row secondary"
                  onClick={() => selectCity(city.id)}
                >
                  <strong>{city.name}</strong>
                  <span>
                    {Math.round(city.morale)} morale ·{" "}
                    {Math.round(city.stability)} stability →
                  </span>
                </button>
              ))}
          </div>
          <p className="muted">
            Treasury rates include connected cities, resource sites and army
            upkeep. Isolated cities use their own reserves. Rates update each
            simulated minute.
          </p>
        </>
      )}
      {tab === "Tech" && (
        <>
          <p className="intro">Lay the groundwork for a stronger state.</p>
          <article className="card">
            <span className="tag">Future milestone</span>
            <h2>Knowledge takes infrastructure.</h2>
            <p>
              Universities can be constructed now. Research points and the
              technology tree will arrive after the military and logistics loop
              is established.
            </p>
            <button onClick={() => selectCity(faction.capitalId)}>
              Inspect your capital
            </button>
          </article>
        </>
      )}
      {tab === "Diplomacy" && (
        <>
          <p className="intro">Two factions share the Meridian frontier.</p>
          {game.factions.map((other) => (
            <article className="card" key={other.id}>
              <span className="eyebrow">
                {other.controller === "player"
                  ? "Your faction"
                  : "AI faction · passive foundation"}
              </span>
              <h2 style={{ color: other.color }}>{other.name}</h2>
              <p>
                {game.cities.filter((city) => city.ownerId === other.id).length}{" "}
                cities · Capital:{" "}
                {game.cities.find((city) => city.id === other.capitalId)?.name}
              </p>
            </article>
          ))}
          <p className="notice">
            The Eastern Accord’s cities produce and consume resources. AI
            decisions, war and treaties are future milestones.
          </p>
        </>
      )}
      {tab === "Forces" && (
        <section className="event-log">
          <h2>Recent orders</h2>
          {game.events.length ? (
            [...game.events]
              .reverse()
              .slice(0, 10)
              .map((event) => (
                <p key={event.id}>
                  <time>{time(event.at)}</time>
                  {event.message}
                </p>
              ))
          ) : (
            <p className="muted">Your first orders will appear here.</p>
          )}
        </section>
      )}
    </section>
  );
}
