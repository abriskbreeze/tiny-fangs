import { applyDamage } from './game.js';
import { getEffectiveAtk as sharedGetEffectiveAtk } from '../shared/engine.js';

// ═══════════════════════════════════════════════════════════════
// ABILITY EFFECTS - Display helpers + shared ATK (combat SSOT)
// ═══════════════════════════════════════════════════════════════

/**
 * Effective ATK — delegates to shared/engine (single source of truth for combat + AI)
 */
export function getEffectiveAtk(creature, owner, enemy) {
  return sharedGetEffectiveAtk(creature, owner, enemy);
}

/**
 * Get ATK modifiers for display (returns effective ATK + list of reasons)
 */
export function getAtkModifiers(creature, owner, enemy) {
  const baseAtk = creature.atk;
  const modifiers = [];
  
  // Orphan (Shade Pup): +15 ATK when bench is empty
  if (creature.id === 'shadePup' && owner.bench.length === 0) {
    modifiers.push({ name: 'Orphan', value: 15, desc: 'Bench empty' });
  }
  
  // Pack Bond (Fangpup): +10 ATK per other creature you control
  if (creature.id === 'fangpup') {
    const others =
      (owner.active && owner.active.uid !== creature.uid ? 1 : 0) +
      owner.bench.filter(c => c.uid !== creature.uid).length;
    if (others > 0) {
      modifiers.push({ name: 'Pack Bond', value: others * 10, desc: `${others} other` });
    }
  }
  
  // Feeding Frenzy (Piranix): +15 ATK if enemy below half HP
  if (creature.id === 'piranix' && enemy?.active) {
    if (enemy.active.curHp < enemy.active.hp / 2) {
      modifiers.push({ name: 'Feeding Frenzy', value: 15, desc: 'Enemy wounded' });
    }
  }
  
  // Rally (Alpha): +10 ATK per bench creature
  if (creature.id === 'alpha' && owner.bench.length > 0) {
    const bonus = owner.bench.length * 10;
    modifiers.push({ name: 'Rally', value: bonus, desc: `${owner.bench.length} benched` });
  }
  
  // Rend (Bladewhisker): +10 ATK always
  if (creature.id === 'bladewhisker') {
    modifiers.push({ name: 'Rend', value: 10, desc: '+10 damage' });
  }
  
  // Reflection (Echomask)
  if (creature.id === 'echomask' && enemy?.active) {
    const enemyModifiedAtk = getEffectiveAtk(enemy.active, enemy, owner);
    modifiers.push({ name: 'Reflection', value: enemyModifiedAtk - baseAtk, desc: `Mirror ${enemy.active.name}` });
  }
  
  // Sonic Strike (Pulsefin): display-only first-attack hint (combat doubles separately)
  if (creature.id === 'pulsefin' && creature.firstAtk) {
    modifiers.push({ name: 'Sonic Strike', value: baseAtk, desc: 'First attack doubled' });
  }
  
  // Attack bonuses on owner
  if (owner.attackBonuses?.length > 0) {
    for (const bonus of owner.attackBonuses) {
      modifiers.push({ name: bonus.source, value: bonus.value, desc: 'Next attack' });
    }
  }
  
  // Attack bonuses on creature
  if (creature.atkBonuses?.length > 0) {
    for (const bonus of creature.atkBonuses) {
      modifiers.push({ name: bonus.source, value: bonus.value, desc: 'Creature buff' });
    }
  }

  // Effective ATK from shared engine (includes passives); Pulsefin display adds first-atk hint above
  // but shared combat applies firstAtk doubling in attack() — keep display consistent with shared base
  let effectiveAtk = getEffectiveAtk(creature, owner, enemy);
  if (creature.id === 'pulsefin' && creature.firstAtk) {
    effectiveAtk += baseAtk; // UI shows doubled; combat handles separately
  }
  
  return { baseAtk, effectiveAtk, modifiers };
}

/**
 * Calculate damage reduction for a creature (creature abilities only, not set verses)
 * Set verses (Brace, Swarm Shield) are handled separately for optional triggers
 * NOTE: Creatures with declarative ability.trigger are handled by the trigger system
 */
export function getEffectiveDamageReduction(creature, owner, includeSetVerses = false) {
  let reduction = 0;
  
  // Den Guard (Hollowfox): -10 damage when bench has creatures
  if (creature.id === 'hollowfox' && owner.bench.length > 0) {
    reduction += 10;
  }
  
  // Set verse reductions (only if explicitly included - for backwards compat)
  // Note: Brace and Swarm Shield now use event-driven triggers (see triggers.js)
  if (includeSetVerses) {
    // All set verse damage reduction now handled by trigger system
  }
  
  // === Shell Pack damage reduction ===
  // NOTE: Pebbleback, Ironhide, Shellkin now use declarative triggers (ability.trigger)
  // Their damage reduction is handled by processTriggers('beforeDamage', ...)
  
  // Juggernaut (Titanback): always -15 damage (not yet migrated to declarative)
  if (creature.id === 'titanback') {
    reduction += 15;
  }
  
  return reduction;
}

/**
 * Check if a set verse would provide damage reduction
 * Returns { verse, reduction } or null
 * Note: Brace and Swarm Shield now use event-driven triggers (see triggers.js)
 */
export function getSetVerseReduction(owner) {
  // All damage-reducing set verses now use event-driven triggers
  return null;
}

/**
 * Get list of active damage reduction effects (for logging)
 * Set verses excluded by default (handled separately for optional triggers)
 * NOTE: Creatures with declarative triggers log via the trigger system
 */
export function getDamageReductionSources(creature, owner, includeSetVerses = false) {
  const sources = [];
  
  if (creature.id === 'hollowfox' && owner.bench.length > 0) {
    sources.push({ name: 'Den Guard', value: 10 });
  }
  // Note: Brace and Swarm Shield now use event-driven triggers (see triggers.js)
  // NOTE: Pebbleback, Ironhide, Shellkin now use declarative triggers - logged by trigger system
  
  if (creature.id === 'titanback') {
    sources.push({ name: 'Juggernaut', value: 15 });
  }
  
  return sources;
}

/**
 * Get retaliation damage (damage dealt back to attacker)
 * NOTE: Thornling, Coilshell, Reflector now use declarative triggers (afterAttack)
 * This function is kept for backward compatibility but returns 0 for migrated creatures
 */
export function getRetaliationDamage(defender) {
  // All retaliation creatures now use declarative ability.trigger
  // Handled by processTriggers('afterAttack', ...)
  return 0;
}

/**
 * Apply Drain effect (Leechling) - heal equal to damage dealt
 */
export function applyDrain(creature, damageDealt) {
  const maxHeal = creature.hp - creature.curHp;
  const healAmount = Math.min(damageDealt, maxHeal);
  creature.curHp += healAmount;
  return healAmount;
}

/**
 * Apply Spark effect (Emberfang) - deal 5 damage on summon
 */
export function applySpark(enemy) {
  if (!enemy.active) {
    return { damage: 0, ko: false };
  }
  const sparkDamage = 5;
  const ko = applyDamage(enemy.active, sparkDamage);
  return { damage: sparkDamage, ko };
}

/**
 * Check if Swarm ability triggers (Hiveling) - 2+ creatures
 */
export function checkSwarm(owner) {
  const totalCreatures = (owner.active ? 1 : 0) + owner.bench.length;
  return totalCreatures >= 2;
}

/**
 * Check if Scurry should trigger (Skitter took damage, has bench)
 */
export function shouldScurryTrigger(creature, owner) {
  return creature.id === 'skitter' && owner.bench.length > 0 && creature.curHp > 0;
}

/**
 * Execute Scurry - swap with bench creature
 */
export function executeScurry(owner) {
  if (owner.bench.length === 0 || !owner.active) return null;
  const current = owner.active;
  const replacement = owner.bench.shift();
  owner.active = replacement;
  owner.bench.push(current);
  return replacement;
}

/**
 * Apply Den Mother buff (+10 ATK to all creatures)
 */
export function applyDenMotherBuff(owner) {
  if (owner.active) {
    owner.active.atk += 10;
  }
  owner.bench.forEach(c => {
    c.atk += 10;
  });
}

/**
 * Apply Spawn effect (Broodmother) - summon Antling to bench
 */
export function applySpawn(owner) {
  if (owner.bench.length >= 2) {
    return null; // Bench full
  }
  
  const antling = {
    id: 'antling',
    name: 'Antling',
    subtitle: 'Swarm Token',
    hp: 10,
    curHp: 10,
    atk: 10,
    cost: 0,
    cardType: 'creature',
    ability: null,
    uid: Math.random().toString(36).slice(2, 9),
    isToken: true
  };
  
  owner.bench.push(antling);
  return antling;
}
