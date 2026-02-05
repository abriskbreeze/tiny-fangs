/**
 * Trigger System
 * Processes declarative triggers for set verses and creature abilities
 */

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
  if (cond.target) {
    if (cond.target === 'self') {
      // For creature abilities - check if this creature is the target
      if (context.target !== context.self) return false;
    } else {
      // Parse 'me.active' or 'opp.active'
      const [owner, location] = cond.target.split('.');
      if (context.targetOwner !== owner) return false;
      if (location && context.targetLocation !== location) return false;
    }
  }

  // Attacker condition: { attacker: 'opp' }
  if (cond.attacker) {
    if (context.attackerOwner !== cond.attacker) return false;
  }

  // Defender condition: { defender: 'self' }
  if (cond.defender) {
    if (cond.defender === 'self') {
      if (context.defender !== context.self) return false;
    } else {
      if (context.defenderOwner !== cond.defender) return false;
    }
  }

  // Owner condition: { owner: 'me' } - relative to trigger owner
  // Used for "when YOUR creature is KO'd" type triggers
  // 'me' means the KO'd creature's owner should match the trigger owner
  if (cond.owner) {
    // context.creatureOwnerKey is 'me' or 'opp' from the emitter's perspective
    // context.triggerOwnerKey is passed during matching to compare
    if (cond.owner === 'me') {
      // Trigger owner must match KO'd creature owner
      if (context.creatureOwnerKey !== context.triggerOwnerKey) return false;
    } else if (cond.owner === 'opp') {
      // Trigger owner must NOT match KO'd creature owner
      if (context.creatureOwnerKey === context.triggerOwnerKey) return false;
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
          ownerKey
        });
      }
    }
  }

  // Check creature abilities for both players
  for (const [ownerKey, player] of [['me', state.G.me], ['opp', state.G.opp]]) {
    const creatures = [player.active, ...player.bench].filter(Boolean);
    
    for (const creature of creatures) {
      if (creature.ability?.trigger) {
        // Add 'self' reference for creature abilities
        const ctxWithSelf = { ...context, self: creature };
        
        if (matchesTrigger(creature.ability.trigger, event, ctxWithSelf)) {
          matches.push({
            type: 'ability',
            card: creature,
            owner: player,
            ownerKey
          });
        }
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

    // Execute effects if card has them
    if (match.card.effects) {
      for (const effect of match.card.effects) {
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
export { matchesTrigger, getMatchingTriggers, processTriggers };

// Attach to window for browser
if (typeof window !== 'undefined') {
  window.matchesTrigger = matchesTrigger;
  window.getMatchingTriggers = getMatchingTriggers;
  window.processTriggers = processTriggers;
}
