# Effect System Refactor Plan

## Goal
Replace the 300+ line `castVerse()` switch statement with a declarative effect system.
Cards define their effects as data; a universal processor executes them.

## Success Criteria (Verifiable)
1. `npm test` passes (190+ tests) before AND after each phase
2. All 16 cast verses work identically in browser (manual spot-check)
3. `castVerse()` switch statement reduced to 0 cases
4. New cards can be added with data only (no code changes)

---

## Phase 1: Effect Primitives (TDD)

### 1.1 Create `src/effects.js` with core primitives

**Required primitives (derived from current cast verses):**

| Primitive | Used By | Params |
|-----------|---------|--------|
| `damage` | soulSiphon, ignite, bloodMoon | target, amount |
| `heal` | soulSiphon, secondWind, shellArmor, regenerate | target, amount |
| `draw` | darkPact, packTactics, sacrifice | count |
| `loseLife` | darkPact | count |
| `gainMana` | manaSurge | amount |
| `atkBonus` | predatorsMark | amount, source |
| `banish` | banish | target |
| `moveCard` | graveEcho | from, to, selected |
| `summon` | callOfTheWild | filter, location |
| `sacrifice` | sacrifice | selected |
| `setStatus` | fortify, unbreakable | status |
| `cureStatus` | regenerate | status |
| `aoeAll` | bloodMoon | effect (recursive) |

### 1.2 Write tests FIRST

```js
// tests/effects.test.js
describe('Effects', () => {
  describe('damage', () => {
    it('reduces target curHp by amount');
    it('returns true if target KO\'d');
    it('respects damage reduction');
  });
  
  describe('heal', () => {
    it('increases curHp up to max hp');
    it('does nothing if no active creature');
  });
  
  // ... etc for each primitive
});
```

### 1.3 Implement primitives to pass tests

---

## Phase 2: Card Data Migration

### 2.1 Add `effects` array to cards.js

Start with simple cards (no selection, no complex logic):

```js
// SIMPLE - no conditions
soulSiphon: {
  ...,
  effects: [
    { type: 'damage', target: 'opp.active', amount: 20 },
    { type: 'heal', target: 'me.active', amount: 10 }
  ]
}

// CONDITIONAL
ignite: {
  ...,
  effects: [
    { type: 'damage', target: 'opp.active', amount: 15, condition: 'opp.active' }
  ]
}

// WITH SELECTION (already has requiresSelection)
graveEcho: {
  ...,
  selection: { type: 'graveCreature', prompt: 'Choose creature to return' },
  effects: [
    { type: 'moveCard', from: 'me.grave', to: 'me.hand', target: 'selected' }
  ]
}
```

### 2.2 Migration order (simple → complex)

1. **Simple** (no conditions): shellArmor, secondWind, manaSurge, predatorsMark, fortify, unbreakable
2. **Conditional**: soulSiphon, ignite, regenerate, darkPact
3. **With selection**: graveEcho, sacrifice
4. **Multi-step**: packTactics, callOfTheWild, banish
5. **Complex AoE**: bloodMoon (last - most complex)

---

## Phase 3: Universal Processor

### 3.1 Create `processEffects()` in effects.js

```js
async function processEffects(card, ctx) {
  // 1. Handle selection if needed
  if (card.selection) {
    ctx.selected = await runSelection(card.selection, ctx);
    if (ctx.selected === null) return false; // canceled
  }
  
  // 2. Process each effect
  for (const effect of card.effects || []) {
    // Check condition
    if (effect.condition && !evalCondition(effect.condition, ctx)) continue;
    
    // Execute effect
    const result = await Effects[effect.type](ctx, effect);
    
    // Handle KO if needed
    if (result?.ko) {
      await handleKo(result.target, result.owner, ctx);
    }
  }
  
  return true;
}
```

### 3.2 Wire into castVerse()

```js
async function castVerse(c) {
  // ... mana drain check (keep as-is) ...
  
  // NEW: Use declarative effects if defined
  if (c.effects) {
    const ctx = { state, me: state.G.me, opp: state.G.opp };
    const success = await processEffects(c, ctx);
    if (!success) return; // selection canceled
    
    // Spend mana (after selection confirmed)
    state.G.me.mana -= c.cost;
    state.G.me.hand = state.G.me.hand.filter(x => x.uid !== c.uid);
    state.G.me.grave.push(c);
    
    log(`Cast ${c.name}`);
    await showCastReveal(c);
    render();
    return;
  }
  
  // FALLBACK: Old switch for un-migrated cards
  switch(c.id) { ... }
}
```

---

## Phase 4: Cleanup

### 4.1 Remove switch cases as cards migrate
### 4.2 Remove fallback when all cards migrated
### 4.3 Update CARDS.md with new effect format

---

## Edge Cases & Escape Hatches

Some effects need special handling:

| Card | Complexity | Solution |
|------|------------|----------|
| bloodMoon | AoE capture-then-process | Custom `aoeAll` primitive |
| sacrifice | Triggers Den Mother, Grave Rise | Effect can trigger other effects |
| callOfTheWild | Random from deck, placement logic | `summon` primitive with options |
| packTactics | Draw count = creature count | Computed `count` param |
| banish | Remove from game, not grave | `banish` vs `ko` distinction |
| manaSurge | Once per game flag | `setFlag` primitive |

For truly complex cards, allow `customEffect: 'cardId'` escape hatch that calls legacy code.

---

## Testing Strategy

### Unit tests (effects.test.js)
- Each primitive in isolation
- Edge cases (no target, max hp, etc.)

### Integration tests
- Cast each verse, verify game state changes
- Selection flow (confirm + cancel)

### Manual verification
- Play test each verse in browser
- Verify animations still fire

---

## File Changes

| File | Change |
|------|--------|
| `src/effects.js` | NEW - primitives + processor |
| `src/cards.js` | ADD effects arrays to cards |
| `index.html` | MODIFY castVerse() to use processor |
| `tests/effects.test.js` | NEW - effect unit tests |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Break existing functionality | TDD + run full test suite after each card |
| Animations desync | Keep Anim calls in primitives |
| Complex interactions | Escape hatch for edge cases |
| Selection cancel regression | Test cancel path explicitly |

---

## Estimated Effort

- Phase 1 (primitives + tests): 1 hour
- Phase 2 (card data): 30 min
- Phase 3 (processor): 30 min  
- Phase 4 (cleanup): 30 min
- **Total: ~2.5 hours**

---

## Checkpoint Questions

Before starting:
1. Should I include AI casting in this refactor? (AI uses same cards)
2. Any cards I should skip for now (leave in switch)?
3. Should effects.js be ES module or IIFE pattern (matching other src files)?
