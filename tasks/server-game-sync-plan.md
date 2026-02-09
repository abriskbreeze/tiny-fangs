# Server Game Sync Implementation Plan

## Overview

Complete the server-based multiplayer by wiring GameEngine to WebSocket handlers and updating client to send actions to server instead of executing locally.

**Current State:**
- ✅ Server: Room create/join/leave
- ✅ Server: GameEngine.js with action validation + events
- ✅ Client: WebSocket connection + room UI
- ❌ Server: Game state management per room
- ❌ Server: Action message handlers
- ❌ Client: Send actions to server
- ❌ Client: Render from server state + animate from events

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js)                            │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   Rooms     │    │   GameEngine     │    │   WebSocket      │   │
│  │  Map<code,  │───▶│  - createGame()  │◀───│   Handlers       │   │
│  │    Room>    │    │  - executeAction │    │                  │   │
│  │             │    │  - endTurn()     │    │  - deckSelect    │   │
│  │  Room:      │    │  - getStateFor() │    │  - action        │   │
│  │  - players[]│    └──────────────────┘    │  - endTurn       │   │
│  │  - gameState│                            └──────────────────┘   │
│  │  - status   │                                     │              │
│  └─────────────┘                                     │              │
│         ▲                                            │              │
│         │                  ┌─────────────────────────┘              │
│         │                  ▼                                        │
│  ┌──────┴──────────────────────────────────────┐                   │
│  │              BROADCAST                       │                   │
│  │   { type, state, events }                   │                   │
│  └──────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│   CLIENT (P1)       │             │   CLIENT (P2)       │
│                     │             │                     │
│  state ← server     │             │  state ← server     │
│  events → animate   │             │  events → animate   │
│  click → action msg │             │  click → action msg │
└─────────────────────┘             └─────────────────────┘
```

---

## Message Protocol

### Client → Server

```javascript
// Deck selection (after room joined)
{ type: 'deckSelect', deckId: 'shadow' }

// Game actions
{ type: 'action', action: { action: 'summon', cardUid: 'xxx', target: 'active' } }
{ type: 'action', action: { action: 'attack' } }
{ type: 'action', action: { action: 'cast', cardUid: 'xxx' } }
{ type: 'action', action: { action: 'set', cardUid: 'xxx' } }
{ type: 'action', action: { action: 'retreat', benchIdx: 0 } }

// End turn
{ type: 'endTurn' }
```

### Server → Client

```javascript
// Waiting for opponent deck
{ type: 'waitingForOpponent' }

// Game start (both decks selected)
{ 
  type: 'gameStart', 
  state: { ... },     // getStateForPlayer() output
  yourTurn: true/false,
  coinFlip: { winner: 'p1'|'p2', you: 'p1'|'p2' }
}

// State update (after any action)
{ 
  type: 'stateUpdate', 
  state: { ... },     // getStateForPlayer() output
  events: [           // For animations
    { type: 'summon', side: 'p1', creature: 'Duskfang', slot: 'active' },
    { type: 'damage', side: 'p2', amount: 30 },
    { type: 'ko', side: 'p2', creature: 'Gloom' }
  ]
}

// Turn change
{ type: 'turnChange', yourTurn: true/false }

// Game over
{ type: 'gameOver', winner: 'p1'|'p2', reason: 'LP depleted'|'Deck out' }

// Error
{ type: 'error', message: 'Not your turn' }
```

---

## Event Types for Animation

```javascript
// Creature events
{ type: 'summon', side: 'p1'|'p2', creature: string, slot: 'active'|'bench' }
{ type: 'attack', side: 'p1'|'p2', damage: number }
{ type: 'damage', side: 'p1'|'p2', amount: number, source?: string }
{ type: 'heal', side: 'p1'|'p2', amount: number }
{ type: 'ko', side: 'p1'|'p2', creature: string }
{ type: 'retreat', side: 'p1'|'p2', from: string, to: string }

// Verse events
{ type: 'cast', side: 'p1'|'p2', verse: string }
{ type: 'setVerse', side: 'p1'|'p2', verse: string }
{ type: 'triggerVerse', side: 'p1'|'p2', verse: string }

// Player events
{ type: 'draw', count: number }
{ type: 'discard', side: 'p1'|'p2', card: string }
{ type: 'lpDamage', side: 'p1'|'p2', amount: number }
{ type: 'manaGain', side: 'p1'|'p2', amount?: number }

// Status events
{ type: 'setStatus', side: 'p1'|'p2', status: 'poison'|'trapped'|null }
{ type: 'atkBonus', side: 'p1'|'p2', amount: number, source: string }

// Game flow
{ type: 'turnStart', yourTurn: boolean }
{ type: 'gameOver', winner: 'p1'|'p2', reason: string }
```

---

## Room States

```
┌────────────┐    join     ┌────────────┐   both decks   ┌────────────┐
│  WAITING   │ ──────────▶ │  READY     │ ────────────▶  │  PLAYING   │
│  (1 player)│             │ (2 players)│                │  (game on) │
└────────────┘             └────────────┘                └────────────┘
      │                          │                             │
      │ creator leaves           │ player leaves               │ game ends
      ▼                          ▼                             ▼
┌────────────┐             ┌────────────┐                ┌────────────┐
│  DELETED   │             │  WAITING   │                │  FINISHED  │
└────────────┘             │ (back to 1)│                └────────────┘
                           └────────────┘
```

---

## Implementation Steps

### Phase 1: Server Game State (server/index.js)

**Goal:** Room tracks game state, handles deck selection, starts game

```javascript
// Update Room class
class Room {
  constructor(code, creatorWs, creatorDeckId) {
    this.code = code;
    this.players = [{ ws: creatorWs, deckId: null, playerIdx: 0 }];
    this.status = 'waiting';  // waiting | ready | playing | finished
    this.gameState = null;
    this.createdAt = Date.now();
  }
  
  setDeck(ws, deckId) { ... }
  canStart() { return both decks selected }
  startGame() { this.gameState = createGame(...) }
}
```

**Verify:** 
- Create room → status = 'waiting'
- Join room → status = 'ready'
- Both select decks → game starts, both receive gameStart

### Phase 2: Server Action Handling (server/index.js)

**Goal:** Handle action/endTurn messages, broadcast state updates

```javascript
case 'action':
  const result = executeAction(room.gameState, playerIdx, message.action);
  if (result.error) {
    ws.send({ type: 'error', message: result.error });
  } else {
    // Broadcast to both players
    room.players.forEach(p => {
      const state = getStateForPlayer(result.state, p.playerIdx);
      p.ws.send({ type: 'stateUpdate', state, events: result.events });
    });
  }
  break;
```

**Verify:**
- Send action when not your turn → error
- Send valid action → both clients receive stateUpdate + events

### Phase 3: Client State Sync (index.html)

**Goal:** Replace local state with server state on updates

```javascript
// In handleServerMessage
case 'gameStart':
  state.G = convertServerState(msg.state);
  state.G.isMultiplayer = true;
  state.G.myTurn = msg.yourTurn;
  render();
  break;

case 'stateUpdate':
  state.G = convertServerState(msg.state);
  await playEvents(msg.events);  // Animate
  render();
  break;
```

**Key:** `convertServerState()` maps server format to existing client state format

**Verify:**
- Receive gameStart → game screen shows with correct state
- Receive stateUpdate → state updates, animations play

### Phase 4: Client Action Sending (index.html)

**Goal:** In multiplayer mode, send actions to server instead of executing locally

```javascript
// Modify existing action handlers
async function summonCreature(cardUid, target) {
  if (state.G.isMultiplayer) {
    ws.send(JSON.stringify({ 
      type: 'action', 
      action: { action: 'summon', cardUid, target } 
    }));
    return;  // Server will send stateUpdate
  }
  // ... existing local logic
}
```

**Actions to wrap:**
- summonCreature() → { action: 'summon', cardUid, target }
- doAttack() → { action: 'attack' }
- castVerse() → { action: 'cast', cardUid }
- setVerse() → { action: 'set', cardUid }
- doRetreat() → { action: 'retreat', benchIdx }
- endTurn() → { type: 'endTurn' }

**Verify:**
- Click attack in MP → sends to server → both clients animate

### Phase 5: Event Animation (index.html)

**Goal:** Play animations from server events array

```javascript
async function playEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'summon':
        await Anim.summon(e.side === 'p1' ? 'me' : 'opp', e.slot);
        break;
      case 'damage':
        await Anim.damage(e.side === 'p1' ? 'me' : 'opp', e.amount);
        break;
      case 'ko':
        await Anim.ko(e.side === 'p1' ? 'me' : 'opp');
        break;
      // ... etc
    }
  }
}
```

**Key mapping:** Server uses `p1`/`p2`, client uses `me`/`opp` based on which player you are

**Verify:**
- P1 attacks → both clients see attack animation
- P2 sees hit animation on their creature

---

## Edge Cases

### Disconnect Mid-Game
- Notify remaining player: `{ type: 'opponentLeft' }`
- Keep room for 2 minutes (allow reconnect)
- After timeout: declare remaining player winner or draw

### Invalid Actions
- Server validates everything
- Return error, don't modify state
- Client should disable buttons during opponent's turn

### Turn Timeout (Future)
- Server tracks turn start time
- After 60s, auto-end turn
- Send warning at 45s

### Reconnection (Future)
- Store player ID in localStorage
- On reconnect: send playerId + roomCode
- Server restores session, sends current state

---

## Success Criteria

1. ✅ Two players can create/join room
2. □ Both select decks → game starts
3. □ P1 summons creature → both see it
4. □ P1 attacks → P2 sees damage animation
5. □ Turn switches properly
6. □ Game ends when LP = 0
7. □ Disconnect shows "opponent left"

---

## File Changes Summary

| File | Changes |
|------|---------|
| `server/index.js` | Add deck select handler, action handler, game state to Room |
| `index.html` | Add state sync, action sending, event animation |
| `server/GameEngine.js` | Minor: ensure all events have side field |

---

## Assumptions

1. **No spectators** — only 2 players per room
2. **No reconnection yet** — disconnect = opponent left
3. **No turn timer yet** — players take as long as needed
4. **Trust client deck selection** — no server-side deck validation
5. **Server events are complete** — client doesn't need to infer animations

---

## Questions / Tradeoffs

**Q: Should client maintain any local state?**
A: Yes, for UI responsiveness. Show card moving immediately, but wait for server to confirm. On error, revert.

**Q: How to handle animation timing?**
A: Server sends events in order. Client plays them sequentially with existing `ANIM_TIMING` delays.

**Q: What if events array is huge?**
A: Batch related events (e.g., AoE damage). Max ~10 events per action typically.
