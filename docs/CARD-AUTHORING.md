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

Selection types:
- `graveCreature` — Creatures in your graveyard
- `ownCreature` — Your creatures (active + bench)

### Computed Values

Some effects support computed values:

```js
// Draw 1 per creature (max 3)
{ type: 'draw', count: 'creatureCount', max: 3 }
```

### Complex Cast Verses (customHandler)

For cards with complex interactions (triggers, multi-phase effects), use the escape hatch:

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

Then add the logic to the switch in `index.html`:

```js
case 'bloodMoon':
  // Complex AoE logic with capture-then-process
  break;
```

**When to use customHandler:**
- Card triggers other cards (Den Mother, Grave Rise)
- Card has multi-phase resolution (capture targets → damage → KO)
- Card has unique timing requirements

---

## Set Verses (Currently Procedural)

Set verses require code changes. They trigger at specific game events.

### Definition

```js
brace: {
  id: 'brace',
  name: 'Brace',
  type: 'set',
  cost: 1,
  trigger: 'When opponent attacks',
  text: 'Reduce damage by 15.'
}
```

### Adding Trigger Logic

Find the appropriate trigger point in `index.html`:

| Trigger | Location in Code |
|---------|------------------|
| When opponent attacks | `doAttack()` before damage |
| When your creature is KO'd | `ko()` function |
| When opponent summons | `doSummon()` |
| When opponent casts | `castVerse()` start |

Example:

```js
// In doAttack(), before damage calculation
if (state.G.me.setVerse?.id === 'brace') {
  // Optional trigger prompt
  const shouldTrigger = await promptTrigger(state.G.me, state.G.me.setVerse, {});
  if (shouldTrigger) {
    await showTriggerReveal(state.G.me.setVerse);
    damageReduction += 15;
    state.G.me.grave.push(state.G.me.setVerse);
    state.G.me.setVerse = null;
  }
}
```

---

## Creatures (Currently Procedural)

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

### Ability Trigger Locations

| Ability Type | Location |
|--------------|----------|
| On attack (Frenzy, Rend) | `doAttack()` damage calc |
| When attacked (Thorns) | `doAttack()` after damage |
| On summon (Spark) | `doSummon()` |
| On KO (Fade, Shatter) | `ko()` |
| Passive (Elusive, Iron Skin) | Various checks |

### Example: Adding "Burn" Ability

```js
// cards.js
firecat: {
  id: 'firecat',
  name: 'Firecat',
  cost: 2,
  hp: 35,
  atk: 25,
  ability: 'Burn',
  abilityText: 'Attacks inflict burn (5 damage per turn).'
}

// In doAttack(), after damage
if (attacker.id === 'firecat' && defender) {
  defender.status = 'burn';
  defender.burnDamage = 5;
  log('Burn inflicted!', 'dmg');
}

// In turn start, process burn
if (state.G.opp.active?.status === 'burn') {
  applyDamage(state.G.opp.active, state.G.opp.active.burnDamage);
  log('Burn damage!', 'dmg');
}
```

---

## Adding to Decks

After defining a card, add it to a deck:

```js
// src/cards.js
export const DECKS = {
  fang: {
    creatures: ['emberfang', 'emberfang', 'cindermaw', ...],
    verses: ['ignite', 'ignite', 'fireball', ...]  // Add here
  }
}
```

---

## Testing

1. Run `npm test` to verify no regressions
2. Test in browser: `node server.cjs`
3. Manual test the new card's interactions

---

## Future: Event System (Planned)

We're planning a declarative event system for set verses and creature abilities:

```js
// Future syntax (not yet implemented)
brace: {
  type: 'set',
  trigger: 'beforeDamage',
  condition: { target: 'me.active' },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}

thornling: {
  ability: {
    trigger: 'whenAttacked',
    effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
  }
}
```

This will allow adding most cards as data only. See `docs/EVENT-SYSTEM-SPEC.md` for architecture details.
