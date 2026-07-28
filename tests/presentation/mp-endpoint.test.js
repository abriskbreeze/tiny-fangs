import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMpClient } from '../../src/mp-client.js';

const DEFAULT_ENDPOINT =
  'wss://obituaries-comedy-blake-having.trycloudflare.com';

function installBrowserStubs({ search = '', storedEndpoint = null } = {}) {
  const openedUrls = [];

  class FakeWebSocket {
    static OPEN = 1;

    constructor(url) {
      this.url = String(url);
      this.readyState = FakeWebSocket.OPEN;
      openedUrls.push(this.url);
      queueMicrotask(() => this.onopen?.());
    }

    close() {
      this.readyState = 3;
      this.onclose?.();
    }

    send() {}
  }

  vi.stubGlobal('location', { search });
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) =>
      key === 'tinyFangsWs' ? storedEndpoint : null,
    ),
  });
  vi.stubGlobal('WebSocket', FakeWebSocket);

  return openedUrls;
}

function createClient() {
  return createMpClient({
    state: {},
    Anim: {},
    log: vi.fn(),
    render: vi.fn(),
    renderLog: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn(),
    playServerEvents: vi.fn(),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('multiplayer endpoint precedence', () => {
  it('uses the ws query parameter ahead of local storage', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const queryEndpoint = 'ws://127.0.0.1:3101';
    const openedUrls = installBrowserStubs({
      search: `?presentation=aaa&ws=${encodeURIComponent(queryEndpoint)}`,
      storedEndpoint: 'ws://127.0.0.1:3999',
    });

    await createClient().connectWebSocket();

    expect(openedUrls).toEqual([queryEndpoint]);
  });

  it('falls back to localStorage.tinyFangsWs when ws is absent', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const storedEndpoint = 'ws://127.0.0.1:3201';
    const openedUrls = installBrowserStubs({ storedEndpoint });

    await createClient().connectWebSocket();

    expect(openedUrls).toEqual([storedEndpoint]);
  });

  it('uses the production default when neither override exists', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const openedUrls = installBrowserStubs();

    await createClient().connectWebSocket();

    expect(openedUrls).toEqual([DEFAULT_ENDPOINT]);
  });
});
