# Atlas Dominion

A mobile-first, persistent real-time grand-strategy prototype. Campaigns are unlimited: no seven-day ending or automatic reset. Actions keep their real-time durations.

> Conquering territory is easier than maintaining it.

The playable European campaign contains **16 real cities**: Gijón, Barcelona, Madrid, Paris, Marseille, Roma, Milano, Berlin, Köln, Amsterdam, Maastricht, Brussels, Copenhagen, London, Birmingham and Manchester. It includes a geographical MapLibre map, army orders, deterministic combat, artillery, occupation, rebellion and notifications. The original six-city map remains a regression fixture; the 74-city world seed remains unused.

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

- Pan or pinch the **World** map. **Fit campaign** restores the European overview. Nearby cities cluster at overview zoom; tap a cluster to zoom in or use **Cities** to find any city directly. Faction colours identify ownership; city symbols distinguish class. Morale, attack and supply warnings appear on city markers.
- New campaigns start with the three Spanish cities and Madrid as capital. The Continental Accord and British League have defensive garrisons.
- Tap a city for population, integrity, morale, stability, resources, buildings, armies and queues. Use **Army** to recruit infantry; upgrade Barracks for cavalry or build an Arsenal for artillery. Construction and recruitment have independent serial queues.
- Tap a friendly army, choose a connected city, review travel time, then **Confirm order**. Enemy cities are legal destinations. **Forces** provides the same controls. Mixed forces move at their slowest unit's speed.
- Opposing armies at a city fight automatically in five-minute rounds. Defending garrisons receive city and fortification bonuses. Morale and supply affect combat strength.
- Once field defenders are gone, infantry or cavalry begin capture. Base occupation takes 15 minutes; damaged cities fall faster and fortifications delay capture. Departing or renewed fighting cancels the countdown.
- Supplied artillery can **Bombard** a connected enemy city or stationed army, firing every five minutes. City attacks reduce integrity, morale and stability. Moving or direct combat interrupts bombardment. Lost supply pauses fire. Artillery cannot capture territory.
- Captured cities retain buildings, damage and local reserves, start with 25 stability and at most 35 morale, and enter occupation. Unfinished paid construction/recruitment is cancelled on a change of government; resource sites change owner with their city.
- Morale below 20 starts a 45-minute unrest timer. Recovery to 20 or above cancels it. Continuous critical unrest causes independence and population-scaled rebel infantry. Existing hostile garrisons then fight the rebels normally.
- The **notification bell** opens a persistent inbox with unread indicators, including completed recruitment/construction and important military events. Device notifications are optional and permission is requested only when you press **Enable device notifications**. They require HTTPS/browser support and delivery while the app is executing; background delivery may pause. Closed-app push is not implemented. The local HTTP Wi-Fi preview supports in-game notifications.
- **Campaign events** on the map shows the latest message and expands into a bounded history. Arrivals, battle starts/ends, bombardment, capture and rebellion are recorded without repeated salvo alerts. **Forces** also shows recent events.
- Leave and return later: the saved timestamps reconstruct economy, recruitment, movement, battles, capture and rebellion. Animation never decides an arrival or outcome.

City positions use a checked [GeoNames subset](docs/EUROPE_CAMPAIGN.md). Travel distances are calculated from geographical corridor waypoints using the existing speeds and terrain modifiers. Paris–London passes through the Channel Tunnel. Long trips now take proportionally longer; recruitment and construction are unchanged. Artillery retains its 150 km connected-route limit.

Each command is persisted to IndexedDB before the UI reports success. Saves belong to this browser and origin. Stale tabs cannot overwrite newer saves. To deliberately restart during development, delete the `atlas-dominion` IndexedDB database and reload; there is no in-game reset or import/export yet.

## Architecture decisions

```text
src/
  app/             Shell, formatting and mobile styles
  components/      City and army bottom sheets, order confirmation
  screens/         Forces, Economy, Tech and Diplomacy
  map/             MapLibre renderer, GeoJSON adapters, visual interpolation
  types/           Typed entities, commands, orders and events
  data/            European campaign, six-city regression fixture and balance
  simulation/      Pure TypeScript economy, logistics, morale, movement,
                   combat, capture, rebellion, queues and timestamp scheduler
  notifications/   Event filtering, offline summaries and browser notification delivery
  state/           Separate UI/game state, durable notification inbox, Dexie and migrations
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
- **Save payload schema 3** migrates schema 1 and 2 saves into the European campaign without resetting progress. Existing city state and queued orders persist; city/route references are remapped and moving armies retain their promised arrival times. Artillery orders stop for retargeting on the larger map. See the exact mappings and migration policy in [European campaign notes](docs/EUROPE_CAMPAIGN.md). The Dexie layout remains version 1 and transactional revisions still protect against stale writers.
- Long offline catch-up runs in timestamped daily batches, yielding between batches to keep the UI responsive. No elapsed time is capped or discarded, and split advancement produces the same state as one offline jump. Notifications are separate persisted presentation state; events record the affected factions before ownership changes.
- MapLibre owns projection, gestures and camera state. Pure `armyVisualPosition` interpolates saved departure/arrival timestamps and clamps to endpoints. A presentation refresh updates markers; the simulation remains authoritative. The normal 15-second app refresh is only a foreground convenience.

## PWA and geography

MapLibre renders bundled country polygons, campaign routes, cities and armies. This deliberately uses a small geographical background without external tile servers or API keys. Natural Earth is [public-domain geographic data](https://www.naturalearthdata.com/about/terms-of-use/); see `public/maps/README.md` for provenance.

The MapLibre worker is bundled explicitly using Vite's `?worker&url` integration, following the [MapLibre installation guide](https://maplibre.org/maplibre-gl-js/docs/). The production service worker precaches that worker, geography, scripts, styles and icons. Visit once online; subsequent map rendering and play work offline. The current precache is roughly 3.0 MiB; MapLibre produces Vite's advisory large-chunk warning.

The mobile home-screen icon is a soldier holding a cucumber. Apple uses the 180px touch icon; the manifest provides 192px and 512px icons plus a padded maskable version. The source artwork and generation prompt are in `assets/branding/`.

`vite.config.ts` uses a relative base, manifest scope and start URL. Deploy `dist/` under a static HTTPS host or GitHub Pages repository path. Build output and `node_modules` are ignored by Git; no deployment is performed by the build.

## Validation and remaining scope

Validated: **62 Vitest tests pass**, **10 Playwright browser tests pass**, and the production build passes. Offline geographic-map reload is included in the browser suite.

The tests cover the 16-city geographic graph, a month of open-ended simulation, normal recruitment after day 30, notification audiences/deduplication/permission handling, deterministic economy and combat, simultaneous damage, stronger forces, morale/supply/fortification effects, artillery vulnerability and targeting, interrupted capture, low-stability occupation, exact rebellion deadlines and cancellation, schema migration, and identical results across offline jumps and serialised refreshes. Browser checks cover recruitment/construction, movement confirmation and reload, touch pan/pinch, narrow layouts, offline map reload, battle/capture, bombardment and rebellion feedback.

AI garrisons defend automatically and their cities participate in the economy; strategic AI orders are not added in this milestone. Research, treaties, advanced supply, natural integrity repair, closed-app push, aircraft, ships and further world expansion remain out of scope. The day indicator continues increasing without a campaign deadline.

Next: tune the European combat/economy/occupation loop and add limited strategic AI before expanding the campaign.

## Project references

- `AGENTS.md` — engineering instructions.
- `TASK.md` — current European campaign task plus the historical foundation brief.
- `docs/GAME_DESIGN.md` — gameplay source of truth.
- `docs/CODEX_BUILD_PROMPT.md` — implementation roadmap.
- `data/world_seed.json` — preserved full world seed, not loaded by the app.
