# Tiny Fangs Architecture

**Version:** 0.2.57  
**Last Updated:** 2026-02-05

## Overview

Tiny Fangs is a browser-based card battle game built with vanilla JavaScript. The architecture emphasizes:
- **Declarative card definitions** — Cards are data, not code
- **Event-driven triggers** — Abilities fire through a priority-sorted event system
- **Separation of concerns** — Logic split across focused modules

## Project Structure

```
tiny-fangs/
├── index.html          # Main game loop (6200+ lines)
├── server.cjs          # Local dev server
├── package.json        # Dependencies (vitest for testing)
├── VERSION             # Semantic version (0.X.Y)
├── src/
│   ├── cards.js        # Card database (creatures, verses, decks)
│   ├── effects.js      # Effect primitives (damage, heal, draw...)
│   ├── events.js       # Event emitter (GameEvents)
│   ├── triggers.js     # Trigger processor with priority system
│   ├── abilities.js    # Creature ability calculations
│   ├── ai.js           # Enemy AI decision-making
│   ├── anim.js         # ASCII animations
│   ├── render.js       # Board rendering
│   ├── game.js         # Core game utilities
│   ├── state.js        # Initial state factory
│   └── helpers.js      # Utility functions
├── tests/              # Vitest test files (276 tests)
├── guides/             # Card authoring & event system docs
└── docs/               # Built documentation (Vite output)
```

## Module Breakdown

### `src/cards.js` — Card Database

All cards defined as plain objects:

```js
export const CREATURES = {
  whisper: { id:'whisper', name:'Whisper', cost:1, hp:30, atk:20,
    ability: { name: 'Elusive', text: '...', procedural: true }
  },
  thornling: { id:'thornling', name:'Thornling', cost:1, hp:40, atk:10,
    ability: {
      name: 'Thorns', text: 'Attackers take 10 damage.',
      trigger: { event: 'afterAttack', condition: { defender: 'self' } },
      effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
    }
  }
};

export const VERSES = {
  darkPact: { id:'darkPact', type:'cast', cost:1,
    text: 'Draw 2 cards. Lose 1 life.',
    effects: [{ type: 'draw', count: 2 }, { type: 'loseLife', count: 1 }]
  },
  brace: { id:'brace', type:'set', cost:1,
    trigger: 'When opponent attacks', text: 'Reduce damage by 15.',
    triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
    effects: [{ type: 'reduceDamage', amount: 15 }]
  }
};

export const DECKS = { shadow: {...}, fang: {...}, venom: {...}, swarm: {...}, shell: {...} };
```

### `src/effects.js` — Effect Primitives

20 effect types that modify game state:

| Effect | Description |
|--------|-------------|
| `damage` | Deal damage to target, returns KO info |
| `heal` / `healSelf` | Restore HP |
| `draw` | Draw cards from deck |
| `loseLife` / `loseLifeOpp` | Reduce life points |
| `gainMana` | Add mana |
| `atkBonus` | Buff next attack |
| `setStatus` / `cureStatus` | Poison, trapped, fortified, shielded |
| `moveCard` | Move between zones (grave → hand) |
| `setFlag` | Player flags (usedManaSurge) |
| `banish` | Remove from game |
| `summon` / `summonFromGrave` | Put creatures into play |
| `discard` | Remove cards from hand |
| `aoeAll` | AoE damage to all creatures |
| `koSelected` | Sacrifice a creature |
| `reduceDamage` | Reduce incoming damage |
| `negateSpell` / `negateAttack` / `negateKO` / `negateLifeLoss` | Prevention effects |
| `destroy` | Send creature to grave |

### `src/events.js` — Event Emitter

Simple pub/sub for game events:

```js
GameEvents.on('onKO', async (context) => { ... });
GameEvents.emit('beforeDamage', { target, damage, ... });
GameEvents.clear();
```

### `src/triggers.js` — Trigger Processor

**Priority System (1-5, lower = fires first):**

| Priority | Purpose | Auto-detected from |
|----------|---------|-------------------|
| 1 | Negate triggers | `negateTrigger` effect |
| 2 | Negate action | `negateAttack`, `negateSpell`, `negateKO` |
| 3 | Pre-modification | `reduceDamage` |
| 4 | Standard (default) | Everything else |
| 5 | Post-event | "After X happens" |

**Tiebreaker:** Same priority → non-active player (defender) fires first.

Key functions:
- `getTriggerPriority(trigger, card)` — Get priority (explicit or auto-detect)
- `matchesTrigger(trigger, event, context)` — Check if conditions match
- `getMatchingTriggers(event, context, state)` — Find all matching triggers
- `processTriggers(event, context, state, gameCtx)` — Execute in priority order

### `src/abilities.js` — Creature Calculations

Handles passive ability modifiers:
- `getEffectiveAtk(creature, owner, enemy)` — Calculate ATK with bonuses
- `getEffectiveDamageReduction(creature, owner)` — Passive damage reduction
- `applyDrain`, `applySpark`, `applySpawn` — Specific ability handlers

### `src/ai.js` — Enemy AI

Decision-making for opponent:
- Creature prioritization
- Attack vs. retreat logic
- Set verse deployment
- Mana management

### `src/anim.js` — Animations

ASCII-based animations:
- `Anim.damage(owner, amount)` — Damage shake
- `Anim.ko(owner)` — Death animation
- `Anim.summon(owner)` — Entry effect
- `Anim.heal(owner, amount)` — Healing sparkle

### `index.html` — Main Game Loop

The monolithic game file containing:
- Game state management
- Turn flow (`doTurn`, `doAttack`, `retreat`)
- UI rendering
- Player input handling
- KO resolution and life loss

## Data Flow

### Card Resolution

```
1. Player plays card
2. If cast verse with `effects`:
   → processEffects(card, ctx)
   → Each effect type calls Effects.damage/heal/etc.
   
3. If set verse:
   → Card placed in setVerse slot
   → On trigger event: processTriggers(event, ctx, state, gameCtx)
   → Priority-sorted triggers fire

4. If creature with ability.trigger:
   → processTriggers finds matching abilities
   → Effects executed via processEffects
```

### Attack Resolution

```
1. doAttack() begins
2. Emit 'beforeAttack' → Phantom Wall can negateAttack
3. If not negated:
   - Calculate damage (getEffectiveAtk + bonuses)
   - Emit 'beforeDamage' → Brace/Swarm Shield reduce damage
   - Apply damage
   - Emit 'afterAttack' → Thornling/Coilshell deal retaliation
4. If KO:
   - Emit 'beforeKO' → Vengeance can negateKO
   - If not negated, Emit 'onKO' → Den Mother, Gloom triggers
   - Life loss check with 'beforeLifeLoss' → Last Breath
```

## Testing

```bash
npm test           # Run all 276 tests
npm test -- -u     # Update snapshots
npm test abilities # Run specific test file
```

Tests use Vitest with ES module support. Test files mirror source structure:
- `tests/effects.test.js`
- `tests/triggers.test.js`
- `tests/abilities.test.js`

## Deployment

```bash
npm run build      # Vite build → docs/
git push           # GitHub Pages serves docs/
```

Live at: https://abriskbreeze.github.io/tiny-fangs/
