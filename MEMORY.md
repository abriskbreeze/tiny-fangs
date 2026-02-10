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
- Deploy: Push to main → GitHub Actions builds → deploys dist/ to GH Pages

---

## Project Scripts & Workflows

### Version Bumping
**When:** After completing fixes/features, before pushing
```bash
./scripts/bump.sh 0.4.5 "Description of changes"
```
Updates: VERSION, package.json, README.md, index.html (title + setup screen), CHANGELOG.md

### Deploying
**When:** Ready to push changes to GitHub/live site
```bash
npm run deploy       # test → build → show diff (review first)
npm run deploy:push  # test → build → commit → push (all-in-one)
```

### Bug Fix Sprints
**When:** Rico provides a list of bugs to fix
**Skill:** `~/clawd/skills/bugfix-sprint/SKILL.md`

**Workflow:**
1. Parse bugs into structured format with root cause questions
2. Group by system area (triggers, UI, AI, etc.)
3. Write plan to `tasks/todo.md`
4. Spawn Sonnet subagents per group (`model: "anthropic/claude-sonnet-4-20250514"`)
5. Monitor completion, run tests, summarize

**Root Cause Questions (always ask):**
1. Am I solving symptoms or ROOT problems?
2. What pattern allowed this bug to exist?
3. What breaks if we revert this fix?

### Searching the Codebase
**Always use `qmd search` first** — NOT grep, NOT memory_search
```bash
qmd search "pulsefin damage"     # Fast keyword search
qmd vsearch "trigger system"     # Semantic search (slower)
```

- `qmd search` = search FILES on disk (code, docs, notes)
- `memory_search` = search AGENT CONTEXT only (prior decisions, preferences)
- `grep` = last resort if qmd doesn't find it

---

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

## Architecture Milestone (2026-02-10)

**Shared Engine Refactor Complete**
- Server GameEngine: 1,724 → 149 lines (thin wrapper only)
- All game logic now in `shared/engine.js` (1,583 lines)
- Single source of truth for solo AND multiplayer
- 262 tests passing

**Next opportunity: Client unification**
- index.html has ~2,000 lines duplicate game logic for solo mode
- Could import shared module, cut ~2,000 lines
- Would guarantee solo/multiplayer parity forever

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


### 2026-02-05 Late Afternoon — Effect System Refactor (v0.2.53)

**New Module: `src/effects.js`**
- Declarative effect system for cast verses
- Cards define `effects: []` array, processor handles execution
- 14 effect primitives: damage, heal, draw, loseLife, gainMana, atkBonus, setStatus, cureStatus, moveCard, setFlag, banish, summon, aoeAll
- 27 unit tests for effects

**Migrated Cards (14 of 16):**
- Simple: shellArmor, secondWind, manaSurge, predatorsMark, fortify, unbreakable
- Conditional: soulSiphon, ignite, darkPact, regenerate
- Selection: graveEcho
- Computed: packTactics (creatureCount draw), callOfTheWild (summon)
- Banish: banish (with replacement handling)

**Still Using Switch (2):**
- `bloodMoon` — Complex AoE with capture-then-process, Den Mother triggers for bench KOs
- `sacrifice` — Triggers Den Mother, Grave Rise, creature death abilities (Gloom, Echomask, Stormtalon)
- Marked with `customHandler: true` in cards.js

**Architecture:**
```js
// Card definition
soulSiphon: {
  effects: [
    { type: 'damage', target: 'opp.active', amount: 20, condition: 'opp.active' },
    { type: 'heal', target: 'me.active', amount: 10, condition: 'me.active' }
  ]
}

// Processor handles: conditions, animations, KO collection
const result = await processEffects(card, ctx);
for (const koInfo of result.kos) { await ko(...); }
```

**Benefits:**
- New simple cards = data only, no code changes
- Centralized effect logic
- Easier testing (effect primitives are isolated)

**Future Work:**
- Set verse triggers could use similar declarative system
- Creature abilities could be migrated
- bloodMoon/sacrifice could be migrated with enhanced KO handling


### 2026-02-05 Evening — Event System Foundation (v0.2.54)

**New Modules:**
- `src/events.js` — GameEvents emitter (on, off, once, emit, clear)
- `src/triggers.js` — Trigger processor (matchesTrigger, getMatchingTriggers, processTriggers)

**Trigger Definitions Added to Cards:**
All set verses now have `triggerDef` with structured event/condition/optional:
- phantomWall, soulTrap, vengeance, graveRise, manaDrain, lastBreath
- brace, spikeShield, denMother, swarmShield

**New Effect Primitives:**
- `reduceDamage` — For damage reduction triggers
- `negateSpell` — For Mana Drain

**Architecture:**
```js
// Set verse with trigger definition
brace: {
  triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}
```

**Status:**
- Event system built and tested (13 event tests, 12 trigger tests)
- Trigger definitions added to all set verses (data only)
- Existing if-checks still handle actual gameplay (not migrated yet)
- Ready for gradual migration: emit events → test → remove old checks

**Tests:** 259 passing

### Priority System & Full Migration (v0.2.57)

**Priority System (5 levels, 1 = highest):**
| Priority | Purpose | Examples |
|----------|---------|----------|
| 1 | Negate triggers | Cancel other set verses |
| 2 | Negate action | negateAttack, negateSpell, negateKO |
| 3 | Pre-modification | reduceDamage, shields |
| 4 | Standard (DEFAULT) | Most triggers |
| 5 | Post-event | "After X happens" effects |

**Tiebreaker:** Same priority → non-active player (defender) fires first.

**New Effect Primitives:**
- `negateAttack` — Attack doesn't resolve
- `negateKO` — Creature survives (set HP to 1)
- `negateLifeLoss` — LP not decremented
- `destroy` — Kill creature, send to grave

**All Set Verses Migrated:**
✅ Brace, Swarm Shield (beforeDamage)
✅ Den Mother (onKO)
✅ Mana Drain (onCast)
✅ Phantom Wall (beforeAttack + negateAttack)
✅ Spike Shield (beforeAttack + damage to attacker)
✅ Vengeance (beforeKO + negateKO + destroy)
✅ Last Breath (beforeLifeLoss + negateLifeLoss)
✅ Soul Trap (onSummon)
✅ Grave Rise (onKO + summonFromGrave)

**Helper Functions Added:**
- `loseLife(player, playerKey)` — Emits beforeLifeLoss, checks lastLife

**All 29 Creatures Migrated:**
- **Passive abilities:** `{ passive: { type, amount, condition } }`
- **Triggered abilities:** `{ trigger: { event, condition }, effects: [...] }`
- **Procedural abilities:** `{ procedural: true }` (complex game flow)

**Tests:** 276 passing

---

## Documentation

| File | Description |
|------|-------------|
| `README.md` | Quick start, architecture overview |
| `CHANGELOG.md` | Full version history |
| `dist/ARCHITECTURE.md` | Complete system documentation |
| `guides/CARD-AUTHORING.md` | How to add new cards (declarative) |
| `guides/EVENT-SYSTEM.md` | Event/trigger system details |


### 2026-02-05 Evening — Bug Fix Sprint (v0.2.60)

**19 Bugs Fixed via 5 Parallel Subagents:**

**Visual/UI:**
- Pulsefin/Duskfang ATK modifiers now show in UI
- Opponent deck count visible
- Graveyard modal: newest at top, scrollbar after 4

**Card Effects:**
- Grave Echo returns creatures with full HP
- Vengeance only triggers on attack KO (not verse KO)
- Predator's Mark no longer doubled by Pulsefin
- Call of the Wild text says "RANDOM"

**Target Selectors:**
- Ignite, Banish, Soul Siphon all have creature selectors
- Visual ownership indicator (green = yours, red = enemy)
- Soul Siphon only heals if damage dealt

**Combat Flow:**
- Action lock prevents attack spam
- 0 HP creatures properly KO'd (fixed owner detection)

**AI Improvements:**
- Uses `getEffectiveAtk()` for ability-modified creatures
- Blood Moon self-preservation (won't suicide)
- Predator's Mark efficiency (won't waste after attacking)

**Tests:** 329 passing (+48 new tests)


### 2026-02-05 Night — Creature Ability Triggers (v0.3.0 → v0.3.3)

**Problem:** Creature abilities with `trigger` definitions weren't firing (Duskfang, Ironhide, Shellkin, Brace, Gloom, etc.)

**Root Cause Analysis:**
1. `processEffects` only checked `card.effects`, not `card.ability?.effects`
2. `showTriggerReveal` only handled set verses, not creature abilities
3. `getMatchingTriggers` didn't handle `onSummon` events (needed to check `context.summoned`)
4. Game paths (AI attack, player attack) weren't emitting `beforeAttack`/`beforeDamage` events

**Fixes Applied:**
- v0.3.0: 19 bugs fixed via 5 parallel subagents
- v0.3.1: `processEffects` now checks `card.ability?.effects` for creatures
- v0.3.1: `showTriggerReveal` handles creatures: shows "Ability Triggered!" + correct text
- v0.3.1: AI attack path: added `beforeDamage` event emission
- v0.3.2: `getMatchingTriggers`: special handling for `onSummon` to check `context.summoned`
- v0.3.2: AI attack path: added `beforeAttack` event emission
- v0.3.3: Removed duplicate Phantom Wall/Spike Shield hardcoded handlers
- v0.3.3: `beforeAttack` trigger fires BEFORE direct attack check

**Key Pattern:**
Trigger system migration requires: (1) card declares trigger, (2) game path emits event, (3) processor finds matches, (4) effect primitives handle execution.

**Procedural Abilities Still Hardcoded:**
- Broodmother (`turnEnd` → summonToken)
- Skitter (`afterDamage` → swapWithBench)
- Cindermaw, Pulsefin (modify attack flow)
- Bulwark (`preventLethal`)

**Missing Effect Primitives:**
- `summonToken` — Create 1/10 Larva token
- `swapWithBench` — Move creature to bench, needs UI
- `preventLethal` — Survive KO at 1 HP

**Tests:** 338 passing

**Next Steps:**
1. Manual test at http://localhost:3004
2. Verify Duskfang/Emberfang/Hiveling onSummon abilities
3. Test Ironhide/Shellkin/Pebbleback damage reduction
4. Test Brace/Phantom Wall/Spike Shield set verse triggers
5. Test Gloom discard effect on KO


### 2026-02-07 — Trigger/Effect System Bug Fixes (Group A)

**4 Bugs Fixed:**

**BUG-A1: Pulsefin Sonic Strike dealt 120 instead of 60**
- **Root cause:** Sonic Strike doubled ATK in BOTH `getEffectiveAtk()` AND inline doAttack code
- **Fix:** Removed doubling from `getEffectiveAtk()` in abilities.js, kept it in doAttack for procedural handling
- **Pattern:** When ability is procedural, don't also apply it in helper functions

**BUG-A2: Chain Lightning not working on retreat/swap**
- **Root cause:** `chainLightning` only checked after fresh summons, not after retreat or Scurry swaps
- **Fix:** Added chainLightning check to `doRetreat()` and `swapWithBench` effect
- **Pattern:** Any bench-to-active transition should check chainLightning

**BUG-A3: Skitter ability showed "UNDEFINED"**
- **Root cause:** `showTriggerReveal` used `card.ability?.trigger?.event` (technical name like 'afterDamage') instead of readable text
- **Fix:** For creature abilities, show `ability.name` as trigger label and `ability.text` as effect
- **Pattern:** Creature ability text already contains trigger condition; don't parse event name

**BUG-A4: Phantom Wall and Spike Shield not triggering for player attacks**
- **Root cause:** Player attack's `processTriggers('beforeAttack', ...)` didn't pass `processEffects` callback
- **Fix:** Added `processEffects` callback to player attack's beforeAttack trigger processing (same as AI attack)
- **Pattern:** Trigger system needs `processEffects` in gameCtx to execute effect primitives like `negateAttack`

**BUG-A5: Blood Moon — Verified Working**
- Player's Blood Moon uses declarative path with `processEffects` → `aoeAll`
- `aoeAll` correctly damages ctx.me (player) and ctx.opp (AI) creatures
- No fix needed; code already correct

**Key Patterns Learned:**
1. **Procedural vs Declarative:** When ability is marked `procedural: true`, don't also apply in helper functions
2. **Event Consistency:** Any state transition that puts a creature in active slot should check flags like `chainLightning`
3. **Trigger Display:** Creature abilities already have human-readable text; don't try to generate from event names
4. **Trigger Processing:** `processTriggers` needs `processEffects` callback to execute non-inline effects

**Tests:** 254 passing


### 2026-02-07 Evening — Ability & Damage System Bug Fixes (Group A)

**6 Bugs Fixed:**

**BUG-A1: Shellkin's Harden vs Ignite**
- **Root cause:** `Effects.damage()` only applied damage without checking for damage reduction abilities
- **Fix:** Added Harden check in `Effects.damage()` — reduces first 10 damage from ANY source (not just attacks), marks `hardenUsed = true`
- **Pattern:** Non-combat damage sources (verses like Ignite) should respect creature damage reduction

**BUG-A2: Echomask 0 ATK direct attack**
- **Root cause:** Direct attack section dealt LP damage without checking effective ATK
- **Fix:** Added `getEffectiveAtk()` check before direct attack loop — if ATK ≤ 0, log "deals no damage" and skip LP loss
- **Pattern:** Always validate effective damage before dealing LP damage

**BUG-A3: Echomask copies BASE not MODIFIED ATK**
- **Root cause:** `getEffectiveAtk()` used `enemy.active.atk` (base) instead of recursive call
- **Fix:** Changed to `getEffectiveAtk(enemy.active, enemy, owner)` to get enemy's full modified ATK
- **Pattern:** Mirror effects should mirror the FINAL stat, not the base stat

**BUG-A4: Thornling causes negative HP / creatures not KO'd**
- **Root cause:** `afterAttack` trigger's `processEffects` callback didn't handle KO results from damage effects
- **Fix:** Added KO handling in both player and AI `afterAttack` trigger processing (same pattern as beforeAttack)
- **Pattern:** Any trigger that can deal damage must handle the KO result from `processEffects`

**BUG-A5: Hexweaver poison damage**
- **Status:** Poison damage was already implemented for both player (line ~4520) and AI (line ~5745)
- **Fix:** Updated Hexweaver card text to be clearer: "On hit, enemy takes 10 damage at end of each turn until cured."
- **Pattern:** Verify bug exists before fixing — sometimes it's just a text issue

**BUG-A6: Duskfang ATK bonus stacks on re-summon**
- **Root cause:** `atkBonuses` array wasn't cleared on creature death or return to hand
- **Fix:** Clear `creature.atkBonuses = []` in `ko()` function AND in `moveCard` effect when returning to hand
- **Pattern:** Creature state must be reset on zone transitions (death, return to hand)

**Key Patterns Learned:**
1. **Damage reduction should be checked at damage source:** `Effects.damage()` is the right place for universal damage reduction like Harden
2. **Mirror effects need recursion:** When copying a stat, recursively call the same getter to get the full modified value
3. **Trigger callbacks must handle KOs:** Any `processEffects` callback that can deal damage needs to check `result.kos` and process them
4. **State reset on zone transitions:** Creatures returning to hand or dying should have temporary bonuses cleared

**Tests:** 257 passing (+3 from trigger tests)


### 2026-02-07 Night — v0.4.0 Major Release + UI Features

**v0.4.0: 33 bugs fixed across 2 sprints**
- Sprint 1: 15 fixes (trigger system, UI, game flow)
- Sprint 2: 18 fixes (damage system, AI, creature abilities)
- All using parallel subagents + Karpathy guidelines

**v0.4.1: Dual Deck Selector**
- Player selects their deck (5 decks + Random)
- Then selects AI deck (5 decks + Random)
- Then coin flip → game start
- Added: `selectPlayerDeck()`, `showAIDeckSelector()`, `selectAIDeck()`, `getRandomDeckId()`

**v0.4.2: AI Healing Verse Scoring**
- Hunter AI was falling through to default for Shell Pack cast verses
- Added proper scoring: `shellArmor`, `regenerate`, `fortify`, `unbreakable` return -100 if no active

**v0.4.3: AI Set Verse Scoring**
- Added smarter scoring for `brace` and `spikeShield`
- `brace`: higher priority when active is wounded
- `spikeShield`: higher priority vs low-HP attackers

**v0.4.5: Deck Preview**
- Hover on desktop / hold on mobile → shows full deck description
- Strategy overview + star creatures for each deck
- Added to deck selector with hint text

### 2026-02-08 — Multiplayer Phase 1 (v0.4.43)

**P2P Multiplayer Foundation — 3 Parallel Subagents**

Built complete 1v1 multiplayer infrastructure using PeerJS WebRTC:

**mp-networking (src/multiplayer.js):**
- `MultiplayerManager` class with PeerJS integration
- Room codes: `FANGS-XXXX` format (4 uppercase letters, no I/O)
- Methods: `createRoom()`, `joinRoom(code)`, `send(msg)`, `disconnect()`
- Callbacks: `onConnect`, `onMessage`, `onDisconnect`, `onError`
- Auto-regenerates room code if taken

**mp-ui (index.html CSS/HTML):**
- Mode select screen (AI vs Friend) — shows BEFORE deck select
- Room modal with create/join views, room code display, copy button
- Waiting indicator with pulsing animation
- Connection status (top-right, green/red)
- Disconnect modal with 30s countdown
- Turn timer (60s, red at 10s warning)

**mp-integration (index.html JS):**
- Message protocol: `MP_MSG` constants (READY, COIN_FLIP, ACTION, SYNC, etc.)
- State flags: `mode`, `isHost`, `opponentReady`, `turnTimeRemaining`
- Action wrappers: `summonCreature`, `castVerse`, `setVerse`, `doAttack`, `doRetreat`, `endTurn`
- State sync: `sanitizePlayer()`, `getMinimalState()`, `applyStateSync()`
- Turn timer: `startTurnTimer()`, `stopTurnTimer()`
- Host authority pattern: guest sends action → host validates → executes → syncs

**Architecture:**
- Host-authority model (host validates all actions)
- Action sync (not state sync) — actions replayed, not states replaced
- Hidden info: deck order and hand contents hidden from opponent
- 60s turn timer with auto-end
- 30s reconnect window

**Remaining Work (Phase 2+):**
- Coin flip sync in `startGame()`
- Deck shuffle sync (host generates both decks)
- `validateAndExecuteAction()` implementation
- Complex selection sync (targeting modals)
- Reconnection handling
- Rematch flow

**Current Version:** v0.4.43
**Tests:** 262 passing

### 2026-02-08 Evening — Multiplayer Phase 4: Disconnection & Reconnection (v0.4.44)

**Complete disconnection and reconnection handling for multiplayer:**

**1. Disconnection Detection:**
- Wired up `multiplayer.onDisconnect` callback in `setupMultiplayerHandlers()`
- Shows disconnect modal when opponent drops mid-game
- 30-second countdown timer with visual countdown display
- "Leave Game" button allows player to forfeit immediately
- Auto-forfeit and show victory if countdown expires

**2. State Persistence:**
- `saveGameState()` saves to sessionStorage (`tf-mp-state` key)
- Includes: room code, isHost flag, turn number, full game state
- Saved on game start, every 10 seconds during game, and after each turn
- `clearSavedGameState()` removes state on game end or forfeit
- 30-second expiry window for reconnection attempts

**3. Reconnection Flow:**
- `loadSavedGameState()` checks sessionStorage on page load
- Shows reconnection prompt if saved state exists and not expired
- `attemptReconnection()` tries to rejoin same room:
  - Host: creates room with same code, waits for guest
  - Guest: joins room using saved code
- Restores game state if successful
- Shows error modal if reconnection fails
- Clears saved state after successful reconnection

**4. Connection Error Handling:**
- `handleConnectionError()` shows user-friendly error messages:
  - "Room not found" if code is invalid
  - "Network error" for connection failures
  - "Room code taken" if unavailable-id error
- Provides "Try Again" and "Return to Menu" options
- Integrated with PeerJS error types

**5. Integration:**
- `startGame()` triggers state persistence for multiplayer games
- `endTurn()` saves state after each turn
- `showResult()` clears state on game end and sends forfeit message
- `leaveGame()` sends forfeit before disconnecting
- `handleReconnect()` syncs state when opponent reconnects
- `initializeMultiplayer()` orchestrates page load checks

**Key Functions:**
- `saveGameState()` / `loadSavedGameState()` / `clearSavedGameState()`
- `handleDisconnect()` / `handleReconnect()` / `attemptReconnection()`
- `handleConnectionError()`
- `setupMultiplayerHandlers()` / `initializeMultiplayer()`
- `startStatePersistence()` (auto-save every 10s)

**User Experience:**
- Seamless reconnection within 30 seconds of disconnect
- Clear error messages with retry options
- No data loss if both players reconnect in time
- Automatic forfeit handling for extended disconnects

**Tests:** 262 passing (all existing tests still pass)
**Version:** v0.4.44


### 2026-02-08 Late — MP Sync Bug (v0.4.58)

**Bug Report (from koi/Rico):**
"You can't see the actions your opponent is taking until they end their turn and then things all happen at once."

**Root Cause Analysis:**
- Player action functions should send `MP_MSG.SYNC` after completing
- All actions had sync blocks: `summonCreature`, `setVerse`, `doAttack`, `doRetreat`
- **Missing:** `castVerse()` had 3 exit paths with no sync!

**Exit Paths Without Sync:**
1. After spell negation (`castResult.negated`)
2. After declarative effects (`if (c.effects)` branch)
3. After legacy switch (fallback for non-migrated cards)

**Fix (v0.4.58):**
Added sync block to all 3 exit paths:
```javascript
if (state.G.mode === 'multiplayer' && state.G.isHost) {
  multiplayer.send({ 
    type: MP_MSG.SYNC, 
    state: getMinimalState() 
  });
}
```

**Pattern Learned:**
Every player action function needs sync at ALL exit paths, not just the happy path. When adding new actions, use try/finally pattern like `doAttack` to ensure sync always runs.

**Tests:** 262 passing


### 2026-02-08 Night — MP Mana Sync & Hash Fix (v0.4.59)

**Bug Reports (from koi/Rico):**
1. Opponent not regaining mana
2. Turn counter not syncing/restarting per turn
3. Constant DESYNC detection in logs

**Root Cause 1: SYNC overwrites mana refill**
When host ends turn:
1. Host sends END_TURN
2. Host sends SYNC (with OLD mana values, before turn transition)
3. Guest receives END_TURN → refills mana, draws
4. Guest receives SYNC → **overwrites** the mana refill with old values!

**Fix:**
- Guest's END_TURN handler now just sets `state.G._pendingTurnStart = true`
- Guest waits for SYNC to arrive
- In `applyStateSync`, after merging state, if `_pendingTurnStart` is true:
  - Refill mana, draw card, reset flags
  - Clear the pending flag

**Root Cause 2: Hash uses perspective keys**
Hash function used `me`/`opp` directly:
- Host hashes: `{me: hostData, opp: guestData}`
- Guest hashes: `{me: guestData, opp: hostData}` (swapped!)
These will NEVER match because JSON key order differs.

**Fix:**
Use consistent `host`/`guest` keys based on `isHost`:
```javascript
const hostPlayer = state.G.isHost ? state.G.me : state.G.opp;
const guestPlayer = state.G.isHost ? state.G.opp : state.G.me;
```

**Pattern Learned:**
1. In multiplayer, message order matters - END_TURN and SYNC can race
2. When syncing state, don't do local modifications that will be overwritten
3. Hash/comparison functions must use consistent keys, not perspective-based keys

**Tests:** 262 passing


### 2026-02-08 Night — MP Deck UID Mismatch (v0.4.60)

**THE CRITICAL BUG:**
Guest's deck had completely different UIDs than what host expected!

**Root Cause:**
```
Host: mkDeck(oppDeckId) → cards get UIDs [abc, def, ...]
Host: sends uidOrder: [abc, def, ...] to guest
Guest: mkDeck(deckId, uidOrder) → creates NEW cards with NEW UIDs [xyz, uvw, ...]
Guest: shuffleByUidOrder tries to find abc, def → NOTHING MATCHES!
```

The `mkCreature` and `mkVerse` functions call `uid()` which generates a NEW unique ID each time. So the guest's cards had completely different UIDs.

**Why this broke everything:**
- Guest summons card with UID `xyz`
- Host validates by looking for `xyz` in `oppPlayer.hand` → NOT FOUND
- Host sends "Card not in hand" error
- Host's `oppPlayer.active` is null (from host's perspective)
- Guest tries to attack, host says "No active creature"

**Fix:**
Host now sends `deckCards: [{uid, cardId}, ...]` so guest can create cards with the EXACT same UIDs:
```javascript
// Host sends:
{ uid: 'abc123', cardId: 'whisper' },
{ uid: 'def456', cardId: 'gloom' }, ...

// Guest creates cards with those exact UIDs
```

**Lesson Learned:**
When syncing deck state across network, you must sync BOTH the card identity (cardId) AND the unique instance ID (uid). Just sending one or the other isn't enough.

**Tests:** 262 passing
**Version:** v0.5.0


### 2026-02-09 — MP Architecture Refactor + Bug Fixes

**v0.5.0:** Host as Single Source of Truth architecture
- `getStateForGuest()` - Host swaps me/opp BEFORE sending
- `applyStateSync()` - Guest applies DIRECTLY (no swap needed)

**v0.5.1:** Fixed `executeDrop()` for guest summons

**v0.5.2:** Fixed turn-start sync (host does guest's mana/draw before sending)
- Added `set` action handler for set verses
- Added `CANCEL_SELECT` message for cancelled targeting

**v0.5.3:** Exposed `showModeSelect` to window

**v0.5.4:** Fixed remaining sync issues
- Sync `hasAttacked`/`hasRetreated` flags to prevent infinite attacks
- Store opponent's `handCount`/`deckCount`/`graveCount` for hash comparison

**v0.5.5:** Fixed DESYNC root cause
- Hash now uses synced counts (`_handCount`, `_deckCount`, `_graveCount`) for ALL players
- Properly sync deck contents (not just counts)
- Issue was: host does guest's draw → sync includes new deck count → but guest's local deck.length was stale

**v0.5.6:** Additional fixes
- Guard doAttack() with hasAttacked/hasRetreated checks
- Added detailed hash data logging (JSON.stringify for debugging)
- Added animation trigger debug logs

**v0.5.7:** Fixed DESYNC false positives
- Hash used `me`/`opp` keys which meant different things on host vs guest
- Now uses consistent `host`/`guest` keys so both sides compute same hash

**v0.5.8:** Fixed "can't attack on subsequent turns"
- When host ends their turn, hasAttacked wasn't reset for guest's new turn
- Now reset hasAttacked/hasRetreated for guest before sending sync

**See:** `tasks/mp-refactor-plan.md` for architecture diagrams


### 2026-02-08 Night — MP Architecture Refactor Planning

**Problem:** Current MP architecture has both host and guest maintaining independent `state.G`, with sync + perspective swap. Causes desync bugs, perspective swap errors, race conditions.

**Solution:** Host as Single Source of Truth
- Host maintains authoritative `state.G`
- Host sends state PRE-SWAPPED for guest (no swap in applyStateSync)
- Guest is view-only layer - sends actions, receives synced state
- All game logic runs on host

**New Functions:**
- `getStateForGuest()` - Host swaps me/opp BEFORE sending
- `applyStateSync()` - Simplified, no swap needed

**See:** `tasks/mp-refactor-plan.md` for full diagrams and implementation details


### 2026-02-08 Night (cont.) — Deploy Cleanup

**Removed docs/ folder:**
- GitHub Pages now served from `dist/` via GitHub Actions workflow
- Deleted the redundant `docs/` folder completely
- Updated all doc references: ARCHITECTURE.md, TODO.md, README.md, MEMORY.md, PLAN.md, CLAUDE.md
- Changed `docs/ARCHITECTURE.md` refs → `dist/ARCHITECTURE.md`

**Debug Logging Added for MP:**
- `[MP] Creating game state` logs deck contents (UIDs and cardIds)
- `[MP] Game started` logs hand contents for both players
- Helps trace UID mismatches between host/guest

**Still investigating:** User reports same hash mismatches after v0.4.60 - may need to verify the new bundle is deployed and cached properly. New bundle should be `index-CpL7ksj7.js`.


### 2026-02-09 — Server-Based MP: Feature Complete (v0.4.48)

**Pivoted from P2P to Server-Based MP** — NAT traversal issues, host disconnect problems, animation sync issues all solved by authoritative server.

**Server Implementation Complete:**
- Node.js + `ws` library (no framework bloat)
- Cloudflare Tunnel for public access
- Room management, deck selection, turn tracking

**GameEngine Feature Complete (via 3 parallel subagents):**
1. **All 10 Cast Verses:** ignite, banish, soulSiphon, secondWind, shellArmor, regenerate, fortify, unbreakable, bloodMoon, callOfTheWild
2. **All 10 Set Verse Triggers:** phantomWall, spikeShield, brace, swarmShield, soulTrap, vengeance, graveRise, denMother, manaDrain, lastBreath
3. **27/28 Creature Abilities:** All except skitter (needs optional action UI)

**Selection UI for Targeting Cards:**
- Selection happens in `castVerse()` BEFORE `dispatchAction()`
- Cards: ignite, banish, soulSiphon (anyCreature), graveEcho (graveCreature), sacrifice (ownCreature)
- MP sends: `targetUid`, `graveUid`, or `sacrificeUid` to server
- Cancel returns card without spending mana

**Server Files:** `server/index.js`, `server/GameEngine.js`, `server/cards.js`, `server/utils.js`

**Current State:**
- **Version:** v0.4.48
- **Tunnel:** `wss://attract-travel-puzzles-karen.trycloudflare.com`
- **Server session:** `tide-atlas`
- **Tunnel session:** `delta-glade`
- **Tests:** 262 passing

**TODO:**
- Skitter ability (reactive swap after damage)
- Full MP playtesting



### 2026-02-09 — MP State Sync & Animation Fixes

**Critical MP Bugs Fixed:**
1. **Animations in wrong place** - Render state BEFORE playing animations (DOM needs elements first)
2. **Double turn banner** - Use personalized `turnChange` message, not shared `turnStart` event
3. **P2 cant attack** - Server must send `hasAttacked`, `hasRetreated`, `firstTurn` flags
4. **No auto-swap after KO** - Added `autoSwapBenchToActive()` helper

**Server State Sync Pattern:**
```javascript
// getStateForPlayer must include ALL game flags
return {
  turn, yourTurn, winner,
  firstTurn: state.firstTurn,      // Was missing!
  hasAttacked: state.hasAttacked,  // Was missing!
  hasRetreated: state.hasRetreated,// Was missing!
  me: { ... },
  opp: { ... }
};
```

**Client Animation Order:**
```javascript
// CORRECT order in updateFromServer:
state.G = convertServerState(serverState);  // 1. Update state
render();                                    // 2. Render (creates DOM elements)
await playServerEvents(events);              // 3. THEN animate
```

**Current Tunnel:** Changes frequently. Check `marine-lobster` session or restart with:
```bash
cloudflared tunnel --url http://localhost:3001
```



### 2026-02-09 — Double Trigger Execution Fix (v0.4.62)

**3 Major Bugs Fixed in Singleplayer:**

**BUG 1: Double damage/animations (Phantom Wall doing 20, Vengeance KO animation twice)**
- **Root cause:** In `processTriggers()`, for each effect in a card's effects array, if it wasn't handled inline, it called `processEffects(card, ctx)`. But `processEffects()` runs ALL effects on the card!
- Example: Phantom Wall has `effects: [negateAttack, damage]`. Loop iterated twice, called processEffects twice, each time running BOTH effects = 2x damage!
- **Fix:** Added `needsProcessEffects` flag. Loop marks which cards need processEffects, then calls it ONCE after the loop.
- **Pattern:** When delegating to a function that handles "all items", don't call it inside a "for each item" loop.

**BUG 2: Ironhide's Iron Skin not reducing second Cindermaw hit**
- **Root cause:** `processTriggers('beforeDamage', ...)` only ran on first hit (`if (hit === 0)`)
- Comment said "first hit only for set verses" but creature abilities use the same trigger system
- Set verses are auto-consumed after triggering, so they won't fire twice anyway
- **Fix:** Removed `if (hit === 0)` guard. Triggers now fire on every hit. Shellkin's Harden has `perTurn: true` flag which the trigger system respects.
- **Pattern:** Don't restrict trigger processing based on assumptions about card types — the trigger system handles those cases.

**BUG 3: Vengeance KO animation playing before KO is negated**
- **Root cause:** Caller did `await Anim.ko(); await ko(creature, ...)`. But inside `ko()`, Vengeance's beforeKO could negate the KO — but animation already played!
- **Fix:** Moved `Anim.ko()` call INSIDE `ko()` function, AFTER beforeKO triggers resolve. If negated, early return before animation.
- **Pattern:** Animation should play AFTER the action is confirmed, not before checks that could cancel it.

**Files Changed:**
- `src/triggers.js` — processEffects called once per card, not per effect
- `index.html` — beforeDamage triggers on every hit; Anim.ko moved inside ko()

**Tests:** 262 passing


### 2026-02-09 — Shared Module Architecture + MP Bug Fixes

**Major Architecture Change: shared/ Module**
Created unified module for client/server code sharing:
```
shared/
├── cards.js     — Card definitions (CREATURES, VERSES)
├── effects.js   — Effect primitives (damage, heal, etc.)
├── triggers.js  — Trigger processing
├── engine.js    — Core game logic
└── index.js     — 23 exports total
```

**Migration:**
- Server migrated to use `shared/`, deleted duplicate `server/cards.js`
- Client's `src/effects.js` now wraps shared + adds animations
- Client's `src/cards.js` re-exports from shared

**5 Multiplayer Bugs Fixed:**
1. **Mana bug** — Captured `wasFirstTurn` before mutation in `server/GameEngine.js` ~line 1385
2. **Phantom Wall damage** — Added 10 damage logic in server ~line 214
3. **Battle log rendering** — Added `renderLog()` call in client
4. **Animation queue** — State updates before animations (elements must exist for summons)
5. **Optional triggers** — Vengeance now prompts "Activate Vengeance?" with Yes/No buttons

**Optional Triggers UI:**
- Uses `pendingAction` flow with Yes/No button prompts
- Server sends `awaitingOptional: true` when optional trigger available
- Client shows prompt, sends `triggerResponse: true/false`

**Key Decisions:**
- State before animations: Update state FIRST, then play animations
- Queue system: `queueUpdate()` processes sequentially to prevent pile-up
- Single source of truth: All game logic in `shared/` module

**Infrastructure:**
- Server: `node index.js` in `~/clawd/tiny-fangs/server` on port 3001
- Tunnel URL hardcoded in `index.html` line 2804
- Deployed to gh-pages after fixes


### 2026-02-10 — Trigger Refactor (v0.4.65)

**Problem:** Server had hardcoded effect values in switch statements that could drift from `shared/cards.js`.

**Solution:** Refactored `executeTrigger()` to use `processEffects()` from shared module.

**8 triggers migrated:**
- phantomWall, spikeShield, soulTrap, brace
- swarmShield (with new `perBench` computed amount)
- manaDrain, vengeance, graveRise

**2 kept as custom (documented):**
- denMother — deck search + complex placement
- lastBreath — one-time-use flag checking

**Key changes:**
- `shared/effects.js` — added `perBench` param to reduceDamage
- `server/GameEngine.js` — imports processEffects, new `buildEffectsContext()` helper

**Pattern:**
```
OLD:  switch(verse.id) { amount: 15 }  ← hardcoded
NEW:  processEffects(verse, ctx)       ← reads from verse.effects[]
```

**Result:** Balance changes now only need to update `shared/cards.js`.

**Tests:** 262 passing


### 2026-02-10 — Full Effects Migration (v0.4.66)

**Goal:** All cards use `processEffects()` for future-proofing (hundreds of cards planned).

**21 cards migrated:**

Creature Abilities (10):
- onSummon: Duskfang, Emberfang, Hiveling
- afterAttack: Thornling, Mireveil, Hexweaver, Coilshell, Reflector
- onKO/onHit: Gloom, Sundew Queen, Leechling

Cast Verses (11):
- ignite, secondWind, shellArmor, regenerate, manaSurge
- predatorsMark, fortify, soulSiphon, darkPact, banish, bloodMoon

Kept Custom:
- graveEcho, packTactics, callOfTheWild, sacrifice (complex logic)
- echomask, alpha, fangpup (special mechanics)

**Infrastructure:**
- `processCastVerseEffects()` helper added
- `buildEffectsContext()` enhanced with selected target
- `getEffectiveAtk()` fixed for creature-specific bonuses

**Result:** New cards = just define effects array. Balance = edit shared/cards.js only.

**Tests:** 262 passing
