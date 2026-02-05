# Optional Set Verse Triggers — Implementation Plan

## Overview
Make all set verses optional (except Last Breath) so players can strategically choose when to use them.

## Set Verses & Trigger Points

| Verse | Trigger Point | Current Location | Optional? |
|-------|---------------|------------------|-----------|
| Phantom Wall | Pre-attack | `doAttack()`, `executeAiAttack()` | Yes |
| Spike Shield | Post-attack retaliation | `doAttack()`, `executeAiAttack()` | Yes |
| Brace | Damage reduction calc | `getEffectiveDamageReduction()` | Yes |
| Swarm Shield | Damage reduction calc | `getEffectiveDamageReduction()` | Yes |
| Vengeance | Would-be-KO in combat | `ko()` function | Yes |
| Mirror Force | Would-be-KO in combat | `ko()` function | Yes |
| Den Mother | After KO | `ko()` function | Yes |
| Grave Rise | After KO | `ko()` function | Yes |
| **Last Breath** | LP would hit 0 | `checkWin()` | **No (mandatory)** |

## Architecture

### 1. Core Helper Function
```js
async function promptTrigger(owner, verse, context) {
  // context = { attacker, defender, damage, etc. }
  
  const isPlayer = owner === state.G.me;
  
  if (isPlayer) {
    // Show modal, return promise
    return new Promise(resolve => {
      showModal(`Trigger ${verse.name}?`, [
        { name: 'Yes', sub: verse.text, action: () => { closeModal(); resolve(true); } },
        { name: 'No', sub: 'Save for later', action: () => { closeModal(); resolve(false); } }
      ], { noCancel: true });
    });
  } else {
    // AI evaluation
    return evaluateAiTrigger(owner, verse, context);
  }
}
```

### 2. AI Trigger Evaluation
```js
function evaluateAiTrigger(owner, verse, context) {
  switch (verse.id) {
    case 'phantomWall':
      return true; // Always trigger - negates attack
      
    case 'spikeShield':
      // Trigger if would KO attacker or deal significant damage
      return context.attacker && context.attacker.curHp <= 15;
      
    case 'brace':
    case 'swarmShield':
      // Trigger only if it would save the creature
      return context.damage - 15 >= context.defender.curHp && 
             context.damage - 15 - 15 < context.defender.curHp;
      
    case 'vengeance':
    case 'mirrorForce':
      // Trigger if attacker is valuable (high ATK or ability)
      return context.attacker && context.attacker.atk >= 25;
      
    case 'denMother':
      // Trigger if we have creatures that can attack
      return owner.active || owner.bench.length > 0;
      
    case 'graveRise':
      // Trigger if there's a 1-cost creature to revive
      return owner.grave.some(c => c.cardType === 'creature' && c.cost === 1);
      
    default:
      return true;
  }
}
```

### 3. Trigger Point Modifications

#### A. Phantom Wall (pre-attack)
Location: `doAttack()` lines ~3808, `executeAiAttack()` lines ~4636

```js
// Before
if (state.G.opp.setVerse?.id === 'phantomWall') {
  // trigger immediately
}

// After
if (state.G.opp.setVerse?.id === 'phantomWall') {
  const shouldTrigger = await promptTrigger(state.G.opp, state.G.opp.setVerse, { attacker });
  if (shouldTrigger) {
    // trigger
  }
}
```

#### B. Spike Shield Priority Check (pre-attack if would KO)
Location: `doAttack()` ~3902, `executeAiAttack()` ~4728

Same pattern - wrap in promptTrigger check.

#### C. Brace & Swarm Shield (damage reduction)
This is trickier because it's in `getEffectiveDamageReduction()` which is a pure function.

**Solution**: Don't auto-include these in reduction. Instead:
1. Calculate base reduction (creature abilities only)
2. Before applying damage, check if Brace/Swarm Shield is set
3. Prompt for trigger
4. If yes, add to reduction and consume verse

#### D. Vengeance & Mirror Force (would-be-KO)
Location: `ko()` function ~5290

Already has checks - wrap in promptTrigger.

#### E. Den Mother & Grave Rise (after KO)
Location: `ko()` function ~5337, ~5350

Wrap existing checks in promptTrigger.

#### F. Spike Shield Retaliation (post-attack)
Location: `doAttack()` ~4036, `executeAiAttack()` ~4795

Wrap in promptTrigger.

## Implementation Order

1. [x] Create `promptTrigger()` helper
2. [x] Create `evaluateAiTrigger()` for AI decisions
3. [ ] Update Phantom Wall triggers
4. [ ] Update Spike Shield triggers (both priority and retaliation)
5. [ ] Refactor Brace/Swarm Shield out of getEffectiveDamageReduction
6. [ ] Update Vengeance/Mirror Force triggers
7. [ ] Update Den Mother trigger
8. [ ] Update Grave Rise trigger
9. [ ] Test all paths (player + AI, each verse)
10. [ ] Update CARDS.md with "optional" notes

## Test Cases

- [ ] Player can decline Phantom Wall, attack goes through
- [ ] Player can decline Spike Shield, no retaliation damage
- [ ] Player can decline Brace, full damage taken
- [ ] AI declines Brace if creature dies anyway
- [ ] AI triggers Vengeance against high-ATK attacker
- [ ] AI declines Den Mother if no creatures to use buff
- [ ] Last Breath still auto-triggers (mandatory)

## Acceptance Criteria

- [ ] All set verses (except Last Breath) show trigger prompt for player
- [ ] AI makes smart trigger decisions
- [ ] No regressions in existing gameplay
- [ ] All 190+ tests still pass
