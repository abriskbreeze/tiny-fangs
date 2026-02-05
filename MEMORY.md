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


### 2026-02-04 Night Session — Animation Polish (v0.2.14 → v0.2.21)

**Coiled Strike Attack Animation (v0.2.14)**
- Pullback coil (tilt 12°) → hold tension → explosive release
- Hit reaction: tilt wobble (-8° → +5° → -3° → settle)

**Bug Fixes (v0.2.15-v0.2.21)**
- v0.2.15: Player attack animation not playing — `render()` removed class before animation played. Fix: `await Anim.attack()`
- v0.2.16: KO animation + hit reaction timing — same render() issue, shake had 45% delay
- v0.2.17: Added `attackDirect()` for direct LP attacks, hit timing tuned
- v0.2.18: Rival set verse animation missing — `Anim.setVerse("opp")` was never called
- v0.2.19-v0.2.20: Hit timing adjustments (400ms → 100ms → 0ms)
- v0.2.21: Non-combat damage now has full hit effects (screen flash, tilt wobble, red flash)

**Key Pattern Learned**
When animation class is added but `render()` is called before animation completes, the class gets removed. Solution: `await` the animation before continuing.


### 2026-02-04 Late Night — AI + Drag-to-Play (v0.2.22 → v0.2.29)

**v0.2.22: AI Cast Verse Phase**
- AI now casts verses (Soul Siphon, Ignite, Dark Pact, etc.)
- Logic: evaluate each cast verse, decide if beneficial, cast if yes
- Added after bench phase, before set verse phase in AI turn

**v0.2.23-v0.2.25: Banish Fixes**
- Bug: Banish didn't trigger opponent bench replacement
- Root cause: `ko()` handles replacement, but Banish just set `active = null`
- Fix: Added bench-to-active swap + KO animation after Banish
- v0.2.25: Fixed `pause` being out of scope in player's castVerse (used `Anim.wait(300)` instead)

**v0.2.26-v0.2.29: Drag-to-Play System**
- Hold card (no movement) → zoom preview
- Drag card (>15px) → card follows finger
- Drop on field → plays card automatically:
  - Creatures: active slot if empty, else bench
  - Cast verses: cast immediately
  - Set verses: set to slot
- Key fixes:
  - v0.2.27: `touch-action: none` + `preventDefault` to stop scroll hijack
  - v0.2.27: Unaffordable cards drag but show grey/red over field
  - v0.2.28: Simplified to one big "field" drop zone
  - v0.2.29: Turn check - can't play cards when not your turn

**Pattern: Mobile Touch Handling**
- Use `touch-action: none` on draggable elements
- Call `e.preventDefault()` in pointer handlers to prevent scroll
- Track affordability separately from drag ability (visual feedback vs action)


### 2026-02-05 — Hunter AI (v0.2.30)

**New Module: `src/ai.js`**
- `getAllMoves(player, opponent)` — generates all legal moves
- `scoreMove(move, ai, player)` — evaluates move (0-100+ score)
- `pickBestMove(moves, threshold)` — selects highest above threshold
- 25 unit tests for move generation and scoring

**Hunter AI (`aiTurnHunter`)**
- Loop: get moves → score → pick best → execute → repeat until pass is best
- Dispatches based on `state.G.aiDifficulty` (default: 2)
- Difficulty 1 = Pup (original), 2 = Hunter, 3 = Alpha (TBD)

**Scoring Heuristics:**
- summon-active: 100 base + survival/KO bonuses
- cast verses: context-specific (Ignite 100 if KO, Dark Pact -100 at 1 LP)
- attack: 50 base + KO bonus - trap fear
- set verses: 30-60 based on defensive value


### 2026-02-05 Afternoon — Bug Fixes & Polish (v0.2.40 → v0.2.48)

**v0.2.40-v0.2.41: Blood Moon AoE Fix**
- Bug: Bench creatures not showing damage animation
- Fix v0.2.40: Added `Anim.benchDamage(side, index, amount)` for bench damage visuals
- Bug: Bench creature escaped damage by swapping to active when active KO'd
- Root cause: Damage applied sequentially — active KO triggered swap before bench damage
- Fix v0.2.41: **Option A** — Capture all targets BEFORE any damage, then animate, apply, KO

**v0.2.42: Bladewhisker Rend Display**
- Added Rend (+10 ATK) to `getAtkModifiers()` so card shows boosted ATK on battlefield

**v0.2.43: Turn Flow Polish**
- END TURN button pulses gold after player attacks (prompts turn end)
- TURN END animation banner (ASCII art, same style as BEGIN)
- Animation blocking on all action buttons during transitions

**v0.2.44: Async KO Fix**
- Bug: Den Mother set card didn't disappear after triggering
- Root cause: `ko()` called without `await`, render happened before trigger completed
- Fix: Added `await` to all `ko()` and `Anim.ko()` calls in Ignite + poison damage

**v0.2.45: END TURN Highlight Fix**
- Bug: Highlight didn't show after certain action sequences
- Root cause: Early return paths in `doAttack()` skipped `highlightEndTurn()`
- Fix: Added highlight to Phantom Wall path, direct attack path, and retreat

**v0.2.46: Spike Shield Priority**
- Bug: Spike Shield KO'd attacker but attack damage still applied
- Root cause: Linear resolution — damage applied before counter-triggers
- Pattern: No priority interrupt mechanism
- Fix: Pre-check Spike Shield — if `attacker.curHp <= 15`, trigger first and negate attack

**v0.2.47: Shellkin Rebalance**
- Stats: 35 HP → 20 HP, 15 ATK → 10 ATK
- Ability text: "Negates first 10 damage each turn from any source"

**v0.2.48: AI Ability Modifiers Fix**
- Bug: AI Shade Pup attacked for 15 instead of 30 (Orphan not applied)
- Root cause: AI used `ai.active.atk` instead of `getEffectiveAtk()`
- Pattern: Duplicated damage calc — player used helper, AI had incomplete inline code
- Fix: Changed AI to use `getEffectiveAtk(ai.active, ai, player)`

**Key Patterns Learned:**
1. **Capture-then-process**: For AoE effects, snapshot targets before any state changes
2. **Await async chains**: Always await async functions that modify state before render
3. **Check all return paths**: Early returns can skip important side effects
4. **DRY helpers**: Use shared functions (getEffectiveAtk) instead of inline duplication

