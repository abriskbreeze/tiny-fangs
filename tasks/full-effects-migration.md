# Full Effects Migration Plan

## Goal
All creature abilities and cast verses should read values from `shared/cards.js` via `processEffects()`.

## Why
- Hundreds of cards eventually
- Balance changes in one place
- Easy to add new cards (data-driven)

---

## Phase 1: Creature Abilities (19 creatures with triggers)

### Group A: onSummon Triggers (easy)
| Creature | Ability | Effects |
|----------|---------|---------|
| Duskfang | Pack Call | atkBonus +20 (conditional) |
| Emberfang | Spark | damage 5 to opp.active |
| Hiveling | Swarm Boost | atkBonus +10 to all allies |

### Group B: afterAttack Triggers
| Creature | Ability | Effects |
|----------|---------|---------|
| Thornling | Thorns | damage 10 to attacker |
| Mireveil | Bog Grasp | setStatus 'trapped' |
| Hexweaver | Venom Thread | setStatus 'poison' |
| Reflector | Mirror Shield | damage to attacker |

### Group C: onKO / onHit Triggers
| Creature | Ability | Effects |
|----------|---------|---------|
| Gloom | Fade | discard 1 from opp |
| Stormtalon | Chain Lightning | setFlag chainLightning 20 |
| Echomask | Reflection | loseLifeOpp 1 |
| Sundew Queen | Digest | healSelf 30 |
| Leechling | Drain | healSelf damageDealt |

### Group D: beforeDamage Triggers (damage reduction)
| Creature | Ability | Effects |
|----------|---------|---------|
| Ironhide | Iron Skin | reduceDamage 10 |
| Pebbleback | Stone Hide | reduceDamage 5 |
| Shellkin | Harden | reduceDamage 10 (perTurn) |

### Group E: Procedural (keep custom)
| Creature | Ability | Why Custom |
|----------|---------|------------|
| Cindermaw | Frenzy | Attacks twice (loop control) |
| Pulsefin | Sonic Strike | First attack doubles (flag) |
| Titanback | Juggernaut | Dual: reduction + death trigger |
| Whisper | Elusive | Can't be targeted (flag check) |
| Skitter | Scurry | Swap with bench (optional action) |
| Broodmother | Spawn | Creates token (turnEnd) |
| Bulwark | Fortress | Survive at 1 HP (onLethalDamage) |

---

## Phase 2: Cast Verses (16 verses)

### Group A: Simple Effects
| Verse | Effects |
|-------|---------|
| ignite | damage 15 to selected |
| secondWind | heal 40 to me.active |
| shellArmor | setStatus 'shielded' |
| regenerate | heal 25 to me.active |
| fortify | reduceDamage 15 + setStatus |
| unbreakable | heal 40 + setStatus 'unbreakable' |
| manaSurge | gainMana 2 |
| predatorsMark | atkBonus 30 |

### Group B: Conditional/Complex
| Verse | Effects | Notes |
|-------|---------|-------|
| soulSiphon | damage 20 + heal 10 | Needs target selection |
| darkPact | loseLife 1 + atkBonus 30 | Self-damage |
| banish | destroy selected | Needs target selection |
| bloodMoon | aoeAll 20 | Hits both sides |
| sacrifice | destroy own creature | Needs selection + triggers |

### Group C: Special (keep custom)
| Verse | Why Custom |
|-------|------------|
| graveEcho | Returns card from grave to hand |
| packTactics | Draw based on creature count |
| callOfTheWild | Summons random creature |

---

## Implementation Strategy

1. Add `processCreatureAbility(creature, event, ctx)` helper
2. Migrate by group (A→B→C→D for creatures, then verses)
3. Each group: 
   - Update server to use processEffects
   - Test thoroughly
   - Commit

## Success Criteria
- `npm test` passes
- Server starts
- No hardcoded values for migrated cards
- Values match shared/cards.js
