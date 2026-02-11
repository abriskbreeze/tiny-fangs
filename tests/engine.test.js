import { describe, it, expect } from 'vitest';
import { summon, castVerse, executeAction, resolveSelection } from '../shared/engine.js';
import { createCreature, createVerse } from '../src/game.js';

function createTestState() {
  return {
    turn: 1,
    currentPlayer: 1,
    firstTurn: false,
    hasAttacked: false,
    hasRetreated: false,
    players: [
      {
        hand: [],
        deck: [],
        grave: [],
        active: null,
        bench: [],
        setVerse: null,
        mana: 5,
        maxMana: 5,
        lp: 3,
        chainLightning: 0
      },
      {
        hand: [],
        deck: [],
        grave: [],
        active: null,
        bench: [],
        setVerse: null,
        mana: 5,
        maxMana: 5,
        lp: 3,
        chainLightning: 0
      }
    ]
  };
}

describe('summon action', () => {
  it('summons creature to active slot when empty', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 40, atk: 20 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    expect(state.players[0].active).toBe(creature);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[0].mana).toBe(3); // 5 - 2 cost
    expect(result.events.some(e => e.type === 'summon' && e.slot === 'active')).toBe(true);
  });

  it('summons creature to bench when active exists', () => {
    const state = createTestState();
    const active = createCreature({ id: 'emberfang', cost: 2, hp: 40, atk: 20 });
    const toSummon = createCreature({ id: 'duskfang', cost: 3, hp: 50, atk: 25 });
    state.players[0].active = active;
    state.players[0].hand.push(toSummon);
    state.players[0].mana = 5;

    const result = summon(state, 0, toSummon.uid);

    expect(result.error).toBeUndefined();
    expect(state.players[0].bench).toContain(toSummon);
    expect(state.players[0].mana).toBe(2); // 5 - 3 cost
    expect(result.events.some(e => e.type === 'summon' && e.slot === 'bench')).toBe(true);
  });

  it('fails when bench is full', () => {
    const state = createTestState();
    state.players[0].active = createCreature({ id: 'a' });
    state.players[0].bench = [
      createCreature({ id: 'b' }),
      createCreature({ id: 'c' })
    ];
    const toSummon = createCreature({ id: 'd', cost: 1 });
    state.players[0].hand.push(toSummon);
    state.players[0].mana = 5;

    const result = summon(state, 0, toSummon.uid);

    expect(result.error).toBe('Bench full');
  });

  it('fails with not enough mana', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang', cost: 3 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 2;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBe('Not enough mana');
  });

  it('applies chain lightning damage after summon', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 40, curHp: 40 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;
    state.players[0].chainLightning = 20;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    expect(creature.curHp).toBe(20); // 40 - 20 chain lightning
    expect(state.players[0].chainLightning).toBe(0); // Consumed
    expect(result.events.some(e => e.type === 'damage' && e.source === 'Chain Lightning')).toBe(true);
  });

  it('chain lightning can KO the summoned creature', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 30, curHp: 30 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;
    state.players[0].chainLightning = 30;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    expect(creature.curHp).toBe(0);
    expect(state.players[0].active).toBeNull(); // KO'd
    expect(state.players[0].grave).toContain(creature);
    expect(result.events.some(e => e.type === 'ko' && e.source === 'Chain Lightning')).toBe(true);
  });

  it('Soul Trap KOs opponent summoned creature with low HP', () => {
    const state = createTestState();
    // Player 1 (opponent) has Soul Trap set
    const soulTrap = createVerse({ id: 'soulTrap', cardType: 'verse', type: 'set' });
    state.players[1].setVerse = soulTrap;

    // Player 0 summons a creature with 20 HP (Soul Trap deals 20 damage)
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 20, curHp: 20 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    // Soul Trap should have dealt 20 damage and KO'd the creature
    expect(creature.curHp).toBe(0);
    expect(state.players[0].active).toBeNull();
    expect(state.players[0].grave).toContain(creature);
    expect(result.events.some(e => e.type === 'ko')).toBe(true);
  });

  it('Soul Trap damages but does not KO creature with enough HP', () => {
    const state = createTestState();
    // Player 1 (opponent) has Soul Trap set
    const soulTrap = createVerse({ id: 'soulTrap', cardType: 'verse', type: 'set' });
    state.players[1].setVerse = soulTrap;

    // Player 0 summons a creature with 40 HP (Soul Trap deals 20 damage)
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 40, curHp: 40 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    // Soul Trap should have dealt 20 damage
    expect(creature.curHp).toBe(20);
    expect(state.players[0].active).toBe(creature); // Still on board
    expect(state.players[0].grave).not.toContain(creature);
  });
});

describe('castVerse action', () => {
  it('casts simple verse (secondWind) and heals active creature', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'secondWind', cardType: 'verse', type: 'cast', cost: 2 });
    const creature = createCreature({ id: 'emberfang', hp: 80 });
    creature.curHp = 30; // Damage the creature
    state.players[0].hand.push(verse);
    state.players[0].active = creature;
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid);

    expect(result.error).toBeUndefined();
    expect(creature.curHp).toBe(70); // 30 + 40 heal
    expect(state.players[0].mana).toBe(3);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[0].grave).toContain(verse);
  });

  it('returns needsSelection for targeting verse without target', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'ignite', cardType: 'verse', type: 'cast', cost: 1 });
    const creature = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    state.players[0].hand.push(verse);
    state.players[1].active = creature;
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid, {});

    expect(result.needsSelection).toBe(true);
    expect(result.selectionConfig).toBeDefined();
    expect(result.selectionConfig.prompt).toContain('ignite');
    // Mana should NOT be spent yet
    expect(state.players[0].mana).toBe(5);
  });

  it('casts ignite with target and deals damage', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'ignite', cardType: 'verse', type: 'cast', cost: 1 });
    const creature = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    state.players[0].hand.push(verse);
    state.players[1].active = creature;
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid, { targetUid: creature.uid });

    expect(result.error).toBeUndefined();
    expect(creature.curHp).toBe(25); // 40 - 15 ignite damage
    expect(state.players[0].mana).toBe(4);
  });

  it('casts banish and removes creature from game', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'banish', cardType: 'verse', type: 'cast', cost: 3 });
    const creature = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    state.players[0].hand.push(verse);
    state.players[1].active = creature;
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid, { targetUid: creature.uid });

    expect(result.error).toBeUndefined();
    expect(state.players[1].active).toBeNull();
    // Banished creatures don't go to grave
    expect(state.players[1].grave).not.toContain(creature);
    expect(state.players[0].mana).toBe(2);
  });

  it('casts sacrifice with own creature target', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'sacrifice', cardType: 'verse', type: 'cast', cost: 0 });
    const creature = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    state.players[0].hand.push(verse);
    state.players[0].active = creature;
    state.players[0].deck = [
      createCreature({ id: 'a' }),
      createCreature({ id: 'b' }),
      createCreature({ id: 'c' })
    ];
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid, { sacrificeUid: creature.uid });

    expect(result.error).toBeUndefined();
    expect(state.players[0].active).toBeNull();
    expect(state.players[0].grave).toContain(creature);
    expect(state.players[0].hand).toHaveLength(2); // Drew 2 cards
    expect(state.players[0].mana).toBe(5); // Cost 0
  });

  it('casts graveEcho and returns creature to hand', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'graveEcho', cardType: 'verse', type: 'cast', cost: 3 });
    const deadCreature = createCreature({ id: 'emberfang', hp: 40, curHp: 0 });
    state.players[0].hand.push(verse);
    state.players[0].grave.push(deadCreature);
    state.players[0].mana = 5;

    const result = castVerse(state, 0, verse.uid, { graveUid: deadCreature.uid });

    expect(result.error).toBeUndefined();
    expect(state.players[0].grave).not.toContain(deadCreature);
    expect(state.players[0].hand).toContain(deadCreature);
    expect(state.players[0].mana).toBe(2);
  });

  it('fails to cast verse with not enough mana', () => {
    const state = createTestState();
    const verse = createVerse({ id: 'secondWind', cardType: 'verse', type: 'cast', cost: 2 });
    state.players[0].hand.push(verse);
    state.players[0].mana = 1;

    const result = castVerse(state, 0, verse.uid);

    expect(result.error).toBe('Not enough mana');
    expect(state.players[0].hand).toContain(verse);
  });
});

describe('resolveSelection', () => {
  it('returns needsSelection when no target provided', () => {
    const state = createTestState();
    const config = { type: 'creature', filter: 'any', location: 'board', required: true };
    
    const result = resolveSelection(state, 0, {}, config);
    
    expect(result.needsSelection).toBe(true);
  });

  it('finds target creature on opponent board', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang' });
    state.players[1].active = creature;
    const config = { type: 'creature', filter: 'any', location: 'board', required: true };
    
    const result = resolveSelection(state, 0, { targetUid: creature.uid }, config);
    
    expect(result.creature).toBe(creature);
    expect(result.ownerKey).toBe('opp');
    expect(result.location).toBe('active');
  });

  it('finds friendly creature on own board', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang' });
    state.players[0].active = creature;
    const config = { type: 'creature', filter: 'friendly', location: 'board', required: true };
    
    const result = resolveSelection(state, 0, { selectedUid: creature.uid }, config);
    
    expect(result.creature).toBe(creature);
    expect(result.ownerKey).toBe('me');
  });

  it('finds creature in graveyard', () => {
    const state = createTestState();
    const creature = createCreature({ id: 'emberfang' });
    state.players[0].grave.push(creature);
    const config = { type: 'creature', filter: 'friendly', location: 'grave', required: true };
    
    const result = resolveSelection(state, 0, { graveUid: creature.uid }, config);
    
    expect(result.creature).toBe(creature);
    expect(result.location).toBe('grave');
  });
});

describe('retreat action with chain lightning', () => {
  it('applies chain lightning damage after retreat', () => {
    const state = createTestState();
    const active = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    const bench = createCreature({ id: 'thornback', hp: 50, curHp: 50 });
    state.players[0].active = active;
    state.players[0].bench.push(bench);
    state.players[0].chainLightning = 20;

    const result = executeAction(state, 0, { action: 'retreat', benchIdx: 0 });

    expect(result.error).toBeUndefined();
    expect(state.players[0].active).toBe(bench);
    expect(bench.curHp).toBe(30); // 50 - 20 chain lightning
    expect(state.players[0].chainLightning).toBe(0); // Consumed
    expect(result.events.some(e => e.type === 'damage' && e.source === 'Chain Lightning')).toBe(true);
  });

  it('chain lightning can KO creature during retreat and auto-swap', () => {
    const state = createTestState();
    const active = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    const bench = createCreature({ id: 'thornback', hp: 20, curHp: 20 });
    state.players[0].active = active;
    state.players[0].bench.push(bench);
    state.players[0].chainLightning = 25;

    const result = executeAction(state, 0, { action: 'retreat', benchIdx: 0 });

    expect(result.error).toBeUndefined();
    // After retreat: active = bench (thornback), bench = [emberfang]
    // Chain lightning deals 25 to thornback (20 hp) → KO
    // Auto-swap brings emberfang back as active
    expect(state.players[0].active).toBe(active); // emberfang swapped back
    expect(state.players[0].grave).toContain(bench); // thornback KO'd
    expect(result.events.some(e => e.type === 'ko' && e.source === 'Chain Lightning')).toBe(true);
    expect(result.events.some(e => e.type === 'benchToActive')).toBe(true);
  });

  it('chain lightning triggers bench auto-swap after KO in retreat', () => {
    const state = createTestState();
    const active = createCreature({ id: 'emberfang', hp: 40, curHp: 40 });
    const bench1 = createCreature({ id: 'thornback', hp: 20, curHp: 20 });
    const bench2 = createCreature({ id: 'ironhide', hp: 60, curHp: 60 });
    state.players[0].active = active;
    state.players[0].bench.push(bench1);
    state.players[0].bench.push(bench2);
    state.players[0].chainLightning = 25;

    const result = executeAction(state, 0, { action: 'retreat', benchIdx: 0 });

    expect(result.error).toBeUndefined();
    // Retreat: active (emberfang) goes to bench[0], bench1 (thornback) becomes active
    // After retreat: bench = [emberfang, bench2], active = bench1
    // Chain lightning hits bench1 (thornback, 20hp), KO'd
    // autoSwapBenchToActive grabs emberfang (first in bench)
    expect(state.players[0].active).toBe(active); // emberfang swapped back from bench
    expect(state.players[0].bench).toContain(bench2); // bench2 still on bench
    expect(state.players[0].grave).toContain(bench1); // thornback KO'd
    expect(result.events.some(e => e.type === 'benchToActive')).toBe(true);
  });
});
