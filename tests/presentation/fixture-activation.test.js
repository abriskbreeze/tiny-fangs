import { describe, expect, it, vi } from 'vitest';
import {
  createVisualFixture,
  listVisualFixtureNames,
} from '../../src/presentation/testing/fixture-registry.js';
import {
  createFixtureActivationController,
} from '../../src/presentation/testing/fixture-activation.js';
import { toStableHashInput } from '../../src/presentation/testing/stable-serialization.js';

function activationHarness({ enabled = true, initialGame = { sentinel: true } } = {}) {
  const calls = [];
  const state = { G: initialGame };
  const readiness = {
    reset: vi.fn((reason) => calls.push(`reset:${reason}`)),
    waitUntilReady: vi.fn(async () => {
      calls.push('ready');
      return true;
    }),
  };
  const loadFixture = vi.fn(async (name) => createVisualFixture(name));
  const clearGame = vi.fn(() => {
    calls.push('clear');
    state.G = null;
  });
  const setGame = vi.fn((game) => {
    calls.push('set');
    state.G = game;
  });
  const showGameRoute = vi.fn(() => calls.push('route'));
  const render = vi.fn(() => calls.push('render'));
  const controller = createFixtureActivationController({
    enabled,
    readiness,
    loadFixture,
    clearGame,
    setGame,
    showGameRoute,
    render,
  });

  return {
    calls,
    clearGame,
    controller,
    loadFixture,
    readiness,
    render,
    setGame,
    showGameRoute,
    state,
  };
}

describe('visual fixture activation controller', () => {
  it('activates through the existing clear/set/route/render path before readiness', async () => {
    const harness = activationHarness();

    const result = await harness.controller.activateFixture('dense-board-statuses');

    expect(result.ready).toBe(true);
    expect(result.fixture).toEqual(harness.controller.currentFixture());
    expect(Object.keys(result.fixture).sort()).toEqual(['name', 'stableHashInput']);
    expect(result.fixture.name).toBe('dense-board-statuses');
    expect(harness.state.G.isVisualFixture).toBe(true);
    expect(harness.calls).toEqual([
      'reset:fixture',
      'clear',
      'set',
      'reset:route',
      'route',
      'render',
      'ready',
    ]);
  });

  it.each(listVisualFixtureNames())(
    'activates registered fixture %s through the real route seam',
    async (name) => {
      const harness = activationHarness();

      const result = await harness.controller.activateFixture(name);

      expect(result.ready).toBe(true);
      expect(result.fixture.name).toBe(name);
      expect(harness.state.G.isVisualFixture).toBe(true);
      expect(harness.showGameRoute).toHaveBeenCalledOnce();
      expect(harness.render).toHaveBeenCalledOnce();
    },
  );

  it('never exposes opponent private fixture state through current metadata', async () => {
    const harness = activationHarness();
    const fixture = createVisualFixture('multiplayer-hidden');
    const secretSet = fixture.G.players[1].setVerse;

    await harness.controller.activateFixture('multiplayer-hidden');
    const metadata = harness.controller.currentFixture();

    expect(metadata.stableHashInput).toContain('"faceDown":true');
    expect(metadata.stableHashInput).not.toContain(secretSet.id);
    expect(metadata.stableHashInput).not.toContain(secretSet.uid);
    expect(metadata.stableHashInput).not.toContain(secretSet.name);
  });

  it.each([
    'optional-trigger-pending',
    'skitter-response-pending',
  ])('keeps %s owner-only response context out of public metadata', async (name) => {
    const harness = activationHarness();
    const fixture = createVisualFixture(name);
    const opponentPrivateUids = [
      ...fixture.G.players[1].deck,
      ...fixture.G.players[1].hand,
      ...(fixture.G.players[1].setVerse
        ? [fixture.G.players[1].setVerse]
        : []),
    ].map((card) => card.uid);

    await harness.controller.activateFixture(name);
    const { stableHashInput } = harness.controller.currentFixture();

    expect(stableHashInput).toContain('"ownerOnly":true');
    expect(stableHashInput).not.toContain('"pendingAction"');
    expect(stableHashInput).not.toContain('"benchOptions"');
    if (fixture.presentation.response.pendingAction.prompt) {
      expect(stableHashInput).not.toContain(
        JSON.stringify(fixture.presentation.response.pendingAction.prompt),
      );
    }
    opponentPrivateUids.forEach((uid) => {
      expect(stableHashInput).not.toContain(uid);
    });
  });

  it('leaves the current game and readiness untouched for an invalid name', async () => {
    const initialGame = { sentinel: true };
    const harness = activationHarness({ initialGame });

    await expect(harness.controller.activateFixture('not-registered')).rejects.toThrow(
      'Unknown visual fixture: not-registered',
    );

    expect(harness.state.G).toBe(initialGame);
    expect(harness.clearGame).not.toHaveBeenCalled();
    expect(harness.setGame).not.toHaveBeenCalled();
    expect(harness.readiness.reset).not.toHaveBeenCalled();
    expect(harness.render).not.toHaveBeenCalled();
    expect(harness.controller.currentFixture()).toBeNull();
  });

  it('cannot load or activate fixtures when QA mode is disabled', async () => {
    const harness = activationHarness({ enabled: false });

    await expect(harness.controller.activateFixture('opening-empty-board')).rejects.toThrow(
      'Visual fixture activation requires visualQa=1',
    );

    expect(harness.loadFixture).not.toHaveBeenCalled();
    expect(harness.state.G).toEqual({ sentinel: true });
  });

  it('is deterministic and idempotent across repeated activation', async () => {
    const harness = activationHarness();

    const first = await harness.controller.activateFixture('target-selection');
    const firstState = toStableHashInput(harness.state.G);
    const firstObject = harness.state.G;
    const second = await harness.controller.activateFixture('target-selection');
    const secondState = toStableHashInput(harness.state.G);

    expect(second.fixture).toEqual(first.fixture);
    expect(secondState).toBe(firstState);
    expect(harness.state.G).not.toBe(firstObject);
    expect(harness.setGame).toHaveBeenCalledTimes(2);
    expect(harness.render).toHaveBeenCalledTimes(2);
  });

  it('validates all dependencies before mutating game state', async () => {
    const fixture = createVisualFixture('opening-empty-board');
    const controller = createFixtureActivationController({
      enabled: true,
      loadFixture: async () => fixture,
      readiness: {
        reset() {},
        waitUntilReady: async () => true,
      },
    });

    await expect(controller.activateFixture(fixture.name)).rejects.toThrow(
      'Visual fixture activation is not connected to the client runtime',
    );
  });
});
