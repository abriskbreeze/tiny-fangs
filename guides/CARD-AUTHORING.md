# Card Authoring Guide

How to add new cards to Tiny Fangs.

## Overview

Cards are defined in `src/cards.js`. The game supports three card types:
- **Creatures** — Summon to battle
- **Cast Verses** — Immediate effects
- **Set Verses** — Trap-style triggers

---

## Cast Verses (Declarative)

Most cast verses use the declarative effect system. Define effects as data — no code changes needed.

### Simple Example

```js
// src/cards.js
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

### Available Effect Primitives

| Type | Params | Description |
|------|--------|-------------|
| `damage` | target, amount, condition? | Deal damage (returns KO info) |
| `heal` | target, amount, condition? | Heal up to max HP |
| `draw` | count, max? | Draw cards. count can be number or `'creatureCount'` |
| `loseLife` | count | Lose life points |
| `gainMana` | amount | Gain mana |
| `atkBonus` | amount, source | Add attack bonus for next attack |
| `setStatus` | target, status | Set status flag (fortified, shielded) |
| `cureStatus` | target, status | Remove status (poison) |
| `moveCard` | from, to, target | Move card between zones |
| `setFlag` | flag, value | Set player flag (usedManaSurge) |
| `banish` | target | Remove from game (not to grave) |
| `summon` | filter, location | Summon from deck |
| `reduceDamage` | amount | For damage reduction triggers |
| `negateSpell` | — | For spell negation (Mana Drain) |

### Target Strings

- `me.active` — Your active creature
- `opp.active` — Opponent's active creature
- `selected` — Player-selected target (for selection cards)

### Conditions

Add `condition: 'target.path'` to skip effect if target doesn't exist:

```js
{ type: 'damage', target: 'opp.active', amount: 20, condition: 'opp.active' }
```

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

### Complex Cast Verses (customHandler)

For cards with complex interactions, use the escape hatch:

```js
bloodMoon: {
  id: 'bloodMoon',
  name: 'Blood Moon',
  type: 'cast',
  cost: 2,
  text: 'All creatures take 20 damage.',
  customHandler: true  // Uses switch case in castVerse()
}
```

---

## Set Verses

Set verses have declarative trigger definitions:

```js
brace: {
  id: 'brace',
  name: 'Brace',
  type: 'set',
  cost: 1,
  trigger: 'When opponent attacks',  // Display text
  text: 'Reduce damage by 15.',
  triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}
```

**Note:** Set verses currently use existing if-checks in the game flow. The `triggerDef` and `effects` are for future event-driven migration.

---

## Creatures

Creature abilities require code changes based on their trigger type.

### Definition

```js
thornling: {
  id: 'thornling',
  name: 'Thornling',
  subtitle: 'Bramble Sprite',
  cost: 1,
  hp: 40,
  atk: 10,
  ability: 'Thorns',
  abilityText: 'Attackers take 10 damage.',
  flavor: '"It doesn\'t chase. It waits."',
  art: ' 🌿ί\n(●oο)\n \\|/'
}
```

### Adding Ability Logic

Find the appropriate trigger point in `index.html` or `src/abilities.js`.

---

## Adding to Decks

```js
export const DECKS = {
  fang: {
    creatures: ['emberfang', 'emberfang', 'cindermaw', ...],
    verses: ['ignite', 'ignite', 'fireball', ...]
  }
}
```

---

## Testing

1. Run `npm test` to verify no regressions
2. Test in browser: `node server.cjs`
3. Manual test the new card's interactions
