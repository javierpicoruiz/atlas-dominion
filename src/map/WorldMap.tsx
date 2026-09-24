import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { GameState } from "../types/game";
import {
  armyRouteGeoJSON,
  armyVisualPosition,
  campaignGeoJSON,
} from "./mapData";
import { useUiStore } from "../state/uiStore";
import { armyIsSupplied, suppliedCityIds } from "../simulation/logistics";
import { cityUnderAttack, unitCount } from "../simulation/combat";
import { duration, time } from "../app/format";
import { BALANCE } from "../data/balance";

setWorkerUrl(workerUrl);

function MapMarker({
  map,
  lon,
  lat,
  offset = 0,
  offsetX = 0,
  children,
}: {
  map: Map;
  lon: number;
  lat: number;
  offset?: number;
  offsetX?: number;
  children: ReactNode;
}) {
  const [element] = useState(() => document.createElement("div"));
  const marker = useRef<Marker | null>(null);
  useEffect(() => {
    marker.current = new Marker({ element, offset: [offsetX, offset] })
      .setLngLat([lon, lat])
      .addTo(map);
    return () => {
      marker.current?.remove();
    };
    // Position updates are handled separately to retain focus on live markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, offset, offsetX]);
  useEffect(() => {
    marker.current?.setLngLat([lon, lat]);
  }, [lon, lat]);
  return createPortal(children, element);
}
export function WorldMap({ game }: { game: GameState }) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const initial = useRef(game);
  const { selectCity, selectArmy } = useUiStore();
  const supplied = suppliedCityIds(game);
  const fit = (instance: Map) => {
    const cities = initial.current.cities;
    instance.fitBounds(
      [
        [
          Math.min(...cities.map((c) => c.lon)),
          Math.min(...cities.map((c) => c.lat)),
        ],
        [
          Math.max(...cities.map((c) => c.lon)),
          Math.max(...cities.map((c) => c.lat)),
        ],
      ],
      { padding: { top: 105, bottom: 130, left: 65, right: 65 }, duration: 0 },
    );
  };
  useEffect(() => {
    if (!container.current) return;
    let instance: Map;
    try {
      instance = new Map({
        container: container.current,
        center: [5.2, 49.2],
        zoom: 5,
        minZoom: 3,
        maxZoom: 12,
        maxBounds: [
          [-12, 35],
          [25, 62],
        ],
        style: {
          version: 8,
          sources: {
            geography: {
              type: "geojson",
              data: `${import.meta.env.BASE_URL}maps/europe.geojson`,
              attribution:
                '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
            },
            campaign: {
              type: "geojson",
              data: campaignGeoJSON(initial.current),
            },
            orders: {
              type: "geojson",
              data: armyRouteGeoJSON(initial.current),
            },
          },
          layers: [
            {
              id: "sea",
              type: "background",
              paint: { "background-color": "#112d39" },
            },
            {
              id: "land",
              type: "fill",
              source: "geography",
              paint: { "fill-color": "#304b40" },
            },
            {
              id: "borders",
              type: "line",
              source: "geography",
              paint: {
                "line-color": "#8fa88a",
                "line-width": 1,
                "line-opacity": 0.5,
              },
            },
            {
              id: "land-routes",
              type: "line",
              source: "campaign",
              filter: ["==", "kind", "route"],
              paint: {
                "line-color": "#c7c698",
                "line-width": 2,
                "line-dasharray": [2, 3],
                "line-opacity": 0.7,
              },
            },
            {
              id: "army-routes",
              type: "line",
              source: "orders",
              paint: {
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": 0.85,
              },
            },
            {
              id: "destinations",
              type: "circle",
              source: "campaign",
              filter: ["==", "kind", "city"],
              paint: {
                "circle-radius": 18,
                "circle-color": "#aaca99",
                "circle-opacity": 0.1,
              },
            },
          ],
        },
      });
    } catch {
      setMapError(true);
      return;
    }
    instance.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );
    instance.on("load", () => {
      fit(instance);
      setMap(instance);
    });
    instance.on("error", () => setMapError(true));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      setMap(null);
      instance.remove();
    };
  }, []);
  useEffect(() => {
    if (!map) return;
    (map.getSource("campaign") as GeoJSONSource).setData(campaignGeoJSON(game));
    (map.getSource("orders") as GeoJSONSource).setData(armyRouteGeoJSON(game));
  }, [map, game]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const visibleAt = Math.max(now, game.lastUpdatedAt);
  return (
    <section className="world-map" aria-label="World map">
      <div
        className="map-canvas"
        ref={container}
        data-testid="geographic-map"
        data-ready={!!map}
      />
      <div className="map-heading">
        <span className="eyebrow">THE MERIDIAN FRONTIER</span>
        <h1>A foothold in the world.</h1>
        <p>Six cities. One beginning.</p>
      </div>
      {map && (
        <>
          <button className="map-fit secondary" onClick={() => fit(map)}>
            Fit campaign
          </button>
          {[
            { name: "FRANCE", lon: 2.1, lat: 48.7 },
            { name: "BELGIUM", lon: 4.6, lat: 51.05 },
            { name: "GERMANY", lon: 8.2, lat: 50.4 },
            { name: "SWITZERLAND", lon: 7.4, lat: 46.9 },
          ].map((label) => (
            <MapMarker key={label.name} map={map} {...label}>
              <span className="country-label">{label.name}</span>
            </MapMarker>
          ))}
          {game.cities.map((city) => {
            const faction = game.factions.find((f) => f.id === city.ownerId)!;
            const attack = cityUnderAttack(game, city.id);
            const shortage = !supplied.has(city.id) || city.shortageMinutes > 0;
            const morale =
              city.morale < BALANCE.rebellion.threshold
                ? "critical"
                : city.morale < 50
                  ? "unsettled"
                  : "steady";
            return (
              <MapMarker key={city.id} map={map} lon={city.lon} lat={city.lat}>
                <button
                  className={`city-marker ${morale}`}
                  style={{ "--faction": faction.color } as CSSProperties}
                  onClick={() => selectCity(city.id)}
                  aria-label={`${city.name}, ${faction.name}, ${city.class}, morale ${Math.round(city.morale)}${attack ? ", under attack" : ""}${shortage ? ", supply problem" : ""}`}
                >
                  <span className="city-symbol">
                    {city.class === "town"
                      ? "▣"
                      : city.class === "regional"
                        ? "◆"
                        : "♜"}
                  </span>
                  <strong>{city.name}</strong>
                  <span className="city-marker-meta">
                    {city.class} · {Math.round(city.morale)}% {morale}
                  </span>
                  {(attack || shortage) && (
                    <span className="map-warning">
                      {attack ? "⚔ Under attack " : ""}
                      {shortage ? "! Supply" : ""}
                    </span>
                  )}
                </button>
              </MapMarker>
            );
          })}
          {game.armies.map((army) => {
            const point = armyVisualPosition(game, army, visibleAt);
            const faction = game.factions.find((f) => f.id === army.ownerId)!;
            const order = army.order;
            const composition = army.units
              .map((stack) => `${stack.count}${stack.type[0].toUpperCase()}`)
              .join(" ");
            const index = game.armies
              .filter((a) => a.cityId === army.cityId)
              .findIndex((a) => a.id === army.id);
            return (
              <MapMarker
                key={army.id}
                map={map}
                {...point}
                offsetX={44}
                offset={-48 - (order.kind === "move" ? 0 : index * 48)}
              >
                <button
                  className="army-marker"
                  style={{ "--faction": faction.color } as CSSProperties}
                  onClick={() => selectArmy(army.id)}
                  aria-label={`${army.name}, ${faction.name}, ${unitCount(army)} units, ${order.kind}`}
                >
                  <strong>
                    {order.kind === "move"
                      ? "➤"
                      : order.kind === "bombard"
                        ? "✹"
                        : "⚑"}{" "}
                    {unitCount(army)} · {composition}
                  </strong>
                  {order.kind === "move" ? (
                    <small>
                      →{" "}
                      {game.cities.find((city) => city.id === order.toId)?.name}{" "}
                      · {duration(order.arrivesAt - visibleAt)}
                    </small>
                  ) : (
                    <small>
                      {order.kind === "bombard" ? "Bombarding" : "Stationed"}
                      {!armyIsSupplied(game, army) ? " · ! Supply" : ""}
                    </small>
                  )}
                </button>
              </MapMarker>
            );
          })}
        </>
      )}
      {mapError && (
        <p className="map-error">
          Map unavailable. Use Forces or Economy to inspect cities and issue
          orders.
        </p>
      )}
      <details className="map-events">
        <summary>
          Campaign events{" "}
          {game.events.length > 0
            ? `· ${game.events.length}`
            : "· no orders yet"}
          <small>{game.events.at(-1)?.message}</small>
        </summary>
        <div>
          {[...game.events].reverse().map((event) => (
            <button
              key={event.id}
              onClick={() => event.cityId && selectCity(event.cityId)}
            >
              <time>{time(event.at)}</time> {event.message}
            </button>
          ))}
        </div>
      </details>
      <div className="map-legend">
        ◆ Regional · ▣ Town · I Infantry · C Cavalry · A Artillery
        <br />
        Green: Meridian · Amber: Eastern · Pink: Rebels
      </div>
    </section>
  );
}
