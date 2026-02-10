# Remaining Hardcoded Values Audit

## Root Cause Questions (from AGENTS.md)
1. **Am I solving symptoms or ROOT problems?** → Pattern: server duplicates values instead of reading from shared
2. **What pattern allowed this bug?** → No processEffects integration for creature abilities or cast verses
3. **What breaks if we revert?** → Values drift when balancing cards

## Current State

### ✅ Already Fixed (v0.4.65)
All 10 set verse triggers now use `processEffects`:
- phantomWall, spikeShield, soulTrap, brace, swarmShield
- manaDrain, vengeance, graveRise
- denMother, lastBreath (kept custom, documented why)

### ⚠️ Still Hardcoded (but correct values)

#### Creature Abilities
| Creature | Ability | Server Value | Shared Value | Status |
|----------|---------|-------------|--------------|--------|
| Duskfang | Pack Call | +20 ATK | +20 ATK | ✓ Match |
| Emberfang | Spark | 5 dmg | 5 dmg | ✓ Match |
| Sundew Queen | Digest | 30 heal | 30 heal | ✓ Match |
| Cindermaw | Frenzy | 10 self-dmg | 10 self-dmg | ✓ Match (procedural) |
| Titanback | Juggernaut | 25 dmg | 25 dmg | ✓ Match (procedural) |

#### Cast Verses
| Verse | Effect | Server Value | Shared Value | Status |
|-------|--------|-------------|--------------|--------|
| Ignite | damage | 15 | 15 | ✓ Match |
| Predator's Mark | atkBonus | +30 | +30 | ✓ Match |
| Mana Surge | gainMana | 2 | 2 | ✓ Match |

### 📋 Procedural Abilities (can't easily migrate)
These modify game flow, not just apply effects:
- **Cindermaw Frenzy** — attacks twice (loop control)
- **Pulsefin Sonic Strike** — first attack doubles (flag check)
- **Titanback Juggernaut** — damage reduction + death trigger (dual ability)
- **Whisper Elusive** — can't be targeted turn summoned (flag check)
- **Mireveil Bog Grasp** — prevents retreat (status effect)

## Recommended Next Phase

### Phase 1: Creature onSummon Triggers
Easy wins — already have trigger definitions:
- Duskfang Pack Call
- Emberfang Spark

### Phase 2: Cast Verse Effects
Already have effects arrays:
- Ignite (damage 15)
- Predator's Mark (atkBonus 30)
- Mana Surge (gainMana 2)
- Soul Siphon (damage 20 + heal 10)
- Second Wind (heal 40)
- etc.

### Phase 3: Complex Creature Abilities
Needs more work:
- Sundew Queen Digest (onKO trigger)
- Stormtalon Chain Lightning (death flag)

## Priority
**LOW** — Values currently match. Risk is future drift when balancing.
**Recommendation:** Do this incrementally as we touch each card, not as a big refactor.
