# Event System Architecture

**Status:** Priority system complete, migrations in progress

## Overview

The event system enables declarative triggers for set verses and creature abilities with a 5-level priority system.

## Priority Levels

| Priority | Purpose | Examples |
|----------|---------|----------|
| 1 | Negate triggers | Cancel other set verses |
| 2 | Negate action | negateAttack, negateSpell, negateKO |
| 3 | Pre-modification | reduceDamage, shields |
| 4 | Standard (DEFAULT) | Most triggers |
| 5 | Post-event | "After X happens" effects |

**Tiebreaker:** Same priority → non-active player (defender) fires first.

## Components

### GameEvents (`src/events.js`)
Event emitter with on/off/once/emit/clear methods.

### Trigger Processor (`src/triggers.js`)
- `getTriggerPriority(trigger, card)` — Get priority (auto-detect or explicit)
- `matchesTrigger(trigger, event, context)` — Check if trigger matches
- `getMatchingTriggers(event, context, state)` — Find all matching triggers (with priority)
- `processTriggers(event, context, state, gameCtx)` — Execute triggers in priority order

## Event Types

| Event | When Emitted | Context |
|-------|--------------|---------|
| `beforeAttack` | Before attack resolves | attacker, defender, attackerOwnerKey |
| `beforeDamage` | Before damage applied | target, targetOwner, targetLocation |
| `beforeKO` | Before creature KO'd | target, attacker, attackerOwnerKey |
| `beforeLifeLoss` | Before LP decremented | owner, lastLife |
| `onKO` | When creature KO'd | creature, creatureOwnerKey |
| `onSummon` | When creature enters | summoned, summonerKey |
| `onCast` | When cast verse played | verse, casterKey |

## Trigger Definition Format

```js
{
  event: 'beforeDamage',
  condition: { target: 'me.active' },
  optional: true,           // Player can choose to trigger
  priority: 3,              // Optional - auto-detected from effects
  cannotBeNegated: true     // Optional - immune to negate-trigger effects
}
```

## Effect Primitives

| Effect | Description | Auto-Priority |
|--------|-------------|---------------|
| `negateAttack` | Attack doesn't deal damage | 2 |
| `negateSpell` | Spell doesn't resolve | 2 |
| `negateKO` | Creature survives | 2 |
| `negateLifeLoss` | LP not decremented | 2 |
| `reduceDamage` | Lower incoming damage | 3 |
| `damage` | Deal damage | — |
| `destroy` | Kill creature (to grave) | — |
| `atkBonus` | Buff next attack | — |
| `gainMana` | Add mana | — |

## Current Status

- ✅ Priority system implemented and tested
- ✅ Effect primitives for negate/reduce/destroy
- ✅ Brace, Swarm Shield, Den Mother, Mana Drain migrated
- ⏳ Phantom Wall, Vengeance, Last Breath, Spike Shield in progress

## Migration Strategy

1. When adding NEW triggers → use event system with priority
2. When touching existing trigger code → migrate to events
3. Complex handlers (negateAttack, negateKO) need game flow integration
