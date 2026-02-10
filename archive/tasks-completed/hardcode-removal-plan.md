# Hardcode Removal Plan

## Root Cause Analysis

**Q: What pattern allowed these 67 hardcoded checks to exist?**
A: Abilities were added incrementally before the event/effect system existed. Each new card got its logic inlined where needed.

**Q: What's the root fix?**
A: Route ALL ability logic through the event system + abilities.js. index.html should NEVER check card IDs directly.

**Q: What breaks if we revert?**
A: Nothing—that's the problem. These checks are tech debt that work but prevent clean card authoring.

---

## Categories of Hardcoded Checks (67 total)

### 1. ATK Modifiers (12 checks) → Use `getAtkBonus()`
Already have this in abilities.js but index.html duplicates it.

| Card | Condition | Current Location |
|------|-----------|------------------|
| duskfang | +20 if grave has creature | index.html:3129,3323,4563 |
| emberfang | +15 if opp has active | index.html:3329 |
| hiveling | +15 if swarm | index.html:3342 |
| bladewhisker | +10 on hit | index.html:4157,4217 |
| pulsefin | +25 first attack | index.html:4169 |
| echomask | copies defender ATK | index.html:4176,4218 |
| cindermaw | attack all | index.html:4117 |

**Fix:** Remove from index.html, ensure abilities.js `getAtkBonus()` handles all.

### 2. On-Summon Effects (14 checks) → Use `onSummon` event
| Card | Effect | Lines |
|------|--------|-------|
| gloom | discard from opp hand | 3507,3945 |
| echomask | copy ATK | 3514,3954 |
| stormtalon | deal 10 to opp active | 3524,3964 |
| titanback | stun opp active | 3530 |

**Fix:** Add `onSummon` event, migrate to triggerDef.

### 3. Retaliation/Damage Response (10 checks) → Use `afterDamage` event
| Card | Effect | Lines |
|------|--------|-------|
| thornling | 5 retaliation | 4320 |
| coilshell | 8 retaliation | 4322 |
| reflector | 10 retaliation | 4324 |
| shellkin | reduce damage | 4251,4481 |

**Fix:** These should fire via `afterDamage` or `beforeDamage` events.

### 4. Post-Attack Effects (8 checks) → Use `afterAttack` event
| Card | Effect | Lines |
|------|--------|-------|
| hexweaver | poison on hit | 4346 |
| mireveil | 50% sleep | 4353 |
| leechling | heal on hit | 4294 |
| sundewqueen | summon spore | 4370 |

**Fix:** Add `afterAttack` event for attacker-side effects.

### 5. On-KO/Survival Effects (6 checks) → Use `onKO` event
| Card | Effect | Lines |
|------|--------|-------|
| bulwark | fortress (survive 1HP) | 4275 |
| broodmother | summon egg | 4437 |

**Fix:** Already have `onKO` event, need `beforeKO` for fortress.

### 6. Set Verse Checks (4 checks) → Already event-driven
| Card | Lines |
|------|-------|
| spikeShield | 4185,4332 |

**Fix:** Remove inline checks, rely on event triggers.

### 7. Procedural Cards (13 checks) → Keep customHandler
These genuinely need procedural logic (targeting, UI choices):
- callOfTheWild (search deck)
- graveEcho (choose from grave)  
- sacrifice (choose creature)
- bloodMoon (complex damage calc)
- banish (choose from bench)
- darkPact (life for cards)

**Fix:** Leave as customHandler, but clean up duplicate checks.

---

## Implementation Plan

### Phase 1: Add Missing Events
- [ ] `onSummon` event (when creature enters play)
- [ ] `afterAttack` event (after damage resolves, attacker-side)
- [ ] `beforeKO` event (for fortress-style survival)

### Phase 2: Migrate Abilities (by event type)
- [ ] Migrate on-summon abilities (gloom, echomask, stormtalon, titanback)
- [ ] Migrate retaliation abilities (thornling, coilshell, reflector)
- [ ] Migrate post-attack abilities (hexweaver, mireveil, leechling, sundewqueen)
- [ ] Migrate survival abilities (bulwark fortress)

### Phase 3: Consolidate ATK Logic
- [ ] Audit `getAtkBonus()` in abilities.js
- [ ] Remove ALL ATK calculations from index.html
- [ ] Ensure combat uses abilities.js exclusively

### Phase 4: Clean Up
- [ ] Remove all remaining `.id ===` checks from index.html
- [ ] Remove debug console.logs
- [ ] Run full test suite
- [ ] Manual playtest

---

## Success Criteria
- [ ] `grep "\.id ===" index.html | wc -l` returns 0 (or only for truly procedural UI)
- [ ] All 275+ tests pass
- [ ] Manual playtest confirms all abilities work
