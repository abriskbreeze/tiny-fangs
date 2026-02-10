# Trigger Refactor: Use Shared Module Effects

## Problem
`server/GameEngine.js` has `executeTrigger()` with a 150-line switch statement that hardcodes effect values. When we balance cards in `shared/cards.js`, server values drift.

## Solution
Replace switch statement with calls to `processEffects()` from `shared/effects.js`.

## Current Flow
```
checkTriggers() → executeTrigger() → switch(verse.id) { hardcoded logic }
```

## Target Flow
```
checkTriggers() → executeTrigger() → processEffects(verse, ctx) → read from verse.effects[]
```

## Implementation

### Step 1: Import processEffects
```javascript
// server/GameEngine.js
import { processEffects } from '../shared/effects.js';
```

### Step 2: Build Context Mapping
The server uses different variable names than shared module expects:

| Server | Shared Context |
|--------|----------------|
| `owner` | `ctx.me` |
| `enemy` | `ctx.opp` |
| `context.attacker` | `ctx.attacker` |
| `context.defender` | `ctx.defender` |
| `context.creature` | `ctx.summoned` |
| `ownerSide` | `ctx.meSide` |
| `enemySide` | `ctx.oppSide` |

```javascript
function buildEffectsContext(context, owner, enemy, ownerSide, enemySide) {
  return {
    me: owner,
    opp: enemy,
    meSide: ownerSide,
    oppSide: enemySide,
    attacker: context.attacker,
    defender: context.defender,
    summoned: context.creature,
    koedCreature: context.koedCreature,
    damage: context.damage,
  };
}
```

### Step 3: Replace Switch with processEffects
```javascript
function executeTrigger(verse, context, owner, enemy, ownerSide, enemySide) {
  const events = [];
  let negated = false;
  let damageReduction = 0;
  
  events.push({ type: 'triggerVerse', side: ownerSide, verse: verse.name });
  
  // Build context for processEffects
  const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
  
  // Get verse template with effects array
  const verseTemplate = VERSES[verse.id];
  if (!verseTemplate?.effects) {
    console.warn(`No effects defined for verse: ${verse.id}`);
    return { events, negated, damageReduction };
  }
  
  // Process effects from card definition
  const result = processEffects(verseTemplate, ctx);
  
  // Collect events
  events.push(...result.events);
  
  // Handle negation flags from result
  if (result.modifiedContext?.negated) negated = true;
  if (result.modifiedContext?.damageReduction) {
    damageReduction = result.modifiedContext.damageReduction;
  }
  
  // Process KOs
  for (const ko of result.kos) {
    // Handle creature removal and grave
    // ... (existing KO logic)
  }
  
  return { events, negated, damageReduction };
}
```

### Step 4: Handle Computed Amounts
Some effects have dynamic values:

| Card | Current | Fix |
|------|---------|-----|
| Swarm Shield | `bench.length * 10` | Add `computedAmount` support |

```javascript
// In shared/effects.js - enhance reduceDamage
reduceDamage(ctx, { amount, perBench }) {
  let reduction = amount || 0;
  if (perBench) {
    reduction = (ctx.me?.bench?.length || 0) * perBench;
  }
  return { modifiedContext: { damageReduction: reduction } };
}

// In shared/cards.js - Swarm Shield
effects: [{ type: 'reduceDamage', perBench: 10 }]
```

### Step 5: Handle Complex Triggers
Some triggers have logic that doesn't fit pure effects:

| Card | Complexity | Approach |
|------|------------|----------|
| Den Mother | Searches deck for 1-cost | Add `summonFromDeck` effect |
| Grave Rise | Summons from grave | Already have `summonFromGrave` |
| Last Breath | One-time use check | Add `usedFlag` check in effect |

## Migration Order
1. **Simple damage/heal:** Phantom Wall, Spike Shield, Soul Trap
2. **Damage reduction:** Brace, Swarm Shield  
3. **Negation:** Mana Drain
4. **Complex:** Vengeance, Grave Rise, Den Mother, Last Breath

## Testing
- Run existing test suite after each migration
- Test each set verse manually in MP
- Verify damage values match shared/cards.js

## Benefits
- Single source of truth for all effect values
- Balance changes only need to update shared/cards.js
- Easier to add new set verses (just define effects array)
- Server and client use same effect logic
