# Event System Architecture Spec

**Status:** Planned  
**Goal:** Make set verses and creature abilities declarative

---

## Problem

Currently, triggers are scattered throughout the codebase:
- Set verse checks in `doAttack()`, `ko()`, `castVerse()`, `doSummon()`
- Creature ability checks in multiple locations
- Each new card requires finding the right spot and adding if-checks

This doesn't scale for 100+ cards.

---

## Solution: Event-Driven Triggers

### Core Concept

1. Game flow emits events at key points
2. Trigger processor checks all set verses + abilities for matching triggers
3. Matching triggers execute their effects

### Event Types

| Event | When Emitted | Context Available |
|-------|--------------|-------------------|
| `beforeAttack` | Before attack resolves | attacker, defender |
| `afterAttack` | After attack damage | attacker, defender, damage |
| `beforeDamage` | Before any damage applied | target, source, amount |
| `afterDamage` | After damage applied | target, source, amount, ko |
| `onKO` | When creature is KO'd | creature, owner, killer? |
| `onSummon` | When creature enters play | creature, owner |
| `onCast` | When cast verse played | verse, caster |
| `turnStart` | At turn beginning | player |
| `turnEnd` | At turn end | player |

### Declarative Trigger Format

```js
// Set Verse
brace: {
  id: 'brace',
  type: 'set',
  cost: 1,
  trigger: {
    event: 'beforeDamage',
    condition: { target: 'me.active' },
    optional: true  // Player can choose to trigger
  },
  effects: [
    { type: 'reduceDamage', amount: 15 }
  ]
}

// Creature Ability
thornling: {
  id: 'thornling',
  // ... stats ...
  ability: {
    name: 'Thorns',
    trigger: {
      event: 'afterAttack',
      condition: { defender: 'self' }  // This creature was attacked
    },
    effects: [
      { type: 'damage', target: 'attacker', amount: 10 }
    ]
  }
}
```

---

## Implementation Plan

### Phase 1: Event Emitter (~1 hour)

Create `src/events.js`:

```js
const GameEvents = {
  listeners: {},
  
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  
  off(event, callback) {
    // Remove listener
  },
  
  async emit(event, context) {
    const handlers = this.listeners[event] || [];
    for (const handler of handlers) {
      await handler(context);
    }
  },
  
  clear() {
    this.listeners = {};
  }
};
```

### Phase 2: Trigger Processor (~1.5 hours)

Create `src/triggers.js`:

```js
/**
 * Check if a trigger condition matches the event context
 */
function matchesTrigger(trigger, event, context) {
  if (trigger.event !== event) return false;
  
  if (trigger.condition) {
    // Evaluate condition against context
    return evalTriggerCondition(trigger.condition, context);
  }
  
  return true;
}

/**
 * Find all triggers that should fire for an event
 */
function getMatchingTriggers(event, context, state) {
  const matches = [];
  
  // Check set verses
  for (const player of [state.G.me, state.G.opp]) {
    if (player.setVerse?.trigger) {
      if (matchesTrigger(player.setVerse.trigger, event, context)) {
        matches.push({
          type: 'setVerse',
          card: player.setVerse,
          owner: player
        });
      }
    }
  }
  
  // Check creature abilities
  for (const player of [state.G.me, state.G.opp]) {
    const creatures = [player.active, ...player.bench].filter(Boolean);
    for (const creature of creatures) {
      if (creature.ability?.trigger) {
        if (matchesTrigger(creature.ability.trigger, event, context)) {
          matches.push({
            type: 'ability',
            card: creature,
            owner: player
          });
        }
      }
    }
  }
  
  return matches;
}

/**
 * Process all matching triggers for an event
 */
async function processTriggers(event, context, state, gameCtx) {
  const matches = getMatchingTriggers(event, context, state);
  
  for (const match of matches) {
    const trigger = match.card.trigger || match.card.ability?.trigger;
    
    // Handle optional triggers (player choice)
    if (trigger.optional) {
      const shouldTrigger = await promptTrigger(match.owner, match.card, context);
      if (!shouldTrigger) continue;
    }
    
    // Execute effects
    await showTriggerReveal(match.card);
    await processEffects(match.card, { ...gameCtx, ...context });
    
    // Consume set verse
    if (match.type === 'setVerse') {
      match.owner.grave.push(match.card);
      match.owner.setVerse = null;
    }
  }
}
```

### Phase 3: Refactor Game Flow (~2 hours)

Replace scattered if-checks with event emissions:

**Before (current):**
```js
// In doAttack()
if (state.G.me.setVerse?.id === 'brace') {
  const shouldTrigger = await promptTrigger(...);
  if (shouldTrigger) {
    // Brace logic
  }
}
if (state.G.me.setVerse?.id === 'spikeShield') {
  // Spike Shield logic
}
// ... more if-checks
```

**After (with events):**
```js
// In doAttack()
await GameEvents.emit('beforeDamage', {
  target: defender,
  targetOwner: state.G.opp,
  source: attacker,
  sourceOwner: state.G.me,
  amount: damage
});
```

### Phase 4: New Effect Primitives (~30 min)

Add trigger-specific effects:

| Effect | Description |
|--------|-------------|
| `reduceDamage` | Subtract from incoming damage |
| `negateAttack` | Cancel the attack entirely |
| `reflect` | Return damage to attacker |
| `preventKO` | Survive with 1 HP |

---

## Migration Strategy

1. **Keep existing if-checks working** during migration
2. **Add event emissions** alongside existing code
3. **Convert cards one-by-one** to declarative triggers
4. **Remove old if-checks** once card is migrated
5. **Test after each card** — no big bang

### Migration Order

1. Simple set verses (Brace, Spike Shield)
2. Complex set verses (Phantom Wall, Vengeance)
3. Simple abilities (Thorns, Spark)
4. Complex abilities (Frenzy, Reflection)

---

## Testing Strategy

### Unit Tests (triggers.test.js)
- `matchesTrigger()` with various conditions
- `getMatchingTriggers()` finds correct triggers
- `processTriggers()` executes in correct order

### Integration Tests
- Event emission at correct game points
- Triggers fire with correct context
- Optional triggers prompt correctly
- Multiple triggers resolve in order

### Regression Tests
- All existing set verses work identically
- All existing abilities work identically

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Break existing triggers | Keep old code until card migrated, test each |
| Event ordering issues | Define clear priority rules, test extensively |
| Performance (many listeners) | Lazy evaluation, early exit on no matches |
| Complex trigger interactions | Document interaction rules, test edge cases |

---

## Files Changed

| File | Change |
|------|--------|
| `src/events.js` | NEW — Event emitter |
| `src/triggers.js` | NEW — Trigger processor |
| `src/effects.js` | ADD — New trigger-specific effects |
| `src/cards.js` | MODIFY — Add trigger definitions to cards |
| `index.html` | MODIFY — Emit events, remove old if-checks |
| `tests/triggers.test.js` | NEW — Trigger tests |
| `tests/events.test.js` | NEW — Event tests |

---

## Success Criteria

1. All existing set verses work identically (regression tests pass)
2. All existing abilities work identically
3. New set verse = data definition only
4. New simple ability = data definition only
5. Complex interactions use documented escape hatch

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Event Emitter | 1 hour |
| Trigger Processor | 1.5 hours |
| Refactor Game Flow | 2 hours |
| New Effect Primitives | 30 min |
| Testing & Polish | 1 hour |
| **Total** | **6 hours** |

---

## Decision

Proceed? The 6-hour investment pays off after ~15 cards. With 100 cards planned, ROI is clear.

Next step: Implement Phase 1 (Event Emitter) with TDD.
