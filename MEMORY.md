# Tiny Fangs — Project Memory

## Overview
ASCII card battler: Pokemon TCG meets Yu-Gi-Oh with original mythical tiny predators.

- **Path:** `~/clawd/tiny-fangs/`
- **Local:** http://localhost:3004
- **Live:** https://abriskbreeze.github.io/tiny-fangs/
- **Service:** `com.tinyfangs.v2` (launchd)
- **Repo:** github.com/abriskbreeze/tiny-fangs (public for GH Pages)

## Tech Stack
- Vanilla HTML/CSS/JS, single `index.html`
- Vite + Vitest for build/test
- Font: JetBrains Mono (ASCII aesthetic, no emojis)
- Deploy: `npm run build` → `docs/` → GH Pages

## Game Design

### Win Conditions
- Reduce opponent LP to 0 (start with 3 LP / hearts)
- Deck out opponent

### Mana System
- +1 per turn, max 5, persists between turns

### Card Types
- **Creatures:** Summon to active/bench, attack enemy
- **Cast Verses:** Immediate effect, goes to graveyard
- **Set Verses:** Trap-style, triggers on condition

### Decks (4)
1. **Fang Pack** — Aggro, direct damage
2. **Shadow Pack** — Control, graveyard synergy
3. **Storm Pack** — Combo, chain effects
4. **Swarm Pack** — Bench synergy, sacrifice mechanics

---

## Technical Patterns

### Animation System
- `ANIM_TIMING` object for all durations
- All animations return promises for sequencing
- `getVisibleElement()` helper — finds visible DOM elements (skips display:none)
- Debug: Ctrl+1-9 tests individual animations

### Module Structure
```
src/
├── cards.js    — CREATURES, VERSES, DECKS
├── state.js    — $ helper, uid generator
├── anim.js     — ANIM_TIMING, Anim methods
├── render.js   — UI rendering helpers
└── helpers.js  — Game logic utilities
```

### Key Helpers
- `getAtkModifiers()` — Returns effective ATK + list of modifiers
- `getVisibleElement()` — Finds visible element by selector
- `applyDamage()` — Handles damage, returns true if KO

### Mobile Layout
- Trading card shape: `aspect-ratio: 5/7`
- Active card: `calc(clamp(50px, 14vw, 60px) * 2 + 3px)` (matches 2 bench cards)
- Responsive: `clamp()` sizing + `@media (max-width: 380px)` breakpoint

---

## Lessons Learned

### Operation Order (2026-02-04)
**Bug:** Grave Rise couldn't find just-KO'd creature.
**Root cause:** `grave.push(creature)` happened AFTER trigger checks.
**Fix:** Update state FIRST, then run triggers.
**Pattern:** In event handlers, order matters — state before triggers.

### Animation Positioning (2026-02-04)
**Bug:** Animations targeting wrong elements.
**Root cause:** `querySelector` returns first match (hidden mobile element).
**Fix:** `getVisibleElement()` helper that skips `display:none`.

### Pre-check Before Mana Spend
Validate card can be played BEFORE deducting mana cost. Prevents wasted mana on invalid plays.

### CSS Specificity
Later rules override earlier ones at same specificity. When adding overrides, check for conflicting rules below.

---

## Balance History

### Creature Adjustments
- Echomask death damage: 20→10 (was instant-win threat)
- Pulsefin ATK: 40→30 (80 first-hit too strong for 2 mana)
- Hexweaver: cost 3→2, HP 30→40 (was underpowered)

### Mechanic Changes
- Den Mother: "this turn +ATK" → "next attack +10" (was useless)

---

## Version History

See `VERSION` file and `TODO.md` for full history.

Current: v0.2.13+

Major milestones:
- v2.0: Initial v2 rewrite
- v2.1: Module extraction (TDD)
- v0.2.5: Trading card UI redesign
- v0.2.13: Grave Rise timing fix

---

## Session Log

### 2026-02-02 — Initial Build
- Complete card battler from scratch
- 12 creatures, 14 verses, 3 decks
- Animation system with promises
- AI with 4-second failsafe

### 2026-02-03 — Module Extraction
- Set up Vite + Vitest
- Extracted: cards.js, state.js, anim.js, render.js
- Deployed to GitHub Pages
- 53 tests passing

### 2026-02-04 — Major Polish
- Swarm Shield, Sacrifice order, Den Mother fixes
- Graveyard view, Set verse inspect, ATK modifiers
- Trading card UI (5:7 ratio)
- Mobile layout polish
- Grave Rise timing fix (root cause: operation order)
- 165 tests passing

### 2026-02-04 Evening — Attack Animation Mockups
- Created `attack-demo.html` with 12 simple universal attack animations
- Animations: Clean Lunge, Quick Jab, Bounce Strike, Slide Push, Pulse Strike, Tilt Strike, Shake Rush, Double Tap, Pop Hit, Hop Forward, Slam Down, Swipe Strike
- All use pure CSS transforms (no special effects) — universal for any creature
- Rico reviewing to pick one for implementation


### 2026-02-04 Late Evening — Attack Animation Fix (v0.2.15)
- **Bug**: Player attack animation not playing, opponent showing old animation
- **Root cause**: `render()` called immediately after `Anim.attack()`, re-rendering DOM and removing animation class before it played
- **Pattern**: AI attack worked because it was `await`ed
- **Fix**: Added `await` to player attack: `await Anim.attack("me", "opp", dmg);`
- **Lesson**: When animation is fire-and-forget but DOM gets re-rendered, the animation class disappears

