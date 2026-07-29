import { describe, expect, it, vi } from 'vitest';
import { getScoredMoves, pickBestMove } from '../src/ai.js';
import { createSoloAi } from '../src/solo-ai.js';
import { createSoloDispatch } from '../src/solo-dispatch.js';
import {
  createGame,
  executeAction,
  mkCreature,
  mkVerse,
} from '../shared/engine.js';

function createHarness({
  difficulty,
  aiHand = [],
  aiActive = null,
  aiMana = 5,
  scoreMoves = getScoredMoves,
  chooseMove = pickBestMove,
}) {
  const shared = createGame('shell', 'shadow');
  const [me, opp] = shared.players;

  Object.assign(me, {
    lp: 3,
    mana: 5,
    maxMana: 5,
    deck: [mkCreature('shellkin'), mkCreature('pebbleback')],
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
  Object.assign(opp, {
    lp: 3,
    mana: aiMana,
    maxMana: aiMana,
    deck: [mkCreature('whisper'), mkCreature('gloom')],
    hand: aiHand,
    active: aiActive,
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

  const state = {
    G: {
      turn: 2,
      me,
      opp,
      winner: null,
      firstTurn: false,
      hasAttacked: false,
      hasRetreated: false,
      myTurn: false,
      aiDifficulty: difficulty,
      _aiSetupDone: true,
    },
  };
  const actionTrace = [];
  const playEvents = vi.fn(() => Promise.resolve());
  const render = vi.fn();
  const log = vi.fn();
  const playTurnEndAnimation = vi.fn(() => Promise.resolve());
  const Anim = {
    cacheActivePositions: vi.fn(),
    wait: vi.fn(() => Promise.resolve()),
  };
  const dispatch = createSoloDispatch({
    state,
    sharedExecuteAction(sharedState, playerIdx, action) {
      actionTrace.push(structuredClone(action));
      return executeAction(sharedState, playerIdx, action);
    },
    Anim,
    log,
    render,
    playEvents,
    showModal: vi.fn(),
    closeModal: vi.fn(),
  });
  const solo = createSoloAi({
    state,
    Anim,
    ANIM_TIMING: { AI_PAUSE: 0 },
    log,
    render,
    draw: vi.fn(),
    dispatchLocalAction: dispatch.dispatchLocalAction,
    playTurnEndAnimation,
    getScoredMoves: scoreMoves,
    pickBestMove: chooseMove,
  });

  return {
    state,
    actionTrace,
    playEvents,
    render,
    log,
    playTurnEndAnimation,
    Anim,
    solo,
  };
}

describe('ACT-16 — complete Pup turn executor', () => {
  it('runs summon, Cast, Set, attack, and End Turn in fixed order through the real engine', async () => {
    const creature = mkCreature('shadePup');
    const cast = mkVerse('manaSurge');
    const set = mkVerse('lastBreath');
    const harness = createHarness({
      difficulty: 1,
      aiHand: [creature, cast, set],
      aiMana: 2,
    });

    await harness.solo.aiTurn();

    expect(harness.actionTrace).toStrictEqual([
      {
        action: 'summon',
        type: 'summon',
        cardUid: creature.uid,
        target: 'active',
      },
      {
        action: 'cast',
        type: 'cast',
        cardUid: cast.uid,
      },
      {
        action: 'set',
        type: 'set',
        cardUid: set.uid,
      },
      { action: 'attack', type: 'attack' },
      { action: 'endTurn', type: 'endTurn' },
    ]);
    expect(harness.state.G.opp).toMatchObject({
      active: creature,
      hand: [],
      grave: [cast],
      setVerse: set,
      mana: 2,
      usedManaSurge: true,
    });
    expect(creature.summonedThisTurn).toBe(false);
    expect(harness.state.G.me.lp).toBe(2);
    expect(harness.state.G.myTurn).toBe(true);
    expect(harness.state.G.hasAttacked).toBe(false);
    expect(harness.state.G.hasRetreated).toBe(false);
    expect(harness.playTurnEndAnimation).toHaveBeenCalledOnce();
  });
});

describe('ACT-16 — complete Hunter turn executor', () => {
  it('executes no more than ten scored moves before ending the turn', async () => {
    const casts = Array.from({ length: 11 }, () => mkVerse('manaSurge'));
    const scoreMoves = vi.fn(ai => (
      ai.hand
        .filter(card => card.id === 'manaSurge')
        .map(card => ({ type: 'cast', card, score: 100 }))
    ));
    const chooseMove = vi.fn((moves, threshold) => pickBestMove(moves, threshold));
    const harness = createHarness({
      difficulty: 2,
      aiHand: casts,
      aiMana: 0,
      scoreMoves,
      chooseMove,
    });

    await harness.solo.aiTurn();

    expect(scoreMoves).toHaveBeenCalledTimes(10);
    expect(chooseMove).toHaveBeenCalledTimes(10);
    expect(harness.actionTrace).toStrictEqual([
      ...casts.slice(0, 10).map(card => ({
        action: 'cast',
        type: 'cast',
        cardUid: card.uid,
      })),
      { action: 'endTurn', type: 'endTurn' },
    ]);
    expect(harness.state.G.opp.hand).toStrictEqual([casts[10]]);
    expect(harness.state.G.opp.grave).toStrictEqual(casts.slice(0, 10));
    expect(harness.state.G.opp.mana).toBe(20);
    expect(harness.state.G.opp.usedManaSurge).toBe(true);
    expect(harness.state.G.myTurn).toBe(true);
    expect(harness.playTurnEndAnimation).toHaveBeenCalledOnce();
  });

  it('uses the real scoring helpers to pass and End Turn when no move clears threshold', async () => {
    const harness = createHarness({
      difficulty: 2,
      aiHand: [],
      aiMana: 3,
    });

    await harness.solo.aiTurn();

    expect(harness.actionTrace).toStrictEqual([
      { action: 'endTurn', type: 'endTurn' },
    ]);
    expect(harness.state.G.opp.hand).toStrictEqual([]);
    expect(harness.state.G.myTurn).toBe(true);
    expect(harness.state.G.me.hand).toHaveLength(1);
    expect(harness.playTurnEndAnimation).toHaveBeenCalledOnce();
  });
});
