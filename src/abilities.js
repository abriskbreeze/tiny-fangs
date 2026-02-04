import { applyDamage } from './game.js';

// ═══════════════════════════════════════════════════════════════
// ABILITY EFFECTS - Pure Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate effective ATK including ability modifiers
 * @param {Object} creature - The attacking creature
 * @param {Object} owner - The creature's owner (player)
 * @param {Object} enemy - The opponent player
 * @returns {number} Effective ATK value
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
  
  // Rally (Alpha): +10 ATK per bench creature (assists)
  if (creature.id === 'alpha') {
    atk += owner.bench.length * 10;
  }
  
  return atk;
}

/**
 * Calculate damage reduction for a creature
 * @param {Object} creature - The creature taking damage
 * @param {Object} owner - The creature's owner
 * @returns {number} Damage reduction amount
 */
export function getEffectiveDamageReduction(creature, owner) {
  let reduction = 0;
  
  // Den Guard (Vulpix): -10 damage when bench has creatures
  if (creature.id === 'vulpix' && owner.bench.length > 0) {
    reduction += 10;
  }
  
  return reduction;
}

/**
 * Apply Drain effect (Leechling) - heal equal to damage dealt
 * @param {Object} creature - The creature with Drain
 * @param {number} damageDealt - Amount of damage dealt
 * @returns {number} Amount actually healed
 */
export function applyDrain(creature, damageDealt) {
  const maxHeal = creature.hp - creature.curHp;
  const healAmount = Math.min(damageDealt, maxHeal);
  creature.curHp += healAmount;
  return healAmount;
}

/**
 * Apply Spark effect (Emberfang) - deal 5 damage to enemy on summon
 * @param {Object} enemy - The opponent player
 * @returns {{ damage: number, ko: boolean }} Result of spark
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
 * Check if Swarm ability should trigger (Hiveling)
 * Triggers when player controls 2+ creatures
 * @param {Object} owner - The player
 * @returns {boolean} Whether swarm triggers
 */
export function checkSwarm(owner) {
  const totalCreatures = (owner.active ? 1 : 0) + owner.bench.length;
  return totalCreatures >= 2;
}

/**
 * Check if Scurry can trigger (Skitter)
 * @param {Object} owner - The player
 * @returns {boolean} Whether scurry is available
 */
export function canScurry(owner) {
  return owner.bench.length > 0;
}

/**
 * Apply Spawn effect (Broodmother) - summon Antling to bench
 * @param {Object} owner - The player
 * @returns {Object|null} The spawned Antling or null if bench full
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
