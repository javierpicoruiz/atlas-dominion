import { useEffect, useState } from "react";
import { useGameStore } from "../state/gameStore";
import { useUiStore, type Tab } from "../state/uiStore";
import { BALANCE, HOUR, RESOURCES } from "../data/balance";
import { factionRates } from "../simulation/economy";
import { duration, number, rate, time } from "./format";
import { WorldMap } from "../map/WorldMap";
import { CitySheet } from "../components/CitySheet";
import { CampaignPanels } from "../screens/CampaignPanels";

const tabs: { name: Tab; icon: string }[] = [
  { name: "World", icon: "◎" },
  { name: "Forces", icon: "⚑" },
  { name: "Economy", icon: "▥" },
  { name: "Tech", icon: "⌘" },
  { name: "Diplomacy", icon: "⚐" },
];
export default function App() {
  const {
    game,
    status,
    busy,
    error,
    resumedMs,
    initialize,
    refresh,
    clearError,
  } = useGameStore();
  const { tab, setTab } = useUiStore();
  const [showResume, setShowResume] = useState(true);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    // This only refreshes the visible screen. Simulation always derives elapsed time from saved timestamps.
    const interval = window.setInterval(resume, 15_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
    };
  }, [refresh]);
  if (!game || status === "error")
    return (
      <main className="loading-screen">
        <img src="./icons/atlas.svg" alt="" width="84" height="84" />
        <span className="eyebrow">ATLAS DOMINION</span>
        <h1>
          {status === "error"
            ? "Campaign unavailable"
            : "Opening your campaign…"}
        </h1>
        <p role="status">
          {error ?? "Restoring orders and calculating elapsed time."}
        </p>
        {status === "error" && (
          <button onClick={() => window.location.reload()}>
            Retry loading
          </button>
        )}
      </main>
    );
  const faction = game.factions.find(
    (faction) => faction.id === game.playerFactionId,
  )!;
  const rates = factionRates(game, faction.id);
  const day =
    Math.floor((game.lastUpdatedAt - game.startedAt) / (24 * HOUR)) + 1;
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <a
            href="#world"
            onClick={(event) => {
              event.preventDefault();
              setTab("World");
            }}
          >
            <img src="./icons/atlas.svg" alt="" />
            ATLAS <span>DOMINION</span>
          </a>
          <span className="campaign-day">
            DAY {day} <span>/ {BALANCE.campaignHours / 24}</span>
          </span>
        </div>
        <div className="resource-bar" aria-label="Treasury">
          {RESOURCES.map((resource) => (
            <button
              key={resource}
              onClick={() => setTab("Economy")}
              aria-label={`${resource}: ${number(faction.resources[resource])}, ${rate(rates.production[resource] - rates.consumption[resource])} per hour`}
            >
              <span className="resource-name">{resource}</span>
              <strong>{number(faction.resources[resource])}</strong>
              <small
                className={
                  rates.production[resource] < rates.consumption[resource]
                    ? "warning"
                    : ""
                }
              >
                {rate(rates.production[resource] - rates.consumption[resource])}
                /h
              </small>
            </button>
          ))}
        </div>
      </header>
      <main className="main-view">
        {tab === "World" ? (
          <WorldMap game={game} />
        ) : (
          <CampaignPanels tab={tab} game={game} />
        )}
      </main>
      {showResume && resumedMs >= 60_000 && (
        <div className="resume-toast" role="status">
          <span>
            <strong>Welcome back.</strong> Your campaign advanced{" "}
            {duration(resumedMs)}. Check Forces for completed orders.
          </span>
          <button
            className="icon-button"
            onClick={() => setShowResume(false)}
            aria-label="Dismiss catch-up summary"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      <footer className="app-footer">
        <div className="save-status" role="status">
          <span className="status-dot" />
          {busy
            ? "Saving campaign…"
            : `Saved locally · ${time(game.lastUpdatedAt)}`}
          <span>Orders continue while away</span>
        </div>
        <nav aria-label="Main navigation">
          {tabs.map(({ name, icon }) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              <span aria-hidden="true">{icon}</span>
              {name}
            </button>
          ))}
        </nav>
      </footer>
      <CitySheet game={game} />
    </div>
  );
}
