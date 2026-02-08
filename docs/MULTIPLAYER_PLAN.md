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

### Phase 1: Mode Selection (BEFORE Deck Select)

```
┌─────────────────────────────────────────────────────────────────┐
│  MODE SELECT (Title Screen)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         [Play vs AI]       [Play vs Friend]                    │
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

1. **Mode first:** Player chooses AI or Friend
2. **If Friend:** Create/Join room, exchange code, wait for connection
3. **Then deck select:** Both players pick decks (opponent's deck HIDDEN)
4. **Ready check:** "Waiting for opponent's deck..."
5. **Coin flip:** Determines first player
6. **Game starts:** Decks revealed only as cards are played

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
   - Show reconnect countdown (30s)
   - Options: [Wait for Reconnect] / [Leave Game]
   - If timeout expires: "Opponent forfeited"

2. **Reconnection:**
   - Store game state in sessionStorage
   - Allow rejoin with same room code within 30s timeout
   - On reconnect: sync full state, resume game

3. **Rematch flow:**
   - Game end → [Rematch] / [Leave]
   - If Rematch: return to deck select (same room stays connected)
   - Both players can pick new decks
   - Ready check → new coin flip → new game

4. **Desync detection:**
   - Periodic state hash comparison
   - If mismatch, host sends full state sync

5. **Animations:**
   - Guest plays animations based on received actions
   - May need slight delay for sync

6. **Mobile considerations:**
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

## Design Decisions (Confirmed)

1. **PeerJS hosting:** Use free cloud tier (P2P, low traffic expected). Self-host only if limits hit.

2. **Deck visibility:** Hidden until cards are played (adds strategy).

3. **Disconnect handling:** Show reconnect window (30s timeout), not auto-forfeit.

4. **Rematch flow:** Same room stays connected → return to deck select → both can pick new decks.

5. **Mode selection:** Happens BEFORE deck select (title screen).

## Open Questions

1. ~~**Turn timer?**~~ → Yes, 60s per turn

2. **Slow connection handling?** Action timeout? Retry logic?

---

## Edge Cases & Solutions

### Network Edge Cases

| Case | Solution |
|------|----------|
| NAT traversal fails | Show error, suggest different network |
| Slow connection lag | Show "Syncing..." indicator |
| Disconnect mid-action | Pause game, start 30s reconnect timer |
| Page refresh mid-game | Reconnect via sessionStorage state |

### Game-Specific Edge Cases

**Target Selection (Ignite, Banish, Soul Siphon):**
```
1. Player casts targeting spell
2. Opponent sees "Opponent is choosing target..."
3. Player selects target → sends to host
4. Host validates → executes → syncs result
5. Both see animation
```

**Deck Sync (Host generates both):**
```
1. Both players select deck IDs
2. Host shuffles BOTH decks (uses crypto.getRandomValues)
3. Host sends guest's shuffled deck (card order only, not contents)
4. Cards revealed as drawn (opponent sees "Drew 1 card")
```

**Trigger Modal Sync:**
```
1. Host detects trigger → sends { type: 'trigger', cardId, abilityName }
2. Both clients show modal simultaneously
3. Modal auto-dismisses after same timeout
4. Then effect resolves
```

**Complex Trigger Chains:**
```
1. Host resolves ENTIRE chain locally
2. Host sends sequence of events to guest
3. Guest plays back animations in order
4. Final state sync after chain completes
```

### Abuse Prevention

| Abuse | Prevention |
|-------|------------|
| Rage quit | Forfeit after 30s timeout |
| Stalling | 60s turn timer, auto-end turn |
| Modified client | Host validates ALL actions |
| Fake actions | Reject invalid state transitions |

### UI/UX Edge Cases

| Case | Solution |
|------|----------|
| Room code taken | Auto-regenerate new code |
| Wrong code | "Room not found" with retry |
| Mirror match | Allowed (both pick same deck) |
| Copy room code | One-tap copy button |
