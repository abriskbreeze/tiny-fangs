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
  });
});
