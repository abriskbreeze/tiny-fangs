import { applyDamage } from './game.js';

// ═══════════════════════════════════════════════════════════════
// ABILITY EFFECTS - Pure Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate effective ATK including ability modifiers
 */
export function getEffectiveAtk(creature, owner, enemy) {
  let atk = creature.atk;
  
  // Orphan (Shade Pup): +15 ATK when bench is empty
  if (creature.id === 'shadePup' && owner.bench.length === 0) {
    atk += 15;
  }
  
  // Pack Bond (Fangpup): +10 ATK per other creature you control
  if (creature.id === 'fangpup') {
    atk += owner.bench.length * 10;
  }
  
  // Feeding Frenzy (Piranix): +15 ATK if enemy below half HP
  if (creature.id === 'piranix' && enemy.active) {
    if (enemy.active.curHp < enemy.active.hp / 2) {
      atk += 15;
    }
  }
  
  // Rally (Alpha): +10 ATK per bench creature
  if (creature.id === 'alpha') {
    atk += owner.bench.length * 10;
  }
  
  return atk;
}

/**
 * Get ATK modifiers for display (returns effective ATK + list of reasons)
 */
export function getAtkModifiers(creature, owner, enemy) {
  const baseAtk = creature.atk;
  const modifiers = [];
  let effectiveAtk = baseAtk;
  
  // Orphan (Shade Pup): +15 ATK when bench is empty
  if (creature.id === 'shadePup' && owner.bench.length === 0) {
    effectiveAtk += 15;
    modifiers.push({ name: 'Orphan', value: 15, desc: 'Bench empty' });
  }
  
  // Pack Bond (Fangpup): +10 ATK per other creature you control
  if (creature.id === 'fangpup' && owner.bench.length > 0) {
    const bonus = owner.bench.length * 10;
    effectiveAtk += bonus;
    modifiers.push({ name: 'Pack Bond', value: bonus, desc: `${owner.bench.length} benched` });
  }
  
  // Feeding Frenzy (Piranix): +15 ATK if enemy below half HP
  if (creature.id === 'piranix' && enemy?.active) {
    if (enemy.active.curHp < enemy.active.hp / 2) {
      effectiveAtk += 15;
      modifiers.push({ name: 'Feeding Frenzy', value: 15, desc: 'Enemy wounded' });
    }
  }
  
  // Rally (Alpha): +10 ATK per bench creature
  if (creature.id === 'alpha' && owner.bench.length > 0) {
    const bonus = owner.bench.length * 10;
    effectiveAtk += bonus;
    modifiers.push({ name: 'Rally', value: bonus, desc: `${owner.bench.length} benched` });
  }
  
  // Den Mother bonus (one-shot)
  if (owner.denMotherBonus) {
    modifiers.push({ name: 'Den Mother', value: owner.denMotherBonus, desc: 'Next attack' });
  }
  
  return { baseAtk, effectiveAtk, modifiers };
}

/**
 * Calculate damage reduction for a creature
 */
export function getEffectiveDamageReduction(creature, owner) {
  let reduction = 0;
  
  // Den Guard (Vulpix): -10 damage when bench has creatures
  if (creature.id === 'vulpix' && owner.bench.length > 0) {
    reduction += 10;
  }
  
  // Swarm Shield (set verse): -15 damage when has bench
  if (owner.setVerse?.id === 'swarmShield' && owner.bench.length > 0) {
    reduction += 15;
  }
  
  return reduction;
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
