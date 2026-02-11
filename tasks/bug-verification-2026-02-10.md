# Bug Verification — 2026-02-10

Verifying old bug list from `tasks/todo.md` (Feb 7) against current codebase (v0.4.72).

## GROUP A: Ability & Damage System

| Bug | Status | Notes |
|-----|--------|-------|
| A1: Shellkin Harden vs Ignite | ✅ FIXED v0.4.73 | Effects.damage now checks Shellkin/Titanback |
| A2: Echomask 0 ATK direct attack | ✅ FIXED v0.4.73 | Added damage > 0 check before LP loss |
| A3: Echomask copies BASE not MODIFIED ATK | ✅ FIXED | getEffectiveAtk properly handles Echomask (engine.js:181) |
| A4: Thornling causes negative HP | ✅ FIXED | Trigger damage properly handles KO in shared engine |
| A5: Poison not dealing damage | ✅ FIXED | endTurn handles poison (engine.js:1389-1398) |
| A6: Duskfang ATK stacks on resummon | ✅ FIXED v0.4.74 | prepareForGrave() clears atkBonuses |

## GROUP B: Card Effects

| Bug | Status | Notes |
|-----|--------|-------|
| B1: Mana Drain remove mana gain | ✅ FIXED v0.4.73 | Removed gainMana effect |
| B2: Soul Siphon damages ALL bench | ✅ FIXED | Selection system now properly limits target |
| B3: Soul Siphon missing log entries | ⚠️ NEEDS TEST | May be fixed with event system |
| B4: Banish not sending to grave | ✅ INTENDED | Banish removes from game per card text |
| B5: Grave Echo can't find revived | ⚠️ NEEDS TEST | Should work with shared engine ko handling |

## GROUP C: AI Behavior

| Bug | Status | Notes |
|-----|--------|-------|
| C1: AI Sacrifice on just-summoned | ⚠️ NEEDS TEST | AI logic in main.js |
| C2: AI wastes Ignite on high HP | ⚠️ NEEDS TEST | AI scoring logic |
| C3: Turn end delay too long | ⚠️ NEEDS TEST | ANIM_TIMING values |
| C4: Rival can't pick any deck | ⚠️ NEEDS TEST | Filter logic in main.js |
| C5: Pack Tactics not updating hand | ⚠️ NEEDS TEST | render() calls |

## GROUP D: Creature Abilities

| Bug | Status | Notes |
|-----|--------|-------|
| D1: Hiveling triggers on active | ✅ FIXED | Has `location: 'bench'` condition, engine checks it (engine.js:648) |
| D2: Last Breath log says "you" | ⚠️ NEEDS TEST | Log message perspective |

---

## Summary

| Status | Count |
|--------|-------|
| ✅ FIXED | 10 |
| ❌ OPEN | 0 |
| ⚠️ NEEDS TEST | 8 |

## All Critical Bugs Fixed ✅

- A1: Shellkin Harden — Fixed in v0.4.73
- A2: Echomask 0 ATK — Fixed in v0.4.73
- A6: Duskfang stacking — Fixed in v0.4.74
- B1: Mana Drain — Fixed in v0.4.73
