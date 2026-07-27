# Architecture Gaps Analysis

## Current State (v0.4.86)

Shared-engine unification and declarative selection are **complete**. This file tracks what remains intentional vs leftover client concerns.

### ✅ Properly Shared
- `shared/cards.js` — Card definitions (CREATURES, VERSES, DECKS)
- `shared/effects.js` — Effect primitives + processEffects
- `shared/triggers.js` — Trigger matching
- `shared/engine.js` — All game logic (~1,665 lines)
- `server/GameEngine.js` — Thin wrapper (149 lines)

### ✅ Declarative Selection (completed v0.4.86)

All targeting cards use declarative `selection` config:
- ignite, banish, soulSiphon — `{ type: 'creature', filter: 'any', location: 'board' }`
- graveEcho — `{ type: 'creature', filter: 'friendly', location: 'grave' }`
- sacrifice — `{ type: 'creature', filter: 'friendly', location: 'board' }`

Flow: `resolveSelection()` → `action.selected` → `processEffects()`.
No card-specific switch cases for selection handling.

### ✅ Custom Handlers (intentionally kept)

Complex logic that does not fit effect primitives:

**denMother** — Searches deck for 1-cost creature, summons to active/bench/grave based on availability  
**lastBreath** — Checks owner perspective, one-time-use flag, negates life loss

Per Karpathy: "No abstractions for single-use code." Custom handlers are appropriate here.

### ✅ Completed Refactor Phases

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Unify `applyDamage` + `getEffectiveAtk` via shared | Done |
| 2 | Declarative `selection` system | Done (v0.4.86) |
| 3 | Unify `executeAction` — server delegates to shared | Done |

Selection lives in `shared/engine.js` (`resolveSelection`) — no separate `selection.js` module.

### 📁 Current Layout

```
shared/              — ALL game logic
  cards.js           — Card data + selection configs
  effects.js         — Effect primitives
  triggers.js        — Trigger matching
  engine.js          — State transitions + resolveSelection
  index.js           — 31 named re-exports

server/              — Multiplayer only
  index.js           — WebSocket server (port 3001)
  GameEngine.js      — Thin wrapper calling shared/engine.js

src/                 — Client only
  main.js            — UI, event playback, AI, MP client
  anim.js / render.js / styles.css
  ai.js              — Solo AI
  multiplayer.js     — Legacy P2P; active MP uses WebSocket in main.js
  cards.js           — Re-exports shared cards
  effects.js / triggers.js — Client wrappers + prompts
```

### ⚠️ Remaining Gaps (not blockers)

1. **Alpha AI (difficulty 3)** — multi-turn planning not implemented (Pup/Hunter only)
2. **MP tunnel URL** — `WS_SERVER` in `src/main.js` is a Cloudflare tunnel; must update after restart
3. **Some procedural abilities** still client-adjacent (e.g. Cindermaw Frenzy, Pulsefin Sonic Strike, Whisper Elusive) — verify they route through shared events
4. **`src/main.js` size** (~3,694 LOC) — largest remaining monolith; UI/event playback candidate for future splits
5. **`archive/`** — completed plans, old server backups, prototypes — reference only

## Why Shared Engine Matters

1. **Single source of truth** — Balance changes in one place
2. **Bug prevention** — Can't have SP/MP logic drift
3. **Easier card authoring** — Just data, no code
4. **Testable** — Shared engine = pure functions = easy tests (285 passing)
