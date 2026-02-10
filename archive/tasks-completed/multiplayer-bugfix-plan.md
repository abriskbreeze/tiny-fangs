# Multiplayer Bug Fix Plan

## Bug 1: P2 Starts with 2 Mana ❌

**Location:** `server/GameEngine.js` lines ~1429-1438

**Root Cause:** Flag mutated before being read for condition.

```javascript
state.firstTurn = false;        // ← Set to false FIRST
// ...
if (!state.firstTurn) {         // ← Always true now
  nextPlayer.maxMana = Math.min(5, nextPlayer.maxMana + 1);
}
nextPlayer.mana = nextPlayer.maxMana;  // P2 incorrectly gets 2 mana
```

**Fix:** Capture flag before mutation:

```javascript
const wasFirstTurn = state.firstTurn;  // Capture BEFORE
state.firstTurn = false;
// ...
if (!wasFirstTurn) {                   // Use saved value
  nextPlayer.maxMana = Math.min(5, nextPlayer.maxMana + 1);
}
```

**Verification:** P1 ends turn → P2 starts with 1 mana ✓

---

## Bug 2: Phantom Wall Doesn't Damage Attacker ❌

**Location:** `server/GameEngine.js` lines ~268-271

**Root Cause:** Hardcoded implementation only negates, missing damage effect.

**Card definition says:**
```javascript
// server/cards.js line 328
effects: [{ type: 'negateAttack' }, { type: 'damage', target: 'attacker', amount: 10 }]
```

**Current implementation:**
```javascript
case 'phantomWall':
  negated = true;  // ← Only negates, no damage!
  break;
```

**Compare to Spike Shield (which works correctly):**
```javascript
case 'spikeShield':
  if (context.attacker) {
    const ko = applyDamage(context.attacker, 15);
    events.push({ type: 'damage', side: enemySide, amount: 15, source: 'Spike Shield' });
    if (ko) {
      events.push({ type: 'ko', side: enemySide, creature: context.attacker.name });
      enemy.grave.push(context.attacker);
      enemy.active = null;
    }
  }
  break;
```

**Fix:** Add 10 damage to attacker in Phantom Wall case:

```javascript
case 'phantomWall':
  negated = true;
  // Deal 10 damage to attacker
  if (context.attacker) {
    const ko = applyDamage(context.attacker, 10);
    events.push({ type: 'damage', side: enemySide, amount: 10, source: 'Phantom Wall' });
    if (ko) {
      events.push({ type: 'ko', side: enemySide, creature: context.attacker.name });
      enemy.grave.push(context.attacker);
      enemy.active = null;
    }
  }
  break;
```

**Verification:** Opponent attacks → Phantom Wall triggers → Attack negated AND attacker takes 10 damage ✓

---

## Bug 3: Battle Log Doesn't Display ❌

**Location:** `index.html` function `updateFromServer()` (~line 2990-3030)

**Root Cause:** `render()` is called BEFORE `playServerEvents()`, but events add log entries. No render after events = log entries never displayed.

```javascript
// Line 3003: Render BEFORE animations
render();

// Line 3006-3008: Events add log entries via log()
if (events && events.length > 0) {
  await playServerEvents(events);  // ← log() called here, but no render after!
}

// Comment says "no need to render again" - but log needs it!
```

**Fix:** Call `renderLog()` after events are processed:

```javascript
if (events && events.length > 0) {
  await playServerEvents(events);
}

// Re-render log after events added entries
renderLog();
```

Using `renderLog()` instead of full `render()` avoids double animation issues.

**Verification:** Play multiplayer → Attacks/abilities/verses show in battle log ✓

---

## Bug 4: Animations Play Late (After KO Already Shown) ❌

**Location:** `index.html` function `updateFromServer()` (~line 2990-3010)

**Root Cause (Two-Part):**

1. **Immediate state overwrite:** State updated to FINAL before animations play
2. **Update pile-up:** Multiple `stateUpdate` messages arrive rapidly — each one calls `updateFromServer()` before previous animations finish

From logs:
```
📩 stateUpdate (3 events)
📩 turnChange
📩 stateUpdate (1 event)
📩 stateUpdate (7 events)  ← Big combo, state already overwritten 3x
```

```javascript
// Line 2997: Update to FINAL state (creatures already KO'd)
state.G = convertServerState(serverState);

// Line 3003: Render shows KO'd creatures immediately
render();

// Line 3006-3008: Animations play... but UI already shows end result!
// AND next stateUpdate can arrive mid-animation!
await playServerEvents(events);
```

**Fix:** Queue updates and process sequentially, deferring state until after animations:

```javascript
// Add update queue at module level
let updateQueue = [];
let processingQueue = false;

async function queueUpdate(serverState, events, pendingAction) {
  updateQueue.push({ serverState, events, pendingAction });
  if (!processingQueue) {
    processingQueue = true;
    while (updateQueue.length > 0) {
      const update = updateQueue.shift();
      await processUpdate(update.serverState, update.events, update.pendingAction);
    }
    processingQueue = false;
  }
}

async function processUpdate(serverState, events, pendingAction) {
  const oldLog = state.G?.log || [];
  
  if (!events || events.length === 0) {
    // No animations needed - update immediately
    state.G = convertServerState(serverState);
    state.G.log = oldLog;
    render();
  } else {
    // Render CURRENT state first (elements must exist for animations)
    render();
    
    // Play animations on current (pre-update) state
    await playServerEvents(events);
    
    // NOW update to final state and re-render
    state.G = convertServerState(serverState);
    state.G.log = oldLog;
    render();
  }
  
  renderLog();  // Also fixes Bug 3
  
  // ... rest (turn UI, game over check, pending actions)
}

// In message handler, replace updateFromServer() calls with queueUpdate()
```

**Verification:** Cindermaw attacks → animations play in order → THEN creatures show as KO'd ✓

---

## Implementation Order

1. **Bug 1 (Mana)** - Server-side, simple flag capture
2. **Bug 2 (Phantom Wall)** - Server-side, add damage logic  
3. **Bug 4 (Animation Timing)** - Client-side, defer state update until after animations
4. **Bug 3 (Battle Log)** - Included in Bug 4 fix with `renderLog()` call

All fixes are surgical with minimal code changes.
