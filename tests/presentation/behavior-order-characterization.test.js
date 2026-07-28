import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Effects } from '../../shared/effects.js';
import { Anim as BrowserAnim } from '../../src/anim.js';
import { createEventPlayback } from '../../src/event-playback.js';
import { createMpClient } from '../../src/mp-client.js';
import { createSoloDispatch } from '../../src/solo-dispatch.js';

function createClientPlayer(label) {
  return {
    label,
    lp: 3,
    mana: 1,
    maxMana: 1,
    deck: [],
    hand: [],
    active: null,
    bench: [],
    grave: [],
    setVerse: null,
  };
}

function createServerState(turn) {
  const player = {
    lp: 3,
    mana: 1,
    maxMana: 1,
    deckCount: 15,
    hand: [],
    active: null,
    bench: [],
    grave: [],
    setVerse: null,
  };

  return {
    yourTurn: true,
    turn,
    winner: null,
    firstTurn: false,
    hasAttacked: false,
    hasRetreated: false,
    me: structuredClone(player),
    opp: {
      ...structuredClone(player),
      hand: undefined,
      handCount: 5,
    },
  };
}

function installMpBrowserStubs() {
  const elements = new Map();
  const makeElement = () => ({
    className: '',
    disabled: false,
    style: {},
    textContent: '',
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
    },
  });

  for (const id of ['setup', 'mobile', 'desktop']) {
    elements.set(id, makeElement());
  }

  vi.stubGlobal('location', { search: '', reload: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
  vi.stubGlobal('window', { innerWidth: 1200 });
  vi.stubGlobal('document', {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({
      className: '',
      style: {},
      textContent: '',
      remove: vi.fn(),
    })),
    getElementById: vi.fn((id) => elements.get(id) ?? null),
  });
  return elements;
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('authoritative state and event ordering', () => {
  it('plays solo pre-render events, replaces and renders state, then plays post-render events', async () => {
    const callOrder = [];
    const state = {
      G: {
        me: createClientPlayer('old-me'),
        opp: createClientPlayer('old-opp'),
        turn: 1,
        myTurn: true,
        winner: null,
        firstTurn: false,
        hasAttacked: false,
        hasRetreated: false,
        log: ['preserved'],
      },
    };
    const nextSharedState = {
      players: [
        createClientPlayer('new-me'),
        createClientPlayer('new-opp'),
      ],
      turn: 2,
      currentPlayer: 2,
      winner: null,
      firstTurn: false,
      hasAttacked: true,
      hasRetreated: false,
    };
    const events = [
      { type: 'draw', count: 1 },
      { type: 'damage', side: 'p2', amount: 20 },
      { type: 'turnStart', yourTurn: false },
      { type: 'attack', side: 'p1', damage: 20 },
      { type: 'setVerse', side: 'p1' },
      { type: 'heal', side: 'p1', amount: 10 },
    ];
    const deps = {
      state,
      sharedExecuteAction: vi.fn(() => {
        callOrder.push('execute');
        return { state: nextSharedState, events };
      }),
      Anim: {
        cacheActivePositions: vi.fn(() => {
          callOrder.push(`cache@${state.G.turn}`);
        }),
      },
      log: vi.fn(),
      render: vi.fn(() => {
        callOrder.push(`render@${state.G.turn}`);
      }),
      playEvents: vi.fn(async (batch) => {
        callOrder.push(
          `events:${batch.map((event) => event.type).join(',')}@${state.G.turn}`,
        );
      }),
    };

    const result = await createSoloDispatch(deps).dispatchLocalAction({
      type: 'attack',
    });

    expect(result.events).toEqual(events);
    expect(state.G.turn).toBe(2);
    expect(state.G.me.label).toBe('new-me');
    expect(state.G.log).toEqual(['preserved']);
    expect(callOrder).toEqual([
      'execute',
      'cache@1',
      'events:damage,attack,heal@1',
      'render@2',
      'events:draw,turnStart,setVerse@2',
    ]);
  });

  it('serializes multiplayer state replacement, render, and event playback without interruption', async () => {
    installMpBrowserStubs();

    const callOrder = [];
    let releaseFirstPlayback;
    const firstPlaybackGate = new Promise((resolve) => {
      releaseFirstPlayback = resolve;
    });
    const state = {
      G: {
        isMultiplayer: true,
        myTurn: true,
        turn: 0,
        winner: null,
        log: ['preserved'],
      },
    };
    const deps = {
      state,
      Anim: {
        cacheActivePositions: vi.fn(() => {
          callOrder.push(`cache@${state.G.turn}`);
        }),
      },
      log: vi.fn(),
      render: vi.fn(() => {
        callOrder.push(`render@${state.G.turn}`);
      }),
      renderLog: vi.fn(() => {
        callOrder.push(`renderLog@${state.G.turn}`);
      }),
      showModal: vi.fn(),
      closeModal: vi.fn(),
      highlightEndTurn: vi.fn(),
      playServerEvents: vi.fn(async ([event]) => {
        callOrder.push(`events:start:${event.id}@${state.G.turn}`);
        if (event.id === 'first') {
          await firstPlaybackGate;
        }
        callOrder.push(`events:end:${event.id}@${state.G.turn}`);
      }),
    };
    const client = createMpClient(deps);

    const firstDrain = client.queueUpdate(
      createServerState(1),
      [{ type: 'draw', id: 'first' }],
      null,
    );
    await vi.waitFor(() => {
      expect(callOrder).toContain('events:start:first@1');
    });

    const queuedCall = client.queueUpdate(
      createServerState(2),
      [{ type: 'turnStart', id: 'second' }],
      null,
    );
    await queuedCall;

    expect(state.G.turn).toBe(1);
    expect(callOrder).not.toContain('render@2');

    releaseFirstPlayback();
    await firstDrain;

    expect(state.G.turn).toBe(2);
    expect(state.G.log).toEqual(['preserved']);
    expect(callOrder).toEqual([
      'cache@0',
      'render@1',
      'events:start:first@1',
      'events:end:first@1',
      'renderLog@1',
      'cache@1',
      'render@2',
      'events:start:second@2',
      'events:end:second@2',
      'renderLog@2',
    ]);
  });

  it('keeps multiplayer state, board rendering, and queued updates behind the coin choreography', async () => {
    const elements = installMpBrowserStubs();

    let releaseCoin;
    const coinGate = new Promise((resolve) => {
      releaseCoin = resolve;
    });
    const callOrder = [];
    const state = { G: null };
    const deps = {
      state,
      Anim: {
        cacheActivePositions: vi.fn(() => {
          callOrder.push(`cache@${state.G?.turn ?? 'empty'}`);
        }),
      },
      log: vi.fn(),
      render: vi.fn(() => {
        callOrder.push(`render@${state.G.turn}`);
      }),
      renderLog: vi.fn(() => {
        callOrder.push(`renderLog@${state.G.turn}`);
      }),
      showModal: vi.fn(),
      closeModal: vi.fn(),
      highlightEndTurn: vi.fn(),
      playServerEvents: vi.fn(async () => {
        callOrder.push(`events@${state.G.turn}`);
      }),
      playMPCoinFlip: vi.fn(async () => {
        callOrder.push('coin:start');
        await coinGate;
        callOrder.push('coin:end');
      }),
      startGameTimer: vi.fn(() => {
        callOrder.push('timer:start');
      }),
    };
    const client = createMpClient(deps);

    const gameStart = client.handleServerMessage({
      type: 'gameStart',
      state: createServerState(1),
      yourTurn: true,
      you: 'p1',
      coinFlip: 'won',
    });
    const queuedUpdate = client.handleServerMessage({
      type: 'stateUpdate',
      state: createServerState(2),
      events: [{ type: 'draw' }],
    });

    await vi.waitFor(() => {
      expect(callOrder).toContain('coin:start');
    });

    expect(gameStart).toBeInstanceOf(Promise);
    expect(queuedUpdate).toBeInstanceOf(Promise);
    expect(state.G).toBeNull();
    expect(deps.render).not.toHaveBeenCalled();
    expect(deps.startGameTimer).not.toHaveBeenCalled();
    expect(elements.get('setup').style.display).not.toBe('none');
    expect(elements.get('desktop').style.display).toBe('none');
    expect(elements.get('mobile').style.display).toBe('none');

    releaseCoin();
    await Promise.all([gameStart, queuedUpdate]);

    expect(state.G.turn).toBe(2);
    expect(callOrder).toEqual([
      'coin:start',
      'coin:end',
      'timer:start',
      'render@1',
      'cache@1',
      'render@2',
      'events@2',
      'renderLog@2',
    ]);
  });
});

describe('event playback target contracts', () => {
  const statusCases = [
    { side: 'p1', status: 'poison', target: 'me', animation: 'anim-poison', message: 'Poisoned!' },
    { side: 'p1', status: 'trapped', target: 'me', animation: 'anim-trapped', message: 'Trapped!' },
    { side: 'me', status: 'poison', target: 'me', animation: 'anim-poison', message: 'Poisoned!' },
    { side: 'me', status: 'trapped', target: 'me', animation: 'anim-trapped', message: 'Trapped!' },
    { side: 'p2', status: 'poison', target: 'opp', animation: 'anim-poison', message: 'Poisoned!' },
    { side: 'p2', status: 'trapped', target: 'opp', animation: 'anim-trapped', message: 'Trapped!' },
    { side: 'opp', status: 'poison', target: 'opp', animation: 'anim-poison', message: 'Poisoned!' },
    { side: 'opp', status: 'trapped', target: 'opp', animation: 'anim-trapped', message: 'Trapped!' },
  ];

  it.each(statusCases)(
    'targets the active-shell active card for $side $status',
    async ({ side, status, target, animation, message }) => {
      // Phase 4 acceptance: status playback resolves one semantic
      // active-shell element and never animates the hidden duplicate tree.
      const activeCard = { id: `${target}-active-card` };
      const Anim = {
        activeCardEl: vi.fn(() => activeCard),
        play: vi.fn(),
        wait: vi.fn(() => Promise.resolve()),
      };
      const log = vi.fn();
      const playback = createEventPlayback({
        Anim,
        log,
        VERSES: {},
        CREATURES: {},
      });

      await playback.playEvents([
        { type: 'setStatus', side, status },
      ]);

      expect(Anim.activeCardEl).toHaveBeenCalledExactlyOnceWith(target);
      expect(Anim.play).toHaveBeenCalledExactlyOnceWith(
        activeCard,
        animation,
        600,
      );
      expect(log).toHaveBeenCalledExactlyOnceWith(message, 'dmg');
      expect(Anim.wait.mock.calls).toStrictEqual([[400], [50]]);
    },
  );

  it('plays generated bench events in exact awaited order', async () => {
    const myBench = {
      uid: 'my-bench',
      cardType: 'creature',
      curHp: 30,
      hp: 30,
    };
    const oppBench = {
      uid: 'opp-bench',
      cardType: 'creature',
      curHp: 30,
      hp: 30,
    };
    const effectContext = {
      me: { active: null, bench: [myBench] },
      opp: { active: null, bench: [oppBench] },
    };
    const aoeResult = Effects.aoeAll(effectContext, { amount: 5 });
    const banishResult = Effects.banish(
      {
        state: { G: { me: effectContext.me } },
        ...effectContext,
        selected: {
          creature: myBench,
          location: 'bench',
          ownerKey: 'me',
          idx: 0,
        },
      },
      { target: 'selected' },
    );
    const benchEvents = [
      ...aoeResult.events.filter((event) => event.type === 'benchDamage'),
      ...banishResult.events.filter((event) => event.type === 'benchKo'),
    ];
    const callOrder = [];
    let damageCallCount = 0;
    let releaseFirstDamage;
    const firstDamageGate = new Promise((resolve) => {
      releaseFirstDamage = resolve;
    });
    const Anim = {
      benchDamage: vi.fn(async (side, index, amount) => {
        damageCallCount += 1;
        callOrder.push(`benchDamage:${side}:${index}:${amount}`);
        if (damageCallCount === 1) {
          await firstDamageGate;
        }
      }),
      benchKo: vi.fn(async (side, index) => {
        callOrder.push(`benchKo:${side}:${index}`);
      }),
      wait: vi.fn(async (duration) => {
        callOrder.push(`wait:${duration}`);
      }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playback = createEventPlayback({
      Anim,
      log: vi.fn(),
      VERSES: {},
      CREATURES: {},
    });

    expect(benchEvents).toStrictEqual([
      {
        type: 'benchDamage',
        animKey: 'me',
        benchIndex: 0,
        amount: 5,
      },
      {
        type: 'benchDamage',
        animKey: 'opp',
        benchIndex: 0,
        amount: 5,
      },
      { type: 'benchKo', animKey: 'me', benchIndex: 0 },
    ]);
    expect(playback.EVENT_HANDLERS).toMatchObject({
      benchDamage: expect.any(Function),
      benchKo: expect.any(Function),
    });

    const playbackPromise = playback.playEvents(benchEvents);
    await vi.waitFor(() => {
      expect(Anim.benchDamage).toHaveBeenCalledTimes(1);
    });
    expect(callOrder).toStrictEqual(['benchDamage:me:0:5']);

    releaseFirstDamage();
    await playbackPromise;

    expect(callOrder).toStrictEqual([
      'benchDamage:me:0:5',
      'wait:50',
      'benchDamage:opp:0:5',
      'wait:50',
      'benchKo:me:0',
      'wait:50',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  const indexedBenchCases = [
    {
      type: 'benchDamage',
      event: { type: 'benchDamage', animKey: 'me', benchIndex: 0, amount: 5 },
      side: 'me',
      index: 0,
      calls: [
        ['anim-shake', 600],
        ['anim-flash-red', 300],
      ],
      duration: 600,
    },
    {
      type: 'benchDamage',
      event: { type: 'benchDamage', animKey: 'opp', benchIndex: 1, amount: 7 },
      side: 'opp',
      index: 1,
      calls: [
        ['anim-shake', 600],
        ['anim-flash-red', 300],
      ],
      duration: 600,
    },
    {
      type: 'benchKo',
      event: { type: 'benchKo', animKey: 'me', benchIndex: 1 },
      side: 'me',
      index: 1,
      calls: [['anim-ko', 400]],
      duration: 400,
    },
    {
      type: 'benchKo',
      event: { type: 'benchKo', animKey: 'opp', benchIndex: 0 },
      side: 'opp',
      index: 0,
      calls: [['anim-ko', 400]],
      duration: 400,
    },
  ];

  it.each(indexedBenchCases)(
    'targets the exact active-shell bench card for $type $event.animKey',
    async ({ type, event, side, index, calls, duration }) => {
      vi.useFakeTimers();
      // Missing bench card resolves to null; playback must still request the
      // exact semantic (side, index) target and skip the float text.
      const benchCardEl = vi
        .spyOn(BrowserAnim, 'benchCardEl')
        .mockReturnValue(null);
      const play = vi.spyOn(BrowserAnim, 'play').mockImplementation(() => Promise.resolve());
      const floatText = vi.spyOn(BrowserAnim, 'floatText').mockImplementation(() => {});
      const playback = createEventPlayback({
        Anim: BrowserAnim,
        log: vi.fn(),
        VERSES: {},
        CREATURES: {},
      });
      const handler = playback.EVENT_HANDLERS[type];

      expect(handler).toEqual(expect.any(Function));
      const pending = handler(event);
      await vi.advanceTimersByTimeAsync(duration);
      await pending;

      expect(benchCardEl).toHaveBeenCalledExactlyOnceWith(side, index);
      expect(play.mock.calls).toStrictEqual(
        calls.map(([animation, animationDuration]) => [
          null,
          animation,
          animationDuration,
        ]),
      );
      expect(floatText).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      type: 'benchDamage',
      event: { type: 'benchDamage', side: 'p1', amount: 5 },
      side: 'me',
      calls: [
        ['anim-shake', 600],
        ['anim-flash-red', 300],
      ],
      wait: 600,
    },
    {
      type: 'benchKo',
      event: { type: 'benchKo', animKey: 'opp' },
      side: 'opp',
      calls: [['anim-ko', 400]],
      wait: 400,
    },
  ])(
    'uses the semantic side bench safely when $type has no index',
    async ({ type, event, side, calls, wait }) => {
      const benchContainer = { id: `${side}-bench-container` };
      const Anim = {
        benchContainerEl: vi.fn(() => benchContainer),
        play: vi.fn(),
        wait: vi.fn(() => Promise.resolve()),
      };
      const playback = createEventPlayback({
        Anim,
        log: vi.fn(),
        VERSES: {},
        CREATURES: {},
      });
      const handler = playback.EVENT_HANDLERS[type];

      expect(handler).toEqual(expect.any(Function));
      await handler(event);

      expect(Anim.benchContainerEl).toHaveBeenCalledExactlyOnceWith(side);
      expect(Anim.play.mock.calls).toStrictEqual(
        calls.map(([animation, duration]) => [
          benchContainer,
          animation,
          duration,
        ]),
      );
      expect(Anim.wait).toHaveBeenCalledExactlyOnceWith(wait);
    },
  );
});

describe('known presentation gaps are frozen, not repaired', () => {
  it('consumes gameOver without any result presentation side effect', async () => {
    const Anim = {
      floatText: vi.fn(),
      negateX: vi.fn(),
      screenFlash: vi.fn(),
      versePopup: vi.fn(),
      wait: vi.fn(() => Promise.resolve()),
    };
    const log = vi.fn();
    const playback = createEventPlayback({
      Anim,
      log,
      VERSES: {},
      CREATURES: {},
    });

    await playback.playEvents([
      { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
    ]);

    expect(log).not.toHaveBeenCalled();
    expect(Anim.floatText).not.toHaveBeenCalled();
    expect(Anim.negateX).not.toHaveBeenCalled();
    expect(Anim.screenFlash).not.toHaveBeenCalled();
    expect(Anim.versePopup).not.toHaveBeenCalled();
    expect(Anim.wait).toHaveBeenCalledOnce();
  });

  it('starts multiplayer timing through the mounted root owner without nesting timer state under G', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T20:00:00.000Z'));
    installMpBrowserStubs();

    const state = {
      G: null,
      startTime: null,
      timerInt: null,
    };
    const startGameTimer = vi.fn();
    const client = createMpClient({
      state,
      Anim: {},
      log: vi.fn(),
      render: vi.fn(),
      renderLog: vi.fn(),
      showModal: vi.fn(),
      closeModal: vi.fn(),
      playServerEvents: vi.fn(),
      highlightEndTurn: vi.fn(),
      startGameTimer,
    });

    client.startMultiplayerGame(createServerState(1), true, 'p1');

    const mainSource = readFileSync(
      new URL('../../src/main.js', import.meta.url),
      'utf8',
    );
    expect(startGameTimer).toHaveBeenCalledOnce();
    expect(state.G).not.toHaveProperty('startTime');
    expect(state.G).not.toHaveProperty('timerInt');
    expect(mainSource).toContain('readGameElapsedSeconds()');
  });
});
