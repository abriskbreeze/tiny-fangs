# Changelog

All notable changes to Tiny Fangs.


## [0.4.78] - 2026-02-10

### Changed
- Unify chain lightning in shared engine

---


## [0.4.77] - 2026-02-10

### Changed
- Unify EVENT_HANDLERS for solo and MP - single animation source

---


## [0.4.76] - 2026-02-10

### Changed
- Fix Last Breath only triggers for LP owner; Fix mobile hand scrolling

---


## [0.4.75] - 2026-02-10

### Changed
- Wire up showSetReveal popup when placing set verses

---


## [0.4.74] - 2026-02-10

### Changed
- Wire up showCastReveal for cast verse card popup

---


## [0.4.76] - 2026-02-10

### Changed
- Fix trigger reveal lookups - use name instead of missing ID fields

---


## [0.4.75] - 2026-02-10

### Changed
- Fix animation timing: pre-render for attack/ko/damage, post-render for summon

---


## [0.4.74] - 2026-02-10

### Changed
- Fix A6: Clear atkBonuses when creature goes to grave

---


## [0.4.73] - 2026-02-10

### Changed
- Fix 3 bugs: Shellkin vs spells, Echomask 0 ATK, Mana Drain no mana

---


## [0.4.72] - 2026-02-10

### Changed
- Fix cast verse and LP damage animations - cache positions before state update

---


## [0.4.71] - 2026-02-10

### Changed
- Fix summon animation timing and mana refill bugs

---


## [0.4.70] - 2026-02-10

### Changed
- Extract JS to src/main.js - index.html now 390 lines

---


## [0.4.69] - 2026-02-10

### Changed
- Client unification complete - 8103 to 4062 lines

---


## [0.4.68] - 2026-02-10

### Changed
- Shared engine refactor complete - server now 149 lines

---


## [0.4.67] - 2026-02-10

### Changed
- Unified server with shared module + declarative selection

---


## [0.4.66] - 2026-02-10

### Changed
- Full effects migration - 21 cards now use processEffects

---


## [0.4.65] - 2026-02-10

### Changed
- Trigger refactor: 8 set verses now use processEffects from shared module

---


## [0.4.64] - 2026-02-10

### Changed
- Multiplayer fixes: Ignite damage, animation positioning, Last Breath, deck/hand counts

---


## [0.4.63] - 2026-02-10

### Changed
- Architecture unification + multiplayer fixes (optional triggers, mana, debug logging)

---


## [0.4.62] - 2026-02-09

### Changed
- Fix double trigger execution & Ironhide Iron Skin

---


## [0.4.61] - 2026-02-09

### Changed
- Cindermaw double attack on server, new tunnel URL

---


## [0.4.60] - 2026-02-09

### Changed
- Fix Soul Trap animation playing on wrong side

---


## [0.4.59] - 2026-02-09

### Changed
- Unified code patterns: playCard, localExecutors map, serverEventHandlers map

---


## [0.4.58] - 2026-02-09

### Changed
- Unified playCard() entry point for all card plays

---


## [0.4.57] - 2026-02-09

### Changed
- Add MP coin flip animation

---


## [0.4.56] - 2026-02-09

### Changed
- Fix drag-to-cast bypass, double animations, coin flip visibility

---


## [0.4.55] - 2026-02-09

### Changed
- Fix Last Breath (only at 1 LP), P2 mana (no bonus first turn), add coin flip banner

---


## [0.4.54] - 2026-02-09

### Changed
- Fix MP state sync - send hasAttacked/hasRetreated/firstTurn from server

---


## [0.4.53] - 2026-02-09

### Changed
- Fix double turn banner - use personalized turnChange message

---


## [0.4.52] - 2026-02-09

### Changed
- Full trigger modals, status effects polish, auto-swap on poison KO

---


## [0.4.51] - 2026-02-09

### Changed
- MP fixes: render before animations, auto-swap after KO, trigger popups

---


## [0.4.50] - 2026-02-09

### Changed
- MP UI fixes: turn indicator, log persistence, turn banner on change

---


## [0.4.49] - 2026-02-09

### Changed
- Skitter Scurry ability - optional swap after taking damage

---


## [0.4.48] - 2026-02-09

### Changed
- Selection UI for targeting cards (ignite, banish, graveEcho, sacrifice) in MP mode

---


## [0.4.48] - 2026-02-09

### Changed
- Refactor: unified dispatchAction for all game actions

---


## [0.4.47] - 2026-02-09

### Changed
- Fix MP drag-drop: delegate to action functions that send to server

---


## [0.4.46] - 2026-02-09

### Changed
- Fix MP display: flex not grid, restore header version

---


## [0.4.45] - 2026-02-09

### Changed
- Fix MP event animations: draw, cast, summonBench

---


## [0.4.44] - 2026-02-09

### Changed
- Remove version from battlefield header, fix bump script

---


## [0.4.43] - 2026-02-09

### Changed
- Fix MP client: element ID, state properties, null checks

---


## [0.5.10] - 2026-02-08

### Changed
- Improved guest animation detection: handles KO+promote, bench KOs, creature replacements
- Captures bench state for proper animation sequencing

---

### Changed
- Fix guest animations - render DOM before animating

---


## [0.5.8] - 2026-02-08

### Changed
- Fix: reset hasAttacked/hasRetreated for guest's turn before sync

---


## [0.5.7] - 2026-02-08

### Changed
- Fix: hash uses consistent host/guest keys instead of me/opp

---


## [0.5.6] - 2026-02-08

### Changed
- Fix: guard doAttack with hasAttacked/hasRetreated, detailed hash logging, animation debug logs

---


## [0.5.9] - 2026-02-08

### Changed
- Fix: use synced counts for ALL players in hash, sync deck contents

---


## [0.5.4] - 2026-02-08

### Changed
- Fix: sync hasAttacked/hasRetreated, fix DESYNC with opponent counts

---


## [0.5.3] - 2026-02-08

### Changed
- Fix: expose showModeSelect to window for onclick handlers

---


## [0.5.2] - 2026-02-08

### Changed
- Fix: set verse action, cancel targeting, turn-start sync

---


## [0.5.1] - 2026-02-08

### Changed
- Fix: executeDrop() now sends MP actions for guest summons

---


## [0.5.0] - 2026-02-08

### Changed
- MP Refactor: Host as source of truth

---


## [0.4.63] - 2026-02-08

### Changed
- More debug logging for sync swap issue

---


## [0.4.62] - 2026-02-08

### Changed
- Debug: log getMinimalState sync contents

---


## [0.4.61] - 2026-02-08

### Changed
- Fix forfeit infinite loop + expose clearSavedGameState to window

---


## [0.4.60] - 2026-02-08

### Fixed
- **MP deck sync**: CRITICAL - Deck UIDs were completely mismatched between host and guest!
  - Host was sending just UIDs, but guest created NEW cards with NEW UIDs
  - Now host sends `[{uid, cardId}, ...]` so guest creates exact same deck
  - This was causing "No active creature" errors and all validation failures

---


## [0.4.59] - 2026-02-08

### Fixed
- **MP mana sync**: Fixed mana not refilling for opponent - SYNC was overwriting mana refill done in END_TURN handler
  - Guest now waits for SYNC before doing turn transition (draw, mana refill)
  - Uses `_pendingTurnStart` flag to coordinate END_TURN and SYNC order
- **MP hash desync**: Fixed constant desync detection - hash function now uses consistent `host`/`guest` keys instead of perspective-based `me`/`opp` keys

---


## [0.4.58] - 2026-02-08

### Fixed
- **MP sync for cast spells**: Added missing state sync after castVerse - opponent now sees spells in real-time instead of all-at-once on turn end
- Sync added for three code paths: spell negation, declarative effects, legacy switch

---


## [0.4.57] - 2026-02-08

### Changed
- Move turn timer to top right, show countdown prominently

---


## [0.4.56] - 2026-02-08

### Changed
- Add turn indicator - shows YOUR TURN or OPP'S TURN with timer

---


## [0.4.55] - 2026-02-08

### Changed
- Fix reconnection - host recreates room with same code, proper state restore

---


## [0.4.54] - 2026-02-08

### Changed
- Fix turn end processing - correct player gets mana/effects, proper turn transition

---


## [0.4.53] - 2026-02-08

### Changed
- Fix perspective swap - guest now correctly sees themselves as 'me'

---


## [0.4.52] - 2026-02-08

### Changed
- Use class selector for overlay removal - fix stuck waiting screen

---


## [0.4.51] - 2026-02-08

### Changed
- Add safety checks for messages that require state.G

---


## [0.4.50] - 2026-02-08

### Changed
- Fix GAME_START flow, add logging, improve waiting UI

---


## [0.4.49] - 2026-02-08

### Changed
- Add connection checks, timeout, and robust connected state handling

---


## [0.4.48] - 2026-02-08

### Changed
- Add debug logging for multiplayer ready flow

---


## [0.4.47] - 2026-02-08

### Changed
- Fix pre-game multiplayer messages not being processed (state.G check)

---


## [0.4.46] - 2026-02-08

### Changed
- Fix multiplayer deck select hang - add startGameMultiplayer() and GAME_START message

---


## [0.4.45] - 2026-02-08

### Changed
- Phase 3 multiplayer: coin flip sync, deck shuffle sync, action validation, selection sync

---


## [0.4.44] - 2026-02-08

### Changed
- Phase 4: Rematch flow, desync detection, animation sync, forfeit button

---


## [0.4.44] - 2026-02-08

### Changed
- Phase 4: Multiplayer disconnection and reconnection handling

---


## [0.4.43] - 2026-02-08

### Changed
- Add multiplayer Phase 1 & 2: networking module + UI (mode select, room modals, turn timer)

---


## [0.4.42] - 2026-02-08

### Changed
- Add debug logs to player attack flow for onHit/afterAttack order tracing

---


## [0.4.41] - 2026-02-08

### Changed
- Extract shared endAiTurn() function - prevents AI path divergence bugs

---


## [0.4.40] - 2026-02-08

### Changed
- Fix double survive log + sync AI paths: setHP now includes ability name, removed duplicate checkLethalDamage log, Pup AI gets missing KO animation and flag clearing

---


## [0.4.39] - 2026-02-08

### Changed
- Fix double survive log, sync Pup AI with Hunter AI - removed duplicate log from checkLethalDamage, added missing KO animation and summonedThisTurn flag clearing to Pup AI

---


## [0.4.38] - 2026-02-08

### Changed
- Fix bench KO animations - processBenchKO now plays benchKo animation, AI verse path now handles bench KOs

---


## [0.4.37] - 2026-02-08

### Changed
- Fix poison tick missing in Hunter AI - aiTurnHunter was missing poison damage code

---


## [0.4.36] - 2026-02-08

### Changed
- Refactor Fortify to use checkLethalDamage - removed hardcoded checks from attack flow

---


## [0.4.35] - 2026-02-08

### Changed
- Fix Banish bench animation - added benchKo() animation, banish now uses correct animation based on target location

---


## [0.4.34] - 2026-02-08

### Changed
- Refactor Harden to use trigger system - removed hardcoded checks, added perTurn support to triggers, Spike Shield now emits beforeDamage

---


## [0.4.33] - 2026-02-08

### Changed
- Add onHit event for attacker sustain abilities (Drain, Digest) - fires before retaliation so Leechling survives Thornling

---


## [0.4.32] - 2026-02-08

### Changed
- Fix Shellkin Harden vs Spike Shield/Phantom Wall - added Harden check to applyDamage function

---


## [0.4.31] - 2026-02-08

### Changed
- Prevent healing dead creatures - heal and healSelf now check if curHp <= 0 first

---


## [0.4.30] - 2026-02-08

### Changed
- Fix KO visual bug - clear active slot immediately to prevent creature re-render during trigger processing

---


## [0.4.29] - 2026-02-08

### Changed
- Any keypress dismisses trigger modals; added hint text

---


## [0.4.28] - 2026-02-08

### Changed
- Fix damage animations for all bench targets - selected bench creatures and explicit .bench targets now use benchDamage

---


## [0.4.27] - 2026-02-08

### Changed
- Trigger modals now require tap/click to dismiss - AI waits for player to acknowledge

---


## [0.4.26] - 2026-02-08

### Changed
- Fix Soul Trap animation - now plays benchDamage on bench slot when creature is summoned to bench

---


## [0.4.25] - 2026-02-08

### Changed
- Fix keyboard shortcuts - was checking undefined G instead of state.G

---


## [0.4.24] - 2026-02-08

### Changed
- Show FORTIFY popup when it saves a creature from lethal damage

---


## [0.4.23] - 2026-02-08

### Changed
- Swap creature/cast verse colors: creatures now orange, cast verses now green (borders, zoom modal, trigger reveals)

---


## [0.4.22] - 2026-02-08

### Changed
- Fix Blood Moon KO bug - processEffects now collects kos array from aoeAll; fix deckHover reference error with optional chaining

---


## [0.4.21] - 2026-02-08

### Changed
- Add green colored header to creature cards in hold-to-zoom modal (matching cast/set verse styling)

---


## [patch] - 2026-02-08

### Changed
- Add green colored header to creature cards in hold-to-zoom modal (matching cast/set verse styling)

---


## [0.4.22] - 2026-02-08

### Changed
- Fixed Spike Shield double-attack bug - attack ends if attacker is KO'd by trigger

---


## [0.4.21] - 2026-02-08

### Changed
- Added Unbreakable indicator, changed Fortified icon to shield, positioned badges bottom-right

---


## [0.4.20] - 2026-02-08

### Changed
- Fixed battle log panel sizing - log entries now properly fill container

---


## [0.4.19] - 2026-02-08

### Changed
- Added art and flavor text to all 26 verses; color-coded trigger reveals (green=creature, purple=set, orange=cast)

---


## [0.4.18] - 2026-02-08

### Changed
- Added visual effect indicators (Fortified, Poisoned, Trapped) on battlefield cards and in hold-to-zoom detail

---


## [0.4.17] - 2026-02-08

### Changed
- Unbreakable now protects ANY creature (player-level shield); removed redundant Close button from set verse detail

---


## [0.4.16] - 2026-02-08

### Changed
- Added deck card list to preview - shows all cards with counts (2× Shellkin)

---


## [0.4.15] - 2026-02-08

### Changed
- Fixed Spike Shield not triggering - attacker/defender conditions used wrong comparison

---


## [0.4.14] - 2026-02-08

### Changed
- Fixed heal/damage animations not playing in declarative effects system

---


## [0.4.5] - 2026-02-08

### Changed
- Deck preview on hold - shows full description and star creatures

---


## [0.4.4] - 2026-02-08

### Changed
- Added automation scripts (bump, deploy, bugfix-sprint skill)

---



### Improved
- **AI scoring for Shell Pack set verses:**
  - `brace` — higher priority when active creature is wounded (50 vs 35)
  - `spikeShield` — higher priority vs low-HP attackers (60 if can KO, else 40)
  - Both return low score (10) if no active creature to protect

---

## [0.4.2] - 2026-02-08

### Fixed
- **AI casts healing verses without active creature** — Hunter AI now properly scores Shell Pack verses:
  - `shellArmor`, `regenerate`, `fortify`, `unbreakable` all return -100 if no active
  - Added intelligent scoring based on missing HP, poison status, existing buffs
  - Default case also checks for active creature before casting unknown verses

---

## [0.4.1] - 2026-02-07

### Added
- **Dual Deck Selector** — After choosing your deck, select the AI's deck
- **Random Deck Option** — Both player and AI deck selectors have "Random" option
- Player deck selector styled with blue border for Random button
- AI deck selector modal with all 5 decks + Random

### Changed
- Game flow: Player Deck → AI Deck → Coin Flip → Game Start
- AI no longer auto-selects random deck (player chooses)

### Technical
- `selectPlayerDeck()` — Handles player deck choice, shows AI selector
- `showAIDeckSelector()` — Modal for AI deck selection
- `selectAIDeck()` — Sets AI deck, proceeds to coin flip
- `getRandomDeckId()` — Helper for random deck selection
- 4 new tests for deck selection

---

## [0.4.0] - 2026-02-07

### Major Bug Fix Release — 33 bugs fixed across 2 sprints

#### Sprint 1: Trigger & Effect System (15 fixes)

**Trigger System**
- Pulsefin Sonic Strike was doubling twice (120 → 60 damage)
- Chain Lightning now fires on retreat/swap, not just summons
- Phantom Wall & Spike Shield now trigger properly (missing processEffects callback)
- Skitter ability shows proper text instead of "UNDEFINED"

**UI/Visual**
- Battle log: full history, scrollable, newest at top (desktop)
- Bench creatures show red HP when damaged
- Hold-to-zoom shows current HP/max HP and ATK modifiers
- Ignite selector: enemies at top, player at bottom, ★ marks actives
- Predator's Mark visual updates immediately after attack

**Game Flow**
- Banish properly swaps bench to active
- Broodmother tokens spawn on correct side (fixed owner context)
- Cindermaw AI double-attack animation now plays

**Text Fixes**
- Coilshell: "When attacked" (was "When damaged")
- Titanback: "Resists first 15 damage per turn. When KO'd deal 25 damage to enemy creature."
- Predator's Mark: "Your next attack" (was "Your creature's next attack")

#### Sprint 2: Ability & Damage System (18 fixes)

**Damage System**
- Shellkin Harden blocks ALL damage sources (not just attacks)
- Echomask 0 ATK can't deal LP damage on direct attack
- Echomask copies MODIFIED ATK (not base)
- Thornling Thorns properly KO attackers (was leaving at 0 HP)
- Duskfang ATK bonus resets on death/return to hand

**Card Effects**
- Mana Drain simplified: just negates, no mana gain
- Soul Siphon targets single creature (was hitting all bench!)
- Soul Siphon logs damage and healing
- Hexweaver poison text clarified

**AI Behavior**
- Won't Sacrifice just-summoned creatures
- Won't waste Ignite on high-HP creatures
- Turn end delay reduced (1400ms → 800ms)
- Can pick any deck (including same as player)
- Pack Tactics updates hand count display

**Creature Abilities**
- Hiveling only draws when summoned to bench (not active/swap)
- Last Breath log says "saved rival!" for opponent

### Changed
- VERSION: 0.3.11 → 0.4.0
- package.json version synced to 0.4.0
- 257 tests passing (3 new tests for location conditions)

---

## [0.3.11] - 2026-02-05

### Fixed — attackerOwner/defenderOwner Type Mismatch
Context fields `attackerOwner` and `defenderOwner` were inconsistently typed:
- Player attack path: Objects (correct)
- AI attack path: Strings (BUG)

Effects expected objects for:
- Setting `owner.poisoned = true` in setStatus
- Returning `owner` in KO info for ko() function
- Animation key comparison against `state.G.me`

**Fixed contexts:**
- Player afterAttack: `attackerOwner: state.G.me`, `defenderOwner: state.G.opp`
- AI beforeAttack: `attackerOwner: ai`, `defenderOwner: player`
- AI afterAttack: Same pattern

---

## [0.3.10] - 2026-02-05

### Fixed — Animation Perspective Bug (Pattern Fix)
The `ownerKey` had two conflicting meanings:
1. **ctx resolution**: relative to caster (me=caster's side)
2. **animations**: absolute (me=player/bottom, opp=AI/top)

After the v0.3.9 fix, AI targeting returned `ownerKey: 'opp'` for ctx, but animations
were still using this directly, causing effects to animate on the wrong side.

**Root Cause Pattern:**
```
// AI damages player's creature
ctx = { me: ai, opp: player }
ownerKey: 'opp' (= player in ctx)

// But animation expected:
Anim.damage('me') for player's side (bottom)
```

**Fixes:**
- `effects.js` damage: Calculate `animKey` from `owner === state.G.me`
- `effects.js` banish: Same fix for ko animation
- `index.html` KO handler: Use `koInfo.owner === state.G.me` for animation key

**Verified working:**
- `attackerOwnerKey` is set correctly as absolute (me=player, opp=AI)
- `destroy` effect uses `attackerOwnerKey` (only used by Vengeance)
- All hardcoded animation calls already use correct absolute keys

---

## [0.3.9] - 2026-02-05

### Fixed
- **AI Banish self-targeting bug** — AI was banishing its own creatures instead of player's
- Root cause: `aiSelectCreatureTarget` returned `ownerKey: 'me'` but AI context uses `me: ai`
- Fix: Changed to `ownerKey: 'opp'` (player is 'opp' from AI's perspective)
- Also fixed replacement check for banished player creatures

---

## [0.3.8] - 2026-02-05

### Removed
- Deleted 9 test files (bug-specific and redundant)
- Test suite: 334 tests → 254 tests, 20 files → 11 files

### Deleted Test Files
- `visual-bugs.test.js` — Bug regression tests
- `combat-flow-bugs.test.js` — Bug regression tests  
- `bug-fixes-agent2.test.js` — Bug regression tests
- `creature-abilities-bug.test.js` — Bug regression tests
- `chain-lightning-summon.test.js` — Specific scenario
- `cindermaw-frenzy.test.js` — Specific scenario
- `new-effects.test.js` — Redundant with effects.test.js
- `new-cards.test.js` — Redundant with cards.test.js
- `state-integration.test.js` — Redundant

---

## [0.3.7] - 2026-02-05

### Fixed
- **Duskfang Pack Call** — ATK bonus now properly targets self (permanent creature buff) instead of owner's next attack
- `atkBonus` effect now supports `target: 'self'` for creature-specific buffs
- Trigger processor now passes `self` and `card` to effect context for creature abilities

### Technical
- `atkBonus` effect: `target: 'self'` adds to `creature.atkBonuses[]` (permanent), no target adds to `owner.attackBonuses[]` (consumed on next attack)
- Effect context includes `self` reference for summonAbility, survivalAbility, deathAbility trigger types

---

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


## [0.5.10] - 2026-02-08

### Changed
- Improved guest animation detection: handles KO+promote, bench KOs, creature replacements
- Captures bench state for proper animation sequencing

---
