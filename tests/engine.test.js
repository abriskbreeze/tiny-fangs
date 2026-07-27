import { describe, it, expect } from 'vitest';
import {
  summon,
  castVerse,
  attack,
  respondOptionalTrigger,
  executeAction,
  resolveSelection,
  mkCreature,
  mkVerse
} from '../shared/engine.js';
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

  it('Soul Trap does NOT trigger on owner summon (only opponent summons)', () => {
    const state = createTestState();
    // Player 0 has their OWN Soul Trap set
    const soulTrap = createVerse({ id: 'soulTrap', cardType: 'verse', type: 'set' });
    state.players[0].setVerse = soulTrap;

    // Player 0 summons a creature - their OWN Soul Trap should NOT trigger
    const creature = createCreature({ id: 'emberfang', cost: 2, hp: 20, curHp: 20 });
    state.players[0].hand.push(creature);
    state.players[0].mana = 5;

    const result = summon(state, 0, creature.uid);

    expect(result.error).toBeUndefined();
    // Creature should NOT be damaged (Soul Trap has condition: owner: 'opp')
    expect(creature.curHp).toBe(20);
    expect(state.players[0].active).toBe(creature);
    // Soul Trap should still be set (not triggered/consumed)
    expect(state.players[0].setVerse).toBe(soulTrap);
    expect(state.players[0].grave).not.toContain(soulTrap);
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

describe('Grave Rise (onKO optional trigger)', () => {
  it('returns pendingAction when defender with Grave Rise is KO\'d and 1-cost is in grave', () => {
    const state = createTestState();
    state.firstTurn = false;
    state.turn = 2;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('whisper');
    defender.curHp = 5;
    const pupInGrave = mkCreature('fangpup');
    pupInGrave.curHp = 0;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].grave = [pupInGrave];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const result = attack(state, 0);

    expect(result.pendingAction).toBeTruthy();
    expect(result.pendingAction.type).toBe('optionalTrigger');
    expect(result.pendingAction.verseId).toBe('graveRise');
    expect(result.pendingAction.side).toBe('p2');
    expect(state.players[1].setVerse?.id).toBe('graveRise'); // still set until response
  });

  it('summons 1-cost from grave to bench when Grave Rise is confirmed', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('duskfang'); // cost 3 — not a revive candidate itself
    defender.curHp = 5;
    const pupInGrave = mkCreature('fangpup');
    pupInGrave.curHp = 0;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].grave = [pupInGrave];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const attackResult = attack(state, 0);
    expect(attackResult.pendingAction?.verseId).toBe('graveRise');

    const confirm = respondOptionalTrigger(state, 1, {
      confirmed: true,
      verseId: 'graveRise',
      context: attackResult.pendingAction.context
    });

    expect(confirm.error).toBeUndefined();
    expect(state.players[1].setVerse).toBeNull();
    expect(state.players[1].bench).toHaveLength(1);
    expect(state.players[1].bench[0].id).toBe('fangpup');
    expect(state.players[1].bench[0].curHp).toBe(state.players[1].bench[0].hp);
    expect(state.players[1].grave.some(c => c.id === 'fangpup')).toBe(false);
    expect(state.players[1].grave.some(c => c.id === 'graveRise')).toBe(true);
    expect(confirm.events.some(e => e.type === 'summon' && e.source === 'Grave Rise')).toBe(true);
  });

  it('does not offer Grave Rise to the attacker who scored the KO', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('whisper');
    defender.curHp = 5;
    const pupInGrave = mkCreature('fangpup');

    state.players[0].active = attacker;
    state.players[0].grave = [pupInGrave];
    state.players[0].setVerse = mkVerse('graveRise');
    state.players[1].active = defender;

    const result = attack(state, 0);

    expect(result.pendingAction).toBeFalsy();
    expect(state.players[0].setVerse?.id).toBe('graveRise');
  });

  it('does not offer Grave Rise when no 1-cost creature is in grave', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('duskfang'); // cost 3
    defender.curHp = 5;
    const expensiveInGrave = mkCreature('titanback'); // cost > 1

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].grave = [expensiveInGrave];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const result = attack(state, 0);

    expect(result.pendingAction).toBeFalsy();
    expect(state.players[1].setVerse?.id).toBe('graveRise');
  });

  it('offers Grave Rise when the only grave creature is the 1-cost that just died', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('fangpup'); // cost 1
    defender.curHp = 5;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].grave = [];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const attackResult = attack(state, 0);
    expect(attackResult.pendingAction?.verseId).toBe('graveRise');
    expect(state.players[1].grave.some(c => c.id === 'fangpup')).toBe(true);

    const confirm = respondOptionalTrigger(state, 1, {
      confirmed: true,
      verseId: 'graveRise',
      context: attackResult.pendingAction.context
    });

    expect(confirm.error).toBeUndefined();
    expect(state.players[1].bench.some(c => c.id === 'fangpup')).toBe(true);
  });

  it('still offers Grave Rise when the KO\'d creature also has an onKO ability (Gloom)', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    state.players[0].active = attacker;
    state.players[0].hand = [mkCreature('whisper')];

    const defender = mkCreature('gloom');
    defender.curHp = 5;
    const pupInGrave = mkCreature('fangpup');
    pupInGrave.curHp = 0;

    state.players[1].active = defender;
    state.players[1].grave = [pupInGrave];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const result = attack(state, 0);
    expect(result.pendingAction?.verseId).toBe('graveRise');
    expect(result.events.some(e => e.type === 'discard' || e.type === 'abilityTrigger')).toBe(true);
  });

  it('offers Grave Rise to revive Gloom itself when it is the only 1-cost in grave', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    state.players[0].active = attacker;
    state.players[0].hand = [mkCreature('whisper')];

    const defender = mkCreature('gloom'); // cost 1 + onKO Fade
    defender.curHp = 5;
    state.players[1].active = defender;
    state.players[1].grave = [];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('graveRise');

    const attackResult = attack(state, 0);
    expect(attackResult.pendingAction?.verseId).toBe('graveRise');

    respondOptionalTrigger(state, 1, {
      confirmed: true,
      verseId: 'graveRise',
      context: attackResult.pendingAction.context
    });
    expect(state.players[1].bench.some(c => c.id === 'gloom')).toBe(true);
  });
});

describe('Mana Drain caster condition', () => {
  it('does not fire when the Mana Drain owner casts their own spell', () => {
    const state = createTestState();
    state.players[0].mana = 5;
    state.players[0].hand = [mkVerse('darkPact')];
    state.players[0].deck = [mkCreature('fangpup'), mkCreature('fangpup'), mkCreature('fangpup')];
    state.players[0].setVerse = mkVerse('manaDrain');
    state.players[0].active = mkCreature('emberfang');

    const result = castVerse(state, 0, state.players[0].hand[0].uid, {});

    expect(state.players[0].setVerse?.id).toBe('manaDrain');
    expect(result.events.some(e => e.verse === 'Mana Drain')).toBe(false);
    expect(state.players[0].lp).toBe(2); // Dark Pact resolved
  });

  it('negates an opponent Cast Verse', () => {
    const state = createTestState();
    state.players[0].mana = 5;
    state.players[0].hand = [mkVerse('darkPact')];
    state.players[0].deck = [mkCreature('fangpup'), mkCreature('fangpup'), mkCreature('fangpup')];
    state.players[0].active = mkCreature('emberfang');
    state.players[1].setVerse = mkVerse('manaDrain');

    const result = castVerse(state, 0, state.players[0].hand[0].uid, {});

    expect(state.players[1].setVerse).toBeNull();
    expect(result.events.some(e => e.type === 'triggerVerse' && e.verse === 'Mana Drain')).toBe(true);
    expect(state.players[0].lp).toBe(3); // Dark Pact negated — no life loss
  });
});

describe('Dark Pact lpDamage side', () => {
  it('emits lpDamage on the caster side', () => {
    const state = createTestState();
    state.players[0].mana = 5;
    state.players[0].hand = [mkVerse('darkPact')];
    state.players[0].deck = [mkCreature('fangpup'), mkCreature('fangpup'), mkCreature('fangpup')];
    state.players[0].lp = 3;
    state.players[1].lp = 3;

    const result = castVerse(state, 0, state.players[0].hand[0].uid, {});
    const lpEvent = result.events.find(e => e.type === 'lpDamage');
    expect(lpEvent).toBeTruthy();
    expect(lpEvent.side).toBe('p1');
    expect(state.players[0].lp).toBe(2);
    expect(state.players[1].lp).toBe(3);
  });
});

describe('endTurn poison (solo parity)', () => {
  it('applies poison damage exactly once per endTurn', () => {
    const state = createTestState();
    const poisoned = mkCreature('whisper');
    poisoned.status = 'poison';
    poisoned.curHp = 30;
    state.players[0].active = poisoned;
    state.players[1].active = mkCreature('emberfang');

    const result = executeAction(state, 0, { action: 'endTurn' });

    expect(result.error).toBeUndefined();
    const poisonEvents = result.events.filter(e => e.source === 'Poison');
    expect(poisonEvents).toHaveLength(1);
    expect(poisonEvents[0].amount).toBe(10);
    expect(state.players[0].active.curHp).toBe(20);
  });
});

describe('Cindermaw Frenzy resume after optional beforeDamage', () => {
  it('pauses mid-Frenzy with resumeAttack context when Brace is offered', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('cindermaw');
    const defender = mkCreature('ironhide');
    defender.curHp = 80;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].setVerse = mkVerse('brace');

    const result = attack(state, 0);

    expect(result.pendingAction).toBeTruthy();
    expect(result.pendingAction.verseId).toBe('brace');
    expect(result.pendingAction.context.resumeAttack).toEqual({
      hit: 0,
      attackCount: 2,
      attackerUid: attacker.uid
    });
    expect(state.hasAttacked).toBe(false);
    expect(defender.curHp).toBe(80); // damage deferred
  });

  it('lands the second Frenzy hit after Brace is confirmed', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('cindermaw'); // atk 30 × 2, then 10 self
    const defender = mkCreature('whisper');
    defender.hp = 100;
    defender.curHp = 100;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].setVerse = mkVerse('brace'); // -15

    const attackResult = attack(state, 0);
    expect(attackResult.pendingAction?.verseId).toBe('brace');

    const confirm = respondOptionalTrigger(state, 1, {
      confirmed: true,
      verseId: 'brace',
      context: attackResult.pendingAction.context
    });

    expect(confirm.error).toBeUndefined();
    expect(state.hasAttacked).toBe(true);
    expect(state.players[1].setVerse).toBeNull();

    // Hit 1 after Brace: 30 - 15 = 15; Hit 2: 30 → total 45
    expect(defender.curHp).toBe(55);
    expect(attacker.curHp).toBe(attacker.hp - 10);
    expect(confirm.events.filter(e => e.type === 'damage').length).toBeGreaterThanOrEqual(2);
  });

  it('lands the second Frenzy hit after Brace is declined', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('cindermaw');
    const defender = mkCreature('whisper');
    defender.hp = 100;
    defender.curHp = 100;

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].setVerse = mkVerse('brace');

    const attackResult = attack(state, 0);
    const decline = respondOptionalTrigger(state, 1, {
      confirmed: false,
      verseId: 'brace',
      context: attackResult.pendingAction.context
    });

    expect(decline.error).toBeUndefined();
    expect(state.hasAttacked).toBe(true);
    // Full two hits of 30 with no DR: 40 HP left
    expect(defender.curHp).toBe(40);
    expect(attacker.curHp).toBe(attacker.hp - 10);
  });
});

describe('Declarative death / survival abilities', () => {
  it('Bulwark Fortress survives lethal once via onLethalDamage card data', () => {
    const state = createTestState();
    state.firstTurn = false;
    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('bulwark');
    defender.curHp = 5;
    state.players[0].active = attacker;
    state.players[1].active = defender;

    const result = attack(state, 0);
    expect(result.error).toBeUndefined();
    expect(state.players[1].active).toBe(defender);
    expect(defender.curHp).toBe(1);
    expect(defender.fortressUsed || defender.bulwarkUsed).toBe(true);
    expect(result.events.some(e => e.type === 'survival')).toBe(true);
  });

  it('Echomask Reflection makes killer lose 1 LP on KO', () => {
    const state = createTestState();
    state.firstTurn = false;
    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('echomask');
    defender.curHp = 5;
    state.players[0].active = attacker;
    state.players[0].lp = 3;
    state.players[1].active = defender;

    const result = attack(state, 0);
    expect(result.error).toBeUndefined();
    expect(state.players[1].active).toBeNull();
    expect(state.players[0].lp).toBe(2);
    expect(result.events.some(e => e.type === 'lpDamage' && e.amount === 1)).toBe(true);
  });

  it('Stormtalon sets chainLightning on the killer', () => {
    const state = createTestState();
    state.firstTurn = false;
    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('stormtalon');
    defender.curHp = 5;
    state.players[0].active = attacker;
    state.players[1].active = defender;

    const result = attack(state, 0);
    expect(result.error).toBeUndefined();
    expect(state.players[0].chainLightning).toBe(20);
    expect(result.events.some(e => e.type === 'setFlag' && e.flag === 'chainLightning')).toBe(true);
  });

  it('Titanback death recoil damages the attacker from proceduralDeathRecoil', () => {
    const state = createTestState();
    state.firstTurn = false;
    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    attacker.curHp = 40;
    const defender = mkCreature('titanback');
    defender.curHp = 5;
    // First hit of turn may consume Juggernaut DR — force lethal with high atk already
    state.players[0].active = attacker;
    state.players[1].active = defender;

    const result = attack(state, 0);
    expect(result.error).toBeUndefined();
    expect(state.players[1].grave.some(c => c.id === 'titanback')).toBe(true);
    // 25 recoil; may also have been reduced if somehow — expect damage event source Juggernaut
    expect(result.events.some(e => e.type === 'damage' && e.source === 'Juggernaut' && e.amount === 25)).toBe(true);
    expect(attacker.curHp).toBe(15);
  });
});

describe('Den Mother card truth', () => {
  it('offers optional Den Mother on ally KO and summons 1-cost from deck when confirmed', () => {
    const state = createTestState();
    state.firstTurn = false;

    const attacker = mkCreature('emberfang');
    attacker.atk = 99;
    const defender = mkCreature('duskfang');
    defender.curHp = 5;
    const pupInDeck = mkCreature('fangpup');

    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].deck = [pupInDeck];
    state.players[1].bench = [];
    state.players[1].setVerse = mkVerse('denMother');

    const attackResult = attack(state, 0);
    expect(attackResult.pendingAction?.verseId).toBe('denMother');
    expect(attackResult.pendingAction?.side).toBe('p2');

    const confirm = respondOptionalTrigger(state, 1, {
      confirmed: true,
      verseId: 'denMother',
      context: attackResult.pendingAction.context
    });

    expect(confirm.error).toBeUndefined();
    expect(state.players[1].setVerse).toBeNull();
    const summoned =
      state.players[1].active?.id === 'fangpup' ||
      state.players[1].bench.some(c => c.id === 'fangpup');
    expect(summoned).toBe(true);
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
