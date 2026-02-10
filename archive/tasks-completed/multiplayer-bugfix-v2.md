# Multiplayer Bug Fix Plan v2

**Following Karpathy Guidelines: Root cause analysis, surgical fixes, verifiable success criteria**

---

## Bugs Identified

1. **Mana Bug (P2 gets 2 mana)** - Server wasn't restarted after fix ✅ FIXED (just restarted)
2. **Double Damage** - Abilities/verses doing 2x damage (e.g., Phantom Wall 20 instead of 10)
3. **Vengeance Not Prompting** - Optional triggers fire automatically without player choice
4. **Animation Desync** - Animations not matching game state

---

## Bug 2: Double Damage

### Root Cause Analysis

**Hypothesis 1:** Trigger executing twice
- `checkTriggers` checks BOTH defender's AND attacker's set verse
- If both had Phantom Wall, it would trigger twice
- **Unlikely** - players rarely have same verse set

**Hypothesis 2:** Animation playing twice
- Multiple stateUpdate messages with same events
- Client plays animations for each update
- **More likely** - logs show rapid stateUpdates

**Hypothesis 3:** Shared module conflict
- Server imports from shared/
- If shared/effects.js also processes damage...
- **Checked** - shared/effects.js doesn't have phantomWall

### Investigation Needed

```javascript
// In server/GameEngine.js, add logging:
case 'phantomWall':
  console.log('PHANTOM WALL TRIGGERED - dealing 10 damage');
  // ...
```

### Fix

If animation doubling:
```javascript
// In index.html, deduplicate events by uid or hash
async function playServerEvents(events) {
  const seen = new Set();
  for (const e of events) {
    const key = JSON.stringify(e);
    if (seen.has(key)) continue;
    seen.add(key);
    // ... play animation
  }
}
```

---

## Bug 3: Vengeance Not Prompting

### Root Cause

The `triggerDef.optional: true` flag in card definitions is ignored. Server executes triggers immediately without checking if player wants to activate.

**Location:** `server/GameEngine.js` lines 358-393

**Current behavior:**
```javascript
if (defenderVerse && matchesTrigger(defenderVerse, event)) {
  // Executes immediately - no optional check!
  const result = executeTrigger(defenderVerse, ...);
}
```

**Required behavior:**
- Check if verse has `optional: true`
- If so, return `pendingAction` to prompt player (like Skitter swap)
- Only execute trigger if player confirms

### Fix

```javascript
function checkTriggers(event, context, activePlayer, inactivePlayer, activeSide, inactiveSide) {
  // ...
  
  // Check if this is an optional trigger
  const defenderVerse = inactivePlayer.setVerse;
  if (defenderVerse && matchesTrigger(defenderVerse, event)) {
    const verseTemplate = VERSES[defenderVerse.id];
    
    if (verseTemplate.triggerDef?.optional) {
      // Return pending action - don't execute yet
      return {
        events: [],
        negated: false,
        pendingAction: {
          type: 'optionalTrigger',
          side: inactiveSide,
          verse: defenderVerse,
          context: context
        }
      };
    }
    
    // Non-optional - execute immediately
    const result = executeTrigger(...);
    // ...
  }
}
```

Also need client-side handler for `optionalTrigger` pending action to show modal.

### Success Criteria
- Vengeance prompts: "Activate Vengeance? Survive at 1 HP, destroy attacker"
- Player can decline optional triggers
- Trigger only fires if confirmed

---

## Bug 4: Animation Desync

### Root Cause

State updates arrive faster than animations complete. Even with queue, the visual state can look wrong because:

1. State is updated immediately
2. Animations play on already-updated DOM
3. For KOs, creature already gone when animation plays

### Fix

For KO-type events, need to preserve element until animation completes:

```javascript
const serverEventHandlers = {
  ko: async (e, side) => {
    // Get element BEFORE it's removed from DOM
    const activeCard = document.querySelector(`#${side}-active .active-card`);
    
    // Play KO animation
    await Anim.ko(side);
    
    // Element already removed by state update - that's OK
  },
  // ...
};
```

Or: Clone element before state update, animate clone, remove clone after.

### Alternative Fix

Delay state update for specific event types:

```javascript
async function processUpdate(serverState, events, pendingAction) {
  // Separate events into "animate before update" and "animate after update"
  const preUpdateEvents = events.filter(e => ['ko', 'damage', 'attack'].includes(e.type));
  const postUpdateEvents = events.filter(e => ['summon', 'draw', 'manaGain'].includes(e.type));
  
  // For KO/damage - animate first, then update
  if (preUpdateEvents.length > 0) {
    await playServerEvents(preUpdateEvents);
  }
  
  // Update state
  state.G = convertServerState(serverState);
  render();
  
  // For summon/draw - animate after (elements now exist)
  if (postUpdateEvents.length > 0) {
    await playServerEvents(postUpdateEvents);
  }
}
```

---

## Implementation Order

1. ✅ Restart server (mana fix)
2. Add debug logging for double damage investigation
3. Implement optional trigger pending action
4. Fix animation timing for different event types

## Verification

- [ ] P2 starts with 1 mana on first turn
- [ ] Phantom Wall deals exactly 10 damage
- [ ] Vengeance prompts before activating
- [ ] KO animations play before creature disappears
