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
  creature.curHp = Math.max(0, creature.curHp - amount);
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

// The monotonic suffix guarantees uniqueness even when Math.random is stubbed
// deterministic (tests do this); keyed board rendering fails closed on
// duplicate uids instead of silently mis-targeting cards.
let uidSerial = 0;
function uniqueUid() {
  return `${Math.random().toString(36).slice(2, 9)}-${(++uidSerial).toString(36)}`;
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
    uid: uniqueUid(),
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
    uid: uniqueUid(),
  };
}
