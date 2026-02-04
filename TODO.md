# Tiny Fangs v2 — Refactor TODO

Full modularization of the monolith using TDD approach.

## Phase 1: Project Setup
- [x] Initialize Vite + Vitest
- [x] Set up GitHub Pages deployment (docs/)
- [x] Add .gitignore

## Phase 2: Module Extraction

### Data & Utilities
- [x] **cards.js** — CREATURES, VERSES, DECKS
- [x] **state.js** — `$`, `uid` helpers + state container
- [x] **anim.js** — ANIM_TIMING, Anim object
- [x] **render.js** — render helper functions (hearts, manaStr, renderActiveCard, etc.)

### Game Initialization (RESTORED)
- [x] **mkCreature, mkVerse, mkDeck, mkPlayer** — card/player factories
- [x] **startGame** — initializes game state, starts timer
- [x] Window exposures for all onclick handlers (module scope fix)

### State Management (NEXT — enables full extraction)
- [ ] Refactor `let G` → import `state.G` from state.js
- [ ] Replace all `G` refs with `state.G` (~100+ occurrences)
- [ ] Replace `selectedCard`, `startTime`, `timerInt`, `longPressTimer` with `state.*`
- [ ] Extract init functions to **src/init.js** using `setGame()`

### Game Logic (TODO — after state refactor)
- [ ] **helpers.js** — draw, ko, checkWin, log
- [ ] **ai.js** — AI decision logic  
- [ ] **actions.js** — doSummon, doCast, doSet, doAttack, doRetreat, endTurn

### UI Layer (TODO)
- [ ] **modals.js** — showModal, closeModal, showResult, showRules, showTriggerReveal
- [ ] **interactions.js** — cardPress, cardRelease, selectCard, keyboard handlers

## Phase 3: Polish
- [ ] Review test coverage
- [ ] Clean up any remaining inline code
- [ ] Update README with new architecture

---

## Current Stats
- **index.html:** ~2910 lines (down from 3392)
- **Tests:** 53 passing
- **Modules:** 4 extracted (cards, state, anim, render)

## Links
- Local dev: http://100.76.215.88:3003
- Live: https://abriskbreeze.github.io/tiny-fangs/
- Repo: github.com/abriskbreeze/tiny-fangs
