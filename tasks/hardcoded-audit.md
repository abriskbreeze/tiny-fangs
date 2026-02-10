# Hardcoded Values Audit — Server vs Shared Module

## Root Cause Questions
1. **Am I solving symptoms or ROOT problems?** → Root problem is hardcoded values that drift from source of truth
2. **What pattern allowed this bug?** → Server duplicates card data instead of importing from shared module
3. **What breaks if we revert?** → Values drift again as cards are balanced

## Audit Results

### ❌ BUGS FOUND

| Card | Server Value | Shared Module | Line | Status |
|------|-------------|---------------|------|--------|
| Soul Trap | 15 damage | 20 damage | 257 | **FIX** |
| Ignite comment | "30 damage" | 15 damage | 947 | Fix comment |

### ✅ VERIFIED CORRECT

| Card | Value | Line |
|------|-------|------|
| Phantom Wall | 10 damage | 221 |
| Spike Shield | 15 damage | 234 |
| Brace | 15 reduction | 245 |
| Swarm Shield | 10 per bench | 250 |
| Mana Drain | 2 mana | 333 |
| Soul Siphon | 20 dmg / 10 heal | 1039/1050 |
| Blood Moon | 20 AoE | 1110 |
| Predator's Mark | +30 ATK | 939 |
| Mana Surge | 2 mana | 944 |
| Second Wind | 40 heal | 1058 |
| Regenerate | 25 heal | 1066 |
| Unbreakable | 40 heal | 1078 |

## Pattern Fix Needed

**Current:** Server has hardcoded values scattered in switch statements
**Ideal:** Server imports from `shared/cards.js` and reads effect values dynamically

```javascript
// Instead of:
events.push({ type: 'damage', amount: 15 }); // hardcoded

// Should be:
const card = VERSES[cardId];
const dmgEffect = card.effects.find(e => e.type === 'damage');
events.push({ type: 'damage', amount: dmgEffect.amount });
```

## Action Items
1. [x] Fix Soul Trap: 15 → 20
2. [x] Fix Ignite comment: "30" → "15"
3. [ ] Future: Refactor to read from shared module dynamically
