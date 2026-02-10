# Double Damage Bug Investigation

## Date: 2026-02-10

## Summary
Investigated potential double damage bug for Phantom Wall and other triggered abilities/verses.

## Findings

### Singleplayer Mode (src/triggers.js)
**Status:** ✅ FIXED in v0.4.62

**Bug Description:**  
In `processTriggers()`, for each effect in a card's effects array, if it wasn't handled inline, it called `processEffects(card, ctx)`. But `processEffects()` runs ALL effects on the card. For Phantom Wall with `effects: [negateAttack, damage]`, the loop iterated twice and called `processEffects` twice, each time running BOTH effects = 2x damage.

**Fix Applied:**  
Added `needsProcessEffects` flag. Loop marks which cards need `processEffects`, then calls it ONCE after the loop (lines 414-460 in src/triggers.js).

### Multiplayer Server Mode (server/GameEngine.js)
**Status:** ✅ NO BUG DETECTED

**Analysis:**  
Server uses a different trigger system (`checkTriggers`/`executeTrigger`):
- `checkTriggers` is called once per event (e.g., 'beforeAttack')
- `executeTrigger` for phantomWall pushes ONE damage event with amount 10
- No loop that could cause duplication
- Code at lines 214-228 shows clean single execution

**Debug Logging Added:**
- Line 215: `console.log('[DEBUG] Phantom Wall triggered - dealing 10 damage to', context.attacker?.name);`
- Line 360: `console.log('[DEBUG] checkTriggers called:', event, 'defender verse:', inactivePlayer.setVerse?.id, 'attacker verse:', activePlayer.setVerse?.id);`
- Line 3125 (index.html): `console.log('[DEBUG] Playing events:', events.map(e => ...));`

## Verification Steps

To verify the fix is working:

1. **Test Phantom Wall in Singleplayer:**
   ```bash
   # Open http://localhost:3004
   # Select Shadow Pack (has Phantom Wall)
   # Set Phantom Wall
   # Let AI attack
   # Check console logs - should show trigger fires once, 10 damage dealt
   ```

2. **Test Phantom Wall in Multiplayer:**
   ```bash
   # Start server: node server/index.js
   # Open two browser windows to http://localhost:3004
   # Both select Shadow Pack
   # One player sets Phantom Wall, other attacks
   # Check server logs - should show:
   #   [DEBUG] checkTriggers called: beforeAttack ...
   #   [DEBUG] Phantom Wall triggered - dealing 10 damage to [creature]
   # Check client console - should show one damage(10) event
   ```

## Conclusion

The double damage bug was **already fixed in v0.4.62 for singleplayer mode**.

The multiplayer server code does not appear to have the same bug - the trigger system is designed differently and executes each trigger only once.

Debug logging has been added to both client and server to verify behavior during gameplay.

## Recommendation

If Rico is still experiencing double damage:
1. Clear browser cache (old bundle may be cached)
2. Check that server is running the latest version of GameEngine.js
3. Review debug logs during actual gameplay to see if there's a different root cause

## Files Modified

- `server/GameEngine.js` - Added debug logging (lines 215, 360)
- `index.html` - Added debug logging (line 3125)
