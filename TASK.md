# TASK — First playable foundation

Build the first technically sound playable foundation of Atlas Dominion.

Read:
1. `AGENTS.md`
2. `docs/GAME_DESIGN.md`
3. `docs/CODEX_BUILD_PROMPT.md`

Do not attempt the complete final game.

## Deliverables

### Application foundation
- Initialise a React + Vite + TypeScript project.
- Preserve the existing project documentation and data files.
- Add PWA support.
- Create a responsive mobile-first application shell.
- Add the top resource bar.
- Add bottom navigation.
- Add a placeholder world-map view suitable for later MapLibre integration.

### Core model
Define strongly typed entities for:
- GameState
- Faction
- City
- ResourceNode
- Route
- Army
- UnitStack
- Building
- QueueItem
- ArmyOrder

### Deterministic simulation
Implement:
- seeded RNG
- game clock
- `advanceGameState(previousTimestamp, currentTimestamp)`
- city resource production
- city consumption
- morale updates
- stability updates
- building queues
- recruitment queues
- timestamp-based army movement

Do not rely on timers continuing while the page is closed.

### Persistence
- Save game state in IndexedDB using Dexie.
- Autosave after meaningful commands.
- Support restoring the latest save after reload.
- Include a save schema version.

### Test world
Create a deliberately small test campaign:
- exactly 6 cities
- a few land routes
- player faction
- at least one AI faction
- Money, Food, Iron and Oil
- Infantry, Cavalry and Artillery

Do not use the full world seed yet.

### Tests
Add Vitest tests proving at minimum:
1. advancing 2 hours changes resources deterministically;
2. a food shortage decreases city morale;
3. queued recruitment can finish while the page was closed;
4. army movement resolves from timestamps;
5. two identical seeds + commands produce identical results;
6. a 24-hour simulation jump completes instantly in tests.

## Explicitly out of scope for this task
Do not implement:
- the 74-city world;
- aircraft;
- helicopters;
- naval combat;
- advanced diplomacy;
- full production AI;
- final artwork;
- monetisation;
- multiplayer.

## Completion checks
Before finishing:
- run `npm test`;
- run `npm run build`;
- fix failures;
- inspect the final project structure;
- update `README.md` with setup, test and build commands;
- summarise what works and the recommended next milestone.

Architecture quality is more important than feature quantity.
