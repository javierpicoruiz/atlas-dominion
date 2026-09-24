import type { CSSProperties } from "react";
import type { GameState } from "../types/game";
import { useUiStore } from "../state/uiStore";
import { project } from "./mapData";

export function WorldMap({ game }: { game: GameState }) {
  const selectCity = useUiStore((state) => state.selectCity);
  return (
    <section className="world-map" aria-label="Six-city campaign map">
      <svg
        className="terrain"
        viewBox="0 0 600 800"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M60 0H0V60"
              fill="none"
              stroke="#adc5a1"
              strokeWidth=".5"
              opacity=".1"
            />
          </pattern>
          <radialGradient id="land">
            <stop stopColor="#3c5144" />
            <stop offset="1" stopColor="#223c36" />
          </radialGradient>
        </defs>
        <rect width="600" height="800" fill="#162f32" />
        <path
          d="M-30 40 110 0 370 30 650-20 670 680 530 730 470 680 420 730 370 690 310 750 220 710 160 800 110 700 40 680 70 590 0 520Z"
          fill="url(#land)"
          stroke="#718675"
          strokeOpacity=".3"
        />
        <g fill="none" stroke="#80927a" opacity=".12" strokeWidth="1.2">
          <path d="M-20 230Q100 90 250 180T630 140M-20 250Q100 110 250 200T630 160M-20 270Q100 130 250 220T630 180M-20 290Q100 150 250 240T630 200" />
          <path d="M170 700Q220 530 370 570T650 470M150 680Q200 510 370 550T650 450M130 660Q180 490 370 530T650 430" />
          <path d="M320 90 350 35 385 100 415 60 455 125 480 80 530 145" />
        </g>
        <path
          d="M290-30Q200 140 295 285T260 520Q220 640 160 800"
          fill="none"
          stroke="#538486"
          strokeWidth="6"
          opacity=".45"
        />
        <rect width="600" height="800" fill="url(#grid)" />
      </svg>
      <div className="map-heading">
        <span className="eyebrow">THE MERIDIAN FRONTIER</span>
        <h1>A foothold in the world.</h1>
        <p>Six cities. One beginning.</p>
      </div>
      <div className="map-north" aria-hidden="true">
        N<span>↑</span>
      </div>
      <svg
        className="route-layer"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {game.routes.map((route) => {
          const a = project(game.cities.find((city) => city.id === route.a)!);
          const b = project(game.cities.find((city) => city.id === route.b)!);
          return (
            <line
              key={route.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <span className="region-label west" aria-hidden="true">
        MERIDIAN UNION
      </span>
      <span className="region-label east" aria-hidden="true">
        EASTERN ACCORD
      </span>
      {game.cities.map((city) => {
        const point = project(city);
        const faction = game.factions.find(
          (faction) => faction.id === city.ownerId,
        )!;
        const count = game.armies
          .filter((army) => army.cityId === city.id)
          .reduce(
            (sum, army) =>
              sum + army.units.reduce((total, unit) => total + unit.count, 0),
            0,
          );
        return (
          <button
            className={`city-marker ${city.ownerId === game.playerFactionId ? "friendly" : ""}`}
            key={city.id}
            style={
              {
                left: `${point.x}%`,
                top: `${point.y}%`,
                "--faction": faction.color,
              } as CSSProperties
            }
            onClick={() => selectCity(city.id)}
            aria-label={`${city.name}, ${faction.name}, morale ${Math.round(city.morale)}${city.queues.length ? ", active queue" : ""}`}
          >
            <span className="city-symbol">
              {city.id === faction.capitalId ? "◆" : "▣"}
            </span>
            <strong>{city.name}</strong>
            <span className="city-marker-meta">
              {Math.round(city.morale)}% morale
              {count > 0 && ` · ${count} units`}
              {city.queues.length > 0 && " · ◷"}
            </span>
          </button>
        );
      })}
      {game.armies
        .filter((army) => army.order.kind === "move")
        .map((army) => {
          if (army.order.kind !== "move") return null;
          const order = army.order;
          const from = project(
            game.cities.find((city) => city.id === order.fromId)!,
          );
          const to = project(
            game.cities.find((city) => city.id === order.toId)!,
          );
          const progress = Math.min(
            1,
            (game.lastUpdatedAt - army.order.departedAt) /
              (army.order.arrivesAt - army.order.departedAt),
          );
          return (
            <span
              key={army.id}
              className="moving-army"
              title={`${army.name} marching`}
              style={{
                left: `${from.x + (to.x - from.x) * progress}%`,
                top: `${from.y + (to.y - from.y) * progress}%`,
              }}
            >
              ➤
            </span>
          );
        })}
      <div className="map-footer">
        <div className="legend">
          <span>
            <i /> You
          </span>
          <span>
            <i className="enemy" /> Eastern Accord
          </span>
        </div>
        <p>Tap a city to inspect and give orders</p>
        <small>Schematic map · route distances are campaign values</small>
      </div>
    </section>
  );
}
