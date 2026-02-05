# Changelog

All notable changes to Tiny Fangs.

## [0.2.57] - 2026-02-05

### Added
- **Priority system** for trigger resolution (1-5 levels)
  - Priority 1: Negate triggers (cancel other triggers)
  - Priority 2: Negate action (negateAttack, negateSpell, negateKO)
  - Priority 3: Pre-modification (reduceDamage)
  - Priority 4: Standard (default)
  - Priority 5: Post-event effects
- Auto-detection of priority from effect types
- Tiebreaker: non-active player (defender) fires first

### Changed
- **All 29 creatures migrated to declarative ability format:**
  - Passive abilities: `{ passive: { type, amount, condition } }`
  - Triggered abilities: `{ trigger: { event, condition }, effects: [...] }`
  - Complex abilities: `{ procedural: true }`
- All 10 set verses now event-driven with `triggerDef` and `effects`

### New Effect Primitives
- `negateAttack` — Attack doesn't resolve
- `negateKO` — Creature survives with 1 HP
- `negateLifeLoss` — Life point saved
- `destroy` — Send creature to grave

---

## [0.2.56] - 2026-02-05

### Added
- More set verses migrated to event-driven triggers
- Phantom Wall, Vengeance, Last Breath, Spike Shield integration

---

## [0.2.55] - 2026-02-04

### Added
- **Brace** migrated to event-driven trigger (`beforeDamage`)
- **Den Mother** migrated to event-driven trigger (`onKO`)
- Context mutation pattern for `damageReduction`

---

## [0.2.54] - 2026-02-04

### Added
- **Event system foundation**
  - `src/events.js` — GameEvents emitter
  - `src/triggers.js` — Trigger processor with condition matching
- All 10 set verses have `triggerDef` declarations
- Documentation in `guides/EVENT-SYSTEM.md`

---

## [0.2.53] - 2026-02-04

### Added
- **Declarative effect system** for cast verses
  - Cards define `effects: []` array
  - Universal `processEffects()` executes them
- Effect primitives: damage, heal, draw, loseLife, gainMana, atkBonus, setStatus, cureStatus, moveCard, setFlag, banish, summon
- `customHandler` escape hatch for complex cards

---

## [0.2.52] - 2026-02-03

### Fixed
- Deferred side effects for selection cards
- Cancel properly returns card to hand

---

## [0.2.51] - 2026-02-03

### Fixed
- Grave Echo/Sacrifice cancel — must select after mana spent (`noCancel`)

---

## [0.2.50] - 2026-02-03

### Added
- **Optional set verse triggers** — All traps now prompt player
- Last Breath remains automatic (prevents death)

---

## [0.2.49] - 2026-02-03

### Added
- END TURN button highlight when player has 0 mana

---

## [0.2.48] - 2026-02-02

### Fixed
- AI attack missing ability modifiers (Orphan, Pack Bond, etc.)

---

## [0.2.47] - 2026-02-02

### Changed
- **Shellkin rebalance** — 20 HP, 10 ATK, clearer ability text

---

## [0.2.46] - 2026-02-02

### Changed
- **Spike Shield priority** — KO attacker negates attack entirely

---

## [0.2.45] - 2026-02-02

### Fixed
- END TURN highlight added to all attack paths + retreat

---

## [0.2.44] - 2026-02-02

### Fixed
- Missing await on `ko()` — Den Mother now properly clears on trigger

---

## [0.2.43] - 2026-02-02

### Added
- END TURN highlight after attack
- TURN END animation

---

## [0.2.42] - 2026-02-02

### Fixed
- Attack bonus display for modified ATK values

---

## [0.2.41] - 2026-02-02

### Added
- Shell Pack tuning — balanced creature stats

---

## [0.2.40] - 2026-02-02

### Added
- **Shell Pack** — 7 new defensive creatures:
  - Shellkin (Harden: negate first 10 damage/turn)
  - Pebbleback (Sturdy: -5 damage)
  - Ironhide (Iron Skin: -10 damage)
  - Coilshell (Recoil: 10 damage to attacker)
  - Bulwark (Fortress: survive lethal once)
  - Reflector (Mirror Shell: 15 damage to attacker)
  - Titanback (Juggernaut: -15 damage, 25 on death)
- **6 new Shell Pack verses:**
  - Shell Armor, Brace, Spike Shield, Regenerate, Fortify, Unbreakable

---

## [0.2.30-0.2.39] - 2026-02-01

### Added
- Swarm Pack creatures and verses
- Pack synergy mechanics
- Broodmother spawning system

---

## [0.2.20-0.2.29] - 2026-01-31

### Added
- Venom Pack expansion
- Status effects (poison, trapped)
- Hexweaver, Sundewqueen abilities

---

## [0.2.0-0.2.19] - 2026-01-30

### Added
- Core game mechanics
- Shadow, Fang packs
- AI opponent
- Basic animations
