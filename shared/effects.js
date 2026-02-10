/**
 * Effects System - Pure Logic (No Browser Dependencies)
 * 
 * This is a pure-logic version of the effects system that works in both
 * browser and server environments. It does NOT call animations directly.
 * Instead, it returns events that the caller can animate.
 * 
 * Key differences from src/effects.js:
 * - No globalThis.Anim access
 * - All functions are synchronous (no async/await)
 * - Returns { events: [...], kos: [...] } instead of calling animations
 * - Pure functions that transform state and return results
 * 
 * Usage:
 *   import { Effects, processEffects } from './shared/effects.js'
 *   const result = processEffects(card, ctx)
 *   // result = { events: [...], kos: [...], ctx }
 */

// Helper: resolve target string to actual object
function resolveTarget(ctx, targetStr) {
  if (!targetStr) return null;
  
  // Special target: 'selected' - creature from target selector
  if (targetStr === 'selected') {
    return ctx.selected?.creature || null;
  }
  
  // Special target: 'attacker' - the attacking creature
  if (targetStr === 'attacker') {
    return ctx.attacker;
  }
  
  // Special target: 'defender' - the defending creature
  if (targetStr === 'defender') {
    return ctx.defender;
  }
  
  // Special target: 'summoned' - the creature just summoned
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

// Effect primitives - Pure logic, no animations
const Effects = {
  /**
   * Deal damage to a target
   * @returns {{ events: array, ko: object|null }}
   */
  damage(ctx, { target, amount }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return { events: [], ko: null };
    
    let finalAmount = amount;
    creature.curHp -= finalAmount;
    
    // Track that damage was dealt
    if (finalAmount > 0) {
      ctx.damageWasDealt = true;
    }
    
    // Determine owner
    let owner;
    let ownerKey;
    if (target === 'selected') {
      ownerKey = ctx.selected?.ownerKey || 'opp';
      owner = ownerKey === 'me' ? ctx.me : ctx.opp;
    } else if (target === 'summoned') {
      ownerKey = ctx.summoningPlayer || ctx.creatureOwnerKey || 'opp';
      owner = ownerKey === 'me' ? ctx.state?.G?.me : ctx.state?.G?.opp;
      if (!owner) owner = ownerKey === 'me' ? ctx.me : ctx.opp;
    } else if (target === 'attacker') {
      owner = ctx.attackerOwner;
      ownerKey = ctx.attackerOwnerKey;
    } else {
      [ownerKey] = target.split('.');
      owner = target.startsWith('me') ? ctx.me : ctx.opp;
    }
    
    // Determine animation key (absolute: 'me' = player, 'opp' = AI)
    const animKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
    
    // Check if target is on bench
    let isBench = false;
    let benchIndex = 0;
    
    if (target === 'summoned' && ctx.summonLocation === 'bench') {
      isBench = true;
      benchIndex = owner.bench?.length || 0;
    } else if (target === 'selected' && ctx.selected?.location === 'bench') {
      isBench = true;
      benchIndex = ctx.selected?.idx ?? owner.bench?.indexOf(creature) ?? 0;
    } else if (target.includes('.bench')) {
      isBench = true;
      benchIndex = owner.bench?.indexOf(creature) ?? 0;
    }
    
    const events = [];
    if (finalAmount > 0) {
      events.push({
        type: 'damage',
        animKey,
        amount: finalAmount,
        creature: creature.name,
        isBench,
        benchIndex
      });
      
      // Log event
      if (ctx.card?.ability?.name) {
        events.push({
          type: 'log',
          message: `${ctx.card.ability.name}! -${finalAmount} to ${creature.name}`,
          style: 'dmg'
        });
      }
    }
    
    const isKo = creature.curHp <= 0;
    
    return { 
      events,
      ko: isKo ? { target, creature, owner, ownerKey } : null
    };
  },

  /**
   * Heal a target
   */
  heal(ctx, { target, amount }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return { events: [] };
    
    // Don't heal dead creatures
    if (creature.curHp <= 0) return { events: [] };
    
    const oldHp = creature.curHp;
    creature.curHp = Math.min(creature.hp, creature.curHp + amount);
    const actualHeal = creature.curHp - oldHp;
    
    const events = [];
    if (actualHeal > 0) {
      const [ownerKey] = target.split('.');
      const owner = ownerKey === 'me' ? ctx.me : ctx.opp;
      const animKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
      
      events.push({
        type: 'heal',
        animKey,
        amount: actualHeal,
        creature: creature.name
      });
      
      events.push({
        type: 'log',
        message: `${creature.name} healed ${actualHeal} HP!`,
        style: 'heal'
      });
    }
    
    return { events };
  },

  /**
   * Heal the triggering creature (self)
   */
  healSelf(ctx, { amount }) {
    const creature = ctx.self || ctx.attacker;
    if (!creature) return { events: [], healed: 0 };
    
    if (creature.curHp <= 0) return { events: [], healed: 0 };
    
    let healAmount = amount;
    if (amount === 'damageDealt') {
      healAmount = ctx.damageDealt || 0;
    }
    
    const maxHeal = creature.hp - creature.curHp;
    const actualHeal = Math.min(healAmount, maxHeal);
    
    if (actualHeal <= 0) return { events: [], healed: 0 };
    
    creature.curHp += actualHeal;
    
    const ownerKey = ctx.attackerOwnerKey || 'me';
    const events = [
      {
        type: 'heal',
        animKey: ownerKey,
        amount: actualHeal,
        creature: creature.name
      },
      {
        type: 'log',
        message: `${ctx.self?.ability?.name || 'Heal'}! +${actualHeal} HP`,
        style: 'heal'
      }
    ];
    
    return { events, healed: actualHeal };
  },

  /**
   * Draw cards from deck
   */
  draw(ctx, { count, max }) {
    let drawCount = count;
    if (count === 'creatureCount') {
      drawCount = (ctx.me.active ? 1 : 0) + ctx.me.bench.length;
    }
    
    if (max !== undefined) {
      drawCount = Math.min(drawCount, max);
    }
    
    for (let i = 0; i < drawCount; i++) {
      if (ctx.draw) {
        ctx.draw();
      } else {
        if (ctx.me.deck.length === 0) break;
        const card = ctx.me.deck.shift();
        ctx.me.hand.push(card);
      }
    }
    
    return { events: [], drawn: drawCount };
  },

  /**
   * Lose life points
   */
  loseLife(ctx, { count }) {
    ctx.me.lp -= count;
    
    return {
      events: [{
        type: 'lpDamage',
        animKey: 'me',
        amount: count
      }]
    };
  },

  /**
   * Gain mana
   */
  gainMana(ctx, { amount }) {
    ctx.me.mana += amount;
    
    return {
      events: [{
        type: 'manaGain',
        amount
      }]
    };
  },

  /**
   * Add attack bonus
   */
  atkBonus(ctx, { amount, source, target }) {
    if (target === 'self' && ctx.self) {
      if (!ctx.self.atkBonuses) ctx.self.atkBonuses = [];
      ctx.self.atkBonuses.push({ source: source || ctx.card?.ability?.name || 'Buff', value: amount });
    } else {
      ctx.me.attackBonuses.push({ source: source || 'Buff', value: amount });
    }
    
    return { events: [] };
  },

  /**
   * Set a status flag on creature
   */
  setStatus(ctx, { target, status }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return { events: [] };
    
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
    
    const events = [];
    
    if (status === 'poison') {
      creature.status = 'poison';
      if (owner) owner.poisoned = true;
      events.push({ type: 'log', message: 'Poisoned!' });
    } else if (status === 'trapped') {
      creature.status = 'trapped';
      events.push({ type: 'log', message: 'Trapped! Cannot retreat' });
    } else {
      creature[status] = true;
    }
    
    return { events };
  },

  /**
   * Cure a status effect
   */
  cureStatus(ctx, { target, status }) {
    const creature = resolveTarget(ctx, target);
    if (!creature) return { events: [] };
    
    if (status === 'poison') {
      creature.status = null;
      ctx.me.poisoned = false;
    } else {
      creature[status] = null;
    }
    
    return { events: [] };
  },

  /**
   * Move a card between zones
   */
  moveCard(ctx, { from, to, target }) {
    let card = null;
    if (target === 'selected') {
      card = ctx.selected;
    }
    if (!card) return { events: [] };
    
    const [fromOwner, fromZone] = from.split('.');
    const [toOwner, toZone] = to.split('.');
    
    const fromArray = ctx[fromOwner][fromZone];
    const toArray = ctx[toOwner][toZone];
    
    const idx = fromArray.findIndex(c => c.uid === card.uid);
    if (idx !== -1) {
      fromArray.splice(idx, 1);
    }
    
    // Reset HP when returning to hand
    if (toZone === 'hand' && card.hp !== undefined) {
      card.curHp = card.hp;
      card.atkBonuses = [];
    }
    
    toArray.push(card);
    
    return { events: [] };
  },

  /**
   * Set a flag on player
   */
  setFlag(ctx, { flag, value, target }) {
    const player = target === 'opp' ? ctx.opp : ctx.me;
    player[flag] = value;
    
    return { events: [] };
  },

  /**
   * Banish (remove from game)
   */
  banish(ctx, { target }) {
    const events = [];
    
    if (target === 'selected') {
      if (!ctx.selected) return { events: [], banished: false };
      
      const { creature, location, ownerKey, idx } = ctx.selected;
      const ownerObj = ctx[ownerKey];
      const animKey = ownerObj === ctx.state?.G?.me ? 'me' : 'opp';
      
      if (location === 'bench') {
        events.push({ type: 'benchKo', animKey, benchIndex: idx });
      } else {
        events.push({ type: 'ko', animKey });
      }
      
      if (location === 'active') {
        ownerObj.active = null;
      } else if (location === 'bench') {
        ownerObj.bench = ownerObj.bench.filter(c => c.uid !== creature.uid);
      }
      
      const needsReplacement = location === 'active' && ownerObj.bench.length > 0;
      return { 
        events,
        banished: true, 
        owner: ownerKey, 
        needsReplacement,
        modifiedContext: { needsReplacement }
      };
    }
    
    // Legacy: explicit target
    const [owner, location] = target.split('.');
    const ownerObj = ctx[owner];
    
    if (location === 'active' && ownerObj.active) {
      events.push({ type: 'ko', animKey: owner });
      ownerObj.active = null;
      return { events, banished: true, owner, needsReplacement: true, modifiedContext: { needsReplacement: true } };
    }
    
    return { events: [], banished: false };
  },

  /**
   * AoE damage to all creatures
   */
  aoeAll(ctx, { amount }) {
    const kos = [];
    const events = [];
    
    // Phase 1: Capture targets
    const targets = {
      meActive: ctx.me.active,
      meBench: [...ctx.me.bench],
      oppActive: ctx.opp.active,
      oppBench: [...ctx.opp.bench]
    };
    
    // Phase 2: Generate damage events
    if (targets.meActive) {
      events.push({ type: 'damage', animKey: 'me', amount });
    }
    for (let i = 0; i < targets.meBench.length; i++) {
      events.push({ type: 'benchDamage', animKey: 'me', benchIndex: i, amount });
    }
    if (targets.oppActive) {
      events.push({ type: 'damage', animKey: 'opp', amount });
    }
    for (let i = 0; i < targets.oppBench.length; i++) {
      events.push({ type: 'benchDamage', animKey: 'opp', benchIndex: i, amount });
    }
    
    // Phase 3: Apply damage and collect KOs
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
    
    // Collect KOs (bench first, then active)
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
    
    return { events, kos };
  },

  /**
   * KO the selected creature (for Sacrifice)
   */
  koSelected(ctx) {
    if (!ctx.selected) return { events: [], ko: false };
    
    const { creature, location, idx } = ctx.selected;
    const owner = ctx.me;
    const ownerKey = 'me';
    
    const events = [];
    
    if (location === 'active') {
      events.push({ type: 'ko', animKey: 'me' });
    }
    
    if (location === 'active') {
      owner.active = null;
    } else if (location === 'bench') {
      const benchIdx = owner.bench.indexOf(creature);
      if (benchIdx !== -1) {
        owner.bench.splice(benchIdx, 1);
      }
    }
    
    owner.grave.push(creature);
    
    events.push({
      type: 'log',
      message: `Sacrificed ${creature.name}`,
      style: 'dmg'
    });
    
    return { 
      events,
      ko: true, 
      creature, 
      owner,
      ownerKey,
      location,
      needsReplacement: location === 'active' && owner.bench.length > 0,
      isSacrifice: true,
      modifiedContext: {
        sacrificedCreature: creature,
        sacrificeLocation: location
      }
    };
  },

  /**
   * Reduce incoming damage
   */
  reduceDamage(ctx, { amount }) {
    ctx.damageReduction = (ctx.damageReduction || 0) + amount;
    return { events: [], modifiedContext: { damageReduction: ctx.damageReduction } };
  },

  /**
   * Negate a spell
   */
  negateSpell(ctx) {
    ctx.negated = true;
    return { events: [], modifiedContext: { negated: true } };
  },

  /**
   * Negate an attack
   */
  negateAttack(ctx) {
    ctx.attackNegated = true;
    return { events: [], modifiedContext: { attackNegated: true } };
  },

  /**
   * Negate a KO
   */
  negateKO(ctx) {
    ctx.koNegated = true;
    if (ctx.target && ctx.target.curHp <= 0) {
      ctx.target.curHp = 1;
    }
    return { events: [], modifiedContext: { koNegated: true } };
  },

  /**
   * Negate life loss
   */
  negateLifeLoss(ctx) {
    ctx.lifeLossNegated = true;
    return { events: [], modifiedContext: { lifeLossNegated: true } };
  },

  /**
   * Destroy a creature
   */
  destroy(ctx, { target }) {
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
    
    if (!creature || !owner) return { events: [], destroyed: false };
    
    const events = [{ type: 'ko', animKey: ownerKey }];
    
    owner.grave.push(creature);
    owner.active = null;
    
    return { 
      events,
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
  summon(ctx, { filter, location }) {
    let candidates = ctx.me.deck;
    
    if (filter?.cost !== undefined) {
      candidates = candidates.filter(c => c.cardType === 'creature' && c.cost === filter.cost);
    }
    
    if (candidates.length === 0) return { events: [], summoned: false };
    
    const summon = candidates[Math.floor(Math.random() * candidates.length)];
    ctx.me.deck = ctx.me.deck.filter(c => c.uid !== summon.uid);
    
    const events = [];
    
    if (location === 'active' || !ctx.me.active) {
      ctx.me.active = summon;
      events.push({ type: 'summon', animKey: 'me' });
    } else {
      ctx.me.bench.push(summon);
      events.push({ type: 'summonBench', animKey: 'me', benchIndex: ctx.me.bench.length - 1 });
    }
    
    return { events, summoned: true, creature: summon };
  },

  /**
   * Discard cards from hand
   */
  discard(ctx, { target, count, random }) {
    const player = target === 'opp' ? ctx.opp : ctx.me;
    if (!player.hand.length) return { events: [], discarded: 0 };
    
    let discarded = 0;
    for (let i = 0; i < count && player.hand.length > 0; i++) {
      const idx = random ? Math.floor(Math.random() * player.hand.length) : 0;
      const card = player.hand.splice(idx, 1)[0];
      player.grave.push(card);
      discarded++;
    }
    
    return { events: [], discarded };
  },

  /**
   * Make opponent lose life points
   */
  loseLifeOpp(ctx, { count }) {
    ctx.opp.lp -= count;
    
    const oppKey = ctx.me === ctx.state?.G?.me ? 'opp' : 'me';
    
    return {
      events: [{
        type: 'lpDamage',
        animKey: oppKey,
        amount: count
      }],
      lifeLost: count
    };
  },

  /**
   * Summon creature from graveyard
   */
  summonFromGrave(ctx, { filter, location = 'bench' }) {
    if (location === 'bench' && ctx.me.bench.length >= 2) {
      return { events: [], summoned: false, reason: 'bench_full' };
    }

    let candidates = ctx.me.grave.filter(c => c.cardType === 'creature');
    
    if (filter?.cost !== undefined) {
      candidates = candidates.filter(c => c.cost === filter.cost);
    }
    
    if (candidates.length === 0) return { events: [], summoned: false, reason: 'no_targets' };
    
    let selected;
    if (candidates.length === 1) {
      selected = candidates[0];
    } else if (ctx.promptGraveSelect) {
      // Note: This would need to be handled async by the caller
      selected = candidates[0]; // Fallback
    } else {
      selected = candidates[0];
    }
    
    if (!selected) return { events: [], summoned: false, reason: 'cancelled' };
    
    selected.curHp = selected.hp;
    ctx.me.grave = ctx.me.grave.filter(c => c.uid !== selected.uid);
    
    const ownerKey = ctx.me === ctx.state?.G?.me ? 'me' : 'opp';
    const events = [];
    
    if (location === 'bench') {
      const benchIdx = ctx.me.bench.length;
      ctx.me.bench.push(selected);
      
      events.push({
        type: 'log',
        message: `${selected.name} rises to bench!`
      });
      events.push({
        type: 'summonBench',
        animKey: ownerKey,
        benchIndex: benchIdx
      });
    }
    
    return { events, summoned: true, creature: selected };
  },

  /**
   * Summon a token creature
   */
  summonToken(ctx, { token, location = 'bench', maxBench = 2 }) {
    if (ctx.me.bench.length >= maxBench) {
      return { events: [], summoned: false, reason: 'bench_full' };
    }

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
      return { events: [], summoned: false, reason: 'unknown_token' };
    }

    const spawned = { ...creature, uid: Math.random().toString(36).slice(2, 9) };
    const ownerKey = ctx.me === ctx.state?.G?.me ? 'me' : 'opp';
    const benchIdx = ctx.me.bench.length;
    
    ctx.me.bench.push(spawned);

    const events = [
      {
        type: 'log',
        message: `${spawned.name} joins the swarm!`,
        style: 'mana'
      },
      {
        type: 'summonBench',
        animKey: ownerKey,
        benchIndex: benchIdx
      }
    ];

    return { events, summoned: true, creature: spawned };
  },

  /**
   * Swap active with bench
   */
  swapWithBench(ctx, { target }) {
    const owner = ctx.me;
    
    if (owner.bench.length === 0) {
      return { events: [], swapped: false, reason: 'no_bench' };
    }

    if (!owner.active) {
      return { events: [], swapped: false, reason: 'no_active' };
    }

    const ownerKey = owner === ctx.state?.G?.me ? 'me' : 'opp';
    const isPlayer = ownerKey === 'me';

    let selectedBench;
    if (isPlayer && ctx.promptBenchSelect) {
      // Note: Would need async handling by caller
      selectedBench = owner.bench[0];
    } else {
      selectedBench = owner.bench[0];
    }

    const current = owner.active;
    const benchIdx = owner.bench.indexOf(selectedBench);
    
    owner.active = selectedBench;
    owner.bench.splice(benchIdx, 1);
    owner.bench.push(current);

    const events = [
      {
        type: 'log',
        message: `${current.name} swaps with ${selectedBench.name}!`,
        style: 'mana'
      },
      {
        type: 'benchToActive',
        animKey: ownerKey
      }
    ];

    // Check for Chain Lightning
    if (owner.chainLightning > 0 && owner.active) {
      const chainDmg = owner.chainLightning;
      events.push({ type: 'wait', ms: 300 });
      events.push({ type: 'damage', animKey: ownerKey, amount: chainDmg });
      
      owner.active.curHp -= chainDmg;
      events.push({
        type: 'log',
        message: `Chain Lightning: -${chainDmg}`,
        style: 'dmg'
      });
      
      owner.chainLightning = 0;
      
      if (owner.active.curHp <= 0) {
        return { events, swapped: true, from: current, to: selectedBench, chainKO: true, chainKOCreature: owner.active };
      }
    }

    return { events, swapped: true, from: current, to: selectedBench };
  },

  /**
   * Set creature HP
   */
  setHP(ctx, { amount }) {
    const creature = ctx.self || ctx.target || ctx.me?.active;
    if (!creature) {
      return { events: [], applied: false, reason: 'no_creature' };
    }

    creature.curHp = amount;
    
    const abilityName = ctx.card?.ability?.name || '';
    const prefix = abilityName ? `${abilityName}! ` : '';
    
    return {
      events: [{
        type: 'log',
        message: `${prefix}${creature.name} survives with ${amount} HP!`,
        style: 'heal'
      }],
      applied: true,
      creature
    };
  },

  /**
   * Mark a flag as used
   */
  markUsed(ctx, { flag }) {
    const creature = ctx.self || ctx.target || ctx.me?.active;
    if (!creature) {
      return { events: [], applied: false, reason: 'no_creature' };
    }

    creature[flag] = true;
    return { events: [], applied: true };
  }
};

/**
 * Process all effects for a card
 * @param {object} card - Card with effects array
 * @param {object} ctx - Context with state, me, opp, selected
 * @returns {{ success: boolean, events: array, kos: array, modifiedContext: object }}
 */
function processEffects(card, ctx) {
  const allEvents = [];
  const kos = [];
  let modifiedContext = {};
  
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
    
    const result = effectFn(ctx, effect);
    
    // Collect events
    if (result?.events) {
      allEvents.push(...result.events);
    }
    
    // Collect modifiedContext
    if (result?.modifiedContext) {
      modifiedContext = { ...modifiedContext, ...result.modifiedContext };
    }
    
    // Collect KOs
    if (result?.ko) {
      kos.push(result.ko);
    }
    if (result?.kos) {
      kos.push(...result.kos);
    }
  }
  
  return { success: true, events: allEvents, kos, modifiedContext };
}

// Export for ES modules
export { Effects, processEffects, resolveTarget, evalCondition };
