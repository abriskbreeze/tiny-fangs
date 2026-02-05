/**
 * Effects System
 * Declarative effect primitives for card abilities
 * 
 * Usage (browser): Effects.damage(ctx, { target: 'opp.active', amount: 20 })
 * Usage (tests): import { Effects, processEffects } from './effects.js'
 */

// Helper: resolve target string to actual object
function resolveTarget(ctx, targetStr) {
  if (!targetStr) return null;
  
  const [owner, location] = targetStr.split('.');
  const ownerObj = ctx[owner]; // 'me' or 'opp'
  
  if (!ownerObj) return null;
  return ownerObj[location]; // 'active', etc.
}

// Helper: evaluate condition string
function evalCondition(condition, ctx) {
  if (!condition) return true;
  
  // Simple existence check: 'opp.active' -> ctx.opp.active exists
  const target = resolveTarget(ctx, condition);
  return !!target;
}

// Effect primitives
const Effects = {
  /**
   * Deal damage to a target
   * @returns {{ ko: boolean, target?: string, creature?: object, owner?: object }}
   */
  async damage(ctx, { target, amount }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return { ko: false };
    
    creature.curHp -= amount;
    
    // Animation (if available)
    if (typeof Anim !== 'undefined') {
      const [owner] = target.split('.');
      await Anim.damage(owner, amount);
    }
    
    const isKo = creature.curHp <= 0;
    return { 
      ko: isKo, 
      target,
      creature,
      owner: target.startsWith('me') ? ctx.me : ctx.opp
    };
  },

  /**
   * Heal a target
   */
  async heal(ctx, { target, amount }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return;
    
    creature.curHp = Math.min(creature.hp, creature.curHp + amount);
    
    if (typeof Anim !== 'undefined') {
      const [owner] = target.split('.');
      Anim.heal(owner, amount);
    }
  },

  /**
   * Draw cards from deck
   * @param {number|string} count - Number or computed value ('creatureCount')
   */
  async draw(ctx, { count, max }) {
    // Compute count if it's a string reference
    let drawCount = count;
    if (count === 'creatureCount') {
      drawCount = (ctx.me.active ? 1 : 0) + ctx.me.bench.length;
    }
    
    // Apply max cap if specified
    if (max !== undefined) {
      drawCount = Math.min(drawCount, max);
    }
    
    for (let i = 0; i < drawCount; i++) {
      // Use game's draw function if provided (handles deck out)
      if (ctx.draw) {
        ctx.draw();
      } else {
        // Fallback for tests
        if (ctx.me.deck.length === 0) break;
        const card = ctx.me.deck.shift();
        ctx.me.hand.push(card);
      }
    }
    
    return { drawn: drawCount };
  },

  /**
   * Lose life points
   */
  async loseLife(ctx, { count }) {
    ctx.me.lp -= count;
    
    if (typeof Anim !== 'undefined') {
      Anim.lpDamage('me', count);
    }
  },

  /**
   * Gain mana
   */
  async gainMana(ctx, { amount }) {
    ctx.me.mana += amount;
    
    if (typeof Anim !== 'undefined') {
      Anim.manaGain();
    }
  },

  /**
   * Add attack bonus
   */
  async atkBonus(ctx, { amount, source }) {
    ctx.me.attackBonuses.push({ source, value: amount });
  },

  /**
   * Set a status flag on creature
   */
  async setStatus(ctx, { target, status }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return;
    
    creature[status] = true;
  },

  /**
   * Cure a status effect
   */
  async cureStatus(ctx, { target, status }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return;
    
    if (status === 'poison') {
      creature.status = null;
      ctx.me.poisoned = false;
    } else {
      creature[status] = null;
    }
  },

  /**
   * Move a card between zones
   */
  async moveCard(ctx, { from, to, target }) {
    // Get the card to move
    let card = null;
    if (target === 'selected') {
      card = ctx.selected;
    }
    if (!card) return;
    
    // Parse zone strings (e.g., 'me.grave' -> ctx.me.grave)
    const [fromOwner, fromZone] = from.split('.');
    const [toOwner, toZone] = to.split('.');
    
    const fromArray = ctx[fromOwner][fromZone];
    const toArray = ctx[toOwner][toZone];
    
    // Remove from source
    const idx = fromArray.findIndex(c => c.uid === card.uid);
    if (idx !== -1) {
      fromArray.splice(idx, 1);
    }
    
    // Add to destination
    toArray.push(card);
  },

  /**
   * Set a flag on player
   */
  async setFlag(ctx, { flag, value }) {
    ctx.me[flag] = value;
  },

  /**
   * Banish (remove from game, not to grave)
   */
  async banish(ctx, { target }) {
    const [owner, location] = target.split('.');
    const ownerObj = ctx[owner];
    
    if (location === 'active' && ownerObj.active) {
      if (typeof Anim !== 'undefined') {
        await Anim.ko(owner);
      }
      ownerObj.active = null;
      // Note: does NOT go to grave - removed from game
      return { banished: true, owner, needsReplacement: true };
    }
    
    return { banished: false };
  },

  /**
   * AoE damage to all creatures (both sides)
   * Captures targets first, then applies damage, then processes KOs
   */
  async aoeAll(ctx, { amount }) {
    const kos = [];
    
    // Phase 1: Capture all targets BEFORE any damage
    const targets = {
      meActive: ctx.me.active,
      meBench: [...ctx.me.bench],
      oppActive: ctx.opp.active,
      oppBench: [...ctx.opp.bench]
    };
    
    // Phase 2: Animate all damage
    if (typeof Anim !== 'undefined') {
      if (targets.meActive) await Anim.damage('me', amount);
      for (let i = 0; i < targets.meBench.length; i++) {
        await Anim.benchDamage('me', i, amount);
      }
      if (targets.oppActive) await Anim.damage('opp', amount);
      for (let i = 0; i < targets.oppBench.length; i++) {
        await Anim.benchDamage('opp', i, amount);
      }
    }
    
    // Phase 3: Apply damage to all captured targets
    const koResults = { meActive: false, meBench: [], oppActive: false, oppBench: [] };
    
    if (targets.meActive) {
      targets.meActive.curHp -= amount;
      koResults.meActive = targets.meActive.curHp <= 0;
    }
    for (const bc of targets.meBench) {
      bc.curHp -= amount;
      koResults.meBench.push({ creature: bc, ko: bc.curHp <= 0 });
    }
    if (targets.oppActive) {
      targets.oppActive.curHp -= amount;
      koResults.oppActive = targets.oppActive.curHp <= 0;
    }
    for (const bc of targets.oppBench) {
      bc.curHp -= amount;
      koResults.oppBench.push({ creature: bc, ko: bc.curHp <= 0 });
    }
    
    // Collect KO info for caller to process (bench first, then active)
    for (const { creature, ko } of koResults.meBench) {
      if (ko) kos.push({ target: 'me.bench', creature, owner: ctx.me, isBench: true });
    }
    for (const { creature, ko } of koResults.oppBench) {
      if (ko) kos.push({ target: 'opp.bench', creature, owner: ctx.opp, isBench: true });
    }
    if (koResults.meActive) {
      kos.push({ target: 'me.active', creature: targets.meActive, owner: ctx.me, isBench: false });
    }
    if (koResults.oppActive) {
      kos.push({ target: 'opp.active', creature: targets.oppActive, owner: ctx.opp, isBench: false });
    }
    
    return { kos };
  },

  /**
   * Summon creature from deck
   */
  async summon(ctx, { filter, location }) {
    // Filter deck for valid targets
    let candidates = ctx.me.deck;
    
    if (filter?.cost !== undefined) {
      candidates = candidates.filter(c => c.cardType === 'creature' && c.cost === filter.cost);
    }
    
    if (candidates.length === 0) return { summoned: false };
    
    // Random selection
    const summon = candidates[Math.floor(Math.random() * candidates.length)];
    ctx.me.deck = ctx.me.deck.filter(c => c.uid !== summon.uid);
    
    if (location === 'active' || !ctx.me.active) {
      ctx.me.active = summon;
      if (typeof Anim !== 'undefined') {
        await Anim.summon('me');
      }
    } else {
      ctx.me.bench.push(summon);
      if (typeof Anim !== 'undefined') {
        await Anim.summonBench('me', ctx.me.bench.length - 1);
      }
    }
    
    return { summoned: true, creature: summon };
  }
};

/**
 * Process all effects for a card
 * @param {object} card - Card with effects array
 * @param {object} ctx - Context with state, me, opp, selected
 * @returns {{ success: boolean, kos: array }}
 */
async function processEffects(card, ctx) {
  const kos = [];
  
  for (const effect of card.effects || []) {
    // Check condition
    if (effect.condition && !evalCondition(effect.condition, ctx)) {
      continue;
    }
    
    // Execute effect
    const effectFn = Effects[effect.type];
    if (!effectFn) {
      console.warn(`Unknown effect type: ${effect.type}`);
      continue;
    }
    
    const result = await effectFn(ctx, effect);
    
    // Collect KO results
    if (result?.ko) {
      kos.push({
        target: result.target,
        creature: result.creature,
        owner: result.owner
      });
    }
  }
  
  return { success: true, kos };
}

// Export for ES modules (tests)
export { Effects, processEffects, resolveTarget, evalCondition };

// Also attach to global for browser IIFE usage
if (typeof window !== 'undefined') {
  window.Effects = Effects;
  window.processEffects = processEffects;
}
