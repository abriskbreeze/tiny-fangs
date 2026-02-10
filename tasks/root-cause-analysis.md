# Root Cause Analysis - Multiplayer Bugs

**Applying AGENTS.md questions:**
- "Am I solving symptoms, or am I solving ROOT problems?"
- "What pattern in the codebase allowed this bug to exist?"
- "What breaks if we revert this fix?"

---

## Bug Class 1: Hardcoded Values Drift from Card Data

### Symptom Fixed
- Ignite dealing 30 → changed to 15

### ROOT CAUSE
Server has **hardcoded switch statements** with damage values that can drift from card definitions.

### Pattern That Allowed This
```javascript
// server/GameEngine.js - ANTI-PATTERN
if (card.id === 'ignite') {
  const ko = applyDamage(target, 30);  // Hardcoded, not from card.effects!
}
```

Should be:
```javascript
// Read from card definition
const damageEffect = card.effects.find(e => e.type === 'damage');
const ko = applyDamage(target, damageEffect.amount);
```

### Similar Issues (UNCHECKED)
```
Line 220: applyDamage(context.attacker, 10) - Phantom Wall
Line 233: applyDamage(context.attacker, 15) - Spike Shield  
Line 256: applyDamage(context.creature, 15) - Soul Trap
Line 743: applyDamage(attacker, 25) - Coilshell recoil?
Line 872: applyDamage(attacker, 10) - Blood Moon?
Line 1038: applyDamage(opponent.active, 20) - Soul Siphon?
Line 1109: applyDamage(t.creature, 20) - Banish?
```

**NEED TO VERIFY:** Each hardcoded value matches card definition.

### Real Fix
Use the shared effects system we built! Server should call `processEffects(card, ctx)` instead of hardcoding.

---

## Bug Class 2: Single-Player Data Assumptions in Multiplayer

### Symptom Fixed
- Deck/hand counts showing 0 → used `deckCount ?? deck.length`

### ROOT CAUSE
Code assumes `state.G.me.deck` and `state.G.opp.hand` are populated arrays, but in multiplayer they're empty (hidden from client).

### Pattern That Allowed This
```javascript
// Render assumes single-player structure
$('d-opp-deck').textContent = state.G.opp.deck.length;  // Always 0 in MP!

// Game logic assumes deck exists
state.G.me.deck.filter(...)  // Works but wrong in MP
state.G.me.deck.pop()        // Would fail silently in MP
```

### Similar Issues (UNCHECKED)
```
Line 4833: state.G.me.deck.filter() - Call of the Wild
Line 5343: state.G.me.deck.filter() - Another deck search
Line 5347: state.G.me.deck.filter() - Deck modification
Line 7388: state.G.me.deck.length > 0 - Draw check
Line 7389: state.G.me.deck.pop() - Draw action
```

**All of these will BREAK in multiplayer mode.**

### Real Fix
1. Multiplayer should not allow client-side deck operations
2. All deck operations go through server
3. Client only renders what server sends

---

## Bug Class 3: Animation/State Coupling

### Symptom Fixed
- Animations appearing center → cache positions before state update

### ROOT CAUSE
Architecture couples state updates with DOM, but animations need DOM state that no longer exists.

### Pattern That Allowed This
```javascript
// Current flow (broken)
state.G = newState;  // DOM updates, creature gone
render();
playAnimations();    // Can't find creature element!
```

### Real Fix
Either:
1. Animations are purely visual overlays (don't depend on DOM)
2. Or: Pre-render animations before state update (complex)

The caching fix is a **band-aid** that will break for edge cases.

---

## Bug Class 4: Wrong Trigger Logic

### Symptom Fixed
- Last Breath triggering at full HP → changed condition

### ROOT CAUSE
Manual trigger implementation instead of using declarative trigger system.

### Pattern That Allowed This
```javascript
// Hardcoded wrong logic
if (owner.lp === 1) {  // Wrong interpretation of "would die"
```

Card says: "When you would lose your last LP"
Code checked: "When you're at exactly 1 LP"

### Similar Issues
Are other triggers implemented with wrong conditions?
- Vengeance: "When this creature would be KO'd"
- Fortify: "When creature would take lethal damage"

---

## Action Items

### Immediate (P0)
1. [ ] Verify ALL hardcoded damage values match card definitions
2. [ ] Find all `deck.` and `hand.` operations that break in multiplayer
3. [ ] Test verses that have "would X" conditions

### Structural (P1) 
4. [ ] Migrate server to use `processEffects()` from shared module
5. [ ] Add `isMultiplayer` guards for client-side deck operations
6. [ ] Review all trigger conditions against card text

### Architecture (P2)
7. [ ] Complete the shared module migration (Phase 3)
8. [ ] Server becomes thin wrapper around shared logic
9. [ ] Single source of truth = no hardcoded values

---

## Lesson
We fixed **symptoms** not **causes**. The bugs will recur in different forms until we:
1. Stop hardcoding values that exist in card data
2. Stop assuming single-player data structures in multiplayer
3. Use the shared module we already built
