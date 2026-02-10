# Client Unification Plan

**Goal:** Replace ~2,000 lines of duplicate game logic in index.html with imports from shared/engine.js

**Current state:**
- index.html: 8,103 lines (2,400 CSS + 5,700 JS)
- Solo mode has full game engine that duplicates shared/engine.js
- Multiplayer already uses server (which uses shared)

**Target state:**
- index.html: ~6,000 lines
- Solo mode calls `executeAction()` from shared
- Single source of truth for ALL game logic

---

## Phase 1: Event-Driven Architecture

**Problem:** Client currently mutates state directly and triggers animations inline. Shared module returns pure state + events.

**Solution:** Create an event playback system.

```javascript
// New pattern for solo mode:
async function dispatchLocalAction(action) {
  const result = executeAction(state, 0, action);  // from shared
  
  if (result.error) {
    log(result.error, 'dmg');
    return;
  }
  
  // Play animations for each event
  await playEvents(result.events);
  
  // Update state
  state = result.state;
  render();
}
```

**Tasks:**
- [ ] Create `playEvents(events)` function that maps event types to animations
- [ ] Map existing `Anim.*` calls to event types from shared
- [ ] Test with one simple action (endTurn)

**Event → Animation mapping:**
| Event Type | Animation |
|------------|-----------|
| `summon` | `Anim.summon(side)` |
| `summonBench` | `Anim.summonBench(side, idx)` |
| `damage` | `Anim.damage(side, amount)` |
| `ko` | `Anim.ko(side)` |
| `heal` | `Anim.heal(side, amount)` |
| `manaGain` | `Anim.mana(side)` |
| `swap` | `Anim.swap(side)` |
| `triggerReveal` | `showTriggerReveal(verse)` |
| `castReveal` | `showCastReveal(verse)` |

---

## Phase 2: Migrate Simple Actions

Start with actions that don't need selection UI:

- [ ] `endTurn` — simplest, just state change
- [ ] `retreat` — swap active/bench
- [ ] `setVerse` — place verse face-down

**Pattern:**
```javascript
// Before (inline mutation):
function doRetreat(benchIdx) {
  const bench = state.G.me.bench[benchIdx];
  state.G.me.bench[benchIdx] = state.G.me.active;
  state.G.me.active = bench;
  render();
  Anim.swap('me');
}

// After (shared module):
async function doRetreat(benchIdx) {
  await dispatchLocalAction({ type: 'retreat', benchIdx });
}
```

---

## Phase 3: Migrate Summon

Summon has on-summon triggers (Soul Trap, etc.) that need event playback.

- [ ] Remove `executeLocalSummon()` (~60 lines)
- [ ] Remove `emitOnSummon()` (~30 lines)
- [ ] Use shared's summon action which handles all triggers

**Verify:** Soul Trap, Duskfang pack call, Hiveling swarm, Chain Lightning

---

## Phase 4: Migrate Attack

Attack is complex — damage, triggers, KO, auto-swap, reflection.

- [ ] Remove client attack logic (~200 lines)
- [ ] Remove `checkLethalDamage()`, damage helpers
- [ ] Map all attack events to animations

**Events to handle:**
- `attack`, `damage`, `ko`, `swap`, `triggerReveal`
- `reflect` (Spike Shield, Reflector)
- `poison`, `lifesteal`

---

## Phase 5: Migrate Cast Verse

Most complex — needs selection UI integration.

**Challenge:** Shared module's `resolveSelection()` returns `{ needsSelection: true }` but client needs to show modal and wait for user input.

**Solution:**
```javascript
async function playCastVerse(verse) {
  const action = { type: 'castVerse', verseUid: verse.uid };
  
  // Try without selection first
  let result = executeAction(state, 0, action);
  
  // If needs selection, show UI and retry
  if (result.needsSelection) {
    const selected = await showSelectionModal(result.selectionConfig);
    if (!selected) return; // cancelled
    
    action.selectedUid = selected.uid;
    result = executeAction(state, 0, action);
  }
  
  await playEvents(result.events);
  state = result.state;
  render();
}
```

- [ ] Integrate selection UI with shared's `resolveSelection()`
- [ ] Remove client verse logic (~500 lines of switch cases)

---

## Phase 6: AI Refactor

AI currently calls client game functions. After migration, AI calls shared module.

**Option A:** AI stays client-side, calls `executeAction()` directly
**Option B:** AI moves to shared module (reusable for server-side AI)

Recommend **Option A** for now — AI decision logic (which card to play) is separate from game rules.

- [ ] Update AI to use `executeAction()` instead of client functions
- [ ] Remove AI's duplicate damage calculations

---

## Phase 7: Cleanup

- [ ] Remove dead code (duplicate functions)
- [ ] Consolidate imports
- [ ] Update tests if needed
- [ ] Verify solo mode end-to-end
- [ ] Verify multiplayer still works

---

## Risk Mitigation

1. **Animation timing:** Events might fire faster than animations. Solution: `playEvents()` awaits each animation.

2. **State divergence:** Solo and MP must use same state shape. Already true — shared module defines it.

3. **Selection UX:** Client selection modals work differently than server prompts. Solution: Client handles UI, passes result to shared.

---

## Line Count Estimate

| Section | Current | After | Removed |
|---------|---------|-------|---------|
| Summon logic | ~100 | ~10 | 90 |
| Attack logic | ~300 | ~20 | 280 |
| Verse logic | ~600 | ~50 | 550 |
| Trigger handling | ~200 | ~30 | 170 |
| Damage helpers | ~150 | 0 | 150 |
| AI game calls | ~200 | ~50 | 150 |
| **Total** | ~1,550 | ~160 | **~1,390** |

Conservative estimate: **~1,400 lines removed**

---

## Execution Order

1. Phase 1 first (event system) — foundation for everything else
2. Phase 2 (simple actions) — validate the pattern works
3. Phase 3-5 in order of complexity
4. Phase 6 after core logic migrated
5. Phase 7 last

**Recommend:** Phases 1-3 as first PR, then 4-5, then 6-7.
