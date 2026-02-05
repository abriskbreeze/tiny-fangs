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
        targetLocation: 'active'
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
        targetLocation: 'active'
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
  });
});
