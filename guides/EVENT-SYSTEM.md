# Event System Architecture

**Status:** Foundation complete, gradual migration in progress

## Overview

The event system enables declarative triggers for set verses and creature abilities.

## Components

### GameEvents (`src/events.js`)
Event emitter with on/off/once/emit/clear methods.

### Trigger Processor (`src/triggers.js`)
- `matchesTrigger(trigger, event, context)` — Check if trigger matches
- `getMatchingTriggers(event, context, state)` — Find all matching triggers
- `processTriggers(event, context, state, gameCtx)` — Execute triggers

## Event Types

| Event | When Emitted | Context |
|-------|--------------|---------|
| `beforeAttack` | Before attack resolves | attacker, defender |
| `afterAttack` | After attack damage | attacker, defender, damage |
| `beforeDamage` | Before damage applied | target, source, amount |
| `afterDamage` | After damage applied | target, source, amount, ko |
| `onKO` | When creature KO'd | creature, owner, killer? |
| `onSummon` | When creature enters | creature, owner |
| `onCast` | When cast verse played | verse, caster |

## Trigger Definition Format

```js
{
  event: 'beforeDamage',
  condition: { target: 'me.active' },
  optional: true  // Player can choose to trigger
}
```

## Current Status

- ✅ Event emitter built and tested
- ✅ Trigger processor built and tested
- ✅ All set verses have `triggerDef` data
- ⏳ Actual event emissions not yet added to game flow
- ⏳ Existing if-checks still handle triggers

## Migration Strategy

1. When adding NEW triggers → use event system
2. When touching existing trigger code → migrate to events
3. Gradual replacement, not big-bang rewrite
