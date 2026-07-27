# Shared Engine Summary

**Status:** Production — v0.4.86  
**Last Updated:** 2026-07-27

## Overview

`shared/` is the single source of truth for all Tiny Fangs game rules. Both the browser client and the multiplayer server delegate to this module.

## Modules

| File | Lines | Purpose |
|------|-------|---------|
| `engine.js` | ~1,665 | Core game operations, `executeAction()`, turn flow |
| `effects.js` | ~990 | 28 effect primitives + `processEffects()` |
| `cards.js` | ~518 | 29 creatures, 26 verses, 5 decks |
| `triggers.js` | ~350 | Priority-based trigger matching |
| `index.js` | ~52 | 31 named re-exports for client + server |

## Core API

### Game lifecycle
- `createGame(deck1Id, deck2Id)` — Initialize state, shuffle decks, deal hands
- `executeAction(state, playerIdx, action)` — Main entry point for all player actions
- `endTurn(state, playerIdx)` — Draw, mana gain, poison, player switch

### Actions (via `executeAction`)
- `summon` — Place creature on active or bench
- `attack` — Full combat resolution with triggers
- `cast` — Cast verse with optional target selection
- `set` — Place set verse face-down
- `retreat` — Swap active with bench
- `endTurn` — End current turn
- `respondOptional` — Answer optional trigger prompts (Vengeance, Brace, etc.)
- `skitterSwap` / `skitterDecline` — Skitter ability choice

### Helpers
- `draw`, `applyDamage`, `autoSwapBenchToActive`, `getEffectiveAtk`
- `resolveSelection` — Declarative target selection for verses
- `mkCreature`, `mkVerse`, `mkDeck`, `mkPlayer`

## Design Principles

1. **Pure functions** — Clone state, return `{ state, events }`
2. **Event-driven** — Every operation returns an event log for animation
3. **Declarative cards** — Effects and triggers defined in `cards.js`, not code
4. **Priority triggers** — 5-level priority system with defender-first tiebreaker

## Event Types (returned to client)

Combat: `attack`, `damage`, `heal`, `ko`, `lpDamage`  
Movement: `summon`, `summonBench`, `benchToActive`, `retreat`, `swap`  
Verses: `castVerse`, `setVerse`, `triggerReveal`  
Meta: `log`, `turnStart`, `turnEnd`, `gameOver`, `awaitingOptional`

## Custom Handlers (intentional)

Two set verses have complex logic kept as custom handlers in `engine.js`:
- **denMother** — Deck search + conditional summon placement
- **lastBreath** — One-time LP save with owner perspective check

## Testing

```bash
npm test -- tests/engine.test.js    # 23 engine tests
npm test -- tests/effects.test.js   # 31 effect tests
npm test -- tests/triggers.test.js  # 54 trigger tests
```

Total suite: **285 tests** across 13 files.

## Client Integration

`src/main.js` calls `sharedExecuteAction()`, then plays returned events through `EVENT_HANDLERS` → `Anim.*` methods.

## Server Integration

`server/GameEngine.js` (149 lines) re-exports shared functions. `server/index.js` handles WebSocket rooms and broadcasts state via `getStateForPlayer()`.
