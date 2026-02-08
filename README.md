# Tiny Fangs

**ASCII Card Battler** — Pokemon TCG meets Yu-Gi-Oh with original mythical tiny predators.

🦷 **Play Now:** https://abriskbreeze.github.io/tiny-fangs/

## Features

- **5 Decks**: Shadow, Fang, Venom, Swarm, Shell — each with unique playstyle
- **29 Creatures**: Unique abilities with declarative trigger system
- **22 Verses**: Cast spells and set traps with priority-based resolution
- **Hunter AI**: Score-based decision making (Pup/Hunter difficulty)
- **Event System**: 5-level priority trigger resolution
- **Full Animations**: Attack coils, damage shakes, KO effects, turn transitions

## How to Play

**Win by:**
- Reducing opponent LP to 0 (3 hearts)
- Or deck them out

**Cards:**
- **Creatures** — Summon to active slot or bench (max 2), attack enemy
- **Cast Verses** — Immediate effects, goes to graveyard
- **Set Verses** — Traps that trigger on conditions

## Quick Start

```bash
npm install
npm run dev      # Dev server → http://localhost:5173
npm test         # Run 276 tests
npm run build    # Build to docs/
```

## Architecture

```
src/
├── cards.js      # Card database (creatures, verses, decks)
├── effects.js    # 20 effect primitives (damage, heal, draw...)
├── events.js     # Event emitter (GameEvents)
├── triggers.js   # Priority-based trigger processor
├── abilities.js  # Creature ability calculations
├── ai.js         # Enemy AI
├── anim.js       # ASCII animations
└── render.js     # Board rendering
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full documentation.

## Card Authoring

Cards are data, not code. Most new cards require **zero code changes**:

```js
// Cast Verse
fireball: {
  type: 'cast', cost: 2,
  text: 'Deal 25 damage.',
  effects: [{ type: 'damage', target: 'opp.active', amount: 25 }]
}

// Set Verse
brace: {
  type: 'set', cost: 1,
  triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' } },
  effects: [{ type: 'reduceDamage', amount: 15 }]
}

// Creature
thornling: {
  cost: 1, hp: 40, atk: 10,
  ability: {
    trigger: { event: 'afterAttack', condition: { defender: 'self' } },
    effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
  }
}
```

See [`guides/CARD-AUTHORING.md`](guides/CARD-AUTHORING.md) for full guide.

## Version

**v0.4.22** — [Changelog](CHANGELOG.md)

## Tech Stack

- Vanilla HTML/CSS/JS (no framework)
- Vite for build/dev server
- Vitest for testing (276 tests)
- GitHub Pages for hosting

---

*Built with 🦷 by Rico & Neve*
