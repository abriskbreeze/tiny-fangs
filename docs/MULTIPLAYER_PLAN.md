# Tiny Fangs: 1v1 Multiplayer Implementation Plan

## Overview

Add peer-to-peer multiplayer using WebRTC (via PeerJS) with room codes for matchmaking.

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTIPLAYER ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Player A                          Player B                     │
│  ┌─────────┐     PeerJS Cloud     ┌─────────┐                  │
│  │  Host   │◄────────────────────►│  Guest  │                  │
│  │ (Room)  │    Signaling Only    │ (Join)  │                  │
│  └────┬────┘                      └────┬────┘                  │
│       │         Direct P2P             │                        │
│       └────────────────────────────────┘                        │
│              WebRTC Data Channel                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why PeerJS?

1. **No server required** — Uses PeerJS cloud for signaling (free tier: 10k connections/month)
2. **Simple API** — Hides WebRTC complexity
3. **Room codes** — Peer IDs can be custom (e.g., "FANGS-ABCD")
4. **Reliable** — Supports both reliable (ordered) and unreliable data channels
5. **Small** — ~60KB gzipped

Alternative considered: Socket.io (requires server), raw WebRTC (complex)

---

## Game Flow

### Phase 1: Matchmaking (Pre-Game)

```
┌─────────────────────────────────────────────────────────────────┐
│  DECK SELECT SCREEN                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Play vs AI]    [Play vs Friend]                              │
│                                                                 │
│  If "Play vs Friend":                                          │
│  ┌─────────────────────────────────────┐                       │
│  │  [Create Room]  or  [Join Room]     │                       │
│  │                                     │                       │
│  │  Create: Shows code "FANGS-WXYZ"    │                       │
│  │  Join: Enter code [____-____]       │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Connection & Deck Selection

1. Host creates room → generates 4-letter code (e.g., "FANGS-ABCD")
2. Guest enters code → connects via PeerJS
3. Both players select decks
4. Host sees "Waiting for opponent's deck..."
5. When both ready, coin flip determines first player
6. Game starts with synchronized state

### Phase 3: Gameplay Sync

**Message Types:**
```js
// Action messages (player → opponent)
{ type: 'action', action: 'summon', cardUid: '...', target: 'active' }
{ type: 'action', action: 'attack' }
{ type: 'action', action: 'cast', cardUid: '...', selection: {...} }
{ type: 'action', action: 'endTurn' }

// State sync (host → guest, periodic)
{ type: 'sync', state: {...}, turn: 5 }

// Control messages
{ type: 'ready', deckId: 'venom' }
{ type: 'coinFlip', result: 'heads', hostFirst: true }
{ type: 'rematch' }
{ type: 'disconnect' }
```

---

## Architecture Decisions

### 1. Host Authority Model

**Host is source of truth.** Guest sends actions, host validates and broadcasts results.

```
Guest: "I play Sundew Queen"
  ↓
Host: Validates (has card? enough mana? legal target?)
  ↓
Host: Executes action, updates state
  ↓
Host: Sends result to guest
  ↓
Both: Render updated state
```

**Why?** Prevents cheating, simplifies conflict resolution, matches existing single-player flow.

### 2. Action-Based Sync (Not State Sync)

Send **actions**, not full state. State syncs are periodic backups.

**Pros:**
- Lower bandwidth
- Smoother animations (guest can animate immediately)
- Less cheating surface

**Cons:**
- Need to handle desync detection
- More complex action validation

### 3. Turn Enforcement

Only current player can send actions. Opponent's actions are queued/rejected.

```js
if (message.type === 'action' && !isYourTurn) {
  console.warn('Action from wrong player, ignoring');
  return;
}
```

---

## Implementation Phases

### Phase 1: Core Networking (src/multiplayer.js)

```js
// New module: src/multiplayer.js
import Peer from 'peerjs';

class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomCode = null;
    this.onMessage = null;
    this.onConnect = null;
    this.onDisconnect = null;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O (ambiguous)
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `FANGS-${code}`;
  }

  async createRoom() {
    this.roomCode = this.generateRoomCode();
    this.isHost = true;
    
    this.peer = new Peer(this.roomCode, {
      // Optional: Use own PeerJS server for production
      // host: 'your-peerjs-server.com',
      // port: 9000
    });

    return new Promise((resolve, reject) => {
      this.peer.on('open', () => resolve(this.roomCode));
      this.peer.on('error', reject);
      
      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupConnection();
      });
    });
  }

  async joinRoom(code) {
    this.roomCode = code;
    this.isHost = false;
    
    this.peer = new Peer(); // Anonymous peer
    
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => {
        this.conn = this.peer.connect(code, { reliable: true });
        this.setupConnection();
        this.conn.on('open', resolve);
        this.conn.on('error', reject);
      });
      this.peer.on('error', reject);
    });
  }

  setupConnection() {
    this.conn.on('data', (data) => {
      if (this.onMessage) this.onMessage(data);
    });
    
    this.conn.on('close', () => {
      if (this.onDisconnect) this.onDisconnect();
    });
    
    if (this.onConnect) this.onConnect();
  }

  send(message) {
    if (this.conn && this.conn.open) {
      this.conn.send(message);
    }
  }

  disconnect() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}

export const multiplayer = new MultiplayerManager();
```

### Phase 2: UI Changes (index.html)

1. Add "Play vs Friend" button on deck select
2. Add room code modal (create/join)
3. Add waiting screen ("Waiting for opponent...")
4. Add connection status indicator during game
5. Add disconnect handling (forfeit or pause)

### Phase 3: Game Integration

**Key changes to existing code:**

1. **New game mode flag:**
```js
state.G.mode = 'ai' | 'multiplayer';
state.G.isHost = true | false;
state.G.opponentReady = false;
```

2. **Wrap player actions to send over network:**
```js
async function playCard(card, target) {
  if (state.G.mode === 'multiplayer') {
    multiplayer.send({ type: 'action', action: 'play', cardUid: card.uid, target });
    if (!state.G.isHost) {
      // Guest waits for host to validate and sync
      return;
    }
  }
  // Execute locally (host or AI mode)
  await executePlayCard(card, target);
}
```

3. **Message handler:**
```js
multiplayer.onMessage = async (msg) => {
  switch (msg.type) {
    case 'action':
      if (state.G.isHost) {
        // Validate and execute
        await executeAction(msg);
        // Send result back
        multiplayer.send({ type: 'sync', state: getMinimalState() });
      } else {
        // Guest: apply host's state update
        applyStateSync(msg);
      }
      break;
    case 'sync':
      if (!state.G.isHost) {
        applyStateSync(msg.state);
      }
      break;
    // ... other message types
  }
};
```

### Phase 4: Edge Cases & Polish

1. **Disconnection handling:**
   - Mid-game disconnect → "Opponent disconnected" modal
   - Options: Wait (30s timeout), Claim Victory, Rematch

2. **Reconnection:**
   - Store game state in sessionStorage
   - Allow rejoin with same room code within timeout

3. **Desync detection:**
   - Periodic state hash comparison
   - If mismatch, host sends full state sync

4. **Animations:**
   - Guest plays animations based on received actions
   - May need slight delay for sync

5. **Mobile considerations:**
   - Room code input: auto-uppercase, no special chars
   - Copy/paste room code button

---

## File Changes Summary

```
src/
├── multiplayer.js      # NEW: PeerJS wrapper, room management
├── state.js            # MODIFY: Add multiplayer flags
├── game.js             # MODIFY: Add network action wrappers
└── ...

index.html              # MODIFY: Add multiplayer UI, message handling

package.json            # MODIFY: Add peerjs dependency
```

## Dependencies

```json
{
  "dependencies": {
    "peerjs": "^1.5.2"
  }
}
```

Or use CDN:
```html
<script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PeerJS cloud limits | Can't create rooms | Self-host PeerJS server ($5/mo VPS) |
| NAT traversal fails | Some users can't connect | Add TURN server fallback |
| State desync | Game becomes unplayable | Periodic full state sync |
| Cheating | Ruins experience | Host authority + server validation (future) |
| Mobile disconnect | Loses game | Reconnection + state persistence |

---

## Estimated Effort

| Phase | Description | Estimate |
|-------|-------------|----------|
| 1 | Core networking module | 2-3 hours |
| 2 | UI (room code, waiting screen) | 2-3 hours |
| 3 | Game integration (action sync) | 4-6 hours |
| 4 | Edge cases & polish | 3-4 hours |
| **Total** | | **11-16 hours** |

---

## Future Enhancements

1. **Ranked matchmaking** — Server-based queue, ELO ratings
2. **Spectator mode** — Third peer watches game
3. **Tournament mode** — Bracket system
4. **Replay system** — Record and share games
5. **Cross-platform** — PWA for mobile, potential native apps

---

## Questions Before Implementation

1. **Self-host PeerJS?** Free tier is 10k connections/month. Enough for testing, but may need own server for production.

2. **Handle slow connections?** Turn timer? Action timeout?

3. **Rematch flow?** Same room or new code?

4. **Deck reveal timing?** Show opponent's deck at game start or keep hidden until played?
