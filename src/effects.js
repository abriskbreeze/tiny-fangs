/**
 * Effects System - Client Animation Wrapper
 * 
 * This wraps the shared pure-logic effects with browser animations.
 * Architecture:
 * 1. Import shared effects (pure logic)
 * 2. Call shared function to get { events, kos, ... }
 * 3. Play animations based on events
 * 4. Return result
 * 
 * The shared module does all the game logic. This layer only handles animations.
 */

import { Effects as CoreEffects, processEffects as coreProcessEffects } from '../shared/effects.js';

// Get Anim from global scope (works in browser and tests with mock)
const getAnim = () => globalThis.Anim;

/**
 * Play animation events returned from shared effects
 * @param {Array<object>} events - Animation events from shared
 */
async function playAnimations(events) {
  const Anim = getAnim();
  if (!Anim) return;
  
  for (const event of events) {
    switch (event.type) {
      case 'damage':
        if (event.isBench) {
          await Anim.benchDamage(event.animKey, event.benchIndex, event.amount);
        } else {
          await Anim.damage(event.animKey, event.amount);
        }
        break;
      
      case 'benchDamage':
        await Anim.benchDamage(event.animKey, event.benchIndex, event.amount);
        break;
      
      case 'heal':
        await Anim.heal(event.animKey, event.amount);
        break;
      
      case 'lpDamage':
        await Anim.lpDamage(event.animKey, event.amount);
        break;
      
      case 'manaGain':
        await Anim.manaGain();
        break;
      
      case 'ko':
        await Anim.ko(event.animKey);
        break;
      
      case 'benchKo':
        await Anim.benchKo(event.animKey, event.benchIndex);
        break;
      
      case 'summon':
        await Anim.summon(event.animKey);
        break;
      
      case 'summonBench':
        await Anim.summonBench(event.animKey, event.benchIndex);
        break;
      
      case 'benchToActive':
        await Anim.benchToActive(event.animKey);
        break;
      
      case 'wait':
        await Anim.wait(event.ms);
        break;
      
      case 'log':
        // Logs are handled by caller context - skip here
        break;
      
      default:
        console.warn(`Unknown animation event type: ${event.type}`);
    }
  }
}

// Wrapper effects - delegate to shared, play animations
const Effects = {
  async damage(ctx, params) {
    const result = CoreEffects.damage(ctx, params);
    await playAnimations(result.events || []);
    return result.ko ? { ko: true, ...result.ko } : { ko: false };
  },

  async heal(ctx, params) {
    const result = CoreEffects.heal(ctx, params);
    await playAnimations(result.events || []);
    // Return undefined if no events (no target or no heal)
    if (!result.events || result.events.length === 0) {
      return undefined;
    }
    return {};
  },

  async healSelf(ctx, params) {
    const result = CoreEffects.healSelf(ctx, params);
    await playAnimations(result.events || []);
    return { healed: result.healed };
  },

  async draw(ctx, params) {
    const result = CoreEffects.draw(ctx, params);
    return { drawn: result.drawn };
  },

  async loseLife(ctx, params) {
    const result = CoreEffects.loseLife(ctx, params);
    await playAnimations(result.events || []);
    return {};
  },

  async gainMana(ctx, params) {
    const result = CoreEffects.gainMana(ctx, params);
    await playAnimations(result.events || []);
    return {};
  },

  async atkBonus(ctx, params) {
    CoreEffects.atkBonus(ctx, params);
    return {};
  },

  async setStatus(ctx, params) {
    const result = CoreEffects.setStatus(ctx, params);
    // Log events manually here since shared returns them
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    return {};
  },

  async cureStatus(ctx, params) {
    CoreEffects.cureStatus(ctx, params);
    return {};
  },

  async moveCard(ctx, params) {
    CoreEffects.moveCard(ctx, params);
    return {};
  },

  async setFlag(ctx, params) {
    CoreEffects.setFlag(ctx, params);
    return {};
  },

  async banish(ctx, params) {
    const result = CoreEffects.banish(ctx, params);
    await playAnimations(result.events || []);
    return result;
  },

  async aoeAll(ctx, params) {
    const result = CoreEffects.aoeAll(ctx, params);
    await playAnimations(result.events || []);
    return { kos: result.kos || [] };
  },

  async koSelected(ctx) {
    const result = CoreEffects.koSelected(ctx);
    await playAnimations(result.events || []);
    // Log manually
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    return result;
  },

  async reduceDamage(ctx, params) {
    const result = CoreEffects.reduceDamage(ctx, params);
    return result;
  },

  async negateSpell(ctx) {
    const result = CoreEffects.negateSpell(ctx);
    return result;
  },

  async negateAttack(ctx) {
    const result = CoreEffects.negateAttack(ctx);
    return result;
  },

  async negateKO(ctx) {
    const result = CoreEffects.negateKO(ctx);
    return result;
  },

  async negateLifeLoss(ctx) {
    const result = CoreEffects.negateLifeLoss(ctx);
    return result;
  },

  async destroy(ctx, params) {
    const result = CoreEffects.destroy(ctx, params);
    await playAnimations(result.events || []);
    return result;
  },

  async summon(ctx, params) {
    const result = CoreEffects.summon(ctx, params);
    await playAnimations(result.events || []);
    return result;
  },

  async discard(ctx, params) {
    const result = CoreEffects.discard(ctx, params);
    return { discarded: result.discarded };
  },

  async loseLifeOpp(ctx, params) {
    const result = CoreEffects.loseLifeOpp(ctx, params);
    await playAnimations(result.events || []);
    return { lifeLost: result.lifeLost };
  },

  async summonFromGrave(ctx, params) {
    const result = CoreEffects.summonFromGrave(ctx, params);
    await playAnimations(result.events || []);
    // Log manually
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    if (ctx.render && result.summoned) {
      ctx.render();
    }
    return result;
  },

  async summonToken(ctx, params) {
    const result = CoreEffects.summonToken(ctx, params);
    await playAnimations(result.events || []);
    // Log manually
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    if (ctx.render && result.summoned) {
      ctx.render();
    }
    return result;
  },

  async swapWithBench(ctx, params) {
    const result = CoreEffects.swapWithBench(ctx, params);
    await playAnimations(result.events || []);
    // Log manually
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    if (ctx.render && result.swapped) {
      ctx.render();
    }
    return result;
  },

  async setHP(ctx, params) {
    const result = CoreEffects.setHP(ctx, params);
    // Log manually
    for (const event of result.events || []) {
      if (event.type === 'log' && ctx.log) {
        ctx.log(event.message, event.style);
      }
    }
    return result;
  },

  async markUsed(ctx, params) {
    const result = CoreEffects.markUsed(ctx, params);
    return result;
  }
};

/**
 * Process all effects for a card (wrapper for shared)
 * @param {object} card - Card with effects array
 * @param {object} ctx - Context with state, me, opp, selected
 * @returns {{ success: boolean, kos: array, modifiedContext: object }}
 */
async function processEffects(card, ctx) {
  const result = coreProcessEffects(card, ctx);
  
  // Play all animations
  await playAnimations(result.events || []);
  
  // Play log events manually
  for (const event of result.events || []) {
    if (event.type === 'log' && ctx.log) {
      ctx.log(event.message, event.style);
    }
  }
  
  return {
    success: result.success,
    kos: result.kos || [],
    modifiedContext: result.modifiedContext || {}
  };
}

// Re-export helper functions from shared (pure logic, no animation needed)
export { resolveTarget, evalCondition } from '../shared/effects.js';

// Export wrapped effects
export { Effects, processEffects };

// Also attach to global for browser IIFE usage
if (typeof window !== 'undefined') {
  window.Effects = Effects;
  window.processEffects = processEffects;
}
