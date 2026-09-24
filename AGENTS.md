# Atlas Dominion — Codex project instructions

## Mission
Build Atlas Dominion: a mobile-first persistent real-time grand-strategy game on a world map. A normal campaign lasts approximately seven real days.

The core strategic pillars are:
1. territorial expansion
2. economy and resources
3. logistics and supply
4. city morale and stability
5. military operations
6. technology

The central game-design rule is:

> Conquering territory is easier than maintaining it.

## Source of truth
For gameplay decisions, read `docs/GAME_DESIGN.md`.
For implementation order, read `docs/CODEX_BUILD_PROMPT.md`.
For the immediate task, read `TASK.md`.

Do not redesign core systems unless a technical constraint makes the documented design impossible.

## Technology
Use:
- React
- TypeScript
- Vite
- MapLibre GL JS
- Zustand
- Dexie / IndexedDB
- Vitest
- PWA support

The application must be mobile-first and work well on iPhone-sized screens.

## Architecture
Core game rules must be framework-independent TypeScript.

React components must never contain core simulation rules.

Game systems should live under `src/simulation/`, including:
- `economy.ts`
- `morale.ts`
- `movement.ts`
- `logistics.ts`
- `combat.ts`
- `research.ts`
- `ai.ts`
- `advanceTime.ts`

Rendering state and simulation state must remain separate.

## Persistent-time simulation
Never depend on JavaScript timers continuing while the app is closed.

Store absolute timestamps and reconstruct elapsed simulation time when the game resumes.

The central simulation entry point should conceptually be:

`advanceGameState(previousTimestamp, currentTimestamp)`

Tests must be able to jump the simulation forward by hours or days instantly.

Simulation must be deterministic for the same seed and player commands.
Use an injectable seeded RNG.

## Balance
Do not scatter balance constants through implementation files.

Costs, timings, production, movement speeds, combat stats and thresholds belong in central balance configuration.

Avoid magic numbers in simulation functions.

## MVP scope
Do not build the entire world immediately.

First build a miniature playable simulation containing:
- 6 cities
- player plus simple AI factions
- Money
- Food
- Iron
- Oil
- Infantry
- Cavalry
- Artillery
- Barracks
- Depot
- Fortifications
- University
- recruitment
- movement
- economy
- city capture
- morale
- stability
- rebellion
- basic logistics

Only expand the map after this loop is stable and tested.

## Mobile UX
The world map occupies most of the screen.

Top resource bar:
`Money | Food | Iron | Oil`

Bottom navigation:
`World | Forces | Economy | Tech | Diplomacy`

Selecting a city opens a mobile bottom sheet.

Avoid permanent desktop sidebars and giant tables in primary gameplay.

Important actions should normally take no more than 2–3 taps.

## Development workflow
Before implementing a large feature:
- inspect existing architecture;
- reuse existing systems where appropriate;
- consider effects on economy, logistics and elapsed-time simulation.

When changing simulation:
- write or update tests;
- test elapsed-time behaviour;
- test edge cases;
- verify save compatibility where relevant.

After meaningful changes run:
- `npm test`
- `npm run build`

Do not report a feature as working unless its relevant tests/build pass.

## Git discipline
- Make focused commits.
- Do not rewrite unrelated code.
- Do not force-push.
- Never commit credentials or secrets.
- Never commit `node_modules`.
- Keep generated build output out of source control unless deployment requires otherwise.

## Engineering judgement
Do not stop for minor implementation choices. Make a sensible choice, document it when necessary and continue.

For a major product decision that materially changes the game's design, preserve the documented design instead of inventing a replacement.
