# Priority System Refactor Plan

## Overview
Add 5-level priority system to trigger processor. Migrate all set verses to event-driven triggers.

## Priority Levels
| Priority | Purpose | Default For |
|----------|---------|-------------|
| 1 | Negate triggers | Cards that cancel other triggers |
| 2 | Negate action | negateAttack, negateSpell effects |
| 3 | Pre-modification | reduceDamage effects |
| 4 | Standard | Most triggers (DEFAULT) |
| 5 | Post-event | "After X happens" effects |

## Tasks

### Phase 1: Core System (Main Agent) ✅
- [x] T-001: Add priority field to triggerDef format
- [x] T-002: Update processTriggers to sort by priority (ascending = first)
- [x] T-003: Add cannotBeNegated flag support
- [x] T-004: Write priority ordering tests
- [x] T-005: Add auto-priority detection (negateSpell → priority 2)
- [x] T-006: Add effect primitives: negateAttack, negateKO, destroy, negateLifeLoss

### Phase 2: Set Verse Migrations (Subagents)
Each subagent migrates one set verse:
- [x] T-101: phantomWall (beforeAttack, negates attack + deals damage) ✅
- [ ] T-102: soulTrap (onSummon, -20 HP to summoned creature) - onSummon emits
- [ ] T-103: vengeance (beforeKO, negates KO + destroys attacker) ⏳ IN PROGRESS
- [ ] T-104: graveRise (onKO, summon 1-cost from grave) - effect exists
- [x] T-105: manaDrain (onCast, negate spell + gain mana) ✅ ALREADY WORKS
- [ ] T-106: lastBreath (beforeLifeLoss, survive with 1 life) ⏳ IN PROGRESS
- [x] T-107: spikeShield (beforeAttack, deal 15 to attacker) ✅
- [x] T-108: swarmShield (beforeDamage, reduce by 15) ✅ ALREADY WORKS

### Phase 3: Cleanup
- [ ] T-201: Remove hardcoded trigger checks from helpers.js
- [ ] T-202: Update CARD-AUTHORING guide
- [ ] T-203: Update EVENT-SYSTEM guide
- [ ] T-204: Bump version to 0.2.57

## Success Criteria
1. `npm test` passes (all tests)
2. Priority 1 triggers resolve before priority 4 in test
3. `cannotBeNegated: true` prevents negation in test
4. All set verses fire via processTriggers (no if-checks)

## Verification
- Run `npm test` after each phase
- Manual playtest: cast verse → Mana Drain negates
- Manual playtest: attack → Brace reduces damage
- Manual playtest: attack → Phantom Wall negates + damages
