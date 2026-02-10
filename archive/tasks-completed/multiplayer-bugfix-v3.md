# Multiplayer Bug Fix Plan v3

## Bugs Identified

### Bug 1: Ignite deals 30 damage (should be 15)
**Location:** `server/GameEngine.js` line 980
**Root cause:** Hardcoded wrong value
```javascript
const ko = applyDamage(target, 30);  // WRONG
events.push({ type: 'damage', side: oppSide, amount: 30, target: target.name });  // WRONG
```
**Fix:** Change to 15

### Bug 2: KO/damage animations appear center screen
**Location:** `src/anim.js` lines 67-70
**Root cause:** `floatText` falls back to center when `targetEl.offsetParent === null`
- In multiplayer, state updates before animations
- Element might not exist or be in wrong position when animation plays
**Fix:** Pass element reference from event, or cache element position before state update

### Bug 3: No LP damage animation
**Location:** `index.html` serverEventHandlers
**Root cause:** lpDamage event handler exists (line 3112) but may not receive correct side parameter
**Check:** Verify server sends correct `side` with lpDamage events

### Bug 4: Last Breath triggers multiple times at full HP
**Location:** `server/GameEngine.js` lines 336-344
**Current logic:**
```javascript
case 'lastBreath':
  if (!owner.usedLastBreath && owner.lp === 1) {
    negated = true;
    owner.usedLastBreath = true;
```
**Root cause:** `onLifeLoss` trigger called multiple times
**Check:** Find all calls to `checkTriggers('onLifeLoss', ...)`

### Bug 5: Deck/hand counts not working
**Location:** `index.html` render function (~line 4099)
**Root cause:** Uses `state.G.opp.deck.length` but in multiplayer `deck = []`
```javascript
// Line 4099 - BROKEN in multiplayer
$('d-opp-deck').textContent = state.G.opp.deck.length;  // Always 0!
```
**Fix:** Use `deckCount` if available:
```javascript
$('d-opp-deck').textContent = state.G.opp.deckCount ?? state.G.opp.deck.length;
$('d-me-deck').textContent = state.G.me.deckCount ?? state.G.me.deck.length;
// Same for hand count
```

## Implementation

### Fix 1: Ignite damage
```javascript
// server/GameEngine.js ~line 980
const ko = applyDamage(target, 15);  // Changed from 30
events.push({ type: 'damage', side: oppSide, amount: 15, target: target.name });
```

### Fix 5: Deck/hand counts
```javascript
// index.html render function
// For deck count:
const myDeckCount = state.G.me.deckCount ?? state.G.me.deck?.length ?? 0;
const oppDeckCount = state.G.opp.deckCount ?? state.G.opp.deck?.length ?? 0;
$('d-me-deck').textContent = myDeckCount;
$('d-opp-deck').textContent = oppDeckCount;

// For hand count (opponent only in multiplayer):
const oppHandCount = state.G.opp.handCount ?? state.G.opp.hand?.length ?? 0;
$('d-opp-hand-count').textContent = oppHandCount;
```

## Success Criteria
- [ ] Ignite deals exactly 15 damage
- [ ] Damage numbers appear over creatures, not center
- [ ] LP damage has animation
- [ ] Last Breath only triggers when at 1 LP
- [ ] Deck counts show correct numbers
- [ ] Hand count shows for opponent
