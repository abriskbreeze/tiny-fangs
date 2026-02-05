# Tiny Fangs Bug Fix Plan

## AGENTS.md Questions (for each task)
1. Am I solving symptoms or ROOT problems?
2. What pattern allowed this bug to exist?
3. What's the verifiable acceptance criteria?

---

## Group A: Quick UI Fixes (Low Risk)

### A1. Cast verse shows "CAST!" instead of "TRIGGERED!"
- **Root cause**: Trigger modal text is hardcoded for set verses
- **Pattern**: No distinction between cast vs set verse in trigger display
- **Acceptance**: Cast verse plays → modal shows "CAST!" in gold, set verse → "TRIGGERED!" in purple
- **Files**: render.js (trigger modal logic)

### A2. Graveyard modal - rename Cancel→Close, remove Close button
- **Root cause**: Inconsistent modal button naming
- **Pattern**: Copy-paste from other modals without context adaptation
- **Acceptance**: Graveyard modal has single "Close" button, no "Cancel"
- **Files**: render.js or index.html (graveyard modal)

### A3. Mobile hold-to-zoom text highlighting
- **Root cause**: Missing `user-select: none` on modal content
- **Pattern**: CSS oversight on touch interactions
- **Acceptance**: Long-press on cards never highlights text
- **Files**: index.html (CSS for card-detail modal)

### A4. Hold-to-zoom on graveyard cards
- **Root cause**: Graveyard cards don't have zoom event handlers
- **Pattern**: Feature not extended to graveyard view
- **Acceptance**: Long-press graveyard card → shows detail modal
- **Files**: render.js (graveyard card rendering)

---

## Group B: Animation/Visual Bugs (Medium Risk)

### B1. Attack animation plays in wrong place for opponent's monster
- **Root cause**: Animation target coordinates not accounting for opponent's card position
- **Pattern**: Hardcoded or relative positioning assumes player's side
- **Acceptance**: Attack on opponent's creature → animation plays ON their card
- **Files**: render.js (attack animation), possibly game.js

### B2. Cindermaw double attack (two separate visual attacks)
- **Root cause**: Current implementation just doubles damage number
- **Pattern**: Shortcut taken instead of proper multi-hit implementation
- **Acceptance**: Cindermaw attacks → animation plays twice, 2 hearts damage on direct, self-damage once at end
- **Files**: game.js (attack logic), render.js (animation sequencing)

---

## Group C: Game Logic Bugs (Higher Risk)

### C1. Blood Moon should damage benched creatures
- **Root cause**: Effect only targets active creatures
- **Pattern**: Incomplete implementation of "all creatures" text
- **Acceptance**: Blood Moon played → all active AND benched creatures on both sides take 20 damage
- **Files**: game.js (verse effect execution), abilities.js

### C2. Sacrifice should trigger "When creature KO'd" effects
- **Root cause**: Self-KO via verse doesn't use same KO pathway
- **Pattern**: Multiple code paths for creature death
- **Acceptance**: Sacrifice your creature → Den Mother triggers, other KO effects fire
- **Files**: game.js (KO handling, verse execution)

### C3. Attacking shouldn't auto-end turn
- **Root cause**: Attack action calls endTurn() directly
- **Pattern**: Overly aggressive turn state management
- **Acceptance**: After attacking, can still cast/set verses. Cannot retreat after attack, cannot attack after retreat.
- **Files**: game.js (attack action, turn state)

### C4. Grave Echo UI for picking card
- **Root cause**: No selection UI for graveyard targets
- **Pattern**: Missing feature, not a bug per se
- **Acceptance**: Grave Echo played → modal shows graveyard, player picks creature → returns to hand
- **Files**: game.js, render.js (new UI flow)

---

## Group D: Feature Work (Separate Sessions)

### D1. Attack animation mockups (6 examples)
- Design task, not code
- Create visual demos showing card movement/effects

### D2. Deck selector / draft system
- Major feature, needs separate planning

### D3. Shell Pack deck
- Reference: CARDS.md has the v2 spec
- Needs full implementation

---

## Execution Plan

**Subagent 1 - UI Fixes (A1-A4)**: Quick, low-risk changes
**Subagent 2 - Animation Fixes (B1-B2)**: Visual/animation work
**Subagent 3 - Game Logic (C1-C4)**: Requires careful testing

**Main session**: Attack animation mockups (D1), oversight
