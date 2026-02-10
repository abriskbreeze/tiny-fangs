# Optional Trigger Implementation (Vengeance Fix)

## Problem
Cards with `optional: true` in their triggerDef (like Vengeance) were firing automatically without prompting the player.

## Solution Implemented

### 1. Server-side: checkTriggers function (GameEngine.js ~line 359)
- Added `pendingAction` to return value
- Before executing a trigger, check if `verseTemplate?.triggerDef?.optional` is true
- If optional, return a `pendingAction` object instead of executing immediately:
  ```javascript
  {
    type: 'optionalTrigger',
    side: inactiveSide,
    verseId: defenderVerse.id,
    verseName: defenderVerse.name,
    prompt: `Activate ${defenderVerse.name}?`,
    context: { ...context }
  }
  ```
- Applied to both defender's verse and attacker's verse checks

### 2. Server-side: Attack handler (GameEngine.js ~line 641)
- Updated lethal damage check to handle `pendingAction`:
  ```javascript
  if (lethalTrigger.pendingAction) {
    return { state, events, pendingAction: lethalTrigger.pendingAction };
  }
  ```
- This pauses the attack before damage is applied

### 3. Client-side: handlePendingAction (index.html ~line 3065)
- Added handler for `optionalTrigger` type (similar to `skitterSwap`)
- Shows modal with "Yes" (activate) / "No" (don't activate) options
- Sends `respondOptionalTrigger` action with:
  - `confirmed`: boolean
  - `verseId`: verse ID
  - `context`: serialized trigger context (damage, etc.)

### 4. Server-side: respondOptionalTrigger handler (GameEngine.js ~line 1320)
- Reconstructs context with actual game state references:
  - `defender = player.active` (player owns the trigger)
  - `attacker = opponent.active`
  - `damage` from serialized context
- **If confirmed:**
  - Executes the trigger (which modifies game state)
  - Consumes the verse
  - For Vengeance: sets defender HP to 1, destroys attacker
- **If declined:**
  - Consumes the verse without executing
  - Applies the lethal damage manually
  - Moves defender to grave if KO'd

## Key Design Decisions

1. **Context serialization**: Since context is sent through WebSocket, object references are lost. The server reconstructs references using `player.active` and `opponent.active`.

2. **Pause-and-resume pattern**: When an optional trigger is detected, the attack action returns early with `pendingAction`. The game waits for player response before continuing.

3. **Manual damage application**: When player declines, we manually apply the damage and handle KO, since we've paused before the normal damage application.

## Testing Checklist

- [ ] Vengeance shows "Activate Vengeance?" prompt when defender would be KO'd
- [ ] Clicking "Yes" activates Vengeance: defender survives at 1 HP, attacker destroyed
- [ ] Clicking "No" declines: defender KO'd normally, attacker survives
- [ ] Verse is consumed in both cases (goes to grave)
- [ ] No infinite loops or stuck states
- [ ] Works for both players (p1 and p2)

## Potential Issues to Watch For

1. **Race conditions**: If multiple optional triggers could fire, only the first one will prompt (current implementation)
2. **State synchronization**: Context reconstruction assumes defender = player.active and attacker = opponent.active
3. **Other trigger types**: Implementation focused on `onLethalDamage` (Vengeance). Other optional triggers may need additional handling.

## Files Modified

- `server/GameEngine.js`: checkTriggers, attack handler, respondOptionalTrigger action
- `index.html`: handlePendingAction function
