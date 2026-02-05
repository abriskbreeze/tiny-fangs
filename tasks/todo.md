# Bug Fix Sprint — 2026-02-05

## Root Cause Questions (Karpathy Guidelines)
Before each fix:
1. Am I solving symptoms or ROOT problems?
2. What pattern allowed this bug to exist?
3. What breaks if we revert this fix?

---

## BUG CATEGORIES

### A. Visual/UI Bugs
- [ ] **BUG-01**: Pulsefin ATK modifier UI not showing doubled ATK
- [ ] **BUG-02**: Duskfang ATK boost UI not triggering when +20 ATK active
- [ ] **BUG-03**: Opponent deck count missing from left stats column
- [ ] **BUG-04**: Graveyard modal: newest at bottom (should be top), no scrollbar

### B. Card Effect Bugs  
- [ ] **BUG-05**: Grave Echo returns creature with 0 HP instead of full HP
- [ ] **BUG-06**: Vengeance triggers on verse KO (should only trigger on attack KO)
- [ ] **BUG-07**: Ignite has no monster selector (should select any creature)
- [ ] **BUG-08**: Banish has no monster selector (should select any creature with ownership visual)
- [ ] **BUG-09**: Soul Siphon needs selector + only heals if damage dealt
- [ ] **BUG-10**: Mana Drain doesn't consume caster's mana (negated spell still costs mana)
- [ ] **BUG-11**: Predator's Mark stacks incorrectly with ability bonuses (doubled instead of added)

### C. Combat/Game Flow Bugs
- [ ] **BUG-12**: Multiple attack button clicks = multiple attacks
- [ ] **BUG-13**: Creature with 0 HP stays on field after Soul Siphon (AI error in logs)
- [ ] **BUG-14**: AI monster not attacking (unclear reason, needs investigation)
- [ ] **BUG-15**: Grave Rise: should summon to bench if slots available; selected creature should be option in "new active" selector

### D. AI Behavior Bugs
- [ ] **BUG-16**: AI doesn't use getEffectiveAtk() for ability-modified creatures
- [ ] **BUG-17**: AI Blood Moon kills own creature when no benefit
- [ ] **BUG-18**: AI wastes Predator's Mark after attacking / when not needed

### E. Text Fixes
- [ ] **BUG-19**: Call of the Wild text should say "RANDOM"

---

## DETAILED ANALYSIS

### BUG-01: Pulsefin ATK modifier UI
**Root cause:** `getAtkModifiers()` in abilities.js doesn't check for Pulsefin's `firstAtk` flag
**Pattern:** Procedural abilities bypass declarative modifier system
**Fix:** Add Pulsefin check to `getAtkModifiers()` when `creature.firstAtk === true`
**Test:** Unit test for getAtkModifiers with Pulsefin when firstAtk is true

### BUG-02: Duskfang ATK boost UI
**Root cause:** Duskfang's +20 ATK from onSummon trigger sets `atkBonuses` but UI doesn't read it
**Pattern:** Trigger-based bonuses stored differently than passive bonuses
**Fix:** Check `creature.atkBonuses` array in `getAtkModifiers()` or unify storage
**Test:** Unit test for getAtkModifiers with Duskfang that has atkBonuses

### BUG-05: Grave Echo 0 HP
**Root cause:** `moveCard` effect doesn't reset creature HP when moving to hand
**Pattern:** Card state not reset on zone transition
**Fix:** In effects.js `moveCard`, reset curHp to hp when destination is hand
**Test:** Unit test for Grave Echo returning creature, verify curHp === hp

### BUG-06: Vengeance on verse KO
**Root cause:** `beforeKO` trigger doesn't distinguish attack vs spell damage
**Pattern:** Missing context in trigger condition
**Fix:** Add `source: 'attack'` to Vengeance triggerDef condition, pass source in KO events
**Test:** Verify Vengeance triggers on attack KO, doesn't trigger on Ignite/Banish KO

### BUG-07/08/09: Missing selectors (Ignite, Banish, Soul Siphon)
**Root cause:** Effects target `opp.active` hardcoded instead of allowing selection
**Pattern:** No selection system for targets in effects
**Fix:** Add `requiresSelection: true` with `selection: { type: 'anyCreature' }` and pass through UI
**Test:** Verify selection modal appears, correct targets available

### BUG-10: Mana Drain doesn't consume mana
**Root cause:** Mana Drain negates spell BEFORE mana deduction in `castVerse()`
**Pattern:** Order of operations - negate happens too early
**Fix:** Deduct mana BEFORE checking for Mana Drain trigger
**Test:** Cast verse into Mana Drain, verify mana still deducted

### BUG-11: Predator's Mark stacking
**Root cause:** In `doAttack()`, Pulsefin doubling happens AFTER Predator's Mark is added
**Pattern:** Modifier application order wrong
**Fix:** Calculate base ATK + ability bonuses first, THEN add one-shot bonuses (Predator's Mark, Den Mother)
**Test:** Pulsefin (30 base, doubled to 60) + Predator's Mark (+30) = 90, not 120

### BUG-12: Multiple attack clicks
**Root cause:** Attack button doesn't disable during attack animation
**Pattern:** Missing action lock
**Fix:** Set `state.G.actionLock = true` at attack start, clear on completion
**Test:** Manual test - rapid click attack, verify single attack occurs

### BUG-13: 0 HP creature on field
**Root cause:** `applyDamage()` returns KO status but caller doesn't always call `ko()`
**Pattern:** Inconsistent KO handling
**Fix:** Audit all applyDamage calls, ensure ko() called when returns true
**Test:** Soul Siphon damages creature to 0, verify ko() triggered

### BUG-15: Grave Rise bench summon
**Root cause:** Grave Rise summon logic doesn't consider bench slots
**Pattern:** Summon location hardcoded
**Fix:** Check bench.length < 2, summon to bench; include revived creature in active selector
**Test:** Creature KO'd, bench has room, Grave Rise summons to bench

### BUG-16: AI effective ATK
**Root cause:** AI scoring uses `card.atk` instead of `getEffectiveAtk()`
**Pattern:** Duplicated damage calculation logic
**Fix:** Import and use `getEffectiveAtk()` in all AI scoring functions
**Test:** AI Shade Pup with empty bench uses 30 ATK in decisions

### BUG-17/18: AI wasteful plays
**Root cause:** AI doesn't simulate outcome, just scores current state
**Pattern:** Greedy without lookahead
**Fix:** Add outcome simulation to Blood Moon / Predator's Mark scoring
**Test:** AI doesn't Blood Moon when it would KO own creature without benefit

### BUG-19: Call of the Wild text
**Root cause:** Text missing "RANDOM" keyword
**Fix:** Update text in cards.js
**Test:** N/A (text change)

---

## SUBAGENT ASSIGNMENTS

### Agent 1: Visual/UI (BUG-01, BUG-02, BUG-03, BUG-04)
Focus: getAtkModifiers, render.js, graveyard modal

### Agent 2: Card Effects (BUG-05, BUG-06, BUG-10, BUG-11, BUG-19)
Focus: effects.js, triggers.js, cards.js

### Agent 3: Selectors (BUG-07, BUG-08, BUG-09)
Focus: Add target selection system for cast verses

### Agent 4: Combat Flow (BUG-12, BUG-13, BUG-14, BUG-15)
Focus: Attack locking, KO consistency, Grave Rise logic

### Agent 5: AI Behavior (BUG-16, BUG-17, BUG-18)
Focus: ai.js scoring improvements

---

## VERIFICATION CHECKLIST
Each bug fix must:
- [ ] Have a failing test first (TDD)
- [ ] Pass all existing tests after fix
- [ ] Be verified in browser manually
- [ ] Not break related functionality
