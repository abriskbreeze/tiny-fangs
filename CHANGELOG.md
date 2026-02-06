# Changelog

All notable changes to Tiny Fangs.

## [0.3.6] - 2026-02-05

### Added
- **ARCHITECTURE.md** — Comprehensive system reference with ASCII diagrams:
  - Module dependency graph
  - Turn cycle and attack resolution flow
  - Event system and priority documentation
  - Effect primitives reference
  - AI decision tree
  - Card and ability type structures
  - State management documentation

### Removed
- `tests/state.test.js` — Redundant with state-integration.test.js
- `tests/game-logic.test.js` — Bug documentation, covered by game.test.js

### Changed
- Test count: 351 → 334 (removed redundant tests)

---

## [0.3.5] - 2026-02-05

### Added
- **`onLethalDamage` event** — Fires when a creature's HP drops to 0 (any damage source)
- **Bulwark migrated to trigger system** — Fortress ability now declarative

### Changed
- `self: true` condition now works for both `onSummon` (context.summoned) and `onLethalDamage` (context.creature)
- Added `checkLethalDamage()` helper function in index.html for unified lethal damage handling
- Replaced hardcoded Bulwark checks in player/AI attack paths with trigger system

### Technical
- `getMatchingTriggers` now has special handling for `onLethalDamage` (survivalAbility type)
- Skips context.creature in regular creature loop to prevent double-matching

### Tests
- 3 new tests for `onLethalDamage` event handling

---

## [0.3.4] - 2026-02-05

### Added - New Effect Primitives
- **`summonToken`** — Create token creatures (Antling for Broodmother)
- **`swapWithBench`** — Swap active with bench creature (Skitter Scurry)
- **`turnEnd` event** — Fires at end of player turn (Broodmother Spawn)
- **`afterDamage` event** — Fires after creature takes damage and survives (Skitter Scurry)
- **`survived` condition** — Match triggers only if creature survived damage
- **`self: 'active'` condition** — Match triggers only if creature is in active slot

### Migrated to Declarative System
- ✅ **Broodmother (Spawn)** — Now uses `turnEnd` event + `summonToken` effect
- ✅ **Skitter (Scurry)** — Now uses `afterDamage` event + `swapWithBench` effect

### Still Procedural (Escape Hatches)
- Cindermaw (Frenzy) — Modifies attack loop
- Pulsefin (Sonic Strike) — Modifies damage calc order
- Bulwark (Fortress) — Lethal prevention during damage resolution

### Added
- 10 new tests for new effects and events

---

## [0.3.3] - 2026-02-05

### Fixed
- **beforeAttack trigger order** — Now fires BEFORE direct attack check, so Phantom Wall can negate direct attacks too
- **Removed duplicate Spike Shield/Phantom Wall handlers** — AI attack path now fully uses trigger system

---

## [0.3.2] - 2026-02-05

### Fixed (Root Cause Analysis)
- **onSummon creature abilities (Duskfang, Emberfang, Hiveling)** — `getMatchingTriggers` now has special handling for `onSummon` event to check `context.summoned` creature (was only checking creatures already on field)
- **AI attack triggers (Brace, Phantom Wall, Spike Shield)** — Added `beforeAttack` event emission to AI attack path (was completely missing)
- **Spike Shield duplicate handling** — Removed hardcoded Spike Shield check, now fully handled by trigger system

### Added
- 2 new tests for onSummon creature abilities
- `beforeAttack` processTriggers call in AI attack with full processEffects support

---

## [0.3.1] - 2026-02-05

### Fixed
- **Ironhide/Shellkin/Pebbleback damage reduction** — These creatures' `beforeDamage` triggers now work when AI attacks (was only working when player attacked)
- **Gloom's discard effect** — `processEffects` now checks `card.ability?.effects` for creatures, not just `card.effects`
- **"Set Verse Triggered!" for creature abilities** — `showTriggerReveal()` now shows "Ability Triggered!" for creatures and correctly displays ability text (was showing "undefined")

### Added
- 7 new tests for creature ability triggers

---

## [0.3.0] - 2026-02-05

### Fixed (19 bugs)

**Visual/UI (4 bugs)**
- Pulsefin ATK modifier UI now shows doubled ATK when Sonic Strike active
- Duskfang ATK boost UI now displays +20 from Pack Call
- Opponent deck count visible in left stats column
- Graveyard modal: newest cards at top, scrollbar after 4 cards

**Card Effects (5 bugs)**
- Grave Echo returns creatures with full HP (was 0 HP)
- Vengeance only triggers on attack KO (not spell/verse KO)
- Mana Drain: caster still pays mana even when spell negated
- Predator's Mark no longer doubled by Pulsefin (30 base × 2 = 60, +30 = 90)
- Call of the Wild text updated: "RANDOM 1-cost creature"

**Target Selectors (3 bugs)**
- Ignite: target selector for any creature with ownership visual
- Banish: target selector with ownership visual (yours = green, enemy = red)
- Soul Siphon: target selector, only heals if damage was dealt

**Combat Flow (4 bugs)**
- Action lock prevents multiple attacks from rapid button clicks
- 0 HP creatures properly KO'd after Soul Siphon (fixed owner detection)
- AI attack behavior fixed (was stuck when creature had 0 HP but not KO'd)
- Grave Rise summon-to-bench already working correctly (verified)

**AI Behavior (3 bugs)**
- AI uses `getEffectiveAtk()` for ability-modified creatures (Shade Pup, Pulsefin)
- AI Blood Moon self-preservation: won't KO own creature without benefit
- AI Predator's Mark efficiency: won't cast after attacking or when already can KO

### Added
- `showCreatureSelector()` modal with ownership labels
- `aiSelectCreatureTarget()` for intelligent AI target selection
- `actionLock` flag to prevent double attacks
- 48 new tests across 4 test files

---

## [0.2.59] - 2026-02-05

### Fixed
- **Double ability bugs** — 3 creatures were applying effects twice:
  - Duskfang: was getting +40 ATK instead of +20
  - Emberfang: was dealing 10 damage instead of 5
  - Hiveling: was drawing 2 cards instead of 1
- Root cause: hardcoded summon logic ran AFTER onSummon triggers fired

### Removed
- Dead import: `applySpark` (now handled by onSummon trigger)
- 6 more hardcoded checks (29 remaining, down from 67 original)

---

## [0.2.58] - 2026-02-05

### Added
- **`afterAttack` event** for combat triggers
  - Retaliation: thornling, coilshell, reflector
  - Status effects: hexweaver (poison), mireveil (trap)
  - Healing: leechling (drain), sundewqueen (digest)

### Removed
- 32 redundant `.id ===` checks (67 → 35)
- Death ability hardcodes (gloom, echomask, stormtalon) — now use onKO triggers
- ATK modifier hardcodes — now consolidated in `getEffectiveAtk()`
- Debug console.logs from AI code
- Dead imports: `getRetaliationDamage`, `applyDrain`

---

## [0.2.57] - 2026-02-05

### Added
- **Priority system** for trigger resolution (1-5 levels)
  - Priority 1: Negate triggers (cancel other triggers)
  - Priority 2: Negate action (negateAttack, negateSpell, negateKO)
  - Priority 3: Pre-modification (reduceDamage)
  - Priority 4: Standard (default)
  - Priority 5: Post-event effects
- Auto-detection of priority from effect types
- Tiebreaker: non-active player (defender) fires first

### Changed
- **All 29 creatures migrated to declarative ability format:**
  - Passive abilities: `{ passive: { type, amount, condition } }`
  - Triggered abilities: `{ trigger: { event, condition }, effects: [...] }`
  - Complex abilities: `{ procedural: true }`
- All 10 set verses now event-driven with `triggerDef` and `effects`

### New Effect Primitives
- `negateAttack` — Attack doesn't resolve
- `negateKO` — Creature survives with 1 HP
- `negateLifeLoss` — Life point saved
- `destroy` — Send creature to grave

---

## [0.2.56] - 2026-02-05

### Added
- More set verses migrated to event-driven triggers
- Phantom Wall, Vengeance, Last Breath, Spike Shield integration

---

## [0.2.55] - 2026-02-04

### Added
- **Brace** migrated to event-driven trigger (`beforeDamage`)
- **Den Mother** migrated to event-driven trigger (`onKO`)
- Context mutation pattern for `damageReduction`

---

## [0.2.54] - 2026-02-04

### Added
- **Event system foundation**
  - `src/events.js` — GameEvents emitter
  - `src/triggers.js` — Trigger processor with condition matching
- All 10 set verses have `triggerDef` declarations
- Documentation in `guides/EVENT-SYSTEM.md`

---

## [0.2.53] - 2026-02-04

### Added
- **Declarative effect system** for cast verses
  - Cards define `effects: []` array
  - Universal `processEffects()` executes them
- Effect primitives: damage, heal, draw, loseLife, gainMana, atkBonus, setStatus, cureStatus, moveCard, setFlag, banish, summon
- `customHandler` escape hatch for complex cards

---

## [0.2.52] - 2026-02-03

### Fixed
- Deferred side effects for selection cards
- Cancel properly returns card to hand

---

## [0.2.51] - 2026-02-03

### Fixed
- Grave Echo/Sacrifice cancel — must select after mana spent (`noCancel`)

---

## [0.2.50] - 2026-02-03

### Added
- **Optional set verse triggers** — All traps now prompt player
- Last Breath remains automatic (prevents death)

---

## [0.2.49] - 2026-02-03

### Added
- END TURN button highlight when player has 0 mana

---

## [0.2.48] - 2026-02-02

### Fixed
- AI attack missing ability modifiers (Orphan, Pack Bond, etc.)

---

## [0.2.47] - 2026-02-02

### Changed
- **Shellkin rebalance** — 20 HP, 10 ATK, clearer ability text

---

## [0.2.46] - 2026-02-02

### Changed
- **Spike Shield priority** — KO attacker negates attack entirely

---

## [0.2.45] - 2026-02-02

### Fixed
- END TURN highlight added to all attack paths + retreat

---

## [0.2.44] - 2026-02-02

### Fixed
- Missing await on `ko()` — Den Mother now properly clears on trigger

---

## [0.2.43] - 2026-02-02

### Added
- END TURN highlight after attack
- TURN END animation

---

## [0.2.42] - 2026-02-02

### Fixed
- Attack bonus display for modified ATK values

---

## [0.2.41] - 2026-02-02

### Added
- Shell Pack tuning — balanced creature stats

---

## [0.2.40] - 2026-02-02

### Added
- **Shell Pack** — 7 new defensive creatures:
  - Shellkin (Harden: negate first 10 damage/turn)
  - Pebbleback (Sturdy: -5 damage)
  - Ironhide (Iron Skin: -10 damage)
  - Coilshell (Recoil: 10 damage to attacker)
  - Bulwark (Fortress: survive lethal once)
  - Reflector (Mirror Shell: 15 damage to attacker)
  - Titanback (Juggernaut: -15 damage, 25 on death)
- **6 new Shell Pack verses:**
  - Shell Armor, Brace, Spike Shield, Regenerate, Fortify, Unbreakable

---

## [0.2.30-0.2.39] - 2026-02-01

### Added
- Swarm Pack creatures and verses
- Pack synergy mechanics
- Broodmother spawning system

---

## [0.2.20-0.2.29] - 2026-01-31

### Added
- Venom Pack expansion
- Status effects (poison, trapped)
- Hexweaver, Sundewqueen abilities

---

## [0.2.0-0.2.19] - 2026-01-30

### Added
- Core game mechanics
- Shadow, Fang packs
- AI opponent
- Basic animations
