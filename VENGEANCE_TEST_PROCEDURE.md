# Vengeance Optional Trigger - Manual Test Procedure

## Setup
1. Start the game: `npm run dev`
2. Open http://localhost:5174/ in browser
3. Open Developer Console (F12) to watch for errors

## Test Cases

### Test 1: Vengeance Activated (Player Confirms)
**Setup:**
1. Start a game with a deck that includes Vengeance
2. Get Vengeance in hand and set it
3. Allow your active creature to take lethal damage from opponent's attack

**Expected Behavior:**
1. Game pauses before applying damage
2. Modal appears: "Activate Vengeance?"
3. Options: "Yes" (Activate Vengeance) / "No" (Don't activate)
4. Click "Yes"
5. Result:
   - Your creature survives at 1 HP
   - Opponent's attacker is destroyed
   - Vengeance goes to grave
   - Log shows: "Vengeance activated" or similar
   - No errors in console

### Test 2: Vengeance Declined (Player Declines)
**Setup:**
Same as Test 1

**Expected Behavior:**
1. Modal appears: "Activate Vengeance?"
2. Click "No"
3. Result:
   - Your creature is KO'd normally
   - Opponent's attacker survives
   - Vengeance goes to grave
   - Log shows: "Trigger declined: Vengeance" or similar
   - No errors in console

### Test 3: Vengeance with Multiple Attacks
**Setup:**
1. Set Vengeance
2. Take non-lethal damage (Vengeance should NOT trigger)
3. Take lethal damage on next attack

**Expected Behavior:**
1. First attack: No prompt, damage applied normally
2. Second attack (lethal): Vengeance prompt appears
3. Works as in Test 1 or Test 2 depending on choice

### Test 4: Opponent Has Vengeance
**Setup:**
1. Opponent sets Vengeance
2. Attack opponent's creature for lethal damage

**Expected Behavior:**
1. YOU (the player) should NOT see a prompt (it's opponent's trigger)
2. If playing against AI: AI should auto-decide
3. If playing against another human: THEY see the prompt

### Test 5: No Vengeance Set
**Setup:**
1. Don't set Vengeance
2. Take lethal damage

**Expected Behavior:**
1. No prompt
2. Creature KO'd normally
3. No errors

## Edge Cases to Check

### Multiple Optional Triggers
If there are multiple optional triggers that could fire:
- Only the first one should prompt (current implementation)
- After handling first, game continues normally

### Rapid Clicks
- Try clicking modal buttons rapidly
- Should only respond once
- No duplicate actions

### Network/State Issues
- Check browser console for any errors
- Check server logs for errors
- Verify game state stays consistent

## Success Criteria
✅ All 5 test cases pass
✅ No console errors
✅ No stuck states (game never freezes)
✅ Modal closes properly after selection
✅ Game log accurately reflects what happened
✅ Both players' views stay synchronized (in multiplayer)

## Known Limitations
- If multiple optional triggers could fire simultaneously, only the first is prompted
- Context reconstruction assumes defender = player.active (may break with more complex scenarios)

## Quick Debug Checklist
If something doesn't work:
1. Check browser console for errors
2. Check server logs: `tail -f ~/.pm2/logs/*.log` (if using PM2)
3. Verify Vengeance has `optional: true` in shared/cards.js
4. Check Network tab to see WebSocket messages
5. Look for `[DEBUG] checkTriggers called` logs in server

## Test Decks
Recommended decks for testing:
- **Starter** - Has Vengeance by default
- **Control** - Likely has multiple triggers to test interactions

## Cleanup
After testing, check:
- No lingering modals
- No stuck pending actions
- Game can start new round normally
