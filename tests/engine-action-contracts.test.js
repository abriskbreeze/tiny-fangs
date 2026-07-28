import { describe, expect, it } from 'vitest';
import {
  createGame,
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
      deck: [mkCreature(index === 0 ? 'shellkin' : 'whisper')],
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

function expectRejectedWithoutMutation(result, state, before, error) {
  expect(result).toStrictEqual({
    state,
    events: [],
    error,
  });
  expect(state).toStrictEqual(before);
}

describe('ACT-01 — executeAction turn authority', () => {
  const normalActions = [
    ['summon', { action: 'summon', cardUid: 'not-reached', target: 'active' }],
    ['cast', { action: 'cast', cardUid: 'not-reached' }],
    ['set', { action: 'set', cardUid: 'not-reached' }],
    ['attack', { action: 'attack' }],
    ['retreat', { action: 'retreat', benchIdx: 0 }],
    ['endTurn', { action: 'endTurn' }],
  ];

  it.each(normalActions)(
    'rejects non-current-player %s before action validation',
    (_name, action) => {
      const state = createContractState();
      const before = structuredClone(state);

      const result = executeAction(state, 1, action);

      expectRejectedWithoutMutation(result, state, before, 'Not your turn');
    },
  );

  it('allows a non-current player to resolve Skitter swap and decline responses', () => {
    const swapState = createContractState();
    const skitter = mkCreature('skitter');
    const replacement = mkCreature('whisper');
    swapState.players[1].active = skitter;
    swapState.players[1].bench = [replacement];

    const swap = executeAction(swapState, 1, {
      action: 'skitterSwap',
      benchIdx: 0,
    });

    expect(swap.error).toBeUndefined();
    expect(swap.events).toStrictEqual([
      {
        type: 'skitterSwap',
        side: 'p2',
        from: skitter.name,
        to: replacement.name,
      },
    ]);
    expect(swapState.players[1].active).toBe(replacement);
    expect(swapState.players[1].bench).toStrictEqual([skitter]);

    const declineState = createContractState();
    const decline = executeAction(declineState, 1, {
      action: 'skitterDecline',
    });

    expect(decline.error).toBeUndefined();
    expect(decline.events).toStrictEqual([
      { type: 'skitterDecline', side: 'p2' },
    ]);
  });

  it('allows a non-current player to answer their optional Set response', () => {
    const state = createContractState();
    const brace = mkVerse('brace');
    state.players[1].setVerse = brace;
    state.players[1].active = mkCreature('duskfang');
    state.players[0].active = mkCreature('whisper');

    const result = executeAction(state, 1, {
      action: 'respondOptionalTrigger',
      confirmed: false,
      verseId: 'brace',
      context: { damage: 0 },
    });

    expect(result.error).toBeUndefined();
    expect(result.events).toStrictEqual([
      { type: 'triggerDeclined', side: 'p2', verse: 'Brace' },
    ]);
    expect(state.players[1].setVerse).toBeNull();
    expect(state.players[1].grave).toContain(brace);
  });
});

describe('ACT-07B — Set validation is atomic and identity-free', () => {
  it('rejects insufficient mana without changing any state', () => {
    const state = createContractState();
    const selected = mkVerse('spikeShield');
    state.players[0].hand = [selected];
    state.players[0].mana = 1;
    const before = structuredClone(state);

    const result = executeAction(state, 0, {
      action: 'set',
      cardUid: selected.uid,
    });

    expectRejectedWithoutMutation(
      result,
      state,
      before,
      'Not enough mana',
    );
  });

  it('rejects an occupied Set slot without spending mana or exposing identity', () => {
    const state = createContractState();
    const occupied = mkVerse('brace');
    const selected = mkVerse('spikeShield');
    state.players[0].setVerse = occupied;
    state.players[0].hand = [selected];
    const before = structuredClone(state);

    const result = executeAction(state, 0, {
      action: 'set',
      cardUid: selected.uid,
    });

    expectRejectedWithoutMutation(
      result,
      state,
      before,
      'Already have a set verse',
    );
  });
});

describe('ACT-08 — ordinary attack and retaliation order', () => {
  it('emits attack, damage, retaliation ability, and retaliation damage in order', () => {
    const state = createContractState();
    const attacker = mkCreature('whisper');
    const defender = mkCreature('thornling');
    state.players[0].active = attacker;
    state.players[1].active = defender;

    const result = executeAction(state, 0, { action: 'attack' });

    expect(result.error).toBeUndefined();
    expect(result.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20 },
      { type: 'damage', side: 'p2', amount: 20 },
      {
        type: 'abilityTrigger',
        side: 'p2',
        creature: 'Thornling',
        ability: 'Thorns',
      },
      { type: 'damage', side: 'p1', amount: 10, source: 'Thorns' },
    ]);
    expect(defender.curHp).toBe(20);
    expect(attacker.curHp).toBe(20);
    expect(state.hasAttacked).toBe(true);
  });
});

describe('ACT-09 and STA-06 — direct life attacks and terminal result', () => {
  it('removes exactly one life after the direct-attack event', () => {
    const state = createContractState();
    state.players[0].active = mkCreature('whisper');
    state.players[1].lp = 2;

    const result = executeAction(state, 0, { action: 'attack' });

    expect(result.error).toBeUndefined();
    expect(result.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20, direct: true },
      { type: 'lpDamage', side: 'p2', amount: 1 },
    ]);
    expect(state.players[1].lp).toBe(1);
    expect(state.winner).toBeNull();
  });

  it('emits one terminal result after the final direct life is lost', () => {
    const state = createContractState();
    state.players[0].active = mkCreature('whisper');
    state.players[1].lp = 1;

    const result = executeAction(state, 0, { action: 'attack' });

    expect(result.events).toStrictEqual([
      { type: 'attack', side: 'p1', damage: 20, direct: true },
      { type: 'lpDamage', side: 'p2', amount: 1 },
      { type: 'gameOver', winner: 'p1', reason: 'LP depleted' },
    ]);
    expect(state.players[1].lp).toBe(0);
    expect(state.winner).toBe(0);
  });

  it('emits one terminal result when a real Cast effect depletes its owner LP', () => {
    const state = createContractState();
    const darkPact = mkVerse('darkPact');
    state.players[0].hand = [darkPact];
    state.players[0].deck = [
      mkCreature('shellkin'),
      mkCreature('pebbleback'),
    ];
    state.players[0].lp = 1;

    const result = executeAction(state, 0, {
      action: 'cast',
      cardUid: darkPact.uid,
    });

    expect(result.events).toStrictEqual([
      { type: 'cast', side: 'p1', verse: 'Dark Pact' },
      { type: 'lpDamage', side: 'p1', amount: 1 },
      { type: 'gameOver', winner: 'p2', reason: 'LP depleted' },
    ]);
    expect(state.players[0].lp).toBe(0);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.players[0].grave).toStrictEqual([darkPact]);
    expect(state.winner).toBe(1);
  });
});

describe('ACT-10 and ACT-11 — attack/retreat turn limits', () => {
  it('prohibits attacking on the first global turn without mutation', () => {
    const state = createContractState();
    state.firstTurn = true;
    state.players[0].active = mkCreature('whisper');
    state.players[1].active = mkCreature('duskfang');
    const before = structuredClone(state);

    const result = executeAction(state, 0, { action: 'attack' });

    expectRejectedWithoutMutation(
      result,
      state,
      before,
      'Cannot attack on first turn',
    );
  });

  it('rejects a second attack and retreat after attacking', () => {
    const state = createContractState();
    state.players[0].active = mkCreature('whisper');
    state.players[0].bench = [mkCreature('shellkin')];
    state.players[1].active = mkCreature('duskfang');

    const attack = executeAction(state, 0, { action: 'attack' });
    expect(attack.error).toBeUndefined();
    const afterAttack = structuredClone(state);

    const secondAttack = executeAction(state, 0, { action: 'attack' });
    expectRejectedWithoutMutation(
      secondAttack,
      state,
      afterAttack,
      'Already attacked this turn',
    );

    const retreat = executeAction(state, 0, {
      action: 'retreat',
      benchIdx: 0,
    });
    expectRejectedWithoutMutation(
      retreat,
      state,
      afterAttack,
      'Cannot retreat after attacking',
    );
  });

  it('rejects attacking and a second retreat after retreating', () => {
    const state = createContractState();
    state.players[0].active = mkCreature('whisper');
    state.players[0].bench = [mkCreature('shellkin')];
    state.players[1].active = mkCreature('duskfang');

    const retreat = executeAction(state, 0, {
      action: 'retreat',
      benchIdx: 0,
    });
    expect(retreat.error).toBeUndefined();
    const afterRetreat = structuredClone(state);

    const attack = executeAction(state, 0, { action: 'attack' });
    expectRejectedWithoutMutation(
      attack,
      state,
      afterRetreat,
      'Cannot attack after retreating',
    );

    const secondRetreat = executeAction(state, 0, {
      action: 'retreat',
      benchIdx: 0,
    });
    expectRejectedWithoutMutation(
      secondRetreat,
      state,
      afterRetreat,
      'Already retreated this turn',
    );
  });

  it('resets both per-turn limits whenever End Turn changes player', () => {
    const state = createContractState();
    state.players[0].active = mkCreature('whisper');
    state.players[1].active = mkCreature('duskfang');
    state.players[0].deck.push(mkCreature('shellkin'));
    state.players[1].deck.push(mkCreature('whisper'));

    executeAction(state, 0, { action: 'attack' });
    expect(state.hasAttacked).toBe(true);

    const firstEnd = executeAction(state, 0, { action: 'endTurn' });
    expect(firstEnd.error).toBeUndefined();
    expect(state.currentPlayer).toBe(2);
    expect(state.hasAttacked).toBe(false);
    expect(state.hasRetreated).toBe(false);

    state.players[1].bench = [mkCreature('shellkin')];
    executeAction(state, 1, { action: 'retreat', benchIdx: 0 });
    expect(state.hasRetreated).toBe(true);

    const secondEnd = executeAction(state, 1, { action: 'endTurn' });
    expect(secondEnd.error).toBeUndefined();
    expect(state.currentPlayer).toBe(1);
    expect(state.hasAttacked).toBe(false);
    expect(state.hasRetreated).toBe(false);
  });
});

describe('ACT-12 — ordinary retreat validation and swap', () => {
  it('swaps the selected bench creature with active and emits one event', () => {
    const state = createContractState();
    const active = mkCreature('whisper');
    const firstBench = mkCreature('shellkin');
    const selected = mkCreature('duskfang');
    state.players[0].active = active;
    state.players[0].bench = [firstBench, selected];

    const result = executeAction(state, 0, {
      action: 'retreat',
      benchIdx: 1,
    });

    expect(result.events).toStrictEqual([
      {
        type: 'retreat',
        side: 'p1',
        from: 'Whisper',
        to: 'Duskfang',
      },
    ]);
    expect(state.players[0].active).toBe(selected);
    expect(state.players[0].bench).toStrictEqual([firstBench, active]);
    expect(state.hasRetreated).toBe(true);
  });

  const invalidRetreats = [
    {
      name: 'missing active creature',
      prepare(state) {
        state.players[0].bench = [mkCreature('shellkin')];
      },
      benchIdx: 0,
      error: 'No active creature',
    },
    {
      name: 'empty bench',
      prepare(state) {
        state.players[0].active = mkCreature('whisper');
      },
      benchIdx: 0,
      error: 'No bench creatures',
    },
    {
      name: 'out-of-range bench index',
      prepare(state) {
        state.players[0].active = mkCreature('whisper');
        state.players[0].bench = [mkCreature('shellkin')];
      },
      benchIdx: 1,
      error: 'Invalid bench index',
    },
    {
      name: 'trapped active creature',
      prepare(state) {
        const active = mkCreature('whisper');
        active.status = 'trapped';
        state.players[0].active = active;
        state.players[0].bench = [mkCreature('shellkin')];
      },
      benchIdx: 0,
      error: 'Active creature is trapped',
    },
  ];

  it.each(invalidRetreats)(
    'rejects $name without mutation',
    ({ prepare, benchIdx, error }) => {
      const state = createContractState();
      prepare(state);
      const before = structuredClone(state);

      const result = executeAction(state, 0, {
        action: 'retreat',
        benchIdx,
      });

      expectRejectedWithoutMutation(result, state, before, error);
    },
  );
});
