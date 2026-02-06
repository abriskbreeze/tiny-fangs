/**
 * Trigger System
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
function getTriggerPriority(trigger, card) {
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
function matchesTrigger(trigger, event, context) {
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

  // Attacker condition: { attacker: 'opp' } or { attacker: 'self' }
  if (cond.attacker) {
    if (cond.attacker === 'self') {
      // The creature with this ability must be the attacker
      if (context.attacker !== context.self) return false;
    } else {
      if (context.attackerOwner !== cond.attacker) return false;
    }
  }

  // Defender condition: { defender: 'self' }
  if (cond.defender) {
    if (cond.defender === 'self') {
      if (context.defender !== context.self) return false;
    } else {
      if (context.defenderOwner !== cond.defender) return false;
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
  // must be the one being summoned/affected (context.summoned === context.self)
  if (cond.self === true) {
    if (!context.summoned || context.summoned !== context.self) return false;
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

  // Swarm condition: { swarm: true } - trigger owner must have 2+ creatures total
  // Used for Hiveling's "when summoned with 2+ creatures"
  if (cond.swarm === true) {
    if (!context.triggerOwner) return false;
    const creatureCount = (context.triggerOwner.active ? 1 : 0) + context.triggerOwner.bench.length;
    if (creatureCount < 2) return false;
  }

  return true;
}

/**
 * Find all triggers that should fire for an event
 * @param {string} event - Event type
 * @param {object} context - Event context
 * @param {object} state - Game state
 * @returns {Array<{type: string, card: object, owner: object}>}
 */
function getMatchingTriggers(event, context, state) {
  const matches = [];

  // Check set verses for both players
  for (const [ownerKey, player] of [['me', state.G.me], ['opp', state.G.opp]]) {
    // Check triggerDef first (from card definitions), then trigger (for test mocks)
    const trigger = player.setVerse?.triggerDef || player.setVerse?.trigger;
    if (trigger) {
      // Add triggerOwnerKey and triggerOwner to context for condition matching
      const ctxWithOwner = { ...context, triggerOwnerKey: ownerKey, triggerOwner: player };
      if (matchesTrigger(trigger, event, ctxWithOwner)) {
        matches.push({
          type: 'setVerse',
          card: player.setVerse,
          owner: player,
          ownerKey,
          priority: getTriggerPriority(trigger, player.setVerse),
          cannotBeNegated: trigger.cannotBeNegated || false
        });
      }
    }
  }

  // Check creature abilities for both players
  for (const [ownerKey, player] of [['me', state.G.me], ['opp', state.G.opp]]) {
    const creatures = [player.active, ...player.bench].filter(Boolean);
    
    for (const creature of creatures) {
      if (creature.ability?.trigger) {
        // Add 'self' and 'triggerOwner' references for creature abilities
        const ctxWithSelf = { ...context, self: creature, triggerOwner: player, triggerOwnerKey: ownerKey };
        
        if (matchesTrigger(creature.ability.trigger, event, ctxWithSelf)) {
          matches.push({
            type: 'ability',
            card: creature,
            owner: player,
            ownerKey,
            priority: getTriggerPriority(creature.ability.trigger, creature),
            cannotBeNegated: creature.ability.trigger.cannotBeNegated || false
          });
        }
      }
    }
  }

  // Special handling for onKO: check if the KO'd creature has a death ability
  // (creature is already in grave, so not in the loop above)
  if (event === 'onKO' && context.creature?.ability?.trigger) {
    const ability = context.creature.ability;
    if (ability.trigger.event === 'onKO') {
      // Check if trigger condition is for self (dying creature)
      const selfCondition = ability.trigger.condition?.target === 'self';
      if (selfCondition || !ability.trigger.condition?.target) {
        // Find the owner
        const ownerKey = context.creatureOwnerKey;
        const owner = ownerKey === 'me' ? state.G.me : state.G.opp;
        
        matches.push({
          type: 'deathAbility',
          card: context.creature,
          owner: owner,
          ownerKey: ownerKey,
          priority: getTriggerPriority(ability.trigger, context.creature),
          cannotBeNegated: ability.trigger.cannotBeNegated || false
        });
      }
    }
  }

  // Special handling for onSummon: check the summoned creature's own ability
  // (creature may not be on field yet when emitOnSummon is called)
  if (event === 'onSummon' && context.summoned?.ability?.trigger) {
    const ability = context.summoned.ability;
    if (ability.trigger.event === 'onSummon') {
      // Check if trigger condition is for self (the summoned creature)
      const selfCondition = ability.trigger.condition?.self === true;
      if (selfCondition || !ability.trigger.condition) {
        const ownerKey = context.creatureOwnerKey || context.summoningPlayer;
        const owner = ownerKey === 'me' ? state.G.me : state.G.opp;
        
        matches.push({
          type: 'summonAbility',
          card: context.summoned,
          owner: owner,
          ownerKey: ownerKey,
          priority: getTriggerPriority(ability.trigger, context.summoned),
          cannotBeNegated: ability.trigger.cannotBeNegated || false
        });
      }
    }
  }

  return matches;
}

/**
 * Process all matching triggers for an event
 * @param {string} event - Event type
 * @param {object} context - Event context
 * @param {object} state - Game state
 * @param {object} gameCtx - Game context with helper functions
 * @returns {object} Modified context (for damage reduction, etc.)
 */
async function processTriggers(event, context, state, gameCtx) {
  const matches = getMatchingTriggers(event, context, state);
  
  // Sort by priority (ascending: 1 fires first)
  // Tiebreaker: defender/non-active player first
  const activePlayerKey = context.activePlayerKey || 'me';
  matches.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;  // Lower priority number = fires first
    }
    // Same priority: non-active player fires first (defender advantage)
    if (a.ownerKey !== b.ownerKey) {
      return a.ownerKey === activePlayerKey ? 1 : -1;
    }
    return 0;
  });
  
  // Track modifications to context (e.g., damage reduction)
  let modifiedContext = { ...context, damageReduction: context.damageReduction || 0 };

  for (const match of matches) {
    // Get trigger definition - check triggerDef first (card definitions), then trigger/ability.trigger
    const trigger = match.card.triggerDef || match.card.trigger || match.card.ability?.trigger;

    // Handle optional triggers (player choice)
    if (trigger.optional && gameCtx.promptTrigger) {
      const shouldTrigger = await gameCtx.promptTrigger(match.owner, match.card, context);
      if (!shouldTrigger) continue;
    }

    // Show trigger reveal animation
    if (gameCtx.showTriggerReveal) {
      await gameCtx.showTriggerReveal(match.card);
    }

    // Get effects - could be on card directly (set verses) or on ability (creatures)
    const effects = match.card.effects || match.card.ability?.effects;

    // Execute effects if card has them
    if (effects) {
      for (const effect of effects) {
        // Handle damage reduction effect directly
        if (effect.type === 'reduceDamage') {
          modifiedContext.damageReduction += effect.amount;
          modifiedContext.triggeredCard = match.card;
          if (gameCtx.log) {
            gameCtx.log(`${match.card.name}! -${effect.amount} damage`, 'heal');
          }
        }
        // Handle spell negation (for Mana Drain)
        else if (effect.type === 'negateSpell') {
          modifiedContext.negated = true;
          modifiedContext.triggeredCard = match.card;
          if (gameCtx.log) {
            gameCtx.log(`${match.card.name} triggered!`, 'dmg');
          }
        }
        // Handle mana gain (for Mana Drain)
        else if (effect.type === 'gainMana') {
          match.owner.mana = Math.min(5, match.owner.mana + effect.amount);
          if (gameCtx.log) {
            gameCtx.log(`${match.ownerKey === 'me' ? 'You' : 'Rival'} gained ${effect.amount} mana`);
          }
        }
        // Other effects handled by processEffects
        else if (gameCtx.processEffects) {
          const effectCtx = {
            state,
            me: match.owner,
            opp: match.owner === state.G.me ? state.G.opp : state.G.me,
            log: gameCtx.log,
            render: gameCtx.render,
            promptGraveSelect: gameCtx.promptGraveSelect,
            ...modifiedContext
          };
          const result = await gameCtx.processEffects(match.card, effectCtx);
          
          // Merge any modifications
          if (result?.modifiedContext) {
            modifiedContext = { ...modifiedContext, ...result.modifiedContext };
          }
        }
      }
    }

    // Consume set verse (send to grave)
    if (match.type === 'setVerse') {
      match.owner.grave.push(match.card);
      match.owner.setVerse = null;
    }
  }

  return modifiedContext;
}

// Export for ES modules
export { getTriggerPriority, matchesTrigger, getMatchingTriggers, processTriggers };

// Attach to window for browser
if (typeof window !== 'undefined') {
  window.getTriggerPriority = getTriggerPriority;
  window.matchesTrigger = matchesTrigger;
  window.getMatchingTriggers = getMatchingTriggers;
  window.processTriggers = processTriggers;
}
