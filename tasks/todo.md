# Tiny Fangs - Current Tasks

## ✅ Completed: Effect System Refactor (v0.2.53)

**Goal:** Replace castVerse() switch with declarative effect system

### Results
- **14 of 16** cast verses migrated to declarative effects
- **27 new tests** for effects system (217 total)
- **2 cards** kept in switch: bloodMoon, sacrifice (complex interactions)

### Files Changed
- `src/effects.js` — NEW: 14 effect primitives + processor
- `src/cards.js` — Added `effects` arrays to 14 cards
- `index.html` — Wired processEffects into castVerse
- `tests/effects.test.js` — NEW: 27 tests

### Effect Primitives
damage, heal, draw, loseLife, gainMana, atkBonus, setStatus, cureStatus, moveCard, setFlag, banish, summon, aoeAll

---

## Backlog

- [ ] Set verse trigger system (declarative)
- [ ] Creature ability system (declarative)
- [ ] Migrate bloodMoon (needs enhanced KO handling)
- [ ] Migrate sacrifice (needs death trigger integration)
