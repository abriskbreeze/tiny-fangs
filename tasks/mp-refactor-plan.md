# Multiplayer Refactor: Host as Source of Truth

## Problem Statement
Current architecture has both host and guest maintaining independent `state.G`, with sync + perspective swap. This causes:
- Desync bugs (hash mismatches)
- Perspective swap errors (guest's me/opp confused)
- Race conditions between actions and syncs
- Complex debugging across two state machines

## Goal
**Host is the single source of truth. Guest is a view layer.**

## Success Criteria
1. ✅ All tests pass (262 tests)
2. ✅ Host can summon, attack, end turn - guest sees updates immediately
3. ✅ Guest can summon, attack, end turn - host processes, syncs back
4. ✅ No DESYNC errors in logs
5. ✅ Both players see correct creatures in correct positions
6. ✅ No perspective swap bugs

---

## Architecture Diagrams

### Current (Broken) Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HOST                              GUEST                        │
│  ┌──────────────┐                  ┌──────────────┐             │
│  │ state.G      │                  │ state.G      │             │
│  │ - me (host)  │    SYNC          │ - me (guest) │             │
│  │ - opp(guest) │ ───────────────► │ - opp (host) │             │
│  └──────────────┘  (host persp.)   └──────────────┘             │
│        │                                  │                     │
│        │ getMinimalState()        applyStateSync()              │
│        │ (me/opp as host sees)    (SWAP me↔opp)  ◄── BUG HERE!  │
│        │                                  │                     │
│        │           ACTION                 │                     │
│        │ ◄───────────────────────────────┤                     │
│        │                                  │                     │
│  validateAndExecuteAction()        (guest also modifies        │
│  (modifies state.G.opp)             state.G.me locally)        │
│                                           ▲                     │
│                                           │                     │
│                                     BUG: Guest state            │
│                                     diverges from host!         │
└─────────────────────────────────────────────────────────────────┘
```

### New Architecture (Host as Truth)
```
┌─────────────────────────────────────────────────────────────────┐
│                        NEW FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HOST (Source of Truth)            GUEST (View Layer)          │
│  ┌──────────────┐                  ┌──────────────┐             │
│  │ state.G      │                  │ state.G      │             │
│  │ - host (me)  │ getStateForGuest │ - me (guest) │             │
│  │ - guest(opp) │ ───────────────► │ - opp (host) │             │
│  └──────────────┘  (PRE-SWAPPED)   └──────────────┘             │
│        │                                  │                     │
│        │ Host swaps BEFORE         Guest applies                │
│        │ sending (no swap          DIRECTLY                     │
│        │ needed on guest)          (no swap)                    │
│        │                                  │                     │
│        │           ACTION                 │                     │
│        │ ◄───────────────────────────────┤                     │
│        │                                  │                     │
│  validateAndExecuteAction()        Guest does NOT modify       │
│  (ALL game logic here)             local state - just sends    │
│        │                           action and waits for sync   │
│        │                                  │                     │
│        └─── SYNC (pre-swapped) ──────────►│                     │
│                                           │                     │
│                                     applyStateSync()            │
│                                     (direct apply, no swap)     │
└─────────────────────────────────────────────────────────────────┘
```

### Message Flow Diagram
```
┌──────────┐                                    ┌──────────┐
│   HOST   │                                    │  GUEST   │
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │ ◄──────── {action: 'summon', uid} ───────────┤
     │                                               │
     │  validateAndExecuteAction()                   │
     │  - Find card in guest's hand                  │
     │  - Validate mana, slot                        │
     │  - Add to guest.active                        │
     │  - Run onSummon triggers                      │
     │                                               │
     │ ────────── {type: 'sync', state} ───────────► │
     │            (state PRE-SWAPPED:                │
     │             me=guest, opp=host)               │
     │                                               │
     │                                    applyStateSync()
     │                                    - Direct merge
     │                                    - render()
     │                                               │
     ▼                                               ▼
```

---

## Implementation Tasks

### Task 1: Create `getStateForGuest()` function
**File:** index.html (around line 3283)
**Action:** New function that returns state already swapped for guest perspective

```javascript
function getStateForGuest() {
  if (!state.G) return null;
  
  return {
    turn: state.G.turn,
    myTurn: !state.G.myTurn,  // Flip for guest
    me: sanitizePlayer(state.G.opp, true),   // Guest's me = host's opp
    opp: sanitizePlayer(state.G.me, false),  // Guest's opp = host's me
    log: state.G.log.slice(-20),
    winner: state.G.winner,
    firstTurn: state.G.firstTurn,
  };
}
```

**Verify:** Log output shows me/opp correctly swapped

---

### Task 2: Update `applyStateSync()` - Remove swap logic
**File:** index.html (line 3314)
**Action:** Guest applies state directly without swap

```javascript
async function applyStateSync(syncState) {
  if (!state.G || state.G.mode !== 'multiplayer' || state.G.isHost) return;
  
  // Direct apply - host already sent in guest's perspective
  state.G.turn = syncState.turn;
  state.G.myTurn = syncState.myTurn;  // Already correct for guest
  state.G.winner = syncState.winner;
  state.G.firstTurn = syncState.firstTurn;
  
  // Direct merge - no swap needed
  mergePlayerState(state.G.me, syncState.me, true);
  mergePlayerState(state.G.opp, syncState.opp, false);
  
  // ... rest of function
}
```

**Verify:** Guest's me.active matches what host intended

---

### Task 3: Update all host sync sends to use `getStateForGuest()`
**File:** index.html
**Locations:**
- Line 4098: After validateAndExecuteAction
- Line 4244: handleSyncRequest
- Line 7627: After endTurn
- Any other `multiplayer.send({ type: MP_MSG.SYNC, state: getMinimalState() })`

**Action:** Replace `getMinimalState()` with `getStateForGuest()`

**Verify:** All syncs use the new function

---

### Task 4: Simplify guest action handlers
**File:** index.html
**Functions:** summonCreature, castVerse, setVerse, doAttack, doRetreat

**Action:** Guest handlers should:
1. Send action message
2. Return immediately (don't modify local state)
3. Wait for sync from host

Example for summonCreature:
```javascript
async function summonCreature(c) {
  // ... validation ...
  
  if (state.G.mode === 'multiplayer' && !state.G.isHost) {
    // Guest: Just send action, host will process and sync
    multiplayer.send({
      type: MP_MSG.ACTION,
      action: 'summon',
      cardUid: c.uid
    });
    log(`Summoning ${c.name}...`);
    return;  // Wait for sync
  }
  
  // Host: Execute locally (existing code)
  // ...
}
```

**Verify:** Guest actions only send messages, no local state changes

---

### Task 5: Update hash computation for consistency
**File:** index.html (line ~4106)
**Action:** Both sides should compute hash from same perspective

Since guest now has state in their perspective, hash should use me/opp directly:
```javascript
function computeStateHash() {
  const hashData = {
    turn: state.G.turn,
    me: { lp, mana, activeUid, handSize, benchCount },
    opp: { lp, mana, activeUid, benchCount }
  };
  // ...
}
```

**Verify:** Hashes match after sync

---

### Task 6: Update game start for guest
**File:** index.html (startGame function)
**Action:** Guest should receive initial state from host, not create independently

Current: Both sides call `mkPlayer()` with deck shuffle
New: Host creates both, sends guest's initial state in first sync

**Verify:** Guest starts with correct state matching host

---

## Testing Plan

1. **Basic Flow Test:**
   - Host creates room, guest joins
   - Host summons creature, ends turn
   - Guest should see opponent's creature
   - Guest summons creature, ends turn
   - Host should see opponent's creature

2. **Attack Test:**
   - Both have active creatures
   - Guest attacks
   - Both should see damage/KO correctly

3. **Reconnection Test:**
   - Mid-game disconnect
   - Reconnect should restore correct state

4. **Hash Check:**
   - After each turn, hashes should match
   - No DESYNC warnings

---

## Rollback Plan
If refactor causes issues, revert to v0.4.63 commit: `b5e6aa2`

---

## Notes
- Keep `getMinimalState()` for backward compatibility/debugging
- Add `[MP-REFACTOR]` log prefix to new code for easy filtering
- Run full test suite after each task
