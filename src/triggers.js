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
    if (player.setVerse?.trigger) {
      if (matchesTrigger(player.setVerse.trigger, event, context)) {
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
  let modifiedContext = { ...context };

  for (const match of matches) {
    const trigger = match.card.trigger || match.card.ability?.trigger;

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
    if (match.card.effects && gameCtx.processEffects) {
      const effectCtx = {
        state,
        me: match.owner,
        opp: match.owner === state.G.me ? state.G.opp : state.G.me,
        ...modifiedContext
      };
      const result = await gameCtx.processEffects(match.card, effectCtx);
      
      // Merge any modifications (damage reduction, etc.)
      if (result.modifiedContext) {
        modifiedContext = { ...modifiedContext, ...result.modifiedContext };
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
