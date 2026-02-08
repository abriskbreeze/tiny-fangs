/**
 * Effects System
 * Declarative effect primitives for card abilities
 * 
 * Usage (browser): Effects.damage(ctx, { target: 'opp.active', amount: 20 })
 * Usage (tests): import { Effects, processEffects } from './effects.js'
 * 
 * Animation Support:
 * In browser: Anim is imported from index.html which loads anim.js and exposes it globally
 * In tests: global.Anim is mocked (no-op promises)
 * We use globalThis.Anim to access whichever is available.
 */

// Get Anim from global scope (works in browser and tests with mock)
const getAnim = () => globalThis.Anim;

// Helper: resolve target string to actual object
function resolveTarget(ctx, targetStr) {
  if (!targetStr) return null;
  
  // Special target: 'selected' - creature from target selector
  if (targetStr === 'selected') {
    // ctx.selected should be { creature, location, ownerKey, idx? }
    return ctx.selected?.creature || null;
  }
  
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
  
  // Special condition: 'damageWasDealt' - for Soul Siphon conditional heal
  if (condition === 'damageWasDealt') {
    return ctx.damageWasDealt === true;
  }
  
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
    
    // BUG-A1 FIX: Apply Harden (Shellkin) damage reduction for non-combat damage
    // Harden reduces first 10 damage from ANY source each turn
    let finalAmount = amount;
    if (creature.id === 'shellkin' && !creature.hardenUsed) {
      const reduction = Math.min(10, amount);
      finalAmount = Math.max(0, amount - reduction);
      creature.hardenUsed = true;
      if (ctx.log) {
        ctx.log(`Harden! -${reduction} damage`, 'heal');
      }
    }
    
    creature.curHp -= finalAmount;
    
    // Track that damage was dealt (for conditional healing like Soul Siphon)
    // Only mark as dealt if actual damage > 0
    if (finalAmount > 0) {
      ctx.damageWasDealt = true;
      
      // Log ability-triggered damage (e.g., Thornling Thorns, Coilshell Recoil)
      if (ctx.log && ctx.card?.ability?.name) {
        ctx.log(`${ctx.card.ability.name}! -${finalAmount} to ${creature.name}`, 'dmg');
      }
    }
    
    // Determine owner object first (needed for animation key)
    let owner;
    let ctxOwnerKey; // The key relative to ctx (me=caster's side)
    if (target === 'selected') {
      ctxOwnerKey = ctx.selected?.ownerKey || 'opp';
      owner = ctxOwnerKey === 'me' ? ctx.me : ctx.opp;
    } else if (target === 'summoned') {
      ctxOwnerKey = ctx.summoningPlayer || ctx.creatureOwnerKey || 'opp';
      owner = ctxOwnerKey === 'me' ? ctx.me : ctx.opp;
    } else if (target === 'attacker') {
      owner = ctx.attackerOwner;
      ctxOwnerKey = ctx.attackerOwnerKey;
    } else {
      [ctxOwnerKey] = target.split('.');
      owner = target.startsWith('me') ? ctx.me : ctx.opp;
    }
    
    // Animation (if available)
    // Animation key is ABSOLUTE: 'me' = player (bottom), 'opp' = AI (top)
    // Convert from ctx-relative key by checking against state.G
    if (getAnim() && finalAmount > 0) {
      const animKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
      
      // Check if target is on bench (for correct animation)
      let isBench = false;
      let benchIndex = 0;
      
      // For summoned creatures going to bench
      if (target === 'summoned' && ctx.summonLocation === 'bench') {
        isBench = true;
        benchIndex = owner.bench?.length || 0;
      }
      // For selected creatures, check if they're on bench
      else if (target === 'selected' && ctx.selected?.location === 'bench') {
        isBench = true;
        benchIndex = ctx.selected?.idx ?? owner.bench?.indexOf(creature) ?? 0;
      }
      // For explicit bench targets like 'opp.bench'
      else if (target.includes('.bench')) {
        isBench = true;
        benchIndex = owner.bench?.indexOf(creature) ?? 0;
      }
      
      if (isBench) {
        await getAnim().benchDamage(animKey, benchIndex, finalAmount);
      } else {
        await getAnim().damage(animKey, finalAmount);
      }
    }
    
    const isKo = creature.curHp <= 0;
    
    return { 
      ko: isKo, 
      target,
      creature,
      owner,
      ownerKey: ctxOwnerKey
    };
  },

  /**
   * Heal a target
   */
  async heal(ctx, { target, amount }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return;
    
    // Don't heal dead creatures (0 or negative HP)
    if (creature.curHp <= 0) return;
    
    const oldHp = creature.curHp;
    creature.curHp = Math.min(creature.hp, creature.curHp + amount);
    const actualHeal = creature.curHp - oldHp;
    
    // Animation (if available)
    // Determine owner for animation key
    if (getAnim() && actualHeal > 0) {
      const [ownerKey] = target.split('.');
      const owner = ownerKey === 'me' ? ctx.me : ctx.opp;
      const animKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
      await getAnim().heal(animKey, actualHeal);
    }
    
    // Log the heal if context has a log function
    if (ctx.log && actualHeal > 0) {
      ctx.log(`${creature.name} healed ${actualHeal} HP!`, 'heal');
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
    
    // Don't heal dead creatures (0 or negative HP)
    if (creature.curHp <= 0) return { healed: 0 };
    
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
    if (getAnim() && actualHeal > 0) {
      const ownerKey = ctx.attackerOwnerKey || 'me';
      await getAnim().heal(ownerKey, actualHeal);
    }
    
    // Log
    if (ctx.log && actualHeal > 0) {
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
    
    if (getAnim()) {
      await getAnim().lpDamage('me', count);
    }
  },

  /**
   * Gain mana
   */
  async gainMana(ctx, { amount }) {
    ctx.me.mana += amount;
    
    if (getAnim()) {
      await getAnim().manaGain();
    }
  },

  /**
   * Add attack bonus
   * @param {string} target - 'self' for creature-specific buff, or undefined for owner's next attack
   */
  async atkBonus(ctx, { amount, source, target }) {
    if (target === 'self' && ctx.self) {
      // Add to creature's own atkBonuses (permanent for that creature)
      if (!ctx.self.atkBonuses) ctx.self.atkBonuses = [];
      ctx.self.atkBonuses.push({ source: source || ctx.card?.ability?.name || 'Buff', value: amount });
    } else {
      // Add to owner's attackBonuses (consumed on next attack)
      ctx.me.attackBonuses.push({ source: source || 'Buff', value: amount });
    }
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
    
    // BUG-05 FIX: Reset HP when returning creature to hand
    // When a creature returns to hand (e.g., Grave Echo), it should have full HP
    // BUG-A6 FIX: Also clear ATK bonuses to prevent stacking on re-summon
    if (toZone === 'hand' && card.hp !== undefined) {
      card.curHp = card.hp;
      card.atkBonuses = [];
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
   * Supports 'selected' target for anyCreature selection
   */
  async banish(ctx, { target }) {
    // Handle 'selected' target from anyCreature selection
    if (target === 'selected') {
      if (!ctx.selected) return { banished: false };
      
      const { creature, location, ownerKey, idx } = ctx.selected;
      const ownerObj = ctx[ownerKey];
      
      // Animation key is ABSOLUTE: 'me' = player (bottom), 'opp' = AI (top)
      if (getAnim()) {
        const animKey = ownerObj === ctx.state?.G?.me ? 'me' : 'opp';
        await getAnim().ko(animKey);
      }
      
      if (location === 'active') {
        ownerObj.active = null;
      } else if (location === 'bench') {
        // Remove from bench by filtering out the creature
        ownerObj.bench = ownerObj.bench.filter(c => c.uid !== creature.uid);
      }
      
      // Note: does NOT go to grave - removed from game
      const needsReplacement = location === 'active' && ownerObj.bench.length > 0;
      return { 
        banished: true, 
        owner: ownerKey, 
        needsReplacement,
        creature,
        location,
        ownerKey,
        modifiedContext: { needsReplacement }
      };
    }
    
    // Legacy: handle explicit target like 'opp.active'
    const [owner, location] = target.split('.');
    const ownerObj = ctx[owner];
    
    if (location === 'active' && ownerObj.active) {
      if (getAnim()) {
        await getAnim().ko(owner);
      }
      ownerObj.active = null;
      // Note: does NOT go to grave - removed from game
      // BUG-C1 FIX: Also add modifiedContext for legacy path
      return { banished: true, owner, needsReplacement: true, modifiedContext: { needsReplacement: true } };
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
    if (getAnim()) {
      if (targets.meActive) await getAnim().damage('me', amount);
      for (let i = 0; i < targets.meBench.length; i++) {
        await getAnim().benchDamage('me', i, amount);
      }
      if (targets.oppActive) await getAnim().damage('opp', amount);
      for (let i = 0; i < targets.oppBench.length; i++) {
        await getAnim().benchDamage('opp', i, amount);
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
    if (getAnim()) {
      if (location === 'active') {
        await getAnim().ko('me');
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
    if (getAnim()) {
      await getAnim().ko(ownerKey);
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
      if (getAnim()) {
        await getAnim().summon('me');
      }
    } else {
      ctx.me.bench.push(summon);
      if (getAnim()) {
        await getAnim().summonBench('me', ctx.me.bench.length - 1);
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
    
    if (getAnim()) {
      const oppKey = ctx.me === ctx.state?.G?.me ? 'opp' : 'me';
      await getAnim().lpDamage(oppKey, count);
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
      if (getAnim()) {
        await getAnim().summonBench(ownerKey, benchIdx);
      }
    }
    
    return { summoned: true, creature: selected };
  },

  /**
   * Summon a token creature to bench
   * @param {string} token - Token type ('antling')
   * @param {string} location - 'bench' (only bench supported)
   * @param {number} maxBench - Max bench size (default 2)
   */
  async summonToken(ctx, { token, location = 'bench', maxBench = 2 }) {
    // Check bench capacity
    if (ctx.me.bench.length >= maxBench) {
      return { summoned: false, reason: 'bench_full' };
    }

    // Token definitions
    const tokens = {
      antling: {
        id: 'antling',
        name: 'Antling',
        subtitle: 'Swarm Token',
        hp: 10,
        curHp: 10,
        atk: 10,
        cost: 0,
        cardType: 'creature',
        ability: null,
        uid: Math.random().toString(36).slice(2, 9),
        isToken: true
      }
    };

    const creature = tokens[token];
    if (!creature) {
      return { summoned: false, reason: 'unknown_token' };
    }

    // Create fresh copy with unique uid
    const spawned = { ...creature, uid: Math.random().toString(36).slice(2, 9) };

    // Determine owner key for animations
    const ownerKey = ctx.me === ctx.state?.G?.me ? 'me' : 'opp';

    // Add to bench
    const benchIdx = ctx.me.bench.length;
    ctx.me.bench.push(spawned);

    if (ctx.log) {
      ctx.log(`${spawned.name} joins the swarm!`, 'mana');
    }
    if (ctx.render) {
      ctx.render();
    }
    if (getAnim()) {
      await getAnim().summonBench(ownerKey, benchIdx);
    }

    return { summoned: true, creature: spawned };
  },

  /**
   * Swap active creature with a bench creature (player choice)
   * @param {string} target - 'self' (the creature with this ability)
   */
  async swapWithBench(ctx, { target }) {
    const owner = ctx.me;
    
    // Need bench creatures to swap with
    if (owner.bench.length === 0) {
      return { swapped: false, reason: 'no_bench' };
    }

    // Need active creature
    if (!owner.active) {
      return { swapped: false, reason: 'no_active' };
    }

    // Determine owner key for animations
    const ownerKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
    const isPlayer = ownerKey === 'me';

    // For player: prompt which bench creature to swap with
    // For AI/tests: auto-select first bench creature
    let selectedBench;
    if (isPlayer && ctx.promptBenchSelect) {
      selectedBench = await ctx.promptBenchSelect(owner.bench);
      if (!selectedBench) {
        return { swapped: false, reason: 'cancelled' };
      }
    } else {
      // AI: pick first bench creature
      selectedBench = owner.bench[0];
    }

    // Perform swap
    const current = owner.active;
    const benchIdx = owner.bench.indexOf(selectedBench);
    
    owner.active = selectedBench;
    owner.bench.splice(benchIdx, 1);
    owner.bench.push(current);

    if (ctx.log) {
      ctx.log(`${current.name} swaps with ${selectedBench.name}!`, 'mana');
    }
    if (ctx.render) {
      ctx.render();
    }
    if (getAnim()) {
      await getAnim().benchToActive(ownerKey);
    }

    // BUG-A2 FIX: Chain Lightning triggers when new creature becomes active via swap
    if (owner.chainLightning > 0 && owner.active) {
      if (getAnim()) {
        await getAnim().wait(300);
        await getAnim().damage(ownerKey, owner.chainLightning);
      }
      const chainDmg = owner.chainLightning;
      owner.active.curHp -= chainDmg;
      if (ctx.log) {
        ctx.log(`Chain Lightning: -${chainDmg}`, 'dmg');
      }
      owner.chainLightning = 0;
      // Return chainKO info so caller can process KO if needed
      if (owner.active.curHp <= 0) {
        return { swapped: true, from: current, to: selectedBench, chainKO: true, chainKOCreature: owner.active };
      }
    }

    return { swapped: true, from: current, to: selectedBench };
  },

  /**
   * Set creature HP to specific value
   * Used for Bulwark's Fortress (set to 1 HP after negating KO)
   */
  async setHP(ctx, { amount }) {
    const creature = ctx.self || ctx.target || ctx.me?.active;
    if (!creature) {
      return { applied: false, reason: 'no_creature' };
    }

    creature.curHp = amount;
    
    if (ctx.log) {
      ctx.log(`${creature.name} survives with ${amount} HP!`, 'heal');
    }

    return { applied: true, creature };
  },

  /**
   * Mark a flag as used on a creature (for "once per game" abilities)
   * Used for Bulwark's Fortress
   */
  async markUsed(ctx, { flag }) {
    const creature = ctx.self || ctx.target || ctx.me?.active;
    if (!creature) {
      return { applied: false, reason: 'no_creature' };
    }

    creature[flag] = true;
    return { applied: true };
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
  
  // Get effects from card.effects (set verses) or card.ability?.effects (creatures)
  const effects = card.effects || card.ability?.effects || [];
  
  for (const effect of effects) {
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
    
    // Collect KO results (single ko or array of kos)
    if (result?.ko) {
      kos.push({
        target: result.target,
        creature: result.creature,
        owner: result.owner
      });
    }
    if (result?.kos) {
      kos.push(...result.kos);
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
