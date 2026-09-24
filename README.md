# Atlas Dominion

A mobile-first, persistent real-time grand-strategy prototype. A normal campaign is designed to last roughly seven real days.

> Conquering territory is easier than maintaining it.

The **second playable milestone** keeps the original **six cities**, three resource sites, seven land routes, and two starting factions. It adds a geographical MapLibre map, army orders, deterministic combat, artillery, occupation and rebellion. The 74-city world seed remains unused.

## Run locally

Requires Node.js 22.12+ and npm.

```bash
npm ci
npm run dev
npm test                 # Simulation, persistence, migration and store tests
npm run test:watch
npm run build            # TypeScript + production bundle + PWA
npm run preview
```

The dev server binds to all interfaces for phone testing. PWA installation requires HTTPS or localhost. Browser checks run against a fresh production build:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

On a fresh Linux host, Playwright may need `npx playwright install --with-deps chromium`. For a restricted home directory, use `PLAYWRIGHT_BROWSERS_PATH=/tmp/atlas-playwright` for both installation and tests. Chromium uses software WebGL for headless map testing. The suite emulates iPhone dimensions; it does not certify physical iOS Safari.

## Play the campaign

- Pan or pinch the **World** map. **Fit campaign** restores the initial six-city view. Faction colours identify ownership; city symbols distinguish class. Morale, attack and supply warnings appear on city markers.
- Tap a city for population, integrity, morale, stability, resources, buildings, armies and queues. Use **Army** to recruit infantry; upgrade Barracks for cavalry or build an Arsenal for artillery. Construction and recruitment have independent serial queues.
- Tap a friendly army, choose a connected city, review travel time, then **Confirm order**. Enemy cities are legal destinations. **Forces** provides the same controls. Mixed forces move at their slowest unit's speed.
- Opposing armies at a city fight automatically in five-minute rounds. Defending garrisons receive city and fortification bonuses. Morale and supply affect combat strength.
- Once field defenders are gone, infantry or cavalry begin capture. Base occupation takes 15 minutes; damaged cities fall faster and fortifications delay capture. Departing or renewed fighting cancels the countdown.
- Supplied artillery can **Bombard** a connected enemy city or stationed army, firing every five minutes. City attacks reduce integrity, morale and stability. Moving or direct combat interrupts bombardment. Lost supply pauses fire. Artillery cannot capture territory.
- Captured cities retain buildings, damage and local reserves, start with 25 stability and at most 35 morale, and enter occupation. Unfinished paid construction/recruitment is cancelled on a change of government; resource sites change owner with their city.
- Morale below 20 starts a 45-minute unrest timer. Recovery to 20 or above cancels it. Continuous critical unrest causes independence and population-scaled rebel infantry. Existing hostile garrisons then fight the rebels normally.
- **Campaign events** on the map shows the latest message and expands into a bounded history. Arrivals, battle starts/ends, bombardment, capture and rebellion are recorded without repeated salvo alerts. **Forces** also shows recent events.
- Leave and return later: the saved timestamps reconstruct economy, recruitment, movement, battles, capture and rebellion. Animation never decides an arrival or outcome.

The miniature campaign retains its original fictional city names, latitude/longitude and deliberately compressed **campaign route distances**. Movement and connected artillery range use those existing route kilometres (150 km maximum for artillery), rather than changing the established travel balance to match the background geography.

Each command is persisted to IndexedDB before the UI reports success. Saves belong to this browser and origin. Stale tabs cannot overwrite newer saves. To deliberately restart during development, delete the `atlas-dominion` IndexedDB database and reload; there is no in-game reset or import/export yet.

## Architecture decisions

```text
src/
  app/             Shell, formatting and mobile styles
  components/      City and army bottom sheets, order confirmation
  screens/         Forces, Economy, Tech and Diplomacy
  map/             MapLibre renderer, GeoJSON adapters, visual interpolation
  types/           Typed entities, commands, orders and events
  data/            Six-city fixture and central balance configuration
  simulation/      Pure TypeScript economy, logistics, morale, movement,
                   combat, capture, rebellion, queues and timestamp scheduler
  state/           Separate Zustand UI/game state, Dexie, validation and migration
public/maps/       Bundled Natural Earth regional geography and provenance
public/icons/      PWA icons
tests/             Simulation, save compatibility and store tests
  browser/         Production map, gestures, military UI and offline PWA checks
```

```ts
const next = advanceGameState(state, state.lastUpdatedAt, currentTimestamp);
```

- Simulation imports no React, MapLibre, Zustand, Dexie or browser APIs. Transitions clone their inputs. All costs, statistics, timings and gameplay thresholds live in `src/data/balance.ts`, with existing unit values sourced from `data/balance.json`.
- Economy/morale retain campaign-anchored one-minute ticks. Arrivals, queues, battle rounds, artillery cooldowns, capture and rebellion are scheduled at absolute timestamps. Coincident events resolve economy/morale, arrivals, queues, direct combat, bombardment, capture, then rebellion, reconciling military and unrest state between phases.
- Direct combat computes attacks from a snapshot and applies casualties simultaneously. Attack/defence, count, morale, supply and city defences contribute. Small seeded variation uses an injectable RNG factory; its updated state is saved. Persistent partial damage allows small armies to inflict losses over multiple rounds. Infantry screens cavalry and artillery.
- Technology has no existing levels in the foundation, so no technology multiplier or research tree is invented here. Universities remain preparatory infrastructure.
- Supply remains a graph of owned cities linked to capitals or depots. Frontier armies may draw rations from an adjacent supplied friendly city while attacking. Ownership and resource-site transfers immediately change the derived supply graph. Unsupplied armies fight at reduced strength; advanced capacity, attrition and timed supply penalties remain future work.
- **Save payload schema 2** explicitly migrates foundation schema 1: cities gain full class-based integrity and empty occupation/unrest state, armies gain morale and partial-damage state, and battle/event fields are initialised. Existing timestamps, queues, movement orders, resources and RNG state are retained. The Dexie database layout stays at version 1; transactional revisions still guard concurrent saves. Invalid and unknown-version saves are preserved and reported.
- MapLibre owns projection, gestures and camera state. Pure `armyVisualPosition` interpolates saved departure/arrival timestamps and clamps to endpoints. A presentation refresh updates markers; the simulation remains authoritative. The normal 15-second app refresh is only a foreground convenience.

## PWA and geography

MapLibre renders bundled country polygons, campaign routes, cities and armies. This deliberately uses a small geographical background without external tile servers or API keys. Natural Earth is [public-domain geographic data](https://www.naturalearthdata.com/about/terms-of-use/); see `public/maps/README.md` for provenance.

The MapLibre worker is bundled explicitly using Vite's `?worker&url` integration, following the [MapLibre installation guide](https://maplibre.org/maplibre-gl-js/docs/). The production service worker precaches that worker, geography, scripts, styles and icons. Visit once online; subsequent map rendering and play work offline. The map increases the precache to roughly 2.3 MiB and produces Vite's advisory large-chunk warning.

`vite.config.ts` uses a relative base, manifest scope and start URL. Deploy `dist/` under a static HTTPS host or GitHub Pages repository path. Build output and `node_modules` are ignored by Git; no deployment is performed by the build.

## Validation and remaining scope

Validated: **47 Vitest tests pass**, **7 Playwright browser tests pass**, and the production build passes. Offline geographic-map reload is included in the browser suite.

The tests cover deterministic economy and combat, simultaneous damage, stronger forces, morale/supply/fortification effects, artillery vulnerability and targeting, interrupted capture, low-stability occupation, exact rebellion deadlines and cancellation, schema migration, and identical results across offline jumps and serialised refreshes. Browser checks cover recruitment/construction, movement confirmation and reload, touch pan/pinch, narrow layouts, offline map reload, battle/capture, bombardment and rebellion feedback.

AI garrisons defend automatically and their cities participate in the economy; strategic AI orders are not added in this milestone. Research, treaties, advanced supply, natural integrity repair, victory enforcement, aircraft, ships and world expansion remain out of scope. The seven-day indicator is pacing information, not an enforced campaign end.

Next: tune the six-city combat/economy/occupation loop and add limited strategic AI before expanding the campaign.

## Project references

- `AGENTS.md` — engineering instructions.
- `TASK.md` — retained first-foundation brief; this milestone implements the subsequent user request.
- `docs/GAME_DESIGN.md` — gameplay source of truth.
- `docs/CODEX_BUILD_PROMPT.md` — implementation roadmap.
- `data/world_seed.json` — preserved full world seed, not loaded by the app.
