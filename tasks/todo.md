# Tiny Fangs Bug Fix Sprint #2 — 2026-02-07

## Root Cause Questions (per AGENTS.md / Karpathy Guidelines)
Before each fix:
1. Am I solving symptoms or ROOT problems?
2. What pattern allowed this bug to exist?
3. What's the verifiable acceptance criteria?

---

## GROUP A: Ability & Damage System Bugs

### BUG-A1: Shellkin's Harden doesn't protect against Ignite
**Symptoms:** Ignite damages Shellkin even if first damage that turn
**Root Cause:** Harden (damage reduction) only checked in attack combat path, not in verse damage path
**Pattern:** Damage reduction bypassed by non-combat damage sources
**Acceptance:** Ignite Shellkin (first damage that turn) → takes 5 damage not 15, Harden marked used
**Files:** index.html (Ignite case), effects.js (damage effect), abilities.js

### BUG-A2: Echomask with 0 ATK deals LP damage on direct attack
**Symptoms:** Echomask attacks directly and deals 1 LP even with 0 ATK
**Root Cause:** Direct attack always deals 1 LP regardless of damage value
**Pattern:** Direct attack doesn't check if actual damage > 0
**Acceptance:** Echomask (0 ATK, no enemy) attacks directly → no LP damage, log says "no damage"
**Files:** index.html (doAttack direct attack section)

### BUG-A3: Echomask copies BASE ATK not MODIFIED ATK
**Symptoms:** Echomask mirrors enemy's base ATK ignoring their buffs
**Root Cause:** `getEffectiveAtk` for Echomask uses `enemy.active.atk` (base) not `getEffectiveAtk(enemy.active...)`
**Pattern:** Nested getEffectiveAtk call needed for proper mirroring
**Acceptance:** Enemy Bladewhisker (30+10 Rend) → Echomask shows 40 ATK
**Files:** src/abilities.js (getEffectiveAtk Echomask section)

### BUG-A4: Thornling causes negative HP / creatures not KO'd
**Symptoms:** After Thornling thorns damage, attacker has 0 or negative HP but stays on field
**Root Cause:** Trigger system damage effect doesn't call ko() or check KO condition
**Pattern:** Trigger-based damage returns KO info but caller doesn't process it
**Acceptance:** Creature attacks Thornling, thorns reduce to 0 HP → creature KO'd and removed
**Files:** index.html (afterAttack trigger handling), effects.js (damage return handling)

### BUG-A5: Hexweaver poison not dealing damage at turn end
**Symptoms:** Poison status applied but no damage at turn end
**Root Cause:** No turnEnd processing for poison status — only status is set, not damage tick
**Pattern:** Poison status exists but no damage loop implemented
**Acceptance:** Hexweaver poisons enemy → enemy's turn ends → takes 10 damage → repeat until cured/KO'd
**Files:** index.html (turn end sections), effects.js, cards.js (poison description)

### BUG-A6: Duskfang ATK bonus stacks on re-summon
**Symptoms:** Duskfang dies, returns via Grave Echo, resummon → +40 ATK instead of +20
**Root Cause:** `atkBonuses` array not cleared when creature dies/returns to hand
**Pattern:** Creature state not reset on zone transitions
**Acceptance:** Duskfang dies, returns to hand, resummons → has +20 (not +40)
**Files:** index.html (ko function), effects.js (moveCard, Grave Echo)

---

## GROUP B: Card Effect & Spell Bugs

### BUG-B1: Mana Drain - remove "gain 1 mana" 
**Symptoms:** Card says gain mana but Rico wants it removed
**Root Cause:** Feature request, not bug
**Acceptance:** Mana Drain text and effect = just negate spell, no mana gain
**Files:** src/cards.js (manaDrain), src/effects.js (if mana gain effect exists)

### BUG-B2: Soul Siphon damages ALL bench creatures
**Symptoms:** Casting Soul Siphon hits enemy bench, not just selected creature
**Root Cause:** Effect targeting wrong — hitting all creatures instead of selected
**Pattern:** Selection system not properly limiting target
**Acceptance:** Soul Siphon → select ONE enemy creature → only that creature takes 20 damage
**Files:** index.html (Soul Siphon case), effects.js

### BUG-B3: Soul Siphon missing battle log entries
**Symptoms:** No log for "dealt X damage to Y" or "healed X on Z"
**Root Cause:** Log calls missing in Soul Siphon execution path
**Acceptance:** Cast Soul Siphon → log shows "Dealt 20 to [creature]" and "Healed 10 on [creature]"
**Files:** index.html (Soul Siphon case)

### BUG-B4: Banish not sending cards to grave
**Symptoms:** Banished creatures disappear completely, not in grave
**Root Cause:** This is INTENDED — Banish removes from game, not grave
**Pattern:** But player expects grave? Check card text.
**Acceptance:** Confirm Banish text says "remove from play" or change to send to grave if that's desired
**Files:** src/cards.js (banish text), effects.js (banish effect)

### BUG-B5: Grave Echo can't find previously-revived creatures
**Symptoms:** Creature revived by Grave Rise, KO'd again, not found in grave
**Root Cause:** When creature is KO'd, it may not be added to grave properly
**Pattern:** KO path for previously-revived creatures different somehow
**Acceptance:** Grave Rise creature → KO it → Grave Echo finds it in grave
**Files:** index.html (ko function), effects.js (ko handling)

---

## GROUP C: AI Behavior Bugs

### BUG-C1: AI Sacrifice casting Skitter immediately (AI error)
**Symptoms:** "Rival called Skitter to bench! Rival cast Sacrifice Rival sacrificed Skitter (AI error)"
**Root Cause:** AI casts Sacrifice on just-summoned creature, which is wasteful/broken
**Pattern:** AI decision making doesn't consider creature value or "just summoned" state
**Acceptance:** AI shouldn't Sacrifice a creature it just summoned that turn
**Files:** src/ai.js (Sacrifice scoring), index.html (AI Sacrifice case)

### BUG-C2: AI wastes Ignite on high-HP creatures
**Symptoms:** AI Ignites creature with 40+ HP when it won't KO
**Root Cause:** AI Ignite decision is `curHp <= 15` but that may be stale or wrong
**Pattern:** AI scoring doesn't properly evaluate Ignite benefit
**Acceptance:** AI only Ignites if it will KO (hp ≤ 15) or significantly weaken target
**Files:** src/ai.js (Ignite scoring), index.html (AI Ignite case)

### BUG-C3: AI turn end delay too long
**Symptoms:** Too much pause between AI ending turn and TURN END animation
**Root Cause:** Multiple `pause()` calls or high `ANIM_TIMING.AI_PAUSE` value
**Pattern:** Animation timing not optimized
**Acceptance:** Reduce delay to feel snappier (current 1400ms → ~800ms or less)
**Files:** src/anim.js (AI_PAUSE), index.html (AI turn end)

### BUG-C4: Allow rival to choose any deck
**Symptoms:** Rival picks from decks OTHER than player's choice
**Root Cause:** `aiDecks = ['shadow','fang','venom','swarm'].filter(d => d !== deckId)`
**Pattern:** Intentional design, but Rico wants changed
**Acceptance:** AI can pick any deck including same as player
**Files:** index.html (startGame function, aiDecks line)

### BUG-C5: Pack Tactics not updating AI hand properly
**Symptoms:** AI casts Pack Tactics, draws cards, but hand count doesn't update
**Root Cause:** `render()` not called after AI draws, or hand count display bug
**Acceptance:** AI casts Pack Tactics → hand count in stats increases correctly
**Files:** index.html (AI Pack Tactics case), render (hand count display)

---

## GROUP D: Creature Ability Fixes

### BUG-D1: Hiveling ability trigger conditions wrong
**Symptoms:** Hiveling draws on active summon, on swap, should only draw on bench summon
**Root Cause:** Trigger condition doesn't check summon location
**Pattern:** onSummon doesn't distinguish active vs bench
**Acceptance:** Hiveling summoned to BENCH → draws 1. Summoned to active → no draw. Swapped to bench → no draw.
**Text:** "When summoned to the bench, draw 1 card."
**Files:** src/cards.js (hiveling), triggers.js (onSummon handling)

### BUG-D2: Last Breath log says "saved you!" for opponent
**Symptoms:** When AI's Last Breath triggers, log says "saved you!" instead of "saved the opponent!"
**Root Cause:** Log message hardcoded for player perspective
**Pattern:** Log messages don't account for which side triggered
**Acceptance:** AI Last Breath → log says "Last Breath saved rival!" (or appropriate enemy text)
**Files:** index.html (Last Breath handling, loseLife function)

---

## Subagent Assignments

### Agent 1: Ability & Damage System (A1-A6)
- Shellkin Harden for all damage sources
- Echomask 0 ATK direct attack
- Echomask copy modified ATK
- Thornling/trigger damage KO handling
- Poison turn-end damage
- Duskfang ATK reset on death

### Agent 2: Card Effects (B1-B5)
- Mana Drain remove mana gain
- Soul Siphon single target fix
- Soul Siphon battle log
- Banish grave behavior (confirm intent)
- Grave Echo finding revived creatures

### Agent 3: AI Behavior (C1-C5)
- Sacrifice not on just-summoned
- Ignite smarter targeting
- Turn end delay reduction
- Any deck for rival
- Pack Tactics hand update

### Agent 4: Creature Ability Fixes (D1-D2)
- Hiveling bench-only trigger
- Last Breath log fix

---

## Verification Checklist
Each fix must:
- [ ] Have clear acceptance criteria
- [ ] Not break existing tests (`npm test`)
- [ ] Be verified in browser manually
