# Event System Architecture

**Version:** 0.2.57  
**Status:** Complete — all cards migrated

## Overview

The event system enables declarative triggers for set verses and creature abilities. All triggers are processed through a 5-level priority system with automatic priority detection.

## Components

### GameEvents (`src/events.js`)

Simple event emitter:

```js
GameEvents.on('onKO', callback);      // Register listener
GameEvents.once('onKO', callback);    // One-time listener
GameEvents.emit('onKO', context);     // Fire event
GameEvents.off('onKO', callback);     // Remove listener
GameEvents.clear();                   // Remove all
```

### Trigger Processor (`src/triggers.js`)

```js
// Check if trigger matches event
matchesTrigger(trigger, event, context) → boolean

// Find all matching triggers with priority
getMatchingTriggers(event, context, state) → Array<Match>

// Execute triggers in priority order
processTriggers(event, context, state, gameCtx) → modifiedContext
```

## Priority System

| Priority | Purpose | Auto-detected from |
|----------|---------|-------------------|
| **1** | Negate triggers | `negateTrigger` effect |
| **2** | Negate action | `negateAttack`, `negateSpell`, `negateKO` |
| **3** | Pre-modification | `reduceDamage` |
| **4** | Standard (default) | Everything else |
| **5** | Post-event | "After X happens" |

**Tiebreaker:** Same priority → non-active player (defender) fires first.

Priority is auto-detected from effects. Override with explicit `priority: N`:

```js
triggerDef: {
  event: 'beforeKO',
  priority: 2,            // Explicit priority
  cannotBeNegated: true   // Immune to negate-trigger effects
}
```

## Event Types

| Event | When Emitted | Context Fields |
|-------|--------------|----------------|
| `beforeAttack` | Before attack resolves | attacker, defender, attackerOwner, attackerOwnerKey |
| `beforeDamage` | Before damage applied | target, targetOwner, targetLocation, damageReduction |
| `afterAttack` | After attack damage | attacker, defender, damageDealt, causedKO |
| `beforeKO` | Before creature dies | target, attacker, attackerOwner, attackerOwnerKey |
| `onKO` | When creature KO'd | creature, creatureOwnerKey |
| `onSummon` | When creature enters | summoned, summonerKey, triggerOwner |
| `onCast` | When cast verse played | verse, casterKey |
| `beforeLifeLoss` | Before LP decremented | owner, ownerKey, lastLife |
| `turnStart` | At turn beginning | player |
| `turnEnd` | At turn end | player |

## Trigger Definition Format

```js
triggerDef: {
  event: 'beforeDamage',           // Required: event type
  condition: {                      // Optional: when to fire
    target: 'me.active',           // Relative target
    attacker: 'opp',               // Attacker is opponent
    defender: 'self',              // This creature is defending
    owner: 'me',                   // Affected entity is mine
    caster: 'opp',                 // Opponent cast spell
    hasBench: true,                // I have bench creatures
    self: true,                    // Creature ability: this creature
    swarm: true,                   // 2+ creatures on field
    lastLife: true,                // Would be last life
    hasOneCostInGrave: true,       // 1-cost in grave
    benchNotFull: true             // Bench has room
  },
  optional: true,                   // Player can decline
  priority: 3,                      // Override auto-detection
  cannotBeNegated: true            // Immune to negate effects
}
```

## Condition Matching

### Relative Ownership

`'me'` and `'opp'` are relative to the **trigger owner**, not the emitter:

```js
// Set by player A
brace: {
  triggerDef: {
    event: 'beforeDamage',
    condition: { target: 'me.active' }  // "my" = player A's
  }
}
```

When player B attacks player A:
- Context: `{ targetOwner: 'opp' }` (from B's perspective)
- Trigger owner: A
- Match check: `targetOwner === triggerOwnerKey` → true ✓

### Self Reference

For creature abilities, `self` refers to the creature with the ability:

```js
ability: {
  trigger: { event: 'afterAttack', condition: { defender: 'self' } },
  effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
}
```

## Effect Execution

Effects fire in order for each trigger:

```js
effects: [
  { type: 'negateKO' },                          // First: prevent death
  { type: 'destroy', target: 'attacker' }        // Then: destroy attacker
]
```

## Context Mutation

Some effects modify the context for later processing:

```js
// Damage reduction accumulates
{ type: 'reduceDamage', amount: 15 }
→ context.damageReduction += 15

// Negation flags
{ type: 'negateAttack' } → context.attackNegated = true
{ type: 'negateSpell' }  → context.negated = true
{ type: 'negateKO' }     → context.koNegated = true
```

## Migrated Cards

### Set Verses (all 10)

| Card | Event | Effects |
|------|-------|---------|
| Brace | beforeDamage | reduceDamage(15) |
| Swarm Shield | beforeDamage | reduceDamage(15) |
| Den Mother | onKO | atkBonus(10) |
| Mana Drain | onCast | negateSpell, gainMana(1) |
| Soul Trap | onSummon | damage(summoned, 20) |
| Phantom Wall | beforeAttack | negateAttack, damage(attacker, 10) |
| Spike Shield | beforeAttack | damage(attacker, 15) |
| Vengeance | beforeKO | negateKO, destroy(attacker) |
| Last Breath | beforeLifeLoss | negateLifeLoss |
| Grave Rise | onKO | summonFromGrave(1-cost) |

### Creature Abilities (all 29)

**Passive abilities** (calculated, not triggered):
- Bladewhisker (Rend), Shade Pup (Orphan), Fangpup (Pack Bond)
- Piranix (Feeding Frenzy), Alpha (Rally), Hollowfox (Den Guard)
- Echomask (Reflection)

**Triggered abilities** (event-driven):
- Thornling, Coilshell, Reflector (afterAttack → damage attacker)
- Hexweaver, Mireveil (afterAttack → setStatus)
- Leechling, Sundewqueen (afterAttack → healSelf)
- Emberfang, Duskfang, Hiveling (onSummon)
- Gloom, Echomask, Stormtalon (onKO)
- Shellkin, Pebbleback, Ironhide (beforeDamage → reduceDamage)

**Procedural abilities** (require game flow changes):
- Whisper (Elusive), Cindermaw (Frenzy), Pulsefin (Sonic Strike)
- Bulwark (Fortress), Broodmother (Spawn), Alpha (Rally assist)
- Skitter (Scurry), Titanback (Juggernaut death)

## Integration Points

### Attack Flow (index.html)

```js
async function doAttack(attacker, defender) {
  // 1. beforeAttack → Phantom Wall, Spike Shield
  const preCtx = await processTriggers('beforeAttack', ...);
  if (preCtx.attackNegated) return;
  
  // 2. Calculate damage
  let damage = getEffectiveAtk(attacker, ...);
  
  // 3. beforeDamage → Brace, Swarm Shield, Shellkin
  const dmgCtx = await processTriggers('beforeDamage', ...);
  damage -= dmgCtx.damageReduction;
  
  // 4. Apply damage
  defender.curHp -= damage;
  
  // 5. afterAttack → Thornling, Hexweaver, Leechling
  await processTriggers('afterAttack', { damageDealt: damage, ... });
  
  // 6. KO check
  if (defender.curHp <= 0) {
    // beforeKO → Vengeance
    const koCtx = await processTriggers('beforeKO', ...);
    if (!koCtx.koNegated) {
      await ko(defender, ...);
      // onKO → Den Mother, Gloom, Grave Rise
      await processTriggers('onKO', ...);
    }
  }
}
```

### Life Loss (index.html)

```js
async function loseLife(player, count) {
  for (let i = 0; i < count; i++) {
    const isLast = player.lp === 1;
    const ctx = await processTriggers('beforeLifeLoss', { 
      lastLife: isLast, ... 
    });
    if (!ctx.lifeLossNegated) {
      player.lp--;
    }
  }
}
```
