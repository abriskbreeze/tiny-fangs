# Tiny Fangs — Development TODO

**Current Version:** v0.2.6 (see VERSION file)

Full modularization of the monolith using TDD approach.

## Version History
- **v0.2.6** — HP moved to footer with damage coloring, ATK modifiers in card detail, Den Mother ATK bug fix
- **v0.2.5** — Bench card ASCII art fix (added white-space: pre, smaller font)
- **v0.2.4** — AI pause increased, LP loss shows "-<3", all emojis replaced with ASCII
- **v0.2.3** — Poison damage now shows red like regular damage (was green/heal color)
- **v0.2.2** — Verse color consistency: cast=gold/orange, set=purple (borders, popups, stars)
- **v0.2.1** — Responsive mobile layout: clamp() sizing for cards, small screen media query
- **v0.2.0** — ATK modifier display (green/red + tooltip), Call of the Wild pre-check
- **v0.1.9** — Fixed: float text centering, bench summon selector (.mini-card → .card-mini)
- **v0.1.8** — Set verse glow animation, attack wind-up (pull back before lunge)
- **v0.1.7** — Bench-to-active animation: slide-in effect when creature enters from bench
- **v0.1.6** — Spark burst effect: 3 stars with random sizes/positions for bench summon
- **v0.1.5** — Animation centering fix, cast/set verse popups, lighter background overlay
- **v0.1.4** — Animation fixes: summon positioned correctly, bench summon animation added
- **v0.1.3** — Den Mother redesign: "next attack +10 damage" (was broken "this turn" buff)
- **v0.1.2** — Battlefield UI: graveyard buttons on field, hold-to-zoom on player's [SET]
- **v0.1.1** — UX fixes: Swarm Shield, Sacrifice order/choice, graveyard view, set verse inspect, Grave Rise choice
- **v0.1** — Swarm deck, 10 new creatures, 6 new verses, ability system
- **v0.0** — Refactor: modular architecture, TDD, bug fixes

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

### State Management ✅
- [x] Refactor `let G` → import `state.G` from state.js
- [x] Replace all `G` refs with `state.G` (222 occurrences)
- [x] Replace `selectedCard`, `startTime`, `timerInt`, `longPressTimer` with `state.*`
- [ ] Extract init functions to **src/init.js** using `setGame()` (future)

### Game Logic (IN PROGRESS)
- [x] **helpers.js** — log, drawCard, checkWinConditions, KO effects (partial - pure logic extracted)
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

## Bug Fixes
- [x] **Negative HP Display Bug** (2026-02-04)
  - Root cause: `ko()` async but not awaited; `curHp -= damage` could go negative before render()
  - Fix: Created `applyDamage()` helper that clamps HP to minimum 0
  - Added `await` to all `ko()` calls that precede `render()`
  - Tests: `game-logic.test.js`, `game.test.js` verify HP never goes negative

## Current Stats
- **index.html:** ~2900 lines (down from 3392)
- **Tests:** 116 passing
- **Modules:** 6 extracted (cards, state, anim, render, game, helpers)

## Links
- Local dev: http://100.76.215.88:3004 (v2 refactor)
- Classic: http://100.76.215.88:3003 (original)
- Live: https://abriskbreeze.github.io/tiny-fangs/
- Repo: github.com/abriskbreeze/tiny-fangs
