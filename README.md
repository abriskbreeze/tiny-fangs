# Tiny Fangs

**ASCII Card Battler** — Pokemon TCG meets Yu-Gi-Oh with original mythical tiny predators.

🦷 **Play Now:** https://abriskbreeze.github.io/tiny-fangs/

## Features

- **5 Decks**: Shadow, Fang, Venom, Swarm, Shell — each with unique playstyle
- **29 Creatures**: Unique abilities with declarative trigger system
- **26 Verses**: 16 cast spells + 10 set traps with priority-based resolution
- **Hunter AI**: Score-based decision making (Pup/Hunter difficulty)
- **Event System**: 5-level priority trigger resolution
- **Full Animations**: Attack coils, damage shakes, KO effects, turn transitions

## Presentation Modes

The classic ASCII presentation is the default and is fully playable.

- **Classic** (default) — the ASCII board, unchanged.
- **AAA** (`?presentation=aaa`) — an opt-in 3D presentation: a Three.js meadow
  board with illustrated card faces, edge rails, and motion/audio. Also settable
  via `localStorage['tinyFangs.presentation.mode'] = 'aaa'`.

The AAA shell is code-split, so classic never downloads it, and if it fails to
load or WebGL is unavailable the game falls back to classic automatically.

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
npm test -- --run # Run 630 unit tests
npm run build    # Build (GitHub Actions deploys dist/)

# Multiplayer server
cd server && npm install && node index.js   # ws://localhost:3001
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  index.html (390 lines) ─── Pure HTML structure             │
│       │                                                     │
│       ├── src/styles.css ─── All CSS                        │
│       │                                                     │
│       └── src/main.js ─── UI, animations, AI                │
│              │                                              │
│              └──► shared/engine.js ─── ALL game logic       │
│                                                             │
│  server/GameEngine.js ─── Multiplayer wrapper               │
│       └──► shared/engine.js                                 │
└─────────────────────────────────────────────────────────────┘

shared/                    # Single source of truth
├── engine.js              # Game logic (executeAction, triggers)
├── cards.js               # Card database (creatures, verses, decks)
├── effects.js             # 28 effect primitives
├── damage-reduction.js    # Declarative creature DR
├── death-effects.js       # On-KO / survival hooks
└── triggers.js            # Priority-based trigger processor

src/                       # Client modules
├── main.js                # UI, animations, AI decisions
├── styles.css             # All styling
├── anim.js                # ASCII animations
├── render.js              # Board rendering
├── ai.js                  # Enemy AI logic
├── presentation/          # Opt-in AAA presentation (see Presentation Modes)
└── *.js                   # Other client utilities
```

See [`MEMORY.md`](MEMORY.md) for full documentation.

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

**v0.4.87** — [Changelog](CHANGELOG.md)

## Tech Stack

- Vanilla HTML/CSS/JS (no framework)
- Three.js (opt-in AAA presentation only, lazy-loaded)
- Vite for build/dev server
- Vitest for unit tests (630), Playwright for E2E/visual
- GitHub Pages for hosting

---

*Built with 🦷 by Rico & Neve*
