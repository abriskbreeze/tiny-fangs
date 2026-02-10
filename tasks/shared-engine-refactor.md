# Shared Engine Refactor — Full Plan

## Goal
Server becomes a thin wrapper around shared/engine.js. All game logic lives in shared module.

## Current Problems
1. Server duplicates: applyDamage, getEffectiveAtk, autoSwapBenchToActive
2. Server has 1400+ lines of game logic that should be in shared
3. Card-specific `if` statements for target selection
4. SP (client) and MP (server) can drift

## Target Architecture

```
shared/                    — ALL game logic (pure functions)
├── cards.js               — Card data + selection configs
├── effects.js             — Effect primitives
├── triggers.js            — Trigger matching  
├── engine.js              — State transitions
└── index.js               — Exports

server/                    — Multiplayer wrapper only
├── index.js               — WebSocket server
└── GameEngine.js          — Thin wrapper (~200 lines)
    - Room management
    - Action validation
    - Calls shared/engine.js
    - State sync

src/                       — Client only
├── effects.js             — Wraps shared + animations
├── cards.js               — Re-exports shared
└── ... (ai, anim, render, multiplayer)
```

---

## Phase 1: Unify Helper Functions

### Task 1.1: Export helpers from shared/engine.js
Already exported:
- mkCreature, mkVerse, mkDeck, mkPlayer, createGame
- draw, applyDamage, autoSwapBenchToActive, getEffectiveAtk
- attack, summon, castVerse, setVerse, endTurn

### Task 1.2: Server imports helpers
Replace server's duplicate implementations:

```javascript
// server/GameEngine.js - BEFORE
function applyDamage(creature, amount) { ... }  // ~20 lines

// server/GameEngine.js - AFTER
import { applyDamage } from '../shared/engine.js';
```

**Functions to unify:**
- [ ] applyDamage
- [ ] getEffectiveAtk  
- [ ] autoSwapBenchToActive

### Task 1.3: Verify no behavior change
- All 262 tests pass
- Manual MP test

---

## Phase 2: Declarative Selection System

### Task 2.1: Add selection config to cards
Update shared/cards.js:

```javascript
ignite: {
  id: 'ignite', name: 'Ignite', type: 'cast', cost: 1,
  text: 'Deal 15 damage to any creature.',
  effects: [{ type: 'damage', target: 'selected', amount: 15 }],
  selection: {
    type: 'creature',      // creature | player | card
    filter: 'any',         // any | enemy | friendly | active | bench
    location: 'board',     // board | hand | grave | deck
    prompt: 'Choose a creature to ignite',
    required: true
  }
},

banish: {
  ...
  selection: {
    type: 'creature',
    filter: 'any',
    location: 'board',
    prompt: 'Choose a creature to banish',
    required: true
  }
},

soulSiphon: {
  ...
  selection: {
    type: 'creature',
    filter: 'enemy',
    location: 'active',
    prompt: 'Choose enemy creature',
    required: true
  }
},

graveEcho: {
  ...
  selection: {
    type: 'creature',
    filter: 'friendly',
    location: 'grave',
    prompt: 'Choose a creature from your graveyard',
    required: true
  }
}
```

### Task 2.2: Generic selection resolver
Add to shared/engine.js:

```javascript
/**
 * Resolve selection from action
 * @returns { creature, location, owner, idx } or null
 */
export function resolveSelection(state, playerIdx, action, selectionConfig) {
  if (!selectionConfig) return null;
  if (!action.targetUid && selectionConfig.required) {
    return { needsSelection: true, config: selectionConfig };
  }
  
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  
  // Find target by UID
  let target = null;
  let location = null;
  let owner = null;
  let idx = -1;
  
  // Check based on filter
  const checkPlayer = (p, ownerKey) => {
    if (p.active?.uid === action.targetUid) {
      target = p.active;
      location = 'active';
      owner = ownerKey;
      return true;
    }
    const benchIdx = p.bench.findIndex(c => c.uid === action.targetUid);
    if (benchIdx !== -1) {
      target = p.bench[benchIdx];
      location = 'bench';
      owner = ownerKey;
      idx = benchIdx;
      return true;
    }
    // Check grave
    const graveIdx = p.grave.findIndex(c => c.uid === action.targetUid);
    if (graveIdx !== -1) {
      target = p.grave[graveIdx];
      location = 'grave';
      owner = ownerKey;
      idx = graveIdx;
      return true;
    }
    return false;
  };
  
  // Search based on filter
  if (selectionConfig.filter === 'friendly' || selectionConfig.filter === 'any') {
    checkPlayer(player, 'me');
  }
  if (!target && (selectionConfig.filter === 'enemy' || selectionConfig.filter === 'any')) {
    checkPlayer(opponent, 'opp');
  }
  
  if (!target) return { error: 'Invalid target' };
  
  return { creature: target, location, owner, idx };
}
```

### Task 2.3: Update castVerse to use generic selection
In shared/engine.js:

```javascript
export function castVerse(state, playerIdx, cardUid, action = {}) {
  const player = state.players[playerIdx];
  const card = player.hand.find(c => c.uid === cardUid);
  if (!card) return { error: 'Card not in hand' };
  
  const template = VERSES[card.id];
  
  // Check selection requirement
  if (template.selection) {
    const selection = resolveSelection(state, playerIdx, action, template.selection);
    if (selection.needsSelection) {
      return { needsSelection: true, config: selection.config };
    }
    if (selection.error) {
      return { error: selection.error };
    }
    // Add to context
    action.selected = selection;
  }
  
  // Pay mana
  if (player.mana < card.cost) return { error: 'Not enough mana' };
  player.mana -= card.cost;
  
  // Move to grave
  player.hand = player.hand.filter(c => c.uid !== cardUid);
  player.grave.push(card);
  
  // Build context and process effects
  const ctx = buildEffectsContext(state, playerIdx, action);
  const result = processEffects(template, ctx);
  
  return { state, events: result.events, kos: result.kos };
}
```

### Task 2.4: Server uses shared castVerse
Server's executeAction becomes:

```javascript
case 'cast': {
  const result = castVerse(state, playerIdx, action.cardUid, action);
  if (result.needsSelection) {
    return { state, events, pendingSelection: result.config };
  }
  if (result.error) {
    return { state, events, error: result.error };
  }
  events.push(...result.events);
  // Handle KOs...
  break;
}
```

---

## Phase 3: Thin Server

### Task 3.1: Server executeAction delegates to shared
Each action type calls the shared function:

```javascript
export function executeAction(state, playerIdx, action) {
  switch (action.action) {
    case 'summon':
      return sharedSummon(state, playerIdx, action.cardUid, action.slot);
    case 'cast':
      return sharedCastVerse(state, playerIdx, action.cardUid, action);
    case 'set':
      return sharedSetVerse(state, playerIdx, action.cardUid);
    case 'attack':
      return sharedAttack(state, playerIdx);
    case 'retreat':
      return sharedRetreat(state, playerIdx, action.benchIdx);
    case 'endTurn':
      return sharedEndTurn(state, playerIdx);
  }
}
```

### Task 3.2: Move trigger handling to shared
Currently server has checkTriggers + executeTrigger.
Move to shared/triggers.js.

### Task 3.3: Server is just:
- WebSocket handling
- Room management
- Action validation (is it your turn?)
- Calling shared/engine.js
- Broadcasting state

---

## Implementation Order

| Phase | Task | Complexity | Subagent? |
|-------|------|------------|-----------|
| 1.1 | Verify shared exports | Low | No |
| 1.2 | Import helpers in server | Low | Yes |
| 1.3 | Test | Low | No |
| 2.1 | Add selection to cards | Medium | Yes |
| 2.2 | Generic selection resolver | Medium | Yes |
| 2.3 | Update shared castVerse | Medium | Yes |
| 2.4 | Server uses shared cast | Medium | Yes |
| 3.1 | Delegate all actions | High | Yes |
| 3.2 | Move triggers to shared | High | Yes |
| 3.3 | Final cleanup | Low | No |

---

## Success Criteria

1. **All 262 tests pass**
2. **Server GameEngine.js < 300 lines** (currently ~1400)
3. **No duplicate function implementations**
4. **All cards with targeting use `selection` config**
5. **SP and MP use identical game logic from shared/**
6. **New cards = just add to shared/cards.js, no code changes**

---

## Risk Mitigation

- **Incremental:** Each phase is independently deployable
- **Tests first:** Run tests after each change
- **MP testing:** Manual test after each phase
- **Git branches:** Can revert if needed
