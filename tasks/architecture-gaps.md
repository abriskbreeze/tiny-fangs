# Architecture Gaps Analysis

## Current State

### ✅ Properly Shared
- `shared/cards.js` — Card definitions (CREATURES, VERSES, DECKS)
- `shared/effects.js` — Effect primitives + processEffects
- `shared/triggers.js` — Trigger matching

### ⚠️ Duplicated Logic

**Server has its own implementations that should use shared:**

| Function | shared/engine.js | server/GameEngine.js | Status |
|----------|-----------------|---------------------|--------|
| `applyDamage` | ✅ Pure | ✅ Has own | DUPLICATE |
| `getEffectiveAtk` | ✅ Pure | ✅ Has own | DUPLICATE |
| `attack` | ✅ Pure | In executeAction | DUPLICATE |
| `summon` | ✅ Pure | In executeAction | DUPLICATE |
| `castVerse` | ✅ Pure | In executeAction | DUPLICATE |
| `autoSwapBenchToActive` | ✅ Pure | ✅ Has own | DUPLICATE |

### 🔧 Better Design for Custom Cards

**Current Problem:** Card-specific `if` statements for target selection

**Proposed Solution:** Declarative selection in card data

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
