import { describe, expect, it } from 'vitest';
import {
  createGame,
  endTurn,
  executeAction,
  mkCreature,
  mkVerse,
} from '../shared/engine.js';

function createContractState() {
  const state = createGame('shell', 'shadow');
  Object.assign(state, {
    turn: 2,
    currentPlayer: 1,
    winner: null,
    firstTurn: false,
    hasAttacked: false,
    hasRetreated: false,
  });

  state.players.forEach((player, index) => {
    Object.assign(player, {
      lp: 3,
      mana: 5,
      maxMana: 5,
      deck: [
        mkCreature(index === 0 ? 'shellkin' : 'whisper'),
        mkCreature(index === 0 ? 'pebbleback' : 'gloom'),
      ],
      hand: [],
      active: null,
      bench: [],
      grave: [],
      setVerse: null,
      usedManaSurge: false,
      usedLastBreath: false,
      attackBonuses: [],
      poisoned: false,
      chainLightning: 0,
      unbreakable: false,
    });
  });

  return state;
}

describe('ACT-13 and STA-05 — complete End Turn phase order', () => {
  it('orders poison KO, promotion, spawn, mana growth/refill, draw, and turn start', () => {
    const state = createContractState();
    const poisoned = mkCreature('whisper');
    const promoted = mkCreature('broodmother');
    const drawn = mkCreature('duskfang');
    poisoned.status = 'poison';
    poisoned.curHp = 10;

    state.players[0].active = poisoned;
    state.players[0].bench = [promoted];
    state.players[1].maxMana = 2;
    state.players[1].mana = 0;
    state.players[1].deck = [drawn];
    state.hasAttacked = true;
    state.hasRetreated = true;

    const result = executeAction(state, 0, { action: 'endTurn' });

    expect(result.error).toBeUndefined();
    expect(result.events).toStrictEqual([
      { type: 'damage', side: 'p1', amount: 10, source: 'Poison' },
      { type: 'ko', side: 'p1', creature: 'Whisper' },
      { type: 'benchToActive', side: 'p1', creature: 'Broodmother' },
      {
        type: 'abilityTrigger',
        side: 'p1',
        creature: 'Broodmother',
        ability: 'Spawn',
      },
      {
        type: 'summon',
        side: 'p1',
        creature: 'Antling',
        slot: 'bench',
      },
      { type: 'manaGain', side: 'p2' },
      { type: 'draw', count: 1 },
      { type: 'turnStart', yourTurn: false },
    ]);
    expect(state.players[0].grave).toStrictEqual([poisoned]);
    expect(state.players[0].active).toBe(promoted);
    expect(state.players[0].bench).toHaveLength(1);
    expect(state.players[0].bench[0]).toMatchObject({
      id: 'hiveling',
      name: 'Antling',
      hp: 10,
      curHp: 10,
      atk: 10,
      presentationFaceId: 'antling',
    });
    expect(state.players[1]).toMatchObject({
      mana: 3,
      maxMana: 3,
      hand: [drawn],
      deck: [],
    });
    expect(state).toMatchObject({
      currentPlayer: 2,
      firstTurn: false,
      hasAttacked: false,
      hasRetreated: false,
      winner: null,
    });
  });

  it('does not grow max mana when ending the first global turn', () => {
    const state = createContractState();
    const drawn = mkCreature('whisper');
    state.firstTurn = true;
    state.players[1].maxMana = 1;
    state.players[1].mana = 0;
    state.players[1].deck = [drawn];

    const result = endTurn(state, 0);

    expect(result.events).toStrictEqual([
      { type: 'manaGain', side: 'p2' },
      { type: 'draw', count: 1 },
      { type: 'turnStart', yourTurn: false },
    ]);
    expect(state.players[1]).toMatchObject({
      mana: 1,
      maxMana: 1,
      hand: [drawn],
      deck: [],
    });
    expect(state.firstTurn).toBe(false);
    expect(state.currentPlayer).toBe(2);
  });
});

describe('STA-07 — deck-out terminal contract', () => {
  it('emits one deck-out result from the authoritative End Turn phase', () => {
    const state = createContractState();
    state.players[1].deck = [];
    state.players[1].hand = [];

    const result = endTurn(state, 0);

    expect(result.events).toStrictEqual([
      { type: 'manaGain', side: 'p2' },
      { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
      { type: 'turnStart', yourTurn: false },
    ]);
    expect(state.winner).toBe(0);
    expect(state.currentPlayer).toBe(2);
  });

  it('emits that terminal result exactly once through executeAction', () => {
    const state = createContractState();
    state.players[1].deck = [];
    state.players[1].hand = [];

    const result = executeAction(state, 0, { action: 'endTurn' });

    expect(state.winner).toBe(0);
    expect(state.currentPlayer).toBe(2);
    expect(result.events).toStrictEqual([
      { type: 'manaGain', side: 'p2' },
      { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
      { type: 'turnStart', yourTurn: false },
    ]);
  });
});

describe('STA-01 — poison application and owner-turn tick', () => {
  it('applies poison on a real hit and deals exactly 10 only at its owner End Turn', () => {
    const state = createContractState();
    const attacker = mkCreature('hexweaver');
    const defender = mkCreature('duskfang');
    state.players[0].active = attacker;
    state.players[1].active = defender;

    const attack = executeAction(state, 0, { action: 'attack' });

    expect(attack.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20 },
      { type: 'damage', side: 'p2', amount: 20 },
      {
        type: 'abilityTrigger',
        side: 'p1',
        creature: 'Hexweaver',
        ability: 'Venom Thread',
      },
      { type: 'setStatus', side: 'p2', status: 'poison' },
    ]);
    expect(defender).toMatchObject({ curHp: 40, status: 'poison' });
    expect(state.players[1].poisoned).toBe(true);

    const attackerEnd = executeAction(state, 0, { action: 'endTurn' });
    expect(attackerEnd.events.filter(event => event.source === 'Poison')).toStrictEqual([]);
    expect(defender.curHp).toBe(40);

    const ownerEnd = executeAction(state, 1, { action: 'endTurn' });
    expect(ownerEnd.events.filter(event => event.source === 'Poison')).toStrictEqual([
      { type: 'damage', side: 'p2', amount: 10, source: 'Poison' },
    ]);
    expect(defender).toMatchObject({ curHp: 30, status: 'poison' });
  });
});

describe('STA-02 — trapped lifecycle', () => {
  it('applies trapped, blocks retreat atomically, and clears it at owner End Turn', () => {
    const state = createContractState();
    const attacker = mkCreature('mireveil');
    const defender = mkCreature('duskfang');
    const bench = mkCreature('whisper');
    state.players[0].active = attacker;
    state.players[1].active = defender;
    state.players[1].bench = [bench];

    const attack = executeAction(state, 0, { action: 'attack' });

    expect(attack.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20 },
      { type: 'damage', side: 'p2', amount: 20 },
      {
        type: 'abilityTrigger',
        side: 'p1',
        creature: 'Mireveil',
        ability: 'Bog Grasp',
      },
      { type: 'setStatus', side: 'p2', status: 'trapped' },
    ]);
    expect(defender.status).toBe('trapped');

    executeAction(state, 0, { action: 'endTurn' });
    const beforeRetreat = structuredClone(state);
    const retreat = executeAction(state, 1, {
      action: 'retreat',
      benchIdx: 0,
    });

    expect(retreat).toStrictEqual({
      state,
      events: [],
      error: 'Active creature is trapped',
    });
    expect(state).toStrictEqual(beforeRetreat);

    const ownerEnd = executeAction(state, 1, { action: 'endTurn' });
    expect(ownerEnd.events[0]).toStrictEqual({
      type: 'clearStatus',
      side: 'p2',
      status: 'trapped',
    });
    expect(defender.status).toBeNull();
  });
});

describe('STA-03 — Fortify single-use lethal survival', () => {
  it('uses a real Fortify Cast and consumes it on one lethal hit at 1 HP', () => {
    const state = createContractState();
    const defender = mkCreature('whisper');
    const attacker = mkCreature('duskfang');
    const fortify = mkVerse('fortify');
    state.players[0].active = defender;
    state.players[0].hand = [fortify];
    state.players[1].active = attacker;

    const cast = executeAction(state, 0, {
      action: 'cast',
      cardUid: fortify.uid,
    });

    expect(cast.events).toStrictEqual([
      { type: 'cast', side: 'p1', verse: 'Fortify' },
    ]);
    expect(defender.fortified).toBe(true);
    expect(state.players[0].mana).toBe(3);
    expect(state.players[0].grave).toStrictEqual([fortify]);

    executeAction(state, 0, { action: 'endTurn' });
    const attack = executeAction(state, 1, { action: 'attack' });

    expect(attack.events).toStrictEqual([
      { type: 'attack', side: 'p2', damage: 40 },
      { type: 'damage', side: 'p1', amount: 40 },
      {
        type: 'survival',
        side: 'p1',
        creature: 'Whisper',
        hp: 1,
        source: 'Fortify',
      },
    ]);
    expect(state.players[0].active).toBe(defender);
    expect(defender).toMatchObject({ curHp: 1, fortified: false });
  });
});

describe('STA-04 — Unbreakable state and consumption', () => {
  it('uses a real Unbreakable Cast to negate exactly the next damage instance', () => {
    const state = createContractState();
    const defender = mkCreature('whisper');
    const attacker = mkCreature('duskfang');
    const unbreakable = mkVerse('unbreakable');
    state.players[0].active = defender;
    state.players[0].hand = [unbreakable];
    state.players[1].active = attacker;

    const cast = executeAction(state, 0, {
      action: 'cast',
      cardUid: unbreakable.uid,
    });

    expect(cast.events).toStrictEqual([
      { type: 'cast', side: 'p1', verse: 'Unbreakable' },
      { type: 'setFlag', side: 'p1', flag: 'unbreakable' },
    ]);
    expect(state.players[0].unbreakable).toBe(true);
    expect(state.players[0].mana).toBe(2);
    expect(state.players[0].grave).toStrictEqual([unbreakable]);

    executeAction(state, 0, { action: 'endTurn' });
    const attack = executeAction(state, 1, { action: 'attack' });

    expect(attack.events).toStrictEqual([
      { type: 'attack', side: 'p2', damage: 40 },
      { type: 'damageNegated', side: 'p1', source: 'Unbreakable' },
      { type: 'damage', side: 'p1', amount: 0 },
    ]);
    expect(defender.curHp).toBe(30);
    expect(state.players[0].unbreakable).toBe(false);
  });
});

describe('STA-08 — Last Breath shared-engine integration', () => {
  it('prevents only the first lethal life loss and reveals exactly once', () => {
    const state = createContractState();
    const attacker = mkCreature('whisper');
    const lastBreath = mkVerse('lastBreath');
    state.players[0].active = attacker;
    state.players[1].lp = 1;
    state.players[1].setVerse = lastBreath;

    const saved = executeAction(state, 0, { action: 'attack' });

    expect(state.players[1]).toMatchObject({
      lp: 1,
      setVerse: null,
      usedLastBreath: true,
    });
    expect(state.players[1].grave).toStrictEqual([lastBreath]);
    expect(state.winner).toBeNull();

    executeAction(state, 0, { action: 'endTurn' });
    executeAction(state, 1, { action: 'endTurn' });
    const lethal = executeAction(state, 0, { action: 'attack' });

    expect(lethal.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20, direct: true },
      { type: 'lpDamage', side: 'p2', amount: 1 },
      { type: 'gameOver', winner: 'p1', reason: 'LP depleted' },
    ]);
    expect(state.players[1].lp).toBe(0);
    expect(state.winner).toBe(0);
    expect(saved.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20, direct: true },
      { type: 'triggerVerse', side: 'p2', verse: 'Last Breath' },
    ]);
  });
});
