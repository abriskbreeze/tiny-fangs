# Tiny Fangs — Architecture Unification Plan

**Goal:** Single source of truth for game logic, shared between client and server.  
**Approach:** Surgical, incremental changes following Karpathy Guidelines.

---

## Current State (The Problem)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CURRENT: DUPLICATED LOGIC                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   CLIENT (Single-Player)              SERVER (Multiplayer)              │
│   ┌─────────────────────┐             ┌─────────────────────┐          │
│   │    src/cards.js     │  ═══╳═══    │  server/cards.js    │ DUPE     │
│   │   (card defs)       │             │   (copy-pasted)     │          │
│   └─────────────────────┘             └─────────────────────┘          │
│                                                                         │
│   ┌─────────────────────┐             ┌─────────────────────┐          │
│   │   src/effects.js    │  ═══╳═══    │  GameEngine.js      │ DUPE     │
│   │   (data-driven)     │             │  (hardcoded switch) │          │
│   │                     │             │                     │          │
│   │  Card defines:      │             │  Switch cases:      │          │
│   │  effects: [...]     │             │  case 'phantomWall':│          │
│   │  Engine executes    │             │    negated = true;  │ ← BUGS   │
│   └─────────────────────┘             └─────────────────────┘          │
│                                                                         │
│   ┌─────────────────────┐             ┌─────────────────────┐          │
│   │  src/triggers.js    │  ═══╳═══    │  checkTriggers()    │ DUPE     │
│   │  (generic)          │             │  (inline in engine) │          │
│   └─────────────────────┘             └─────────────────────┘          │
│                                                                         │
│   RESULT: Bugs in server that don't exist in client (Phantom Wall)     │
│   RESULT: Changes must be made twice, easy to forget                   │
│   RESULT: Features drift apart over time                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Target State (The Solution)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TARGET: SHARED CORE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ┌─────────────────────────┐                          │
│                    │       shared/           │                          │
│                    │  ┌─────────────────┐   │                          │
│                    │  │    cards.js     │   │  Single card definitions │
│                    │  └─────────────────┘   │                          │
│                    │  ┌─────────────────┐   │                          │
│                    │  │   effects.js    │   │  Data-driven effects     │
│                    │  └─────────────────┘   │                          │
│                    │  ┌─────────────────┐   │                          │
│                    │  │  triggers.js    │   │  Trigger matcher         │
│                    │  └─────────────────┘   │                          │
│                    │  ┌─────────────────┐   │                          │
│                    │  │    engine.js    │   │  Core game logic         │
│                    │  └─────────────────┘   │                          │
│                    └───────────┬────────────┘                          │
│                                │                                        │
│              ┌─────────────────┼─────────────────┐                      │
│              │                 │                 │                      │
│              ▼                 │                 ▼                      │
│   ┌─────────────────────┐     │     ┌─────────────────────┐            │
│   │   CLIENT (Browser)  │     │     │   SERVER (Node.js)  │            │
│   │  ┌───────────────┐  │     │     │  ┌───────────────┐  │            │
│   │  │  index.html   │  │     │     │  │   index.js    │  │            │
│   │  │  (UI/Anim)    │  │     │     │  │  (WebSocket)  │  │            │
│   │  └───────────────┘  │     │     │  └───────────────┘  │            │
│   │  ┌───────────────┐  │     │     │  ┌───────────────┐  │            │
│   │  │   anim.js     │  │     │     │  │  GameEngine   │  │            │
│   │  │   render.js   │  │     │     │  │  (thin wrap)  │  │            │
│   │  └───────────────┘  │     │     │  └───────────────┘  │            │
│   └─────────────────────┘     │     └─────────────────────┘            │
│                                                                         │
│   CLIENT-ONLY: UI, animations, AI                                       │
│   SERVER-ONLY: WebSocket, session management                            │
│   SHARED: All game rules, effects, triggers                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Create Shared Module (No Breaking Changes)

**Goal:** Extract shared logic without breaking existing code.

```
tiny-fangs/
├── shared/                    ← NEW DIRECTORY
│   ├── cards.js              ← Copy from src/cards.js
│   ├── effects.js            ← Adapt from src/effects.js (no Anim deps)
│   ├── triggers.js           ← Adapt from src/triggers.js
│   ├── engine.js             ← Core game logic (attack, summon, etc.)
│   └── index.js              ← Re-export all
```

**Tasks:**
- [ ] Create `shared/` directory
- [ ] Copy `cards.js` to shared (remove browser-specific code if any)
- [ ] Create `shared/effects.js` - pure logic, no animations
  - Effects return `{ events: [...], stateChanges: [...] }`
  - Animations handled by caller
- [ ] Create `shared/triggers.js` - trigger matching
- [ ] Create `shared/engine.js` - core operations (attack, summon, cast, etc.)
- [ ] Add tests for shared modules

**Verification:**
```bash
npm run test:shared  # All shared module tests pass
```

---

### Phase 2: Migrate Server to Shared

**Goal:** Server uses shared modules instead of hardcoded logic.

```javascript
// server/GameEngine.js - BEFORE (1500+ LOC hardcoded)
case 'phantomWall':
  negated = true;  // Missing damage!
  break;

// server/GameEngine.js - AFTER (thin wrapper)
import { processEffects, triggerSetVerse } from '../shared/index.js';

export function attack(state, playerIdx) {
  return engine.attack(state, playerIdx);  // Shared logic
}
```

**Tasks:**
- [ ] Update `server/GameEngine.js` to import from `shared/`
- [ ] Replace hardcoded switch cases with `processEffects()` calls
- [ ] Replace `checkTriggers()` with shared trigger system
- [ ] Remove duplicate card definitions (use `shared/cards.js`)
- [ ] Test all multiplayer scenarios

**Verification:**
```bash
# Server tests pass
npm run test:server

# Manual: Play multiplayer, verify:
# - Phantom Wall deals 10 damage ✓
# - All verses work correctly ✓
# - No missing effects ✓
```

---

### Phase 3: Migrate Client to Shared

**Goal:** Client uses shared modules, keeps animation layer separate.

```javascript
// index.html - BEFORE
// 1000+ lines of inline game logic

// index.html - AFTER
import { attack, summon, castVerse } from './shared/index.js';
import { Anim } from './src/anim.js';

async function doAttack() {
  const { events, newState } = attack(state.G, 0);
  
  // Animate events
  for (const e of events) {
    await animateEvent(e);
  }
  
  state.G = newState;
  render();
}
```

**Tasks:**
- [ ] Update `src/effects.js` to delegate to `shared/effects.js`
- [ ] Update `src/triggers.js` to delegate to `shared/triggers.js`
- [ ] Refactor `index.html` to use shared engine
- [ ] Keep animation layer separate (Anim calls based on events)
- [ ] Ensure all 350+ tests still pass

**Verification:**
```bash
npm test  # All tests pass
# Manual: Play single-player, verify all cards work
```

---

### Phase 4: Update Documentation

**Goal:** Architecture docs reflect the new unified structure.

**Tasks:**
- [ ] Update `ARCHITECTURE.md` with:
  - New directory structure
  - Shared module documentation
  - Multiplayer architecture diagram
  - Network flow diagram
- [ ] Add `shared/README.md` explaining the module
- [ ] Update `CLAUDE.md` with new architecture notes

---

## Network Architecture (New Diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MULTIPLAYER NETWORK FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PLAYER 1 (Host)                    PLAYER 2 (Guest)                   │
│   ┌─────────────┐                    ┌─────────────┐                   │
│   │   Browser   │                    │   Browser   │                   │
│   │  index.html │                    │  index.html │                   │
│   └──────┬──────┘                    └──────┬──────┘                   │
│          │                                  │                           │
│          │ WebSocket                        │ WebSocket                 │
│          │                                  │                           │
│          ▼                                  ▼                           │
│   ┌─────────────────────────────────────────────────────┐              │
│   │                    SERVER (Node.js)                  │              │
│   │  ┌─────────────────────────────────────────────┐    │              │
│   │  │              Room Manager                    │    │              │
│   │  │  rooms: Map<roomCode, { p1, p2, gameState }> │    │              │
│   │  └─────────────────────────────────────────────┘    │              │
│   │                         │                            │              │
│   │                         ▼                            │              │
│   │  ┌─────────────────────────────────────────────┐    │              │
│   │  │              Shared Engine                   │    │              │
│   │  │  import { attack, summon } from 'shared/'   │    │              │
│   │  └─────────────────────────────────────────────┘    │              │
│   └─────────────────────────────────────────────────────┘              │
│                                                                         │
│   MESSAGE FLOW:                                                         │
│                                                                         │
│   1. Player sends action ──────▶ { type: 'attack' }                    │
│   2. Server validates action                                            │
│   3. Server calls shared engine ──▶ attack(state, playerIdx)           │
│   4. Engine returns { state, events }                                   │
│   5. Server broadcasts to both ──▶ { type: 'stateUpdate', state, events}│
│   6. Clients queue update, play animations, update state               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Animation Pipeline (New Diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CLIENT ANIMATION PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐                                                   │
│   │  Server sends   │                                                   │
│   │  stateUpdate    │                                                   │
│   │  + events[]     │                                                   │
│   └────────┬────────┘                                                   │
│            │                                                            │
│            ▼                                                            │
│   ┌─────────────────┐     ┌─────────────────┐                          │
│   │   Update Queue  │────▶│  Process Update │                          │
│   │  (FIFO buffer)  │     │  (sequential)   │                          │
│   └─────────────────┘     └────────┬────────┘                          │
│                                    │                                    │
│            ┌───────────────────────┴───────────────────────┐           │
│            │                                               │           │
│            ▼                                               ▼           │
│   ┌─────────────────┐                             ┌─────────────────┐  │
│   │  No events?     │                             │  Has events?    │  │
│   │  Update state   │                             │  Keep old state │  │
│   │  Render         │                             │  Render         │  │
│   └─────────────────┘                             └────────┬────────┘  │
│                                                            │           │
│                                                            ▼           │
│                                                   ┌─────────────────┐  │
│                                                   │  Play events    │  │
│                                                   │  sequentially   │  │
│                                                   │                 │  │
│                                                   │  for (e of events):│
│                                                   │    await Anim[e] │  │
│                                                   │    log(e)        │  │
│                                                   └────────┬────────┘  │
│                                                            │           │
│                                                            ▼           │
│                                                   ┌─────────────────┐  │
│                                                   │  Update state   │  │
│                                                   │  Render         │  │
│                                                   │  renderLog()    │  │
│                                                   └─────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Effect Processing (Unified)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       UNIFIED EFFECT PROCESSING                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   CARD DEFINITION (shared/cards.js)                                     │
│   ┌─────────────────────────────────────────────┐                      │
│   │  phantomWall: {                             │                      │
│   │    id: 'phantomWall',                       │                      │
│   │    trigger: 'beforeAttack',                 │                      │
│   │    effects: [                               │                      │
│   │      { type: 'negateAttack' },              │                      │
│   │      { type: 'damage',                      │                      │
│   │        target: 'attacker',                  │                      │
│   │        amount: 10 }                         │                      │
│   │    ]                                        │                      │
│   │  }                                          │                      │
│   └─────────────────────────────────────────────┘                      │
│                          │                                              │
│                          ▼                                              │
│   SHARED ENGINE (shared/effects.js)                                     │
│   ┌─────────────────────────────────────────────┐                      │
│   │  processEffects(card, ctx) {                │                      │
│   │    const events = [];                       │                      │
│   │    for (const effect of card.effects) {    │                      │
│   │      const result = Effects[effect.type](  │                      │
│   │        ctx, effect                          │                      │
│   │      );                                     │                      │
│   │      events.push(...result.events);         │                      │
│   │    }                                        │                      │
│   │    return { events, ctx };                  │                      │
│   │  }                                          │                      │
│   └─────────────────────────────────────────────┘                      │
│                          │                                              │
│          ┌───────────────┴───────────────┐                             │
│          │                               │                             │
│          ▼                               ▼                             │
│   ┌─────────────────┐           ┌─────────────────┐                    │
│   │     CLIENT      │           │     SERVER      │                    │
│   │  Animate events │           │  Broadcast to   │                    │
│   │  Update DOM     │           │  all players    │                    │
│   └─────────────────┘           └─────────────────┘                    │
│                                                                         │
│   SAME LOGIC, DIFFERENT PRESENTATION                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria (Karpathy-style)

### Phase 1
- [ ] `npm run test:shared` exits 0
- [ ] `shared/effects.js` has no `Anim` imports
- [ ] `shared/cards.js` identical to `src/cards.js`

### Phase 2
- [ ] `server/GameEngine.js` imports from `shared/`
- [ ] No hardcoded `case 'phantomWall':` etc. in server
- [ ] Multiplayer: Phantom Wall deals 10 damage to attacker

### Phase 3
- [ ] `npm test` exits 0 (all 350+ tests pass)
- [ ] Single-player works identically to before

### Phase 4
- [ ] `ARCHITECTURE.md` includes multiplayer section
- [ ] All new diagrams present

---

## Risk Mitigation

1. **Incremental migration** - Each phase is independently deployable
2. **Tests first** - Add tests for shared modules before migrating
3. **Feature parity** - Compare behavior between old and new implementations
4. **Rollback plan** - Keep old code until new code is verified

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 2-3 hours | None |
| Phase 2 | 2-3 hours | Phase 1 |
| Phase 3 | 3-4 hours | Phase 1 |
| Phase 4 | 1-2 hours | Phases 2-3 |

Total: ~10 hours of focused work

---

*Created: 2026-02-09*
