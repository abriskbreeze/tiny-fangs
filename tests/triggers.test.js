/**
 * Trigger System Tests
 * TDD: Tests for declarative trigger processing
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock state factory
function createMockState() {
  return {
    G: {
      me: {
        active: null,
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        mana: 3,
        lp: 3,
        setVerse: null,
        attackBonuses: []
      },
      opp: {
        active: null,
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        mana: 3,
        lp: 3,
        setVerse: null,
        attackBonuses: []
      }
    }
  };
}

function createCreature(overrides = {}) {
  return {
    uid: Math.random().toString(36).slice(2),
    id: 'testCreature',
    name: 'Test Creature',
    cardType: 'creature',
    hp: 30,
    curHp: 30,
    atk: 10,
    cost: 1,
    ...overrides
  };
}

function createSetVerse(overrides = {}) {
  return {
    uid: Math.random().toString(36).slice(2),
    id: 'testVerse',
    name: 'Test Verse',
    cardType: 'verse',
    type: 'set',
    cost: 1,
    ...overrides
  };
}

describe('Triggers', () => {
  let state;
  let matchesTrigger, getMatchingTriggers;

  beforeEach(async () => {
    state = createMockState();
    const module = await import('../src/triggers.js');
    matchesTrigger = module.matchesTrigger;
    getMatchingTriggers = module.getMatchingTriggers;
  });

  describe('matchesTrigger', () => {
    it('matches when event type matches', () => {
      const trigger = { event: 'beforeDamage' };
      expect(matchesTrigger(trigger, 'beforeDamage', {})).toBe(true);
    });

    it('does not match when event type differs', () => {
      const trigger = { event: 'beforeDamage' };
      expect(matchesTrigger(trigger, 'onKO', {})).toBe(false);
    });

    it('matches with target condition', () => {
      const trigger = { 
        event: 'beforeDamage', 
        condition: { target: 'me.active' } 
      };
      const context = { 
        targetOwner: 'me',
        targetLocation: 'active',
        triggerOwnerKey: 'me'  // Target owner matches trigger owner
      };
      expect(matchesTrigger(trigger, 'beforeDamage', context)).toBe(true);
    });

    it('fails when target condition not met', () => {
      const trigger = { 
        event: 'beforeDamage', 
        condition: { target: 'me.active' } 
      };
      const context = { 
        targetOwner: 'opp',
        targetLocation: 'active',
        triggerOwnerKey: 'me'  // Target is opp, trigger owner is me -> mismatch
      };
      expect(matchesTrigger(trigger, 'beforeDamage', context)).toBe(false);
    });

    it('matches with attacker condition', () => {
      const trigger = { 
        event: 'beforeAttack', 
        condition: { attacker: 'opp' } 
      };
      const context = { attackerOwner: 'opp' };
      expect(matchesTrigger(trigger, 'beforeAttack', context)).toBe(true);
    });

    it('matches self condition for creature abilities', () => {
      const creature = createCreature({ uid: 'abc123' });
      const trigger = { 
        event: 'afterAttack', 
        condition: { defender: 'self' } 
      };
      const context = { 
        defender: creature,
        self: creature
      };
      expect(matchesTrigger(trigger, 'afterAttack', context)).toBe(true);
    });

    it('matches lastLife condition when context has lastLife: true', () => {
      const trigger = { 
        event: 'beforeLifeLoss', 
        condition: { owner: 'me', lastLife: true } 
      };
      const context = { 
        ownerKey: 'me',
        creatureOwnerKey: 'me',  // For owner condition matching
        lastLife: true,
        triggerOwnerKey: 'me'
      };
      expect(matchesTrigger(trigger, 'beforeLifeLoss', context)).toBe(true);
    });

    it('does NOT match lastLife condition when context has lastLife: false', () => {
      const trigger = { 
        event: 'beforeLifeLoss', 
        condition: { owner: 'me', lastLife: true } 
      };
      const context = { 
        ownerKey: 'me',
        creatureOwnerKey: 'me',
        lastLife: false,  // Not last life
        triggerOwnerKey: 'me'
      };
      expect(matchesTrigger(trigger, 'beforeLifeLoss', context)).toBe(false);
    });

    it('does NOT match lastLife condition when context lacks lastLife', () => {
      const trigger = { 
        event: 'beforeLifeLoss', 
        condition: { owner: 'me', lastLife: true } 
      };
      const context = { 
        ownerKey: 'me',
        creatureOwnerKey: 'me',
        // lastLife not present
        triggerOwnerKey: 'me'
      };
      expect(matchesTrigger(trigger, 'beforeLifeLoss', context)).toBe(false);
    });

    it('does NOT match lastLife when owner does not match', () => {
      const trigger = { 
        event: 'beforeLifeLoss', 
        condition: { owner: 'me', lastLife: true } 
      };
      const context = { 
        ownerKey: 'opp',
        creatureOwnerKey: 'opp',  // Owner is opponent
        lastLife: true,
        triggerOwnerKey: 'me'  // But trigger belongs to 'me'
      };
      // owner: 'me' means trigger owner should match life-loser, but opp != me
      expect(matchesTrigger(trigger, 'beforeLifeLoss', context)).toBe(false);
    });
  });

  describe('getMatchingTriggers', () => {
    it('finds matching set verse', () => {
      const brace = createSetVerse({
        id: 'brace',
        name: 'Brace',
        trigger: { event: 'beforeDamage', condition: { target: 'me.active' } }
      });
      state.G.me.setVerse = brace;
      state.G.me.active = createCreature();

      const context = { targetOwner: 'me', targetLocation: 'active' };
      const matches = getMatchingTriggers('beforeDamage', context, state);

      expect(matches).toHaveLength(1);
      expect(matches[0].card.id).toBe('brace');
      expect(matches[0].type).toBe('setVerse');
      expect(matches[0].owner).toBe(state.G.me);
    });

    it('finds matching creature ability', () => {
      const thornling = createCreature({
        id: 'thornling',
        name: 'Thornling',
        ability: {
          name: 'Thorns',
          trigger: { event: 'afterAttack', condition: { defender: 'self' } }
        }
      });
      state.G.me.active = thornling;

      const context = { 
        defender: thornling, 
        self: thornling,
        defenderOwner: 'me'
      };
      const matches = getMatchingTriggers('afterAttack', context, state);

      expect(matches).toHaveLength(1);
      expect(matches[0].card.id).toBe('thornling');
      expect(matches[0].type).toBe('ability');
    });

    it('finds multiple matching triggers', () => {
      // Set verse on me
      const brace = createSetVerse({
        id: 'brace',
        trigger: { event: 'beforeDamage', condition: { target: 'me.active' } }
      });
      state.G.me.setVerse = brace;

      // Creature with defensive ability
      const shellkin = createCreature({
        id: 'shellkin',
        ability: {
          name: 'Harden',
          trigger: { event: 'beforeDamage', condition: { target: 'self' } }
        }
      });
      state.G.me.active = shellkin;

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        target: shellkin,
        self: shellkin
      };
      const matches = getMatchingTriggers('beforeDamage', context, state);

      expect(matches).toHaveLength(2);
    });

    it('checks both players set verses', () => {
      const myVerse = createSetVerse({
        id: 'mine',
        trigger: { event: 'onKO' }
      });
      const oppVerse = createSetVerse({
        id: 'theirs',
        trigger: { event: 'onKO' }
      });
      state.G.me.setVerse = myVerse;
      state.G.opp.setVerse = oppVerse;

      const matches = getMatchingTriggers('onKO', {}, state);

      expect(matches).toHaveLength(2);
    });

    it('checks bench creatures for abilities', () => {
      const benchCreature = createCreature({
        id: 'hiveling',
        ability: {
          name: 'Swarm',
          trigger: { event: 'onSummon' }
        }
      });
      state.G.me.bench = [benchCreature];

      const matches = getMatchingTriggers('onSummon', {}, state);

      expect(matches).toHaveLength(1);
      expect(matches[0].card.id).toBe('hiveling');
    });

    it('returns empty array when no matches', () => {
      state.G.me.setVerse = createSetVerse({
        trigger: { event: 'onKO' }
      });

      const matches = getMatchingTriggers('beforeAttack', {}, state);

      expect(matches).toHaveLength(0);
    });
  });

  describe('processTriggers', () => {
    let processTriggers;

    beforeEach(async () => {
      const module = await import('../src/triggers.js');
      processTriggers = module.processTriggers;
    });

    it('Brace reduces damage by 15 via damageReduction context', async () => {
      // Set up Brace with triggerDef (as defined in cards.js)
      const brace = createSetVerse({
        id: 'brace',
        name: 'Brace',
        triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
        effects: [{ type: 'reduceDamage', amount: 15 }]
      });
      state.G.me.setVerse = brace;
      state.G.me.active = createCreature();

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        target: state.G.me.active,
        damage: 30,
        damageReduction: 0
      };

      // Mock gameCtx - player chooses to trigger
      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('beforeDamage', context, state, gameCtx);

      // Verify damage reduction was applied
      expect(result.damageReduction).toBe(15);
      // Verify set verse was consumed (sent to grave)
      expect(state.G.me.setVerse).toBeNull();
      expect(state.G.me.grave).toHaveLength(1);
      expect(state.G.me.grave[0].id).toBe('brace');
    });

    it('Swarm Shield reduces damage by 15 when bench has creatures', async () => {
      // Set up Swarm Shield with triggerDef (as defined in cards.js)
      const swarmShield = createSetVerse({
        id: 'swarmShield',
        name: 'Swarm Shield',
        triggerDef: { event: 'beforeDamage', condition: { target: 'me.active', hasBench: true }, optional: true },
        effects: [{ type: 'reduceDamage', amount: 15 }]
      });
      state.G.me.setVerse = swarmShield;
      state.G.me.active = createCreature();
      // Add bench creature - Swarm Shield requires bench
      state.G.me.bench = [createCreature({ id: 'benchCreature' })];

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        target: state.G.me.active,
        damage: 30,
        damageReduction: 0
      };

      // Mock gameCtx - player chooses to trigger
      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('beforeDamage', context, state, gameCtx);

      // Verify damage reduction was applied
      expect(result.damageReduction).toBe(15);
      // Verify set verse was consumed (sent to grave)
      expect(state.G.me.setVerse).toBeNull();
      expect(state.G.me.grave).toHaveLength(1);
      expect(state.G.me.grave[0].id).toBe('swarmShield');
    });

    it('Swarm Shield does NOT trigger when bench is empty', async () => {
      const swarmShield = createSetVerse({
        id: 'swarmShield',
        name: 'Swarm Shield',
        triggerDef: { event: 'beforeDamage', condition: { target: 'me.active', hasBench: true }, optional: true },
        effects: [{ type: 'reduceDamage', amount: 15 }]
      });
      state.G.me.setVerse = swarmShield;
      state.G.me.active = createCreature();
      // NO bench creatures - should not match
      state.G.me.bench = [];

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        target: state.G.me.active,
        damage: 30,
        damageReduction: 0
      };

      // Check matching - should find no triggers
      const matches = getMatchingTriggers('beforeDamage', context, state);
      expect(matches).toHaveLength(0);

      // Even if we call processTriggers, no reduction should happen
      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('beforeDamage', context, state, gameCtx);

      // Verify NO damage reduction
      expect(result.damageReduction).toBe(0);
      // Verify set verse was NOT consumed
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Brace is optional - does not reduce if player declines', async () => {
      const brace = createSetVerse({
        id: 'brace',
        name: 'Brace',
        triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
        effects: [{ type: 'reduceDamage', amount: 15 }]
      });
      state.G.me.setVerse = brace;
      state.G.me.active = createCreature();

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        target: state.G.me.active,
        damage: 30,
        damageReduction: 0
      };

      // Mock gameCtx - player DECLINES trigger
      const gameCtx = {
        promptTrigger: async () => false,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('beforeDamage', context, state, gameCtx);

      // Verify NO damage reduction
      expect(result.damageReduction).toBe(0);
      // Verify set verse was NOT consumed
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Soul Trap deals 20 damage to opponent summoned creature', async () => {
      // Import processEffects for the test
      const effectsModule = await import('../src/effects.js');
      const processEffects = effectsModule.processEffects;
      
      // Set up Soul Trap with the proper triggerDef (as defined in cards.js)
      const soulTrap = createSetVerse({
        id: 'soulTrap',
        name: 'Soul Trap',
        triggerDef: { event: 'onSummon', condition: { owner: 'opp' } },
        effects: [{ type: 'damage', target: 'summoned', amount: 20 }]
      });
      state.G.me.setVerse = soulTrap;
      
      // Create creature being summoned by opponent
      const summonedCreature = createCreature({ curHp: 30, hp: 30 });
      
      const context = {
        summoned: summonedCreature,
        creatureOwnerKey: 'opp',  // Opponent is summoning
        summoningPlayer: 'opp'
      };

      // Mock gameCtx with processEffects
      const gameCtx = {
        showTriggerReveal: async () => {},
        log: () => {},
        processEffects: async (card, effectCtx) => {
          return await processEffects(card, { ...effectCtx, summoned: summonedCreature });
        }
      };

      await processTriggers('onSummon', context, state, gameCtx);

      // Verify creature took 20 damage
      expect(summonedCreature.curHp).toBe(10);
      // Verify set verse was consumed (sent to grave)
      expect(state.G.me.setVerse).toBeNull();
      expect(state.G.me.grave).toHaveLength(1);
      expect(state.G.me.grave[0].id).toBe('soulTrap');
    });

    it('Soul Trap does NOT trigger when owner summons', async () => {
      const soulTrap = createSetVerse({
        id: 'soulTrap',
        name: 'Soul Trap',
        triggerDef: { event: 'onSummon', condition: { owner: 'opp' } },
        effects: [{ type: 'damage', target: 'summoned', amount: 20 }]
      });
      state.G.me.setVerse = soulTrap;
      
      // Create creature being summoned by ME (same as trap owner)
      const summonedCreature = createCreature({ curHp: 30, hp: 30 });
      
      const context = {
        summoned: summonedCreature,
        creatureOwnerKey: 'me',  // I am summoning (same as trap owner)
        summoningPlayer: 'me'
      };

      const gameCtx = {
        showTriggerReveal: async () => {},
        log: () => {}
      };

      await processTriggers('onSummon', context, state, gameCtx);

      // Verify creature did NOT take damage
      expect(summonedCreature.curHp).toBe(30);
      // Verify set verse was NOT consumed (wrong owner condition)
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Den Mother adds +10 attack bonus when YOUR creature is KO\'d', async () => {
      // Import processEffects for the test
      const effectsModule = await import('../src/effects.js');
      const processEffects = effectsModule.processEffects;

      // Set up Den Mother with triggerDef (as defined in cards.js)
      const denMother = createSetVerse({
        id: 'denMother',
        name: 'Den Mother',
        triggerDef: { event: 'onKO', condition: { owner: 'me' }, optional: true },
        effects: [{ type: 'atkBonus', amount: 10, source: 'Den Mother' }]
      });
      state.G.me.setVerse = denMother;
      state.G.me.active = createCreature(); // Need active to receive buff

      // Create a KO'd creature owned by me
      const kodCreature = createCreature({ id: 'victim', name: 'Victim' });

      const context = {
        creature: kodCreature,
        creatureOwnerKey: 'me',  // MY creature was KO'd
        targetOwner: 'me',
        targetLocation: 'active'
      };

      // Mock gameCtx - player chooses to trigger
      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {},
        processEffects: async (card, effectCtx) => {
          return await processEffects(card, effectCtx);
        }
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Verify attack bonus was added
      expect(state.G.me.attackBonuses).toHaveLength(1);
      expect(state.G.me.attackBonuses[0]).toEqual({ source: 'Den Mother', value: 10 });
      // Verify set verse was consumed (sent to grave)
      expect(state.G.me.setVerse).toBeNull();
      expect(state.G.me.grave).toHaveLength(1);
      expect(state.G.me.grave[0].id).toBe('denMother');
    });

    it('Den Mother does NOT trigger when OPPONENT creature is KO\'d', async () => {
      // Set up Den Mother owned by me
      const denMother = createSetVerse({
        id: 'denMother',
        name: 'Den Mother',
        triggerDef: { event: 'onKO', condition: { owner: 'me' }, optional: true },
        effects: [{ type: 'atkBonus', amount: 10, source: 'Den Mother' }]
      });
      state.G.me.setVerse = denMother;

      // Create a KO'd creature owned by OPPONENT
      const kodCreature = createCreature({ id: 'victim', name: 'Victim' });

      const context = {
        creature: kodCreature,
        creatureOwnerKey: 'opp',  // OPPONENT's creature was KO'd
        targetOwner: 'opp',
        targetLocation: 'active'
      };

      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Verify NO attack bonus was added
      expect(state.G.me.attackBonuses).toHaveLength(0);
      // Verify set verse was NOT consumed (wrong owner condition)
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Den Mother is optional - does not trigger if player declines', async () => {
      const denMother = createSetVerse({
        id: 'denMother',
        name: 'Den Mother',
        triggerDef: { event: 'onKO', condition: { owner: 'me' }, optional: true },
        effects: [{ type: 'atkBonus', amount: 10, source: 'Den Mother' }]
      });
      state.G.me.setVerse = denMother;

      const kodCreature = createCreature({ id: 'victim', name: 'Victim' });

      const context = {
        creature: kodCreature,
        creatureOwnerKey: 'me',
        targetOwner: 'me',
        targetLocation: 'active'
      };

      // Mock gameCtx - player DECLINES trigger
      const gameCtx = {
        promptTrigger: async () => false,
        showTriggerReveal: async () => {},
        log: () => {}
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Verify NO attack bonus was added
      expect(state.G.me.attackBonuses).toHaveLength(0);
      // Verify set verse was NOT consumed
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Mana Drain negates opponent spell and gains 1 mana', async () => {
      // Set up Mana Drain on opponent
      const manaDrain = createSetVerse({
        id: 'manaDrain',
        name: 'Mana Drain',
        triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
        effects: [{ type: 'negateSpell' }, { type: 'gainMana', amount: 1 }]
      });
      state.G.opp.setVerse = manaDrain;
      state.G.opp.mana = 2; // Starting mana

      // Mock spell being cast by 'me' (opponent of Mana Drain owner)
      const spell = { id: 'fireball', name: 'Fireball' };
      const context = { spell, casterKey: 'me' };

      const gameCtx = {
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('onCast', context, state, gameCtx);

      // Verify spell was negated
      expect(result.negated).toBe(true);
      // Verify opponent gained 1 mana
      expect(state.G.opp.mana).toBe(3);
      // Verify Mana Drain was consumed (sent to grave)
      expect(state.G.opp.setVerse).toBeNull();
      expect(state.G.opp.grave).toHaveLength(1);
      expect(state.G.opp.grave[0].id).toBe('manaDrain');
    });

    it('Mana Drain does NOT trigger when owner casts a spell', async () => {
      // Set up Mana Drain on 'me'
      const manaDrain = createSetVerse({
        id: 'manaDrain',
        name: 'Mana Drain',
        triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
        effects: [{ type: 'negateSpell' }, { type: 'gainMana', amount: 1 }]
      });
      state.G.me.setVerse = manaDrain;
      state.G.me.mana = 2;

      // Spell cast by 'me' (same as Mana Drain owner)
      const spell = { id: 'fireball', name: 'Fireball' };
      const context = { spell, casterKey: 'me' };

      const gameCtx = {
        showTriggerReveal: async () => {},
        log: () => {}
      };

      const result = await processTriggers('onCast', context, state, gameCtx);

      // Verify spell was NOT negated
      expect(result.negated).toBeFalsy();
      // Verify mana unchanged
      expect(state.G.me.mana).toBe(2);
      // Verify Mana Drain was NOT consumed
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.grave).toHaveLength(0);
    });

    it('Grave Rise summons 1-cost creature from grave to bench on KO', async () => {
      // Set up a 1-cost creature in the grave
      const deadCreature = createCreature({
        id: 'fangpup',
        name: 'Fangpup',
        cost: 1,
        hp: 20,
        curHp: 0  // It's dead
      });
      state.G.me.grave = [deadCreature];
      
      // Set up Grave Rise with proper trigger definition
      const graveRise = createSetVerse({
        id: 'graveRise',
        name: 'Grave Rise',
        triggerDef: { 
          event: 'onKO', 
          condition: { owner: 'me', hasOneCostInGrave: true, benchNotFull: true }, 
          optional: true 
        },
        effects: [{ type: 'summonFromGrave', filter: { cost: 1 }, location: 'bench' }]
      });
      state.G.me.setVerse = graveRise;
      
      // Empty bench (not full)
      state.G.me.bench = [];
      
      // Some creature just got KO'd (trigger condition)
      const koVictim = createCreature({ id: 'other', name: 'Other', cost: 2 });

      const context = { 
        creature: koVictim,
        creatureOwnerKey: 'me',
        targetOwner: 'me',
        targetLocation: 'active'
      };

      // Mock gameCtx - player accepts trigger
      const logs = [];
      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: (msg) => logs.push(msg),
        render: () => {},
        promptGraveSelect: async (candidates) => candidates[0], // Auto-select first
        processEffects: async (card, ctx) => {
          // Import and run the actual effect
          const { processEffects } = await import('../src/effects.js');
          return processEffects(card, ctx);
        }
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Verify creature was summoned to bench
      expect(state.G.me.bench).toHaveLength(1);
      expect(state.G.me.bench[0].id).toBe('fangpup');
      expect(state.G.me.bench[0].curHp).toBe(20); // HP restored
      
      // Verify creature was removed from grave
      expect(state.G.me.grave.filter(c => c.id === 'fangpup')).toHaveLength(0);
      
      // Verify set verse was consumed (sent to grave)
      expect(state.G.me.setVerse).toBeNull();
      expect(state.G.me.grave.some(c => c.id === 'graveRise')).toBe(true);
      
      // Verify log message
      expect(logs.some(l => l.includes('rises to bench'))).toBe(true);
    });

    it('Grave Rise does not trigger if no 1-cost creature in grave', async () => {
      // No 1-cost creatures in grave (only a 2-cost)
      const deadCreature = createCreature({
        id: 'biggie',
        name: 'Biggie',
        cost: 2
      });
      state.G.me.grave = [deadCreature];
      
      const graveRise = createSetVerse({
        id: 'graveRise',
        name: 'Grave Rise',
        triggerDef: { 
          event: 'onKO', 
          condition: { owner: 'me', hasOneCostInGrave: true, benchNotFull: true }, 
          optional: true 
        },
        effects: [{ type: 'summonFromGrave', filter: { cost: 1 }, location: 'bench' }]
      });
      state.G.me.setVerse = graveRise;
      state.G.me.bench = [];

      const context = { 
        creature: createCreature(),
        creatureOwnerKey: 'me',
        targetOwner: 'me',
        targetLocation: 'active'
      };

      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {},
        render: () => {},
        processEffects: async () => ({ success: true, kos: [] })
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Grave Rise should NOT have triggered (condition not met)
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.bench).toHaveLength(0);
    });

    it('Grave Rise does not trigger if bench is full', async () => {
      // 1-cost creature in grave
      const deadCreature = createCreature({ id: 'fangpup', cost: 1 });
      state.G.me.grave = [deadCreature];
      
      const graveRise = createSetVerse({
        id: 'graveRise',
        name: 'Grave Rise',
        triggerDef: { 
          event: 'onKO', 
          condition: { owner: 'me', hasOneCostInGrave: true, benchNotFull: true }, 
          optional: true 
        },
        effects: [{ type: 'summonFromGrave', filter: { cost: 1 }, location: 'bench' }]
      });
      state.G.me.setVerse = graveRise;
      
      // Full bench (2 creatures)
      state.G.me.bench = [createCreature(), createCreature()];

      const context = { 
        creature: createCreature(),
        creatureOwnerKey: 'me',
        targetOwner: 'me',
        targetLocation: 'active'
      };

      const gameCtx = {
        promptTrigger: async () => true,
        showTriggerReveal: async () => {},
        log: () => {},
        render: () => {},
        processEffects: async () => ({ success: true, kos: [] })
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Grave Rise should NOT have triggered (bench full)
      expect(state.G.me.setVerse).not.toBeNull();
      expect(state.G.me.bench).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VENGEANCE / BEFORE KO EVENT TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('Vengeance (beforeKO event)', () => {
    let processTriggers;

    beforeEach(async () => {
      const module = await import('../src/triggers.js');
      processTriggers = module.processTriggers;
    });

    it('beforeKO event matches when target is me.active and trigger owner matches target owner', () => {
      // Player's creature is being KO'd, player has Vengeance
      const vengeance = createSetVerse({
        id: 'vengeance',
        name: 'Vengeance',
        triggerDef: { event: 'beforeKO', condition: { target: 'me.active' }, optional: true, priority: 2 },
        effects: [{ type: 'negateKO' }, { type: 'destroy', target: 'attacker' }]
      });
      state.G.me.setVerse = vengeance;
      state.G.me.active = createCreature({ curHp: 0 });  // Would be KO'd

      const context = { 
        target: state.G.me.active,
        targetOwner: 'me',  // Player's creature is target
        targetLocation: 'active',
        attacker: createCreature({ name: 'Enemy Attacker' }),
        attackerOwner: state.G.opp,
        attackerOwnerKey: 'opp',
        activePlayerKey: 'opp'
      };

      const matches = getMatchingTriggers('beforeKO', context, state);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].card.id).toBe('vengeance');
    });

    it('beforeKO event does NOT match when target owner differs from trigger owner', () => {
      // Opponent's creature is being KO'd, player has Vengeance
      // Vengeance should NOT trigger for opponent's creature
      const vengeance = createSetVerse({
        id: 'vengeance',
        name: 'Vengeance',
        triggerDef: { event: 'beforeKO', condition: { target: 'me.active' }, optional: true, priority: 2 },
        effects: [{ type: 'negateKO' }, { type: 'destroy', target: 'attacker' }]
      });
      state.G.me.setVerse = vengeance;  // Player has vengeance
      state.G.opp.active = createCreature({ curHp: 0 });  // But opp's creature is dying

      const context = { 
        target: state.G.opp.active,
        targetOwner: 'opp',  // Opponent's creature is target
        targetLocation: 'active',
        attacker: createCreature({ name: 'Player Attacker' }),
        attackerOwner: state.G.me,
        attackerOwnerKey: 'me',
        activePlayerKey: 'me'
      };

      const matches = getMatchingTriggers('beforeKO', context, state);
      
      // No matches - player's vengeance shouldn't trigger for opp's creature
      expect(matches).toHaveLength(0);
    });

    it('Vengeance negates KO and sets koNegated in context', async () => {
      const vengeance = createSetVerse({
        id: 'vengeance',
        name: 'Vengeance',
        triggerDef: { event: 'beforeKO', condition: { target: 'me.active' }, optional: true, priority: 2 },
        effects: [{ type: 'negateKO' }, { type: 'destroy', target: 'attacker' }]
      });
      state.G.me.setVerse = vengeance;
      
      const dyingCreature = createCreature({ name: 'My Creature', curHp: 0 });
      state.G.me.active = dyingCreature;
      
      const attacker = createCreature({ name: 'Enemy Attacker' });
      state.G.opp.active = attacker;
      state.G.opp.grave = [];

      const context = { 
        target: dyingCreature,
        targetOwner: 'me',
        targetLocation: 'active',
        attacker: attacker,
        attackerOwner: state.G.opp,
        attackerOwnerKey: 'opp',
        activePlayerKey: 'opp'
      };

      const result = await processTriggers('beforeKO', context, state, {
        promptTrigger: async () => true,  // Always trigger
        showTriggerReveal: async () => {},
        log: () => {},
        render: () => {},
        processEffects: async (card, ctx) => {
          const { processEffects: pe } = await import('../src/effects.js');
          return await pe(card, ctx);
        }
      });

      // KO should be negated
      expect(result.koNegated).toBe(true);
      
      // Creature should survive with 1 HP
      expect(dyingCreature.curHp).toBe(1);
      
      // Attacker should be destroyed (sent to grave, active nulled)
      expect(state.G.opp.active).toBeNull();
      expect(state.G.opp.grave).toContainEqual(attacker);
      
      // Set verse should be consumed
      expect(state.G.me.setVerse).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY SYSTEM TESTS
  // ═══════════════════════════════════════════════════════════════
  
  describe('Priority System', () => {
    let getTriggerPriority, processTriggers;

    beforeEach(async () => {
      const module = await import('../src/triggers.js');
      getTriggerPriority = module.getTriggerPriority;
      processTriggers = module.processTriggers;
    });

    it('getTriggerPriority returns explicit priority when set', () => {
      const trigger = { event: 'beforeDamage', priority: 2 };
      expect(getTriggerPriority(trigger, {})).toBe(2);
    });

    it('getTriggerPriority auto-detects priority 2 for negateSpell', () => {
      const trigger = { event: 'onCast' };
      const card = { effects: [{ type: 'negateSpell' }] };
      expect(getTriggerPriority(trigger, card)).toBe(2);
    });

    it('getTriggerPriority auto-detects priority 2 for negateAttack', () => {
      const trigger = { event: 'beforeAttack' };
      const card = { effects: [{ type: 'negateAttack' }] };
      expect(getTriggerPriority(trigger, card)).toBe(2);
    });

    it('getTriggerPriority auto-detects priority 3 for reduceDamage', () => {
      const trigger = { event: 'beforeDamage' };
      const card = { effects: [{ type: 'reduceDamage', amount: 15 }] };
      expect(getTriggerPriority(trigger, card)).toBe(3);
    });

    it('getTriggerPriority defaults to 4 for standard triggers', () => {
      const trigger = { event: 'onKO' };
      const card = { effects: [{ type: 'atkBonus', amount: 10 }] };
      expect(getTriggerPriority(trigger, card)).toBe(4);
    });

    it('getMatchingTriggers includes priority in matches', () => {
      const braceVerse = createSetVerse({
        id: 'brace',
        name: 'Brace',
        triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' } },
        effects: [{ type: 'reduceDamage', amount: 15 }]
      });
      state.G.me.setVerse = braceVerse;
      state.G.me.active = createCreature();

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active',
        damage: 30 
      };

      const matches = getMatchingTriggers('beforeDamage', context, state);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].priority).toBe(3);  // Auto-detected from reduceDamage
    });

    it('processTriggers fires priority 2 before priority 4', async () => {
      const executionOrder = [];
      
      // Set up two verses: one with negate (priority 2), one standard (priority 4)
      const negateVerse = createSetVerse({
        id: 'manaDrain',
        name: 'Mana Drain',
        triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
        effects: [{ type: 'negateSpell' }]
      });
      state.G.me.setVerse = negateVerse;

      const standardVerse = createSetVerse({
        id: 'standard',
        name: 'Standard Trigger',
        triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
        effects: [{ type: 'draw', count: 1 }]
      });
      state.G.opp.setVerse = standardVerse;

      const context = { 
        casterKey: 'opp',
        verse: { name: 'Fireball' }
      };

      const gameCtx = {
        log: (msg) => {
          executionOrder.push(msg);
        }
      };

      await processTriggers('onCast', context, state, gameCtx);

      // Mana Drain (priority 2) should fire first
      expect(executionOrder[0]).toContain('Mana Drain');
    });

    it('same priority triggers: non-active player fires first', async () => {
      const executionOrder = [];
      
      // Both players have priority 4 triggers
      const meVerse = createSetVerse({
        id: 'myTrigger',
        name: 'My Trigger',
        triggerDef: { event: 'onKO', condition: { owner: 'me' } },
        effects: [{ type: 'draw', count: 1 }]
      });
      state.G.me.setVerse = meVerse;

      const oppVerse = createSetVerse({
        id: 'oppTrigger',
        name: 'Opp Trigger',
        triggerDef: { event: 'onKO', condition: { owner: 'opp' } },  // 'opp' from opp's POV = my creature
        effects: [{ type: 'draw', count: 1 }]
      });
      state.G.opp.setVerse = oppVerse;

      const context = { 
        creatureOwnerKey: 'me',
        targetOwner: 'me',
        activePlayerKey: 'me'  // Player 'me' is the active player
      };

      // Track which triggers fire
      const fired = [];
      const gameCtx = {
        processEffects: async (card) => {
          fired.push(card.name);
          return { success: true };
        }
      };

      await processTriggers('onKO', context, state, gameCtx);

      // Opp's trigger should fire first (defender/non-active advantage)
      expect(fired[0]).toBe('Opp Trigger');
      expect(fired[1]).toBe('My Trigger');
    });

    it('cannotBeNegated flag is included in matches', () => {
      const unstoppableVerse = createSetVerse({
        id: 'unstoppable',
        name: 'Unstoppable',
        triggerDef: { event: 'beforeDamage', cannotBeNegated: true },
        effects: [{ type: 'reduceDamage', amount: 20 }]
      });
      state.G.me.setVerse = unstoppableVerse;
      state.G.me.active = createCreature();

      const context = { 
        targetOwner: 'me', 
        targetLocation: 'active'
      };

      const matches = getMatchingTriggers('beforeDamage', context, state);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].cannotBeNegated).toBe(true);
    });
  });
});

// ============================================
// afterAttack Event Tests (standalone)
// ============================================
import { matchesTrigger as matchesTriggerFn } from '../src/triggers.js';

describe('afterAttack event (standalone)', () => {
  it('should match thornling trigger when defending', () => {
    const trigger = { event: 'afterAttack', condition: { defender: 'self' } };
    const thornling = { id: 'thornling', name: 'Thornling' };
    const context = {
      defender: thornling,
      self: thornling,  // Same object reference
      attacker: { id: 'fangpup', name: 'Fangpup' }
    };
    expect(matchesTriggerFn(trigger, 'afterAttack', context)).toBe(true);
  });

  it('should not match thornling trigger when attacking', () => {
    const trigger = { event: 'afterAttack', condition: { defender: 'self' } };
    const thornling = { id: 'thornling', name: 'Thornling' };
    const context = {
      defender: { id: 'fangpup', name: 'Fangpup' },
      self: thornling,
      attacker: thornling
    };
    expect(matchesTriggerFn(trigger, 'afterAttack', context)).toBe(false);
  });

  it('should match hexweaver trigger when attacking and dealing damage', () => {
    const trigger = { event: 'afterAttack', condition: { attacker: 'self', didDamage: true, defenderAlive: true } };
    const hexweaver = { id: 'hexweaver', name: 'Hexweaver' };
    const context = {
      attacker: hexweaver,
      self: hexweaver,  // Same object reference
      defender: { id: 'fangpup', name: 'Fangpup' },
      didDamage: true,
      defenderAlive: true
    };
    expect(matchesTriggerFn(trigger, 'afterAttack', context)).toBe(true);
  });

  it('should not match hexweaver when defender KOd', () => {
    const trigger = { event: 'afterAttack', condition: { attacker: 'self', didDamage: true, defenderAlive: true } };
    const hexweaver = { id: 'hexweaver', name: 'Hexweaver' };
    const context = {
      attacker: hexweaver,
      self: hexweaver,
      defender: { id: 'fangpup', name: 'Fangpup' },
      didDamage: true,
      defenderAlive: false  // KO'd!
    };
    expect(matchesTriggerFn(trigger, 'afterAttack', context)).toBe(false);
  });

  it('should match sundewqueen trigger when causing KO', () => {
    const trigger = { event: 'afterAttack', condition: { attacker: 'self', causedKO: true } };
    const sundewqueen = { id: 'sundewqueen', name: 'Sundew Queen' };
    const context = {
      attacker: sundewqueen,
      self: sundewqueen,  // Same object reference
      defender: { id: 'fangpup', name: 'Fangpup' },
      causedKO: true
    };
    expect(matchesTriggerFn(trigger, 'afterAttack', context)).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// onLethalDamage EVENT TESTS (Bulwark's Fortress)
// ═══════════════════════════════════════════════════════════════

describe('onLethalDamage event', () => {
  let getMatchingTriggers;
  
  beforeEach(async () => {
    const module = await import('../src/triggers.js');
    getMatchingTriggers = module.getMatchingTriggers;
  });

  it('finds Bulwark survival ability when taking lethal damage', () => {
    const state = {
      G: {
        me: {
          active: {
            id: 'bulwark',
            name: 'Bulwark',
            curHp: 0,
            hp: 70,
            ability: {
              name: 'Fortress',
              trigger: { event: 'onLethalDamage', condition: { self: true, notUsed: 'fortressUsed' } },
              effects: [
                { type: 'setHP', target: 'self', amount: 1 },
                { type: 'markUsed', flag: 'fortressUsed' }
              ]
            }
          },
          bench: [],
          setVerse: null
        },
        opp: {
          active: null,
          bench: [],
          setVerse: null
        }
      }
    };
    
    const matches = getMatchingTriggers('onLethalDamage', {
      creature: state.G.me.active,
      creatureOwnerKey: 'me',
      source: 'attack'
    }, state);
    
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('survivalAbility');
    expect(matches[0].card.id).toBe('bulwark');
    expect(matches[0].ownerKey).toBe('me');
  });

  it('does NOT trigger if fortressUsed flag is set', () => {
    const state = {
      G: {
        me: {
          active: {
            id: 'bulwark',
            name: 'Bulwark',
            curHp: 0,
            hp: 70,
            fortressUsed: true,  // Already used
            ability: {
              name: 'Fortress',
              trigger: { event: 'onLethalDamage', condition: { self: true, notUsed: 'fortressUsed' } },
              effects: [
                { type: 'setHP', target: 'self', amount: 1 },
                { type: 'markUsed', flag: 'fortressUsed' }
              ]
            }
          },
          bench: [],
          setVerse: null
        },
        opp: {
          active: null,
          bench: [],
          setVerse: null
        }
      }
    };
    
    const matches = getMatchingTriggers('onLethalDamage', {
      creature: state.G.me.active,
      creatureOwnerKey: 'me',
      source: 'attack'
    }, state);
    
    expect(matches).toHaveLength(0);  // Should not trigger
  });

  it('does NOT trigger for non-Bulwark creatures without onLethalDamage trigger', () => {
    const state = {
      G: {
        me: {
          active: {
            id: 'emberfang',
            name: 'Emberfang',
            curHp: 0,
            hp: 35,
            ability: {
              name: 'Ignite',
              trigger: { event: 'onSummon', condition: { self: true } },
              effects: [{ type: 'damage', target: 'opp.active', amount: 10 }]
            }
          },
          bench: [],
          setVerse: null
        },
        opp: {
          active: null,
          bench: [],
          setVerse: null
        }
      }
    };
    
    const matches = getMatchingTriggers('onLethalDamage', {
      creature: state.G.me.active,
      creatureOwnerKey: 'me',
      source: 'attack'
    }, state);
    
    expect(matches).toHaveLength(0);  // No onLethalDamage trigger
  });
});
