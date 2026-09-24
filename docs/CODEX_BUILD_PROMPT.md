# CODEX BUILD BRIEF — ATLAS DOMINION

Build a mobile-first installable PWA called **Atlas Dominion**.

Read `docs/GAME_DESIGN.md` before changing architecture.

## Product goal
A persistent real-time world strategy game. A normal campaign should last roughly seven real days. The player controls cities, resource nodes, armies, ports, research, morale and logistics. Orders resolve using absolute timestamps while the app is closed.

## Critical constraints
1. TypeScript.
2. React + Vite.
3. Mobile-first.
4. Simulation code must be framework-independent pure TypeScript.
5. Save with IndexedDB/Dexie.
6. Deterministic seeded RNG.
7. No backend for v1.
8. Must deploy cleanly to GitHub Pages.
9. Do not implement fake timers that require the page to stay open.
10. Write tests for economy, morale, movement and capture.

## Build in milestones

### Milestone 1 — shell
- create Vite React TypeScript app
- PWA manifest/service worker
- responsive full-screen layout
- top resource bar
- bottom navigation
- placeholder map screen

### Milestone 2 — simulation
Implement typed entities and:
- game clock
- resource production/consumption
- city morale/stability
- building queue
- recruitment queue
- timestamp-based movement
- deterministic `advanceGameState(from,to)`

### Milestone 3 — map
- MapLibre world view
- render cities/resources/routes
- selectable nodes
- owner styling
- city bottom sheet
- pan/zoom/touch gestures

### Milestone 4 — military
- infantry
- cavalry
- artillery
- army stacks
- movement orders
- basic combat
- artillery bombardment
- capture

### Milestone 5 — rebellion/logistics
- supply graph
- out-of-supply penalties
- morale <20 critical timer
- rebel faction spawning

### Milestone 6 — AI
- 5 factions
- utility-based expansion/economy decisions
- AI decisions every simulated 5–15 minutes
- no resource cheating

### Milestone 7 — polish
- notifications
- map filters
- save/export/import
- new-game screen
- balance debug panel behind dev flag
- GitHub Pages workflow

## First playable scope
Start smaller than the final game:
- 48 cities
- 18 resource nodes
- 6 factions total
- four resources: money, food, iron, oil
- five buildings: barracks, depot, fortification, university, port
- three land units: infantry, cavalry, artillery

Once this is stable, expand using GAME_DESIGN.md.

## UI
Map occupies almost the full screen.

Top bar:
Money | Food | Iron | Oil

Bottom nav:
World | Forces | Economy | Tech | Diplomacy

Tap city -> bottom sheet:
Overview | Buildings | Army | Economy | Stability

Do not use dense desktop tables on the main interaction path.

## Engineering rules
- No magic numbers: central balance config.
- All actions validate cost/ownership/prerequisites.
- Store timestamps in Unix milliseconds.
- Game simulation must be testable by jumping forward hours/days instantly.
- Keep rendering state separate from simulation state.
- Use discriminated unions for orders/events.
- Seeded RNG must be injectable.
- Add migration version to saves.
- Prefer immutable state transitions or clearly controlled mutation in simulation functions.
- Use comments for design reasoning, not obvious syntax.

## Acceptance tests
1. Advance a new game by 2h and resources change deterministically.
2. Starve a city for 2h and morale falls materially.
3. Keep a city <20 morale for 45m and it rebels.
4. Recruit infantry and it completes without page being open.
5. Move infantry between connected cities and arrival resolves from timestamps.
6. Artillery can damage a target in range without occupying the target.
7. An army cut from supply receives penalties.
8. Capturing a city changes owner, lowers stability and starts occupation state.
9. Reload browser and state is preserved.
10. Jump simulation forward 24h in tests without waiting in real time.

## Important implementation order
Do not build all content first. Build the simulation loop, tests and 6-city miniature map. Then scale to the 48-city MVP seed.
