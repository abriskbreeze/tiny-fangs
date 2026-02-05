# Effect System Refactor Plan

## Goal
Replace hardcoded card logic with a data-driven effect system where cards define their effects as structured data, and a single executor interprets them.

## Why
- Current: Each card's effect is hardcoded in 3+ places (player, Pup AI, Hunter AI)
- Adding new cards requires finding and updating all those places
- Easy to miss a code path (e.g., Phantom Wall didn't trigger on direct attacks)

## Proposed Architecture

### Card Definition (cards.js)
```js
phantomWall: {
  id: 'phantomWall',
  name: 'Phantom Wall',
  type: 'set',
  cost: 1,
  trigger: 'onOpponentAttack',  // Enum, not string
  effects: [
    { type: 'negateAttack' },
    { type: 'damage', target: 'attacker', value: 10 }
  ]
}
```

### Effect Executor (src/effects.js)
```js
async function executeEffects(card, context) {
  for (const effect of card.effects) {
    await executeEffect(effect, context);
  }
}

async function executeEffect(effect, context) {
  switch (effect.type) {
    case 'damage':
      return handleDamage(effect, context);
    case 'heal':
      return handleHeal(effect, context);
    case 'negateAttack':
      return handleNegateAttack(context);
    // ... etc
  }
}
```

## Effect Primitives Needed

### Damage/Healing
- `damage` - deal X to target
- `heal` - heal X on target
- `damageAll` - deal X to all creatures

### Attack Modifiers
- `negateAttack` - stop the attack
- `reduceDamage` - reduce incoming damage by X
- `reflectDamage` - deal X back to attacker
- `buffNextAttack` - add X to next attack

### Card Manipulation
- `draw` - draw X cards
- `discard` - opponent discards X
- `returnFromGrave` - return creature from graveyard
- `searchDeck` - find card in deck

### Summoning
- `summon` - summon creature from source
- `destroy` - destroy target creature
- `banish` - remove without KO triggers

### Status
- `applyPoison` - poison target
- `applyTrap` - trap target (can't retreat)
- `shield` - prevent next damage instance

### Targeting
- `self` - your active
- `enemy` - enemy active
- `attacker` - the attacking creature
- `defender` - the defending creature
- `allYours` - all your creatures
- `allEnemy` - all enemy creatures
- `bench` - bench creatures

## Trigger Types
- `onOpponentAttack` - when opponent attacks
- `onOpponentSummon` - when opponent summons
- `onYourCreatureKO` - when your creature is KO'd
- `onOpponentCast` - when opponent casts
- `onLethalDamage` - when would take lethal

## Migration Approach
1. Define all effect types and handlers
2. Add structured effects to cards.js (keep text for display)
3. Migrate `onOpponentAttack` triggers first (Phantom Wall, Spike Shield, Brace)
4. Replace hardcoded checks with executor calls
5. Migrate other trigger types incrementally
6. Remove old hardcoded logic

## Estimate
- 2-4 hours focused work
- Should use subagent for parallel implementation

## Status
**PLANNED** - Simple fix done first, this is for later session
