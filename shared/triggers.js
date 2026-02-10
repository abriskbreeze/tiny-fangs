/**
 * Trigger System - Pure Logic
 * Processes declarative triggers for set verses and creature abilities
 * 
 * Priority Levels (1 = highest, fires first):
 * 1 - Negate triggers (cancel other triggers)
 * 2 - Negate action (negateAttack, negateSpell)
 * 3 - Pre-modification (reduceDamage, shields)
 * 4 - Standard triggers (DEFAULT)
 * 5 - Post-event ("after X happens")
 */

/**
 * Get priority for a trigger based on its effects
 * @param {object} trigger - Trigger definition
 * @param {object} card - Card with effects
 * @returns {number} Priority 1-5
 */
export function getTriggerPriority(trigger, card) {
  // Explicit priority takes precedence
  if (trigger.priority !== undefined) {
    return trigger.priority;
  }

  // Auto-detect from effects
  if (card?.effects) {
    for (const effect of card.effects) {
      // Priority 1: Negate other triggers
      if (effect.type === 'negateTrigger') return 1;
      
      // Priority 2: Negate attacks/spells
      if (effect.type === 'negateAttack' || effect.type === 'negateSpell' || effect.type === 'negateKO') return 2;
      
      // Priority 3: Damage reduction
      if (effect.type === 'reduceDamage') return 3;
    }
  }

  // Default: Standard (4)
  return 4;
}

/**
 * Check if a trigger matches an event and context
 * @param {object} trigger - Trigger definition { event, condition? }
 * @param {string} event - Event type being emitted
 * @param {object} context - Event context
 * @returns {boolean}
 */
export function matchesTrigger(trigger, event, context) {
  // Event type must match
  if (trigger.event !== event) return false;

  // No condition = always matches
  if (!trigger.condition) return true;

  const cond = trigger.condition;

  // Target condition: { target: 'me.active' }
  // 'me'/'opp' are RELATIVE to trigger owner
  if (cond.target) {
    if (cond.target === 'self') {
      // For creature abilities - check if this creature is the target
      if (context.target !== context.self) return false;
    } else {
      // Parse 'me.active' or 'opp.active'
      const [owner, location] = cond.target.split('.');
      
      // Handle relative owner matching (me/opp relative to trigger owner)
      let targetOwnerMatches;
      if (owner === 'me') {
        // 'me' means target owner should be the same as trigger owner
        targetOwnerMatches = context.targetOwner === context.triggerOwnerKey;
      } else if (owner === 'opp') {
        // 'opp' means target owner should be different from trigger owner
        targetOwnerMatches = context.targetOwner !== context.triggerOwnerKey;
      } else {
        // Absolute owner specified
        targetOwnerMatches = context.targetOwner === owner;
      }
      
      if (!targetOwnerMatches) return false;
      if (location && context.targetLocation !== location) return false;
    }
  }

  // Attacker condition: { attacker: 'opp' }, { attacker: 'me' }, or { attacker: 'self' }
  // 'me'/'opp' are RELATIVE to trigger owner (same pattern as target condition)
  if (cond.attacker) {
    if (cond.attacker === 'self') {
      // The creature with this ability must be the attacker
      if (context.attacker !== context.self) return false;
    } else if (cond.attacker === 'me') {
      // Attacker should be same as trigger owner
      if (context.attackerOwnerKey !== context.triggerOwnerKey) return false;
    } else if (cond.attacker === 'opp') {
      // Attacker should be different from trigger owner (opponent attacking)
      if (context.attackerOwnerKey === context.triggerOwnerKey) return false;
    }
  }

  // Defender condition: { defender: 'self' }, { defender: 'me' }, or { defender: 'opp' }
  // 'me'/'opp' are RELATIVE to trigger owner (same pattern as attacker condition)
  if (cond.defender) {
    if (cond.defender === 'self') {
      if (context.defender !== context.self) return false;
    } else if (cond.defender === 'me') {
      // Defender should be same as trigger owner
      if (context.defenderOwnerKey !== context.triggerOwnerKey) return false;
    } else if (cond.defender === 'opp') {
      // Defender should be different from trigger owner
      if (context.defenderOwnerKey !== context.triggerOwnerKey) return false;
    }
  }

  // afterAttack conditions
  // didDamage: { didDamage: true } - attack must have dealt damage
  if (cond.didDamage === true && !context.didDamage) return false;
  
  // defenderAlive: { defenderAlive: true } - defender must have survived
  if (cond.defenderAlive === true && context.defenderAlive === false) return false;
  
  // causedKO: { causedKO: true } - attack must have KO'd the defender
  if (cond.causedKO === true && !context.causedKO) return false;

  // Source condition: { source: 'attack' } - KO must come from attack, not verse
  // BUG-06 FIX: Vengeance should only trigger on attack KO
  if (cond.source && context.source !== cond.source) return false;

  // Owner condition: { owner: 'me' } - relative to trigger owner
  // Used for "when YOUR creature is KO'd" or "when YOU would lose life" triggers
  // 'me' means the affected entity's owner should match the trigger owner
  if (cond.owner) {
    // Support both creatureOwnerKey (for KO) and ownerKey (for life loss)
    const affectedOwnerKey = context.creatureOwnerKey || context.ownerKey;
    if (cond.owner === 'me') {
      // Trigger owner must match affected entity's owner
      if (affectedOwnerKey !== context.triggerOwnerKey) return false;
    } else if (cond.owner === 'opp') {
      // Trigger owner must NOT match affected entity's owner
      if (affectedOwnerKey === context.triggerOwnerKey) return false;
    }
  }

  // hasBench condition: { hasBench: true } - trigger owner must have bench creatures
  // context.triggerOwner is the player who owns the trigger
  if (cond.hasBench === true) {
    if (!context.triggerOwner || context.triggerOwner.bench.length === 0) return false;
  }

  // Caster condition: { caster: 'opp' } - relative to trigger owner
  // Used for "when OPPONENT casts a spell" triggers (e.g., Mana Drain)
  if (cond.caster) {
    // context.casterKey is 'me' or 'opp' from the emitter's perspective
    // triggerOwnerKey tells us who owns the trigger
    if (cond.caster === 'opp') {
      // Caster must be opponent of trigger owner
      if (context.casterKey === context.triggerOwnerKey) return false;
    } else if (cond.caster === 'me') {
      // Caster must be the trigger owner
      if (context.casterKey !== context.triggerOwnerKey) return false;
    }
  }

  // Grave conditions - requires triggerOwner player context
  if (cond.hasOneCostInGrave && context.triggerOwner) {
    const hasOneCost = context.triggerOwner.grave.some(
      c => c.cardType === 'creature' && c.cost === 1
    );
    if (!hasOneCost) return false;
  }

  if (cond.benchNotFull && context.triggerOwner) {
    if (context.triggerOwner.bench.length >= 2) return false;
  }

  // Last life condition: { lastLife: true } - context must have lastLife flag
  if (cond.lastLife && !context.lastLife) return false;

  // Self condition: { self: true } - for creature abilities, the creature with the ability
  // must be the one being affected. Works for:
  // - onSummon: context.summoned === context.self
  // - onLethalDamage: context.creature === context.self
  // - other events with a creature context
  if (cond.self === true) {
    const affected = context.summoned || context.creature;
    if (!affected || affected !== context.self) return false;
  }

  // Self position condition: { self: 'active' } - creature must be in active slot
  // Used for Broodmother's "end of your turn" trigger
  if (cond.self === 'active') {
    if (!context.self || !context.triggerOwner) return false;
    if (context.triggerOwner.active !== context.self) return false;
  }

  // Survived condition: { survived: true } - target must have survived damage
  // Used for Skitter's "when damaged" trigger (only if not KO'd)
  if (cond.survived === true && context.survived !== true) return false;

  // notUsed condition: { notUsed: 'flagName' } - creature must not have used this ability
  // Used for Bulwark's "once per game" Fortress ability
  if (cond.notUsed && context.self?.[cond.notUsed]) return false;

  // Swarm condition: { swarm: true } - trigger owner must have 2+ creatures total
  // Used for Hiveling's "when summoned with 2+ creatures"
  if (cond.swarm === true) {
    if (!context.triggerOwner) return false;
    const creatureCount = (context.triggerOwner.active ? 1 : 0) + context.triggerOwner.bench.length;
    if (creatureCount < 2) return false;
  }

  // Location condition: { location: 'bench' } - summon must be to specific location
  // Used for Hiveling's "when summoned to the bench" ability
  if (cond.location && context.summonLocation !== cond.location) return false;

  // BUG-C3 FIX: myTurn condition - trigger only fires on owner's turn
  // Used for Broodmother's "End of YOUR turn" ability
  if (cond.myTurn === true) {
    // activePlayerKey tells us whose turn is ending
    if (context.activePlayerKey !== context.triggerOwnerKey) return false;
  }

  return true;
}

/**
 * Find all triggers that should fire for an event
 * @param {Array<object>} cards - Array of cards to check (can include set verses and creatures)
 * @param {string} event - Event type
 * @param {object} context - Event context
 * @returns {Array<{type: string, card: object, owner: object, priority: number}>}
 */
export function findMatchingTriggers(cards, event, context) {
  const matches = [];

  for (const cardEntry of cards) {
    const { card, ownerKey, owner, type } = cardEntry;

    // Check set verse triggers
    if (type === 'setVerse') {
      const trigger = card.triggerDef || card.trigger;
      if (trigger) {
        const ctxWithOwner = { ...context, triggerOwnerKey: ownerKey, triggerOwner: owner };
        if (matchesTrigger(trigger, event, ctxWithOwner)) {
          matches.push({
            type: 'setVerse',
            card,
            owner,
            ownerKey,
            priority: getTriggerPriority(trigger, card),
            cannotBeNegated: trigger.cannotBeNegated || false
          });
        }
      }
    }

    // Check creature ability triggers
    if (type === 'creature' && card.ability?.trigger) {
      const ctxWithSelf = { ...context, self: card, triggerOwner: owner, triggerOwnerKey: ownerKey };
      
      if (matchesTrigger(card.ability.trigger, event, ctxWithSelf)) {
        matches.push({
          type: 'ability',
          card,
          owner,
          ownerKey,
          priority: getTriggerPriority(card.ability.trigger, card),
          cannotBeNegated: card.ability.trigger.cannotBeNegated || false
        });
      }
    }

    // Special handling for death/summon abilities on the specific creature
    if (type === 'special') {
      if (event === 'onKO' && card === context.creature && card.ability?.trigger?.event === 'onKO') {
        const selfCondition = card.ability.trigger.condition?.target === 'self';
        if (selfCondition || !card.ability.trigger.condition?.target) {
          matches.push({
            type: 'deathAbility',
            card,
            owner,
            ownerKey,
            priority: getTriggerPriority(card.ability.trigger, card),
            cannotBeNegated: card.ability.trigger.cannotBeNegated || false
          });
        }
      }

      if (event === 'onSummon' && card === context.summoned && card.ability?.trigger?.event === 'onSummon') {
        const selfCondition = card.ability.trigger.condition?.self === true;
        if (selfCondition || !card.ability.trigger.condition) {
          matches.push({
            type: 'summonAbility',
            card,
            owner,
            ownerKey,
            priority: getTriggerPriority(card.ability.trigger, card),
            cannotBeNegated: card.ability.trigger.cannotBeNegated || false
          });
        }
      }

      if (event === 'onLethalDamage' && card === context.creature && card.ability?.trigger?.event === 'onLethalDamage') {
        const selfCondition = card.ability.trigger.condition?.self === true;
        if (selfCondition || !card.ability.trigger.condition?.target) {
          const ctxWithSelf = { ...context, self: card, triggerOwner: owner, triggerOwnerKey: ownerKey };
          const notUsedFlag = card.ability.trigger.condition?.notUsed;
          
          if (notUsedFlag && card[notUsedFlag]) {
            // Already used, skip
          } else if (matchesTrigger(card.ability.trigger, event, ctxWithSelf)) {
            matches.push({
              type: 'survivalAbility',
              card,
              owner,
              ownerKey,
              priority: getTriggerPriority(card.ability.trigger, card),
              cannotBeNegated: card.ability.trigger.cannotBeNegated || false
            });
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Sort triggers by priority
 * @param {Array<object>} triggers - Array of trigger matches
 * @param {string} [activePlayerKey] - Optional active player key for tiebreaking
 * @returns {Array<object>} Sorted triggers (mutates input array)
 */
export function sortByPriority(triggers, activePlayerKey = 'me') {
  return triggers.sort((a, b) => {
    // Primary sort: priority (ascending - lower fires first)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // Tiebreaker: non-active player fires first (defender advantage)
    if (a.ownerKey !== b.ownerKey) {
      return a.ownerKey === activePlayerKey ? 1 : -1;
    }
    
    return 0;
  });
}
