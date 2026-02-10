# Phase 2: Server Migration Plan

**Goal:** Migrate `server/GameEngine.js` to use `shared/` module instead of hardcoded logic.

## Current State
- `server/GameEngine.js`: ~1500 lines with hardcoded switch cases
- `server/cards.js`: Duplicate of card definitions
- Hardcoded effects processing duplicates `src/effects.js`
- Bug-prone: phantom wall was missing damage, shows the problem

## Target State
- Server becomes a THIN WRAPPER around shared functions
- Server only handles: WebSocket messages, room management, state filtering
- All game logic lives in `shared/` and is used by both client and server

## Migration Steps

### ✅ Step 1: Read and understand
- [x] Read current `server/GameEngine.js` structure
- [x] Read `shared/engine.js` to understand pure functions
- [x] Read `server/index.js` to see how GameEngine is used

### ⬜ Step 2: Update imports in `server/GameEngine.js`
- [ ] Remove `import { CREATURES, VERSES, DECKS } from './cards.js'`
- [ ] Add `import { ... } from '../shared/index.js'`
- [ ] Import: `createGame`, `attack`, `summon`, `castVerse`, `setVerse`, `endTurn`, `draw`, `mkCreature`, `mkVerse`, `mkDeck`, `mkPlayer`, `applyDamage`, `CREATURES`, `VERSES`, `DECKS`

### ⬜ Step 3: Remove duplicate card creation functions
- [ ] Delete local `mkCreature` function
- [ ] Delete local `mkVerse` function
- [ ] Delete local `mkDeck` function
- [ ] Delete local `mkPlayer` function

### ⬜ Step 4: Replace `createGame` export
- [ ] Delete local `createGame` function
- [ ] Re-export shared `createGame` directly

### ⬜ Step 5: Refactor `executeAction` to use shared functions
**Key insight:** Shared functions are PURE (return new state), server functions mutate.
We need ADAPTER WRAPPERS.

- [ ] Create adapter for `summon`: call shared, merge result into mutable state
- [ ] Create adapter for `attack`: call shared, merge result into mutable state  
- [ ] Create adapter for `castVerse`: call shared, merge result into mutable state
- [ ] Create adapter for `setVerse`: call shared, merge result into mutable state
- [ ] Update `executeAction` to use these adapters instead of hardcoded logic

### ⬜ Step 6: Replace `endTurn` with shared version
- [ ] Create adapter wrapper for shared `endTurn`
- [ ] Replace hardcoded end turn logic with shared function call

### ⬜ Step 7: Update helper functions
- [ ] Keep `getStateForPlayer` (server-specific for hiding opponent info)
- [ ] Keep `getEffectiveAtk` and `getAtkModifiers` if still needed for display
- [ ] Remove any other duplicate logic

### ⬜ Step 8: Remove `server/cards.js`
- [ ] Delete `server/cards.js` (use shared/cards.js)
- [ ] Verify no other files import from `server/cards.js`

### ⬜ Step 9: Verification
- [ ] Check syntax: `cd server && node -e "import('./GameEngine.js').then(m => console.log('Server exports:', Object.keys(m)))"`
- [ ] Start server: `cd server && node index.js`
- [ ] Test multiplayer: Create room, join, select decks, play game
- [ ] Verify all cards work correctly
- [ ] Test edge cases (KO, triggers, set verses)

## Architecture Notes

**Key difference: Pure vs Mutable**
- **Shared functions** are PURE: `{ state: newState, events: [] }`
- **Server needs** MUTABLE for performance: `executeAction(state, ...)` mutates state in-place

**Solution: Adapter Pattern**
```javascript
// Shared (pure)
const result = sharedAttack(state, playerIdx)
// result.state is NEW immutable state

// Server adapter (mutable)
function attack(state, playerIdx) {
  const result = sharedAttack(state, playerIdx)
  Object.assign(state, result.state)  // Merge into mutable state
  return { state, events: result.events }
}
```

## Success Criteria
- [ ] Server code reduced from ~1500 to <500 lines
- [ ] No more hardcoded effect switch cases
- [ ] Multiplayer game works exactly as before
- [ ] Server/index.js unchanged (same API)
- [ ] Bug fixed: phantom wall now deals damage (inherited from shared)
