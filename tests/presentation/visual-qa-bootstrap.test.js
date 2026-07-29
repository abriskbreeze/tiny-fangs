import { describe, expect, it, vi } from 'vitest';
import {
  VISUAL_QA_GLOBAL,
  installVisualQaContract,
  isVisualQaEnabled,
} from '../../src/presentation/testing/visual-qa-bootstrap.js';

describe('visual QA bootstrap contract', () => {
  it('only enables for the exact visualQa=1 query value', () => {
    expect(isVisualQaEnabled('?visualQa=1&presentation=aaa')).toBe(true);
    expect(isVisualQaEnabled('?presentation=aaa&visualQa=0')).toBe(false);
    expect(isVisualQaEnabled('?visualQa=true')).toBe(false);
    expect(isVisualQaEnabled('')).toBe(false);
  });

  it('does not publish test globals when QA mode is disabled', () => {
    const target = {};
    const setGame = vi.fn();

    expect(installVisualQaContract({
      target,
      search: '?presentation=aaa&fixture=opening-empty-board',
      activation: { setGame },
    })).toBeNull();
    expect(target).toEqual({});
    expect(setGame).not.toHaveBeenCalled();
  });

  it('exposes fixture names and the readiness lifecycle without exposing state', async () => {
    const target = {};
    const nextFrame = vi.fn(() => Promise.resolve());
    const contract = installVisualQaContract({
      target,
      search: '?ws=wss%3A%2F%2Fexample.test&visualQa=1',
      fonts: { ready: Promise.resolve() },
      nextFrame,
    });

    expect(VISUAL_QA_GLOBAL).toBe('__TINY_FANGS_VISUAL_QA__');
    expect(target.__TINY_FANGS_VISUAL_QA__).toBe(contract);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
    expect(contract.fixtureNames).toContain('opening-empty-board');
    expect(contract.fixtureNames).toContain('multiplayer-hidden');
    expect(contract.fixtureNames).not.toContainEqual(expect.objectContaining({ G: expect.anything() }));
    expect(contract.currentFixture).toBeNull();
    expect(contract.activateFixture).toEqual(expect.any(Function));
    expect(contract).not.toHaveProperty('fixtures');
    expect(contract).not.toHaveProperty('state');

    await expect(contract.ready).resolves.toBe(true);
    expect(nextFrame).toHaveBeenCalledTimes(2);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(true);
  });

  it('auto-activates a registered query fixture through the injected runtime seam', async () => {
    const target = {};
    const state = { G: null };
    const calls = [];
    const contract = installVisualQaContract({
      target,
      search: '?visualQa=1&fixture=multiplayer-hidden',
      fonts: { ready: Promise.resolve() },
      nextFrame: () => Promise.resolve(),
      activation: {
        clearGame() {
          calls.push('clear');
          state.G = null;
        },
        setGame(game) {
          calls.push('set');
          state.G = game;
        },
        showGameRoute() {
          calls.push('route');
        },
        render() {
          calls.push('render');
        },
      },
    });

    await expect(contract.ready).resolves.toBe(true);

    expect(calls).toEqual(['clear', 'set', 'route', 'render']);
    expect(state.G.isVisualFixture).toBe(true);
    expect(contract.currentFixture.name).toBe('multiplayer-hidden');
    expect(Object.keys(contract.currentFixture).sort()).toEqual(['name', 'stableHashInput']);
    expect(JSON.stringify(target.__TINY_FANGS_VISUAL_QA__)).not.toContain('"players"');
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(true);
  });

  it('fails an invalid query fixture safely without replacing current state', async () => {
    const target = {};
    const initialGame = { sentinel: true };
    const state = { G: initialGame };
    const setGame = vi.fn((game) => {
      state.G = game;
    });
    const contract = installVisualQaContract({
      target,
      search: '?visualQa=1&fixture=not-registered',
      fonts: { ready: Promise.resolve() },
      nextFrame: () => Promise.resolve(),
      activation: {
        clearGame: vi.fn(),
        setGame,
        showGameRoute: vi.fn(),
        render: vi.fn(),
      },
    });

    await expect(contract.ready).resolves.toBe(false);

    expect(state.G).toBe(initialGame);
    expect(setGame).not.toHaveBeenCalled();
    expect(contract.currentFixture).toBeNull();
    expect(contract.activationError).toBe(
      'Unknown visual fixture: not-registered',
    );
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
  });
});
