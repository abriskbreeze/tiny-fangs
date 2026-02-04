# State Refactor Plan

## Goal
Migrate from local variables (`let G`, `let selectedCard`, etc.) to centralized `state.*` from `src/state.js`.

## Current State
- `index.html` has ~220 references to `G`
- Local variables: `G`, `selectedCard`, `startTime`, `timerInt`, `longPressTimer`
- `src/state.js` already exports: `state`, `getGame()`, `setGame()`, `clearGame()`

## Tasks

### Phase 1: Update imports
- [x] T-001: Add `state` to imports from state.js

### Phase 2: Remove local declarations  
- [x] T-002: Remove `let G = null;`
- [x] T-003: Remove `let selectedCard = null;`
- [x] T-004: Remove `let startTime = null;`
- [x] T-005: Remove `let timerInt = null;`
- [x] T-006: Remove `let longPressTimer = null;`

### Phase 3: Replace references
- [x] T-007: Replace all `G.` with `state.G.` (219 occurrences)
- [x] T-008: Replace `G =` assignments with `state.G =`
- [x] T-009: Replace `selectedCard` with `state.selectedCard`
- [x] T-010: Replace `startTime` with `state.startTime`
- [x] T-011: Replace `timerInt` with `state.timerInt`
- [x] T-012: Replace `longPressTimer` with `state.longPressTimer`

### Phase 4: Verify & Test
- [x] T-013: Run test suite - all 70 tests pass
- [ ] T-014: Manual test - start game, play a few turns
- [x] T-015: Verify no console errors in static analysis

### Phase 5: Cleanup
- [x] T-016: Update TODO.md with completion status
- [ ] T-017: Commit with descriptive message

## Acceptance Criteria
- No local game state variables in index.html
- All state accessed via `state.*` from state.js
- Tests pass
- Game plays correctly

## Risk Mitigation
- Use sed for bulk replacements (atomic)
- Test after each phase
- Keep backup of index.html before starting
