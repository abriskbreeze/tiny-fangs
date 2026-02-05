# Card Authoring Guide

How to add new cards to Tiny Fangs.

## Overview

Cards are defined in `src/cards.js`. The game supports three card types:
- **Creatures** — Summon to battle
- **Cast Verses** — Immediate effects
- **Set Verses** — Trap-style triggers

All cards use declarative definitions. Most cards require **zero code changes**.

---

## Cast Verses (Declarative)

Cast verses define an `effects` array. The engine executes them automatically.

### Simple Example

```js
fireball: {
  id: 'fireball',
  name: 'Fireball',
  type: 'cast',
  cost: 2,
  text: 'Deal 25 damage to enemy creature.',
  effects: [
    { type: 'damage', target: 'opp.active', amount: 25, condition: 'opp.active' }
  ]
}
```

### Multi-Effect Example

```js
darkPact: {
  id: 'darkPact',
  name: 'Dark Pact',
  type: 'cast',
  cost: 1,
  text: 'Draw 2 cards. Lose 1 life.',
  effects: [
    { type: 'draw', count: 2 },
    { type: 'loseLife', count: 1 }
  ]
}
```

### Available Effect Primitives

| Type | Params | Description |
|------|--------|-------------|
| `damage` | target, amount, condition? | Deal damage (returns KO info) |
| `heal` | target, amount, condition? | Heal up to max HP |
| `healSelf` | amount | Heal the creature that triggered this |
| `draw` | count, max? | Draw cards. count: number or `'creatureCount'` |
| `loseLife` | count | Lose life points |
| `loseLifeOpp` | count | Opponent loses life |
| `gainMana` | amount | Gain mana |
| `atkBonus` | amount, source | Buff next attack |
| `setStatus` | target, status | Set status (fortified, shielded, poison, trapped) |
| `cureStatus` | target, status | Remove status |
| `moveCard` | from, to, target | Move card between zones |
| `setFlag` | flag, value, target? | Set player flag |
| `banish` | target | Remove from game (not to grave) |
| `summon` | filter, location | Summon from deck |
| `summonFromGrave` | filter, location | Summon from graveyard |
| `discard` | target, count, random | Discard from hand |
| `aoeAll` | amount | Damage all creatures |
| `koSelected` | — | Sacrifice selected creature |
| `reduceDamage` | amount | For trigger damage reduction |
| `negateSpell` | — | Negate the spell being cast |
| `negateAttack` | — | Negate the attack |
| `negateKO` | — | Prevent the KO |
| `negateLifeLoss` | — | Prevent life loss |
| `destroy` | target | Send creature to grave |

### Target Strings

| Target | Description |
|--------|-------------|
| `me.active` | Your active creature |
| `opp.active` | Opponent's active creature |
| `attacker` | The attacking creature |
| `defender` | The defending creature |
| `summoned` | The creature just summoned |
| `selected` | Player-selected target |

### Conditions

Add `condition: 'path'` to skip effect if target doesn't exist:

```js
{ type: 'damage', target: 'opp.active', amount: 20, condition: 'opp.active' }
```

Special conditions:
- `me.grave.hasCreature` — You have creatures in grave
- `opp.grave.hasCreature` — Opponent has creatures in grave

### Selection Cards

For cards requiring player selection:

```js
graveEcho: {
  id: 'graveEcho',
  name: 'Grave Echo',
  type: 'cast',
  cost: 3,
  text: 'Return a creature from your graveyard to your hand.',
  requiresSelection: true,
  selection: { type: 'graveCreature', prompt: 'Choose creature to return' },
  effects: [
    { type: 'moveCard', from: 'me.grave', to: 'me.hand', target: 'selected' }
  ]
}
```

---

## Set Verses (Event-Driven)

Set verses use `triggerDef` for when they fire and `effects` for what happens.

### Basic Structure

```js
brace: {
  id: 'brace',
  name: 'Brace',
  type: 'set',
  cost: 1,
  trigger: 'When opponent attacks',  // Display text
  text: 'Reduce damage by 15.',
  triggerDef: {
    event: 'beforeDamage',
    condition: { target: 'me.active' },
    optional: true,       // Player can decline
    priority: 3           // Optional, auto-detected
  },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}
```

### Event Types

| Event | When Emitted | Typical Use |
|-------|--------------|-------------|
| `beforeAttack` | Before attack resolves | Negate attacks |
| `beforeDamage` | Before damage applied | Reduce damage |
| `afterAttack` | After attack completes | Retaliation |
| `beforeKO` | Before creature dies | Prevent KO |
| `onKO` | When creature KO'd | Death triggers |
| `onSummon` | When creature enters | Entry effects |
| `onCast` | When cast verse played | Counter spells |
| `beforeLifeLoss` | Before LP decremented | Save from death |

### Trigger Conditions

```js
condition: {
  target: 'me.active',       // Your active creature is targeted
  attacker: 'opp',           // Opponent is attacking
  defender: 'self',          // This creature is defending
  owner: 'me',               // Affected entity belongs to you
  caster: 'opp',             // Opponent cast a spell
  hasBench: true,            // You have bench creatures
  lastLife: true,            // This would be your last life
  hasOneCostInGrave: true,   // 1-cost creature in grave
  benchNotFull: true         // Bench has room
}
```

### Priority System

| Priority | Purpose | Auto-detected from |
|----------|---------|-------------------|
| 1 | Negate triggers | `negateTrigger` |
| 2 | Negate action | `negateAttack`, `negateSpell`, `negateKO` |
| 3 | Pre-modification | `reduceDamage` |
| 4 | Standard (default) | Everything else |
| 5 | Post-event | After effects |

Priority is usually auto-detected. Override with explicit `priority: N`.

---

## Creatures

Creatures define abilities in a structured format.

### Passive Abilities

Always-on modifiers:

```js
bladewhisker: {
  id: 'bladewhisker',
  name: 'Bladewhisker',
  cost: 2, hp: 40, atk: 30,
  ability: {
    name: 'Rend',
    text: 'Attacks deal +10 damage.',
    passive: { type: 'atkBonus', amount: 10 }
  }
}
```

Conditional passives:

```js
shadePup: {
  id: 'shadePup',
  name: 'Shade Pup',
  cost: 1, hp: 25, atk: 15,
  ability: {
    name: 'Orphan',
    text: '+15 ATK while you have no bench creatures.',
    passive: { type: 'atkBonus', amount: 15, condition: 'me.bench.empty' }
  }
}
```

### Triggered Abilities

Fire on specific events:

```js
thornling: {
  id: 'thornling',
  name: 'Thornling',
  cost: 1, hp: 40, atk: 10,
  ability: {
    name: 'Thorns',
    text: 'Attackers take 10 damage.',
    trigger: { event: 'afterAttack', condition: { defender: 'self' } },
    effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
  }
}
```

On-summon triggers:

```js
emberfang: {
  id: 'emberfang',
  name: 'Emberfang',
  cost: 1, hp: 25, atk: 25,
  ability: {
    name: 'Spark',
    text: 'When summoned, deal 5 damage to enemy creature.',
    trigger: { event: 'onSummon', condition: { self: true } },
    effects: [{ type: 'damage', target: 'opp.active', amount: 5, condition: 'opp.active' }]
  }
}
```

On-KO triggers:

```js
gloom: {
  id: 'gloom',
  name: 'Gloom',
  cost: 1, hp: 20, atk: 20,
  ability: {
    name: 'Fade',
    text: 'When KO\'d, opponent discards 1 random card.',
    trigger: { event: 'onKO', condition: { target: 'self' } },
    effects: [{ type: 'discard', target: 'opp', count: 1, random: true }]
  }
}
```

### Complex/Procedural Abilities

For abilities that modify game flow (can't be declarative):

```js
cindermaw: {
  id: 'cindermaw',
  name: 'Cindermaw',
  cost: 2, hp: 30, atk: 30,
  ability: {
    name: 'Frenzy',
    text: 'Attacks twice, but takes 10 self-damage.',
    procedural: true  // Handled in doAttack()
  }
}
```

---

## Adding to Decks

```js
export const DECKS = {
  fang: {
    creatures: ['emberfang', 'emberfang', 'cindermaw', 'cindermaw', ...],
    verses: ['ignite', 'ignite', 'predatorsMark', ...]
  }
}
```

Each deck has exactly 8 creatures and 12 verses (20 cards total).

---

## Testing

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test triggers           # Run specific file
```

### Test Checklist

1. **Unit tests** — Test effects in isolation
2. **Integration** — Test card in game context
3. **Browser test** — `node server.cjs` → http://localhost:3000
4. **Manual playtest** — All interactions work as expected

---

## Examples

### Damage Reduction Trigger

```js
swarmShield: {
  id: 'swarmShield',
  type: 'set', cost: 1,
  trigger: 'When your active would take damage',
  text: 'If you have bench, reduce damage by 15.',
  triggerDef: {
    event: 'beforeDamage',
    condition: { target: 'me.active', hasBench: true },
    optional: true
  },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}
```

### Counter Spell

```js
manaDrain: {
  id: 'manaDrain',
  type: 'set', cost: 1,
  trigger: 'When opponent plays Cast Verse',
  text: 'Negate it. Gain 1 mana.',
  triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
  effects: [{ type: 'negateSpell' }, { type: 'gainMana', amount: 1 }]
}
```

### Death Replacement

```js
vengeance: {
  id: 'vengeance',
  type: 'set', cost: 2,
  trigger: 'When your creature would be KO\'d',
  text: 'Negate KO. Destroy attacker instead.',
  triggerDef: {
    event: 'beforeKO',
    condition: { target: 'me.active' },
    optional: true,
    priority: 2
  },
  effects: [{ type: 'negateKO' }, { type: 'destroy', target: 'attacker' }]
}
```
