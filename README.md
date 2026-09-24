# Atlas Dominion

A mobile-first, persistent real-time grand-strategy game. A normal campaign is designed to last roughly seven real days.

> Conquering territory is easier than maintaining it.

This foundation deliberately uses **six cities**, three resource sites, seven land routes, a player faction and one passive AI faction. The original documentation and full world seed are preserved; the full seed is not loaded by the app.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. The dev server binds to all interfaces for phone testing on a local network. PWA installation and service workers require HTTPS or localhost; use a production HTTPS deployment to test installation on a phone.

```bash
npm test                 # Vitest simulation, persistence and store tests
npm run test:watch       # Watch unit tests
npm run build            # Strict TypeScript check + production bundle + PWA
npm run preview          # Serve dist locally
```

Optional Chromium browser checks (run against a fresh production build):

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

On a fresh Linux host, Playwright may require its system dependencies (`npx playwright install --with-deps chromium`). Browser tests cover orders, reloads, narrow phone layouts and service-worker-controlled offline reloads. They emulate phone dimensions in Chromium; they do not certify iOS Safari.

## Play the foundation

- Tap **Haven**, **Ashford** or **Greenfield** on the map to open its city sheet.
- Use **Army** to recruit infantry (15 minutes). Upgrade Barracks to level 2 to recruit cavalry (30 minutes), or construct an Arsenal for artillery (45 minutes).
- Use **Buildings** to queue construction. Costs are paid immediately. Construction and recruitment have independent serial queues with four slots each. Prerequisites must be complete before a recruitment order is accepted.
- Open **Forces** to send an army to a directly connected friendly city. Mixed armies travel at the slowest unit’s speed, modified by route terrain. Departure and arrival times are absolute timestamps.
- Tap a resource or open **Economy** to see production, consumption, net hourly rates and reserve duration when running a deficit.
- Close the page and return later. Queues, arrivals, resources, morale and stability catch up from the saved timestamp. An event log in Forces records recent orders and completions.

Each command is saved to IndexedDB before the UI reports success. Saves are local to this browser and origin. The interface refreshes and saves while visible and catches up on reload, focus and resume. Storage errors are shown, not silently ignored. A stale tab cannot overwrite a newer save from another tab; reload it to continue.

To deliberately start over during development, remove the `atlas-dominion` IndexedDB database in browser developer tools and reload. This deletes that local campaign. There is no in-game reset or save import/export in this milestone.

## Simulation and architecture

```text
src/
  app/             Application shell, formatting and mobile styles
  components/      City bottom sheet and army controls
  screens/         Forces, Economy, Tech and Diplomacy panels
  map/             Schematic renderer and MapLibre-ready GeoJSON adapter
  types/           Strongly typed game entities and command unions
  data/            Six-city campaign and central balance configuration
  simulation/      Pure TypeScript clock, RNG, economy, morale, logistics,
                   queues, movement, commands and elapsed-time advancement
  state/           Zustand orchestration, separate UI state, Dexie and save validation
public/icons/      Vector source and installable PWA icons
tests/             Determinism, offline simulation, command validation, saves
  browser/         Production browser/PWA smoke tests
```

The pure entry point is:

```ts
const next = advanceGameState(state, state.lastUpdatedAt, currentTimestamp);
```

- All times are integer Unix milliseconds. Commands apply at `state.lastUpdatedAt`; callers first advance the state to the command time.
- Economy and morale use 60-second ticks anchored to the campaign start. Partial minutes remain pending across refreshes and saves. Queues and movements resolve at exact timestamps, between ticks where necessary.
- Coincident events resolve in a fixed order: economy/morale, arrivals, then queue completions. A newly completed unit or building participates in the following economy tick. Refreshing frequently and returning after a long absence produce identical state for identical timestamped commands.
- Transitions clone their inputs. Simulation modules do not import React, Zustand, Dexie or browser APIs. They never read wall-clock time or use global randomness.
- The clock and seeded RNG are injectable. The seed and RNG state are saved. Seeded starting morale varies slightly; there are no random combat/events in this milestone.
- Each food pool allocates food proportionally, avoiding city iteration order bias. City demand, army food and wages, taxes, resource sites, shortage stages, morale convergence and stability recovery share centralized balance settings in `src/data/balance.ts`. Existing unit prices, recruitment times and speeds are read from `data/balance.json`.
- The foundation supply graph connects friendly cities to owned capitals or depots. Connected cities use faction stockpiles; isolated cities use local reserves. This is a minimal connectivity model, not full supply capacity or army attrition.
- Dexie database version **1** stores a schema-versioned game snapshot plus a transactional revision. Runtime validation checks shape, resource bounds, entity references and timestamps. Unsupported future versions and invalid saves are preserved and reported. No older application save format exists yet; future schema changes must add explicit migration before changing the version.
- The 15-second foreground refresh is only a UI convenience. No background timer is necessary for progress while closed.

## PWA and deployment

The production build generates a manifest and service worker and precaches the shell, scripts, styles and icons. Visit once online to populate the cache; subsequent play works offline. The map is a local schematic with no tile-server dependency. PWA setup follows the [Vite PWA documentation](https://vite-pwa-org.netlify.app/guide/); IndexedDB persistence uses [Dexie](https://dexie.org/docs/Typescript).

`vite.config.ts` uses a relative base and relative manifest scope/start URL. The contents of `dist/` can be deployed beneath a GitHub Pages repository path or another static HTTPS host. Publish the **build output**, not source files; do not commit `dist/`. No deployment or remote publishing is performed by the build.

## Scope and next milestone

Working now: the responsive shell, selectable map, resource economy, morale/stability, construction, all three unit types, timestamp-based friendly movement, basic supply connectivity, deterministic offline advancement, durable save/load and offline PWA shell.

The map remains a placeholder for MapLibre integration. The AI faction participates in the economy but does not issue orders. Universities are buildable infrastructure with no research output yet; fortifications currently improve target morale. Combat, capture, rebellion, advanced supply penalties, research, diplomacy, victory resolution and final artwork are not implemented. The seven-day indicator is pacing information, not an enforced campaign end. There is no aircraft, naval warfare, monetisation, backend or multiplayer.

**Recommended next milestone:** replace the schematic renderer with MapLibre using the existing geographic graph and GeoJSON adapter, retaining the same six-city fixture. Then implement and test combat, capture, occupation and rebellion before expanding the world or adding active AI.

## Project references

- `AGENTS.md` — project engineering instructions.
- `TASK.md` — this foundation's deliverables and completion checks.
- `docs/GAME_DESIGN.md` — gameplay source of truth.
- `docs/CODEX_BUILD_PROMPT.md` — implementation roadmap.
- `data/balance.json` — preserved initial balance constants.
- `data/schema.json` — preserved suggested model.
- `data/world_seed.json` — preserved 74-city seed for later milestones.
