# Tiny Fangs — Project Context for Claude

## Quick Start
```bash
# From repo root
npm install
npm test              # 298 tests (Vitest)
npm run dev           # Vite dev server → http://localhost:5173
npm run build         # Build to dist/ (GitHub Actions deploys on push to main)
```

- **Live:** https://abriskbreeze.github.io/tiny-fangs/
- **Version:** `v0.4.87` (see `VERSION`, `package.json`, `index.html`)
- **Repo:** github.com/abriskbreeze/tiny-fangs

## Architecture (v0.4.x)

```
index.html (390 lines)     Pure HTML structure + setup screens
├── src/styles.css         All CSS
└── src/main.js            UI shell (event-playback / mp-client / solo-ai peeled out)
       └── shared/engine.js   ALL game rules (single source of truth)

server/GameEngine.js (149 lines)   Thin wrapper for multiplayer
       └── shared/engine.js
```

### Shared module (`shared/`)
- `cards.js` — 29 creatures, 26 verses, 5 decks
- `effects.js` — 28 effect primitives + `processEffects()`
- `triggers.js` — Priority-based trigger matching
- `engine.js` — `executeAction()`, attack, summon, cast, endTurn, etc.

### Client-only (`src/`)
- `main.js` — Game UI shell + wiring
- `event-playback.js` / `solo-dispatch.js` / `solo-ai.js` / `mp-client.js` — peeled from main
- `anim.js` — ASCII animations (all return Promises)
- `render.js` — DOM rendering
- `ai.js` — Hunter AI (Pup/Hunter difficulty levels)
- `abilities.js` — UI ATK modifiers; `getEffectiveAtk` re-exports shared
- `effects.js` — Wraps shared effects + animation layer
- `triggers.js` — Client trigger processing + UI prompts
- `cards.js` — Re-exports shared card data

### Multiplayer
- Server-authoritative WebSocket model
- WS URL: `?ws=` / `localStorage.tinyFangsWs` / default tunnel (see `src/mp-client.js`)
- Start server: `cd server && node index.js`

## Game Design

**Win:** Reduce opponent LP to 0 (3 hearts) or deck them out.

**Turn:** Draw 1 → +1 mana (max 5) → main phase (summon, attack, cast/set verse, retreat) → end turn (poison tick, turnEnd triggers).

**Card types:**
- Creatures — active slot + bench (max 2), attack enemy
- Cast verses — immediate effect, to graveyard
- Set verses — face-down traps with trigger conditions

**Decks (5):** Shadow, Fang, Venom, Swarm, Shell (20 cards each: 8 creatures + 12 verses)

## Key Patterns

**State:**
```js
import { state } from './src/state.js';
state.G.me / state.G.opp   // Player objects
state.G.myTurn             // Boolean
```

**Shared engine actions:**
```js
import { executeAction } from '../shared/engine.js';
const result = executeAction(state, playerIdx, action);
// result: { state, events, error?, pendingAction? }
```

**Animations:** Always `await` before `render()` to avoid killing CSS classes mid-animation.

**Card authoring:** Cards are data in `shared/cards.js`. See `guides/CARD-AUTHORING.md`.

## Testing
```bash
npm test                        # All 298 tests
npm test -- tests/engine.test.js  # Single file
```

## Deployment
GitHub Actions builds `dist/` on push to `main` and deploys to GitHub Pages.
Always run `npm run build` before pushing if testing locally against `dist/`.

## Documentation
| File | Purpose |
|------|---------|
| `README.md` | Quick start |
| `MEMORY.md` | Full project history + session log |
| `ARCHITECTURE.md` | System diagrams + reference |
| `CHANGELOG.md` | Version history |
| `guides/CARD-AUTHORING.md` | How to add cards |
| `guides/EVENT-SYSTEM.md` | Trigger/event system |
| `tasks/architecture-gaps.md` | Current architecture status |

## Style
- ASCII aesthetic, JetBrains Mono font
- No emoji in game UI (setup screen has a few)
- Cast verses = gold, Set verses = purple
- Hearts for LP: ♥ / ♡
