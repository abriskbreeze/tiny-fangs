# Architecture Gaps Analysis

## Current State (v0.4.86)

### ✅ Properly Shared
- `shared/cards.js` — Card definitions (CREATURES, VERSES, DECKS)
- `shared/effects.js` — Effect primitives + processEffects
- `shared/triggers.js` — Trigger matching
- `shared/engine.js` — All game logic (1,670 lines)
- `server/GameEngine.js` — Thin wrapper (149 lines, 91% reduction)

### ✅ Declarative Selection (completed v0.4.86)

All targeting cards now use declarative `selection` config:
- ignite, banish, soulSiphon — `{ type: 'creature', filter: 'any', location: 'board' }`
- graveEcho — `{ type: 'creature', filter: 'friendly', location: 'grave' }`  
- sacrifice — `{ type: 'creature', filter: 'friendly', location: 'board' }`

These go through `resolveSelection()` → `action.selected` → `processEffects()`.
No more card-specific switch cases for selection handling.

### ✅ Custom Handlers (intentionally kept)

These triggers have complex logic that doesn't fit effect primitives:

**denMother** — Searches deck for 1-cost creature, summons to active/bench/grave based on availability
**lastBreath** — Checks owner perspective, one-time-use flag, negates life loss

Per Karpathy: "No abstractions for single-use code." Custom handlers are appropriate here.

```javascript
// In shared/cards.js
ignite: {
  effects: [{ type: 'damage', target: 'selected', amount: 15 }],
  selection: {
    type: 'creature',        // What to select
    filter: 'any',           // any | enemy | friendly | active | bench
    prompt: 'Choose target', // UI text
    required: true           // Must select to cast
  }
}
```

Then generic handler:
```javascript
// In shared/engine.js
function castVerse(state, playerIdx, cardUid, selection) {
  const card = VERSES[cardId];
  
  // Generic selection handling
  if (card.selection?.required && !selection.targetUid) {
    return { error: 'NEEDS_SELECTION', selectionType: card.selection };
  }
  
  // Build context with selected target
  const ctx = buildContext(state, playerIdx, selection);
  return processEffects(card, ctx);
}
```

**Benefits:**
- New cards with targeting = just add `selection` object
- No card-specific `if` statements
- Server and client use same selection logic

### 🏗️ Recommended Refactor Phases

**Phase 1: Unify applyDamage + getEffectiveAtk**
- Server imports from shared/engine.js
- Remove duplicate implementations

**Phase 2: Declarative Selection System**
- Add `selection` to cards that need it
- Generic selection handler in shared
- Server + client both use it

**Phase 3: Unify executeAction**
- Server's executeAction calls shared/engine.js functions
- Reduces server to just: WebSocket handling + state sync

### 📁 File Purpose After Refactor

```
shared/              — ALL game logic
  cards.js           — Card data + selection configs
  effects.js         — Effect primitives
  triggers.js        — Trigger matching
  engine.js          — State transitions (attack, summon, etc.)
  selection.js       — Target selection logic (NEW)

server/              — Multiplayer only
  index.js           — WebSocket server
  GameEngine.js      — Thin wrapper calling shared/engine.js

src/                 — Client only
  anim.js            — Animations
  render.js          — UI
  ai.js              — Single-player AI
  multiplayer.js     — WebSocket client
```

## Why This Matters

1. **Single source of truth** — Balance changes in one place
2. **Bug prevention** — Can't have SP/MP logic drift
3. **Easier card authoring** — Just data, no code
4. **Testable** — Shared engine = pure functions = easy tests
