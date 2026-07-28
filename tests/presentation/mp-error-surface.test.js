import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMpClient } from '../../src/mp-client.js';

function installBrowserStubs() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        className: '',
        disabled: false,
        id,
        style: {},
        textContent: '',
        value: '',
      });
    }
    return elements.get(id);
  };

  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
  });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    getElementById: vi.fn((id) => element(id)),
    querySelector: vi.fn(() => element('mp-buttons')),
  });

  return { element };
}

function createHarness() {
  const { element } = installBrowserStubs();
  const deps = {
    Anim: {},
    closeModal: vi.fn(),
    highlightEndTurn: vi.fn(),
    log: vi.fn(),
    playServerEvents: vi.fn(),
    render: vi.fn(),
    renderLog: vi.fn(),
    showModal: vi.fn(),
    state: { G: null },
  };

  return {
    client: createMpClient(deps),
    deps,
    element,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('multiplayer error surfaces', () => {
  it('shows exact server errors in lobby status', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, deps, element } = createHarness();

    client.handleServerMessage({
      type: 'error',
      message: 'Player not found',
    });

    expect(element('mp-status').textContent).toBe(
      'Error: Player not found',
    );
    expect(deps.log).not.toHaveBeenCalled();
  });

  it('logs exact server errors without opening a blocking in-game modal', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, deps, element } = createHarness();
    deps.state.G = {
      isMultiplayer: true,
    };

    client.handleServerMessage({
      type: 'error',
      message: 'Not your turn',
    });

    expect(deps.log).toHaveBeenCalledOnce();
    expect(deps.log).toHaveBeenCalledWith(
      'Error: Not your turn',
      'dmg',
    );
    expect(deps.showModal).not.toHaveBeenCalled();
    expect(element('mp-status').textContent).toBe('');
  });
});
