import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGame,
  readGameElapsedSeconds,
  resetGameTimer,
  setGame,
  startGameTimer,
  state,
  stopGameTimer,
} from '../../src/state.js';
import { createMpClient } from '../../src/mp-client.js';

function installDom() {
  const elements = new Map();

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        className: '',
        disabled: false,
        innerHTML: '',
        style: {},
        textContent: '',
        value: '',
        remove: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          toggle: vi.fn(),
        },
      });
    }
    return elements.get(id);
  }

  globalThis.document = {
    body: {
      appendChild: vi.fn(),
    },
    createElement: (tag) => element(`created-${tag}`),
    getElementById: (id) => element(id),
    querySelector: (selector) => {
      if (selector === '#mp-buttons .btn.active') return element('active-mp-button');
      if (selector === '.mp-buttons') return element('mp-buttons');
      return null;
    },
  };

  return { element };
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState !== FakeWebSocket.CONNECTING) return;
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send() {}

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function multiplayerState(overrides = {}) {
  return {
    firstTurn: false,
    hasAttacked: false,
    hasRetreated: false,
    me: {
      active: null,
      bench: [],
      deckCount: 10,
      grave: [],
      hand: [],
      lp: 20,
      mana: 1,
      maxMana: 1,
      setVerse: null,
    },
    opp: {
      active: null,
      bench: [],
      deckCount: 10,
      grave: [],
      handCount: 0,
      lp: 20,
      mana: 1,
      maxMana: 1,
      setVerse: null,
    },
    turn: 1,
    winner: null,
    yourTurn: true,
    ...overrides,
  };
}

function createHarness() {
  const modalActions = [];
  const timerLifecycle = {
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gameState = { G: null };
  const deps = {
    $: (id) => document.getElementById(id),
    Anim: {
      cacheActivePositions: vi.fn(),
      clearVisuals: vi.fn(),
      finishAll: vi.fn(),
      playServerEvents: vi.fn(async () => {}),
    },
    applyServerState: (serverState) => {
      gameState.G = serverState;
    },
    clearGame: timerLifecycle.clear,
    closeAllOverlays: vi.fn(),
    closeModal: vi.fn(),
    finishAnimations: vi.fn(),
    highlightEndTurn: vi.fn(),
    isMobile: vi.fn(() => false),
    log: vi.fn(),
    playMPCoinFlip: vi.fn(async () => {}),
    playServerEvents: vi.fn(async () => {}),
    refreshCssCards: vi.fn(),
    render: vi.fn(),
    renderLog: vi.fn(),
    showModal: vi.fn((_title, actions) => {
      modalActions.splice(0, modalActions.length, ...actions);
    }),
    resetGameTimer: timerLifecycle.clear,
    startGameTimer: timerLifecycle.start,
    state: gameState,
    stopGameTimer: timerLifecycle.stop,
    updateTurnUI: vi.fn(),
  };

  return {
    client: createMpClient(deps),
    gameState,
    modalActions,
    timerLifecycle,
  };
}

describe('root game timer ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T20:00:00.000Z'));
    clearGame();
  });

  afterEach(() => {
    clearGame();
    vi.useRealTimers();
  });

  it('owns one interval at the root and advances from 0:00 to 1:01', () => {
    const onTick = vi.fn();

    startGameTimer(onTick);

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(readGameElapsedSeconds()).toBe(0);
    expect(state.startTime).toBe(Date.now());
    expect(state.timerInt).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(61_000);

    expect(readGameElapsedSeconds()).toBe(61);
    expect(onTick).toHaveBeenCalledTimes(62);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('survives game-state replacement and replaces an existing owner before a new match', () => {
    const firstTick = vi.fn();
    const secondTick = vi.fn();
    setGame({ id: 'first' });
    startGameTimer(firstTick);
    const firstStartTime = state.startTime;
    const firstTimer = state.timerInt;

    vi.advanceTimersByTime(10_000);
    setGame({ id: 'server-replacement' });

    expect(state.startTime).toBe(firstStartTime);
    expect(state.timerInt).toBe(firstTimer);
    expect(readGameElapsedSeconds()).toBe(10);
    expect(vi.getTimerCount()).toBe(1);

    startGameTimer(secondTick);

    expect(state.startTime).toBe(Date.now());
    expect(state.timerInt).not.toBe(firstTimer);
    expect(firstTick).toHaveBeenCalledTimes(11);
    expect(secondTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1_000);
    expect(firstTick).toHaveBeenCalledTimes(11);
    expect(secondTick).toHaveBeenCalledTimes(2);
  });

  it('stops idempotently, preserves the terminal time, and resets on clear/unmount', () => {
    const onTick = vi.fn();
    startGameTimer(onTick);
    vi.advanceTimersByTime(7_000);
    const startedAt = state.startTime;

    stopGameTimer();
    stopGameTimer();

    expect(state.timerInt).toBeNull();
    expect(state.startTime).toBe(startedAt);
    expect(readGameElapsedSeconds()).toBe(7);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(onTick).toHaveBeenCalledTimes(8);

    resetGameTimer();
    expect(state.startTime).toBeNull();
    expect(readGameElapsedSeconds()).toBe(0);

    startGameTimer(onTick);
    clearGame();
    expect(state.startTime).toBeNull();
    expect(state.timerInt).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('multiplayer timer lifecycle seam', () => {
  beforeEach(() => {
    installDom();
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket;
    globalThis.location = {
      hostname: 'localhost',
      protocol: 'http:',
      reload: vi.fn(),
      search: '',
    };
    globalThis.localStorage = {
      getItem: vi.fn(() => null),
    };
    globalThis.window = {
      location: globalThis.location,
      innerWidth: 1672,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.WebSocket;
  });

  it('starts the root owner once and does not restart it for server-state replacement', async () => {
    const { client, gameState, timerLifecycle } = createHarness();

    await client.startMultiplayerGame(multiplayerState(), true, 'p1');

    expect(timerLifecycle.start).toHaveBeenCalledTimes(1);
    expect(gameState.G).not.toHaveProperty('startTime');
    expect(gameState.G).not.toHaveProperty('timerInt');

    await client.processUpdate(multiplayerState({ turn: 2 }), [], null);
    await client.processUpdate(multiplayerState({ turn: 3 }), [], null);

    expect(timerLifecycle.start).toHaveBeenCalledTimes(1);
    expect(gameState.G).not.toHaveProperty('startTime');
    expect(gameState.G).not.toHaveProperty('timerInt');
  });

  it('stops on result, opponent departure, and unexpected disconnect', async () => {
    const { client, modalActions, timerLifecycle } = createHarness();

    await client.startMultiplayerGame(multiplayerState(), true, 'p1');
    client.showGameOver(true);

    expect(timerLifecycle.stop).toHaveBeenCalledTimes(1);
    modalActions[0].action();
    expect(timerLifecycle.clear).toHaveBeenCalledTimes(1);
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    timerLifecycle.stop.mockClear();
    client.handleServerMessage({ type: 'opponentLeft' });
    expect(timerLifecycle.stop).toHaveBeenCalledTimes(1);

    timerLifecycle.stop.mockClear();
    await client.connectWebSocket();
    client.getWs().close();
    expect(timerLifecycle.stop).toHaveBeenCalledTimes(1);
  });

  it('clears on Back and mode change without accumulating open sockets', async () => {
    const { client, timerLifecycle } = createHarness();

    await client.connectWebSocket();
    expect(FakeWebSocket.instances.filter((socket) => socket.readyState === FakeWebSocket.OPEN)).toHaveLength(1);

    client.backToModeSelect();

    expect(timerLifecycle.clear).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.filter((socket) => socket.readyState === FakeWebSocket.OPEN)).toHaveLength(0);

    await client.connectWebSocket();
    expect(FakeWebSocket.instances.filter((socket) => socket.readyState === FakeWebSocket.OPEN)).toHaveLength(1);

    client.selectMode('solo');
    expect(timerLifecycle.clear).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances.filter((socket) => socket.readyState === FakeWebSocket.OPEN)).toHaveLength(0);
  });
});
