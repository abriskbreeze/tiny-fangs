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
  
  // Special target: 'attacker' - the attacking creature (from attack context)
  if (targetStr === 'attacker') {
    return ctx.attacker;
  }
  
  // Special target: 'defender' - the defending creature (from attack context)
  if (targetStr === 'defender') {
    return ctx.defender;
  }
  
  // Special target: 'summoned' - the creature just summoned (from trigger context)
  if (targetStr === 'summoned') {
    return ctx.summoned;
  }
  
  const [owner, location] = targetStr.split('.');
  const ownerObj = ctx[owner]; // 'me' or 'opp'
  
  if (!ownerObj) return null;
  return ownerObj[location]; // 'active', etc.
}

// Helper: evaluate condition string
function evalCondition(condition, ctx) {
  if (!condition) return true;
  
  // Complex condition: 'me.grave.hasCreature' - check if grave has creatures
  if (condition === 'me.grave.hasCreature') {
    return ctx.me?.grave?.some(c => c.cardType === 'creature') || false;
  }
  if (condition === 'opp.grave.hasCreature') {
    return ctx.opp?.grave?.some(c => c.cardType === 'creature') || false;
  }
  
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
      let owner;
      if (target === 'attacker') {
        owner = ctx.attackerOwnerKey;
      } else if (target === 'summoned') {
        // Summoned creature - use the summoning player key from context
        owner = ctx.summoningPlayer || ctx.creatureOwnerKey || 'opp';
      } else {
        [owner] = target.split('.');
      }
      await Anim.damage(owner, amount);
    }
    
    const isKo = creature.curHp <= 0;
    
    // Determine owner object
    let owner;
    if (target === 'summoned') {
      // For summoned, use context to determine owner
      const ownerKey = ctx.summoningPlayer || ctx.creatureOwnerKey;
      owner = ownerKey === 'me' ? ctx.me : ctx.opp;
    } else if (target === 'attacker') {
      owner = ctx.attackerOwner;
    } else {
      owner = target.startsWith('me') ? ctx.me : ctx.opp;
    }
    
    return { 
      ko: isKo, 
      target,
      creature,
      owner
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
   * Heal the triggering creature (self)
   * Used for on-hit abilities like Drain, Digest
   * @param {number|string} amount - Fixed number or 'damageDealt' for dynamic
   */
  async healSelf(ctx, { amount }) {
    // Get the creature that triggered this ability
    const creature = ctx.self || ctx.attacker;
    if (!creature) return { healed: 0 };
    
    // Resolve dynamic amount
    let healAmount = amount;
    if (amount === 'damageDealt') {
      healAmount = ctx.damageDealt || 0;
    }
    
    // Don't heal more than missing HP
    const maxHeal = creature.hp - creature.curHp;
    const actualHeal = Math.min(healAmount, maxHeal);
    
    if (actualHeal <= 0) return { healed: 0 };
    
    creature.curHp += actualHeal;
    
    // Animation
    if (typeof Anim !== 'undefined') {
      const ownerKey = ctx.attackerOwnerKey || 'me';
      Anim.heal(ownerKey, actualHeal);
    }
    
    // Log
    if (ctx.log) {
      const abilityName = ctx.self?.ability?.name || 'Heal';
      ctx.log(`${abilityName}! +${actualHeal} HP`, 'heal');
    }
    
    return { healed: actualHeal };
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
   * Handles special cases like poison (creature.status + owner.poisoned)
   */
  async setStatus(ctx, { target, status }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return;
    
    // Determine owner for status flags
    let owner = null;
    if (target === 'defender') {
      owner = ctx.defenderOwner;
    } else if (target === 'attacker') {
      owner = ctx.attackerOwner;
    } else if (target.startsWith('me.')) {
      owner = ctx.me;
    } else if (target.startsWith('opp.')) {
      owner = ctx.opp;
    }
    
    // Handle poison status specially
    if (status === 'poison') {
      creature.status = 'poison';
      if (owner) owner.poisoned = true;
      if (ctx.log) ctx.log('Poisoned!');
    } else if (status === 'trapped') {
      creature.status = 'trapped';
      if (ctx.log) ctx.log('Trapped! Cannot retreat');
    } else {
      // Generic status flag
      creature[status] = true;
    }
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
   * @param {string} target - 'me' or 'opp' (default: 'me')
   */
  async setFlag(ctx, { flag, value, target }) {
    const player = target === 'opp' ? ctx.opp : ctx.me;
    player[flag] = value;
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
   * KO the selected creature (for Sacrifice)
   * Handles both active and bench creatures
   * Returns info for caller to process death abilities and triggers
   */
  async koSelected(ctx) {
    if (!ctx.selected) return { ko: false };
    
    const { creature, location, idx } = ctx.selected;
    const owner = ctx.me;
    const ownerKey = 'me'; // Sacrifice is always your own creature
    
    // Animation
    if (typeof Anim !== 'undefined') {
      if (location === 'active') {
        await Anim.ko('me');
      }
      // Bench KO animation could be added here
    }
    
    // Remove from field
    if (location === 'active') {
      owner.active = null;
    } else if (location === 'bench') {
      const benchIdx = owner.bench.indexOf(creature);
      if (benchIdx !== -1) {
        owner.bench.splice(benchIdx, 1);
      }
    }
    
    // Add to graveyard
    owner.grave.push(creature);
    
    // Log
    if (ctx.log) {
      ctx.log(`Sacrificed ${creature.name}`, 'dmg');
    }
    
    return { 
      ko: true, 
      creature, 
      owner,
      ownerKey,
      location,
      needsReplacement: location === 'active' && owner.bench.length > 0,
      // Signal that this is a self-sacrifice (no attacker)
      isSacrifice: true,
      modifiedContext: {
        sacrificedCreature: creature,
        sacrificeLocation: location
      }
    };
  },

  /**
   * Reduce incoming damage (for triggers)
   * Modifies ctx.damageReduction
   */
  async reduceDamage(ctx, { amount }) {
    ctx.damageReduction = (ctx.damageReduction || 0) + amount;
    return { modifiedContext: { damageReduction: ctx.damageReduction } };
  },

  /**
   * Negate a spell (for Mana Drain)
   */
  async negateSpell(ctx) {
    ctx.negated = true;
    return { modifiedContext: { negated: true } };
  },

  /**
   * Negate an attack (for Phantom Wall)
   * Attack doesn't resolve - no damage dealt
   */
  async negateAttack(ctx) {
    ctx.attackNegated = true;
    return { modifiedContext: { attackNegated: true } };
  },

  /**
   * Negate a KO (for Vengeance)
   * Creature survives with current HP (or 1 HP)
   */
  async negateKO(ctx) {
    ctx.koNegated = true;
    // If creature would be KO'd, set to 1 HP
    if (ctx.target && ctx.target.curHp <= 0) {
      ctx.target.curHp = 1;
    }
    return { modifiedContext: { koNegated: true } };
  },

  /**
   * Negate life loss (for Last Breath)
   * Player doesn't lose the life point
   */
  async negateLifeLoss(ctx) {
    ctx.lifeLossNegated = true;
    return { modifiedContext: { lifeLossNegated: true } };
  },

  /**
   * Destroy a creature (send to grave)
   * @param {string} target - 'attacker', 'me.active', 'opp.active'
   */
  async destroy(ctx, { target }) {
    let creature, owner, ownerKey;
    
    if (target === 'attacker') {
      creature = ctx.attacker;
      owner = ctx.attackerOwner;
      ownerKey = ctx.attackerOwnerKey;
    } else {
      const [ownerStr, location] = target.split('.');
      ownerKey = ownerStr;
      owner = ctx[ownerStr];
      creature = owner?.[location];
    }
    
    if (!creature || !owner) return { destroyed: false };
    
    // Animation
    if (typeof Anim !== 'undefined') {
      await Anim.ko(ownerKey);
    }
    
    // Send to grave
    owner.grave.push(creature);
    owner.active = null;
    
    return { 
      destroyed: true, 
      creature, 
      owner,
      ownerKey,
      needsReplacement: true,
      modifiedContext: { 
        destroyed: true,
        destroyedOwner: owner,
        destroyedOwnerKey: ownerKey,
        needsReplacement: true 
      }
    };
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
  },

  /**
   * Discard cards from hand
   * @param {string} target - 'opp' or 'me'
   * @param {number} count - Number of cards to discard
   * @param {boolean} random - If true, discard random cards
   */
  async discard(ctx, { target, count, random }) {
    const player = target === 'opp' ? ctx.opp : ctx.me;
    if (!player.hand.length) return { discarded: 0 };
    
    let discarded = 0;
    for (let i = 0; i < count && player.hand.length > 0; i++) {
      const idx = random ? Math.floor(Math.random() * player.hand.length) : 0;
      const card = player.hand.splice(idx, 1)[0];
      player.grave.push(card);
      discarded++;
    }
    
    return { discarded };
  },

  /**
   * Make opponent lose life points
   */
  async loseLifeOpp(ctx, { count }) {
    ctx.opp.lp -= count;
    
    if (typeof Anim !== 'undefined') {
      const oppKey = ctx.me === ctx.state?.G?.me ? 'opp' : 'me';
      Anim.lpDamage(oppKey, count);
    }
    
    return { lifeLost: count };
  },

  /**
   * Summon creature from graveyard
   * @param {object} filter - { cost: number } - filter by cost
   * @param {string} location - 'bench' (default, respects bench limit)
   */
  async summonFromGrave(ctx, { filter, location = 'bench' }) {
    // Check bench capacity
    if (location === 'bench' && ctx.me.bench.length >= 2) {
      return { summoned: false, reason: 'bench_full' };
    }

    // Filter grave for valid targets
    let candidates = ctx.me.grave.filter(c => c.cardType === 'creature');
    
    if (filter?.cost !== undefined) {
      candidates = candidates.filter(c => c.cost === filter.cost);
    }
    
    if (candidates.length === 0) return { summoned: false, reason: 'no_targets' };
    
    // Select creature (prompt if multiple, auto-select if one)
    let selected;
    if (candidates.length === 1) {
      selected = candidates[0];
    } else if (ctx.promptGraveSelect) {
      // Browser: prompt player to choose
      selected = await ctx.promptGraveSelect(candidates);
    } else {
      // Test/AI: pick first (or random)
      selected = candidates[0];
    }
    
    if (!selected) return { summoned: false, reason: 'cancelled' };
    
    // Restore HP
    selected.curHp = selected.hp;
    
    // Remove from grave
    ctx.me.grave = ctx.me.grave.filter(c => c.uid !== selected.uid);
    
    // Determine owner key for animations
    const ownerKey = ctx.me === ctx.state?.G?.me ? 'me' : 'opp';
    
    // Summon to bench
    if (location === 'bench') {
      const benchIdx = ctx.me.bench.length;
      ctx.me.bench.push(selected);
      
      if (ctx.log) {
        ctx.log(`${selected.name} rises to bench!`);
      }
      if (ctx.render) {
        ctx.render();
      }
      if (typeof Anim !== 'undefined') {
        await Anim.summonBench(ownerKey, benchIdx);
      }
    }
    
    return { summoned: true, creature: selected };
  }
};

/**
 * Process all effects for a card
 * @param {object} card - Card with effects array
 * @param {object} ctx - Context with state, me, opp, selected
 * @returns {{ success: boolean, kos: array, modifiedContext: object }}
 */
async function processEffects(card, ctx) {
  const kos = [];
  let modifiedContext = {};
  
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
    
    // Collect modifiedContext from effects
    if (result?.modifiedContext) {
      modifiedContext = { ...modifiedContext, ...result.modifiedContext };
    }
    
    // Collect KO results
    if (result?.ko) {
      kos.push({
        target: result.target,
        creature: result.creature,
        owner: result.owner
      });
    }
  }
  
  return { success: true, kos, modifiedContext };
}

// Export for ES modules (tests)
export { Effects, processEffects, resolveTarget, evalCondition };

// Also attach to global for browser IIFE usage
if (typeof window !== 'undefined') {
  window.Effects = Effects;
  window.processEffects = processEffects;
}
