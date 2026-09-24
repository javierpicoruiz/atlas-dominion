# Atlas Dominion

**Atlas Dominion** is a mobile-first persistent real-time grand-strategy game played on a world map. A normal campaign is designed to last roughly seven real days.

Its central strategic idea is simple:

> Conquering territory is easier than maintaining it.

Players manage cities, armies, logistics, resources, ports, morale, stability and technological development while the world continues to progress between play sessions.

## Repository map

- `AGENTS.md` — persistent instructions for Codex.
- `TASK.md` — the next implementation milestone.
- `.codex/config.toml` — project-level Codex defaults.
- `docs/GAME_DESIGN.md` — complete current game design.
- `docs/CODEX_BUILD_PROMPT.md` — implementation roadmap.
- `data/balance.json` — initial balance constants.
- `data/schema.json` — suggested entity schemas.
- `data/world_seed.json` — 74-city world seed for later milestones.

## First milestone

The first build deliberately uses a six-city miniature world. The purpose is to prove the persistent simulation, economy, morale, recruitment, movement and save/load architecture before scaling to the full world.

## Start Codex

From the repository root:

```bash
codex
```

Then tell Codex:

```text
Read AGENTS.md and TASK.md and execute TASK.md completely.
Run the tests and production build before finishing.
```
