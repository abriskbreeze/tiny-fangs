/**
 * Declarative creature damage reduction (beforeDamage triggers + passives).
 * Replaces per-creature ID switches in attack / Effects.damage.
 */
import { CREATURES } from './cards.js';
import { findMatchingTriggers, sortByPriority } from './triggers.js';

/**
 * Apply defender creature DR abilities to incoming damage.
 * @param {object} creature - Defender instance
 * @param {object} owner - Player who owns the defender
 * @param {number} damage - Incoming damage
 * @param {object} [opts]
 * @param {Array} [opts.events] - Event list to push into (mutated)
 * @param {string} [opts.side] - Side key for events (p1/p2 or omitted)
 * @returns {number} Damage after reduction
 */
export function applyCreatureDamageReduction(creature, owner, damage, opts = {}) {
  const { events = null, side = null } = opts;
  if (!creature || damage <= 0) return damage;

  let remaining = damage;
  const ability = creature.ability || CREATURES[creature.id]?.ability;
  if (!ability) return remaining;

  // Passive DR (e.g. Hollowfox Den Guard)
  if (ability.passive?.type === 'damageReduction') {
    const cond = ability.passive.condition;
    let ok = true;
    if (cond === 'me.bench.notEmpty') {
      ok = (owner?.bench?.length || 0) > 0;
    }
    if (ok && ability.passive.amount > 0) {
      const reduction = Math.min(ability.passive.amount, remaining);
      remaining -= reduction;
      pushReductionEvents(events, side, creature, ability.name, reduction);
    }
  }

  // Triggered beforeDamage reduceDamage (Shellkin, Pebbleback, Ironhide, Titanback, …)
  if (ability.trigger?.event === 'beforeDamage' && remaining > 0) {
    const matches = findMatchingTriggers(
      [{ card: creature, ownerKey: 'me', owner, type: 'creature' }],
      'beforeDamage',
      {
        target: creature,
        self: creature,
        targetOwner: 'me',
        triggerOwnerKey: 'me',
        damage: remaining
      }
    );

    for (const match of sortByPriority(matches)) {
      if (remaining <= 0) break;
      const effects = match.card.ability?.effects || [];
      for (const effect of effects) {
        if (effect.type !== 'reduceDamage') continue;

        if (effect.perTurn) {
          const flag = `${match.card.id}Used`;
          if (creature[flag]) continue;
          creature[flag] = true;
        }

        const amount = effect.amount || 0;
        if (amount <= 0) continue;
        const reduction = Math.min(amount, remaining);
        remaining -= reduction;
        pushReductionEvents(
          events,
          side,
          creature,
          match.card.ability?.name || 'Ability',
          reduction
        );
      }
    }
  }

  return remaining;
}

function pushReductionEvents(events, side, creature, abilityName, reduction) {
  if (!events || reduction <= 0) return;
  const base = side != null ? { side } : {};
  events.push({
    type: 'abilityTrigger',
    ...base,
    creature: creature.name,
    ability: abilityName
  });
  events.push({
    type: 'damageReduced',
    ...base,
    amount: reduction,
    source: abilityName
  });
}
