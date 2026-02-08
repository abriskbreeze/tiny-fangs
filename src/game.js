// ═══════════════════════════════════════════════════════════════
// GAME LOGIC HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Apply damage to a creature with HP clamping.
 * Ensures curHp never goes below 0 (fixes negative HP display bug).
 * 
 * @param {Object} creature - The creature taking damage
 * @param {number} amount - Amount of damage to deal
 * @returns {boolean} - True if creature is KO'd (HP <= 0)
 */
export function applyDamage(creature, amount) {
  let finalAmount = amount;
  
  // Shellkin Harden: reduces first 10 damage from ANY source each turn
  if (creature.id === 'shellkin' && !creature.hardenUsed) {
    const reduction = Math.min(10, amount);
    finalAmount = Math.max(0, amount - reduction);
    creature.hardenUsed = true;
    // Note: caller should log "Harden!" if needed
  }
  
  creature.curHp = Math.max(0, creature.curHp - finalAmount);
  return creature.curHp <= 0;
}

/**
 * Heal a creature with HP capping at max.
 * 
 * @param {Object} creature - The creature to heal
 * @param {number} amount - Amount to heal
 */
export function applyHeal(creature, amount) {
  creature.curHp = Math.min(creature.hp, creature.curHp + amount);
}

/**
 * Create a creature card instance from template.
 * 
 * @param {Object} template - Creature template from CREATURES
 * @returns {Object} - Card instance with runtime state
 */
export function createCreature(template) {
  return {
    ...template,
    cardType: 'creature',
    curHp: template.hp,
    status: null,
    uid: Math.random().toString(36).slice(2, 9),
    firstAtk: true,
  };
}

/**
 * Create a verse card instance from template.
 * 
 * @param {Object} template - Verse template from VERSES
 * @returns {Object} - Card instance
 */
export function createVerse(template) {
  return {
    ...template,
    cardType: 'verse',
    uid: Math.random().toString(36).slice(2, 9),
  };
}
